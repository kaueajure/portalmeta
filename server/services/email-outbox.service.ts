import pool from '../db/connection.js';
import { buildTicketEmailTemplate, TicketEmailParams } from '../utils/mailer.js';
import { emailOutboundService, TicketOutboundParams, trackTicketEmailMessageIds } from './email-outbound.service.js';
import { maskEmail, maskIdentifier } from '../utils/sanitize.js';

const MAX_ATTEMPTS = 5;
const BACKOFF_MINUTES = [5, 15, 30, 60];
const LOCK_NAME = 'gestifique:email_outbox_processor';

export interface EmailOutboxEnqueueParams extends TicketOutboundParams {
  dedupeKey?: string;
}

export interface EmailOutboxScope {
  isDev: boolean;
  empresaId?: number | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function serializePayload(params: TicketOutboundParams) {
  return JSON.stringify(params);
}

function getNextAttemptSql(attempts: number): string {
  const minutes = BACKOFF_MINUTES[Math.min(Math.max(attempts - 1, 0), BACKOFF_MINUTES.length - 1)];
  return `DATE_ADD(NOW(), INTERVAL ${minutes} MINUTE)`;
}

export function validateTicketEmailOutboxParams(params: EmailOutboxEnqueueParams): { ok: true; dedupeKey: string } | { ok: false; error: string } {
  if (!params || typeof params !== 'object') return { ok: false, error: 'Payload de e-mail ausente.' };
  if (!Number.isInteger(Number(params.empresaId)) || Number(params.empresaId) <= 0) return { ok: false, error: 'Empresa invalida para e-mail.' };
  if (!Number.isInteger(Number(params.ticketId)) || Number(params.ticketId) <= 0) return { ok: false, error: 'Chamado invalido para e-mail.' };
  if (!params.type) return { ok: false, error: 'Tipo de e-mail ausente.' };
  if (!params.title) return { ok: false, error: 'Assunto/base do e-mail ausente.' };
  if (!EMAIL_RE.test(String(params.to || '').trim())) return { ok: false, error: 'Destinatario de e-mail invalido.' };

  const dedupeKey = String(params.dedupeKey || params.messageId || '').trim();
  if (!dedupeKey) return { ok: false, error: 'Chave de deduplicacao ausente para e-mail de chamado.' };

  return { ok: true, dedupeKey };
}

export function normalizeOutboxProcessLimit(value: unknown, fallback = 20): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 50);
}

export function buildEmailOutboxScopeCondition(scope?: EmailOutboxScope, alias = 'email_outbox'): { sql: string; params: any[] } {
  if (scope?.isDev) return { sql: '', params: [] };

  const empresaId = Number(scope?.empresaId);
  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    return { sql: ' AND 1 = 0', params: [] };
  }

  return { sql: ` AND ${alias}.empresa_id = ?`, params: [empresaId] };
}

class EmailOutboxService {
  async enqueueTicketEmail(params: EmailOutboxEnqueueParams): Promise<number | null> {
    const validation = validateTicketEmailOutboxParams(params);
    if (validation.ok !== true) {
      console.error(`[EmailOutbox] Payload recusado: ${validation.error}`);
      throw new Error(validation.error);
    }

    const template = buildTicketEmailTemplate(params as TicketEmailParams);
    const dedupeKey = validation.dedupeKey;

    const [result]: any = await pool.query(
      `
        INSERT INTO email_outbox (
          empresa_id, ticket_id, tipo, destinatario, assunto, payload_json, dedupe_key, status, next_attempt_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente', NOW())
        ON DUPLICATE KEY UPDATE
          id = LAST_INSERT_ID(id),
          updated_at = updated_at
      `,
      [
        params.empresaId,
        params.ticketId,
        params.type,
        params.to,
        template.subject,
        serializePayload(params),
        dedupeKey
      ]
    );

    if (result.affectedRows === 1) {
      console.log(`[EmailOutbox] E-mail enfileirado para ${maskEmail(params.to)} ticket #${params.ticketId} (${params.type}, dedupe=${maskIdentifier(dedupeKey || '')}).`);
    } else {
      console.log(`[EmailOutbox] E-mail ja estava enfileirado para ticket #${params.ticketId} (${params.type}, dedupe=${maskIdentifier(dedupeKey || '')}).`);
    }

    return result.insertId || null;
  }

  async processPending(limit = 20): Promise<{ processed: number; sent: number; failed: number }> {
    const safeLimit = normalizeOutboxProcessLimit(limit);
    const connection = await pool.getConnection();
    let hasLock = false;

    try {
      const [lockRows]: any = await connection.query('SELECT GET_LOCK(?, 1) AS locked', [LOCK_NAME]);
      hasLock = Number(lockRows?.[0]?.locked) === 1;
      if (!hasLock) {
        console.log('[EmailOutbox] Outro processador esta executando. Ciclo ignorado.');
        return { processed: 0, sent: 0, failed: 0 };
      }

      await connection.query(
        `
          UPDATE email_outbox
          SET status = 'erro',
              ultimo_erro = COALESCE(ultimo_erro, 'Processamento interrompido antes da conclusao.'),
              next_attempt_at = NOW(),
              updated_at = NOW()
          WHERE status = 'processando'
            AND locked_at < (NOW() - INTERVAL 10 MINUTE)
            AND sent_at IS NULL
        `
      );

      await connection.beginTransaction();
      const [claimResult]: any = await connection.query(
        `
          UPDATE email_outbox
          SET status = 'processando',
              locked_at = NOW(),
              tentativas = tentativas + 1,
              updated_at = NOW()
          WHERE status IN ('pendente', 'erro')
            AND tentativas < ?
            AND next_attempt_at <= NOW()
          ORDER BY next_attempt_at ASC, id ASC
          LIMIT ${safeLimit}
        `,
        [MAX_ATTEMPTS]
      );

      const [rows]: any = await connection.query(
        `
          SELECT *
          FROM email_outbox
          WHERE status = 'processando'
            AND locked_at >= (NOW() - INTERVAL 2 MINUTE)
          ORDER BY locked_at ASC, id ASC
          LIMIT ${safeLimit}
        `
      );
      await connection.commit();

      if (claimResult.affectedRows === 0 || rows.length === 0) {
        return { processed: 0, sent: 0, failed: 0 };
      }

      let sent = 0;
      let failed = 0;

      for (const row of rows) {
        try {
          const payload = typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : row.payload_json;
          const sendResult = await emailOutboundService.sendTicketEmail(payload);

          if (sendResult.success) {
            await pool.query(
              `
                UPDATE email_outbox
                SET status = 'enviado',
                    ultimo_erro = NULL,
                    sent_at = NOW(),
                    updated_at = NOW()
                WHERE id = ?
              `,
              [row.id]
            );

            if (payload.messageId) {
              await trackTicketEmailMessageIds(payload.empresaId, payload.ticketId, payload.messageId, sendResult);
            }

            sent++;
            console.log(`[EmailOutbox] E-mail #${row.id} enviado para ${maskEmail(row.destinatario)} ticket #${row.ticket_id}.`);
          } else {
            failed++;
            await this.markFailed(row.id, row.tentativas, sendResult.error || 'Falha desconhecida no envio');
          }
        } catch (err: any) {
          failed++;
          await this.markFailed(row.id, row.tentativas, err?.message || 'Erro inesperado ao processar outbox');
        }
      }

      return { processed: rows.length, sent, failed };
    } catch (err) {
      try {
        await connection.rollback();
      } catch {}
      console.error('[EmailOutbox] Falha no processamento da outbox:', err);
      throw err;
    } finally {
      if (hasLock) {
        try {
          await connection.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME]);
        } catch {}
      }
      connection.release();
    }
  }

  async getSummary(scope?: EmailOutboxScope) {
    const scopeCondition = buildEmailOutboxScopeCondition(scope);
    const [countsRows]: any = await pool.query(`
      SELECT status, COUNT(*) as total
      FROM email_outbox
      WHERE 1 = 1
        ${scopeCondition.sql}
      GROUP BY status
    `, scopeCondition.params);

    const counts = {
      pendente: 0,
      processando: 0,
      enviado: 0,
      erro: 0,
    };

    for (const row of countsRows) {
      if (row.status in counts) {
        counts[row.status as keyof typeof counts] = Number(row.total || 0);
      }
    }

    return {
      ...counts,
      lastErrors: await this.getErrors(20, scope),
    };
  }

  async getErrors(limit = 20, scope?: EmailOutboxScope) {
    const safeLimit = normalizeOutboxProcessLimit(limit);
    const scopeCondition = buildEmailOutboxScopeCondition(scope);
    const [rows]: any = await pool.query(
      `
        SELECT id, empresa_id, ticket_id, tipo, destinatario, status, tentativas,
               ultimo_erro, next_attempt_at, created_at, updated_at
        FROM email_outbox
        WHERE status = 'erro'
          ${scopeCondition.sql}
        ORDER BY updated_at DESC, id DESC
        LIMIT ${safeLimit}
      `,
      scopeCondition.params
    );

    return rows.map((row: any) => ({
      ...row,
      destinatario: maskEmail(row.destinatario),
    }));
  }

  async retryById(id: number, scope?: EmailOutboxScope): Promise<boolean> {
    const scopeCondition = buildEmailOutboxScopeCondition(scope);
    const [result]: any = await pool.query(
      `
        UPDATE email_outbox
        SET status = 'pendente',
            next_attempt_at = NOW(),
            locked_at = NULL,
            updated_at = NOW()
        WHERE id = ?
          AND status = 'erro'
          AND sent_at IS NULL
          ${scopeCondition.sql}
      `,
      [id, ...scopeCondition.params]
    );

    return result.affectedRows > 0;
  }

  async retryRecentErrors(limit = 20, scope?: EmailOutboxScope): Promise<number> {
    const safeLimit = normalizeOutboxProcessLimit(limit);
    const scopeCondition = buildEmailOutboxScopeCondition(scope);
    const [rows]: any = await pool.query(
      `
        SELECT id
        FROM email_outbox
        WHERE status = 'erro'
          AND sent_at IS NULL
          ${scopeCondition.sql}
        ORDER BY updated_at DESC, id DESC
        LIMIT ${safeLimit}
      `,
      scopeCondition.params
    );

    let retried = 0;
    for (const row of rows) {
      if (await this.retryById(Number(row.id), scope)) retried++;
    }

    return retried;
  }

  private async markFailed(id: number, attempts: number, error: string) {
    const finalError = attempts >= MAX_ATTEMPTS;
    const nextAttemptSql = finalError ? 'NULL' : getNextAttemptSql(attempts);

    await pool.query(
      `
        UPDATE email_outbox
        SET status = 'erro',
            ultimo_erro = ?,
            next_attempt_at = COALESCE(${nextAttemptSql}, next_attempt_at),
            updated_at = NOW()
        WHERE id = ?
      `,
      [String(error).slice(0, 4000), id]
    );

    console.error(`[EmailOutbox] E-mail #${id} falhou na tentativa ${attempts}/${MAX_ATTEMPTS}: ${error}`);
  }
}

export const emailOutboxService = new EmailOutboxService();
