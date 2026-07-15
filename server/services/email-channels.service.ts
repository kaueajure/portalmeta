import crypto from 'crypto';
import pool from '../db/connection.js';
import { env } from '../config/env.js';
import { encryptSecret } from '../utils/crypto.js';
import { maskEmail } from '../utils/sanitize.js';

// Colunas seguras para exposição (NUNCA inclui smtp_pass_enc).
const PUBLIC_CHANNEL_COLUMNS = `
  id, empresa_id, nome, email_publico, inbound_address, verification_token, status,
  ultimo_erro, last_received_at, verified_at, created_at, updated_at,
  smtp_enabled, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_from_name,
  smtp_status, smtp_last_test_at, smtp_last_error
`;

function normalizePublicEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

export class EmailChannelsService {
  async listByCompany(empresaId: number) {
    const [rows]: any = await pool.query(
      `SELECT ${PUBLIC_CHANNEL_COLUMNS} FROM empresa_email_canais WHERE empresa_id = ? ORDER BY created_at DESC`,
      [empresaId]
    );
    return rows;
  }

  async getByIdAndCompany(channelId: number, empresaId: number) {
    const [rows]: any = await pool.query(
      'SELECT * FROM empresa_email_canais WHERE id = ? AND empresa_id = ? LIMIT 1',
      [channelId, empresaId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async createChannel(data: { empresa_id: number; nome?: string; email_publico: string }) {
    const { empresa_id, nome, email_publico } = data;
    const normalizedEmailPublico = normalizePublicEmail(email_publico);

    if (!normalizedEmailPublico) {
      throw new Error('E-mail publico do canal e obrigatorio.');
    }

    const [duplicateRows]: any = await pool.query(
      'SELECT id, empresa_id FROM empresa_email_canais WHERE LOWER(TRIM(email_publico)) = ? LIMIT 1',
      [normalizedEmailPublico]
    );
    if (duplicateRows.length > 0) {
      throw new Error('Este e-mail publico ja esta vinculado a outro canal.');
    }

    const randomHex = crypto.randomBytes(4).toString('hex');
    const inbound_address =
      `${env.INBOUND_EMAIL_PREFIX}-${empresa_id}-${randomHex}@${env.INBOUND_EMAIL_DOMAIN}`.toLowerCase();
    const verification_token = crypto.randomBytes(16).toString('hex');

    const [result]: any = await pool.query(
      'INSERT INTO empresa_email_canais (empresa_id, nome, email_publico, inbound_address, verification_token, status) VALUES (?, ?, ?, ?, ?, ?)',
      [empresa_id, nome || null, normalizedEmailPublico, inbound_address, verification_token, 'pendente']
    );

    await pool.query(
      'INSERT INTO logs_sistema (empresa_id, acao, descricao, user_agent, ip) VALUES (?, ?, ?, ?, ?)',
      [
        empresa_id,
        'EMAIL_CHANNEL_CREATED',
        `Canal de e-mail criado: ${maskEmail(inbound_address)} referenciando ${maskEmail(normalizedEmailPublico)}`,
        'SYSTEM',
        '127.0.0.1',
      ]
    );

    return result.insertId;
  }

  async getByInboundAddress(address: string) {
    const [rows]: any = await pool.query(
      'SELECT * FROM empresa_email_canais WHERE inbound_address = ? LIMIT 1',
      [address.toLowerCase()]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async markVerified(channelId: number) {
    await pool.query(
      'UPDATE empresa_email_canais SET status = ?, verified_at = NOW() WHERE id = ? AND status = ?',
      ['ativo', channelId, 'pendente']
    );

    await pool.query(
      'INSERT INTO logs_sistema (acao, descricao, user_agent, ip) VALUES (?, ?, ?, ?)',
      ['EMAIL_CHANNEL_VERIFIED', `Canal de e-mail ID ${channelId} verificado/ativado.`, 'SYSTEM_LISTENER', '127.0.0.1']
    );
  }

  async markError(channelId: number, errorMsg: string) {
    await pool.query(
      'UPDATE empresa_email_canais SET status = ?, ultimo_erro = ? WHERE id = ?',
      ['erro', errorMsg, channelId]
    );

    await pool.query(
      'INSERT INTO logs_sistema (acao, descricao, user_agent, ip) VALUES (?, ?, ?, ?)',
      ['EMAIL_CHANNEL_ERROR', `Erro no canal de e-mail ID ${channelId}: ${errorMsg}`, 'SYSTEM_LISTENER', '127.0.0.1']
    );
  }

  async touchReceived(channelId: number) {
    await pool.query(
      'UPDATE empresa_email_canais SET last_received_at = NOW(), ultimo_erro = NULL WHERE id = ?',
      [channelId]
    );

    await pool.query(
      'UPDATE empresa_email_canais SET status = ?, verified_at = NOW() WHERE id = ? AND (status = ? OR status = ?)',
      ['ativo', channelId, 'pendente', 'erro']
    );
  }

  async deleteChannel(id: number, empresaId: number) {
    await pool.query('DELETE FROM empresa_email_canais WHERE id = ? AND empresa_id = ?', [id, empresaId]);
  }

  async regenerate(id: number, empresaId: number) {
    const randomHex = crypto.randomBytes(4).toString('hex');
    const inbound_address =
      `${env.INBOUND_EMAIL_PREFIX}-${empresaId}-${randomHex}@${env.INBOUND_EMAIL_DOMAIN}`.toLowerCase();
    const verification_token = crypto.randomBytes(16).toString('hex');

    await pool.query(
      'UPDATE empresa_email_canais SET inbound_address = ?, verification_token = ?, status = ? WHERE id = ? AND empresa_id = ?',
      [inbound_address, verification_token, 'pendente', id, empresaId]
    );
  }

  /**
   * Atualiza a configuração de SMTP do canal. A senha (quando enviada) é
   * cifrada antes de gravar (smtp_pass_enc). Nunca grava/expõe senha em claro.
   */
  async updateSmtpConfig(
    channelId: number,
    empresaId: number,
    data: {
      smtp_enabled?: boolean;
      smtp_host?: string | null;
      smtp_port?: number | null;
      smtp_secure?: boolean;
      smtp_user?: string | null;
      smtp_from_name?: string | null;
      password?: string | null; // senha em claro recebida (opcional)
    }
  ) {
    const channel = await this.getByIdAndCompany(channelId, empresaId);
    if (!channel) {
      throw new Error('Canal não encontrado.');
    }

    const enabled = data.smtp_enabled ? 1 : 0;
    const hasNewPassword = typeof data.password === 'string' && data.password.length > 0;
    const willHavePassword = hasNewPassword || !!channel.smtp_pass_enc;

    if (enabled) {
      if (!data.smtp_host) throw new Error('Host SMTP é obrigatório.');
      if (!data.smtp_port || data.smtp_port <= 0) throw new Error('Porta SMTP inválida.');
      if (!data.smtp_user) throw new Error('Usuário SMTP é obrigatório.');
      if (!willHavePassword) throw new Error('Senha SMTP é obrigatória para ativar o envio pelo canal.');
    }

    const fields: string[] = [
      'smtp_enabled = ?',
      'smtp_host = ?',
      'smtp_port = ?',
      'smtp_secure = ?',
      'smtp_user = ?',
      'smtp_from_name = ?',
      'smtp_status = ?',
      'smtp_updated_at = NOW()',
      'smtp_last_error = NULL'
    ];
    const params: any[] = [
      enabled,
      data.smtp_host ?? null,
      data.smtp_port ?? null,
      data.smtp_secure ? 1 : 0,
      data.smtp_user ?? null,
      data.smtp_from_name ?? null,
      enabled ? 'configured' : 'not_configured'
    ];

    if (hasNewPassword) {
      // Cifra a senha (lança erro claro se ENCRYPTION_KEY não estiver definida).
      fields.push('smtp_pass_enc = ?');
      params.push(encryptSecret(data.password as string));
    }

    params.push(channelId, empresaId);

    await pool.query(
      `UPDATE empresa_email_canais SET ${fields.join(', ')} WHERE id = ? AND empresa_id = ?`,
      params
    );

    return this.getByIdAndCompany(channelId, empresaId);
  }

  /**
   * Atualiza apenas o status do SMTP do canal (verified/error) + último teste.
   */
  async setSmtpStatus(channelId: number, status: 'configured' | 'verified' | 'error', error?: string | null) {
    await pool.query(
      'UPDATE empresa_email_canais SET smtp_status = ?, smtp_last_error = ?, smtp_last_test_at = NOW() WHERE id = ?',
      [status, error ? String(error).slice(0, 1000) : null, channelId]
    );
  }

  /**
   * Indica se o canal tem SMTP próprio habilitado e configurado.
   */
  isChannelSmtpReady(channel: any): boolean {
    return !!(channel && Number(channel.smtp_enabled) === 1 && channel.smtp_host && channel.smtp_user && channel.smtp_pass_enc);
  }
}

export const emailChannelsService = new EmailChannelsService();
