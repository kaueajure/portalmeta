import { Router } from 'express';
import  { authMiddleware, AuthRequest } from  '../middlewares/auth.js';
import { permissionsService } from '../services/permissions.service.js';
import  { sendSuccess, sendError } from  '../utils/response.js';
import pool from '../db/connection.js';
import { isValidTicketStatusValue, normalizeTicketStatusSpecial, TICKET_STATUS_SPECIALS } from '../utils/ticket-status-config.js';
import { recomputeTicketMessageState } from '../utils/ticket-state.js';
import { normalizeServiceForm } from '../utils/service-form.js';

const router = Router();

router.use(authMiddleware);

const CATEGORY_SIGLA_MAX_LENGTH = 6;
const normalizeCategorySigla = (value: unknown) =>
  typeof value === 'string' ? value.trim().toUpperCase().slice(0, CATEGORY_SIGLA_MAX_LENGTH) : '';
const isSiglaTooLong = (value: unknown) =>
  typeof value === 'string' && value.trim().length > CATEGORY_SIGLA_MAX_LENGTH;
const slugifyOptionValue = (value: unknown) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// Settings: Ticket Categories
router.get('/categories', async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Não autenticado', 401);

    const [rows]: any = await pool.query('SELECT * FROM ticket_categories ORDER BY ordem ASC, id ASC');
    sendSuccess(res, rows);
  } catch(error: unknown) {
    sendError(res, 'Erro ao buscar categorias');
  }
});

router.post('/categories', async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Não autenticado', 401);
    const hasConfigPerm = await permissionsService.hasPermission(currentUser, 'configuracoes.atendimento');
    if (!hasConfigPerm) return sendError(res, 'Acesso negado', 403);

    let { nome, valor, ativo, ordem } = req.body;
    const normalizedNome = typeof nome === 'string' ? nome.trim() : '';
    const sigla = normalizeCategorySigla(req.body.sigla);
    const normalizedValor = slugifyOptionValue(valor || sigla || normalizedNome);
    if (!normalizedNome || !sigla) return sendError(res, 'Nome e sigla sao obrigatorios', 400);
    if (isSiglaTooLong(req.body.sigla)) return sendError(res, 'A sigla deve ter no maximo 6 caracteres', 400);
    if (!normalizedValor) return sendError(res, 'Valor da categoria invalido', 400);
    valor = normalizedValor;
    if (!nome || !valor) return sendError(res, 'Nome e valor são obrigatórios', 400);

    const [result]: any = await pool.query(
      'INSERT INTO ticket_categories (nome, sigla, valor, ativo, ordem) VALUES (?, ?, ?, ?, ?)',
      [normalizedNome, sigla, normalizedValor, ativo !== undefined ? ativo : 1, ordem || 0]
    );
    sendSuccess(res, { id: result.insertId });
  } catch(error: unknown) {
    sendError(res, 'Erro ao criar categoria. Tente usar um valor único.');
  }
});

router.patch('/categories/:catId', async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Não autenticado', 401);
    const catId = parseInt(req.params.catId);
    const hasConfigPerm = await permissionsService.hasPermission(currentUser, 'configuracoes.atendimento');
    if (!hasConfigPerm) return sendError(res, 'Acesso negado', 403);

    const { nome, valor, ativo, ordem, sigla } = req.body;
    let updates = [];
    let params = [];
    if (nome !== undefined) {
      const normalizedNome = typeof nome === 'string' ? nome.trim() : '';
      if (!normalizedNome) return sendError(res, 'Nome da categoria e obrigatorio', 400);
      updates.push('nome = ?');
      params.push(normalizedNome);
    }
    if (sigla !== undefined) {
      const normalizedSigla = normalizeCategorySigla(sigla);
      if (!normalizedSigla) return sendError(res, 'Sigla da categoria e obrigatoria', 400);
      if (isSiglaTooLong(sigla)) return sendError(res, 'A sigla deve ter no maximo 6 caracteres', 400);
      updates.push('sigla = ?');
      params.push(normalizedSigla);
    }
    if (valor !== undefined) {
      const normalizedValor = slugifyOptionValue(valor);
      if (!normalizedValor) return sendError(res, 'Valor da categoria invalido', 400);
      updates.push('valor = ?');
      params.push(normalizedValor);
    }
    if (ativo !== undefined) { updates.push('ativo = ?'); params.push(ativo); }
    if (ordem !== undefined) { updates.push('ordem = ?'); params.push(ordem); }

    if (updates.length > 0) {
      params.push(catId);
      await pool.query(`UPDATE ticket_categories SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    sendSuccess(res, null);
  } catch(error: unknown) {
    sendError(res, 'Erro ao atualizar categoria');
  }
});

router.delete('/categories/:catId', async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Não autenticado', 401);
    const catId = parseInt(req.params.catId);
    const hasConfigPerm = await permissionsService.hasPermission(currentUser, 'configuracoes.atendimento');
    if (!hasConfigPerm) return sendError(res, 'Acesso negado', 403);

    await pool.query('DELETE FROM ticket_categories WHERE id = ?', [catId]);
    sendSuccess(res, null);
  } catch(error: unknown) {
    sendError(res, 'Erro ao deletar categoria');
  }
});

// Settings: Ticket Services
router.get('/services', async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Não autenticado', 401);

    const [rows]: any = await pool.query('SELECT * FROM ticket_services ORDER BY ordem ASC, id ASC');
    sendSuccess(res, rows);
  } catch(error: unknown) {
    sendError(res, 'Erro ao buscar servicos');
  }
});

router.post('/services', async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Não autenticado', 401);
    const hasConfigPerm = await permissionsService.hasPermission(currentUser, 'configuracoes.atendimento');
    if (!hasConfigPerm) return sendError(res, 'Acesso negado', 403);

    const { nome, valor, ativo, ordem, formulario_json } = req.body;
    if (!nome || !valor) return sendError(res, 'Nome e valor são obrigatórios', 400);

    const [result]: any = await pool.query(
      'INSERT INTO ticket_services (nome, valor, ativo, ordem, formulario_json) VALUES (?, ?, ?, ?, ?)',
      [nome, valor, ativo !== undefined ? ativo : 1, ordem || 0, JSON.stringify(normalizeServiceForm(formulario_json))]
    );
    sendSuccess(res, { id: result.insertId });
  } catch(error: unknown) {
    sendError(res, 'Erro ao criar serviço. Tente usar um valor único.');
  }
});

router.patch('/services/:servId', async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Não autenticado', 401);
    const servId = parseInt(req.params.servId);
    const hasConfigPerm = await permissionsService.hasPermission(currentUser, 'configuracoes.atendimento');
    if (!hasConfigPerm) return sendError(res, 'Acesso negado', 403);

    const { nome, valor, ativo, ordem, formulario_json } = req.body;
    let updates = [];
    let params = [];
    if (nome !== undefined) { updates.push('nome = ?'); params.push(nome); }
    if (valor !== undefined) { updates.push('valor = ?'); params.push(valor); }
    if (ativo !== undefined) { updates.push('ativo = ?'); params.push(ativo); }
    if (ordem !== undefined) { updates.push('ordem = ?'); params.push(ordem); }
    if (formulario_json !== undefined) { updates.push('formulario_json = ?'); params.push(JSON.stringify(normalizeServiceForm(formulario_json))); }

    if (updates.length > 0) {
      params.push(servId);
      await pool.query(`UPDATE ticket_services SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    sendSuccess(res, null);
  } catch(error: unknown) {
    sendError(res, 'Erro ao atualizar serviço');
  }
});

router.delete('/services/:servId', async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Não autenticado', 401);
    const servId = parseInt(req.params.servId);
    const hasConfigPerm = await permissionsService.hasPermission(currentUser, 'configuracoes.atendimento');
    if (!hasConfigPerm) return sendError(res, 'Acesso negado', 403);

    await pool.query('DELETE FROM ticket_services WHERE id = ?', [servId]);
    sendSuccess(res, null);
  } catch(error: unknown) {
    sendError(res, 'Erro ao deletar serviço');
  }
});

// Settings: Ticket Status Workflow
router.get('/statuses', async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Não autenticado', 401);

    const [rows]: any = await pool.query(
      `SELECT id, nome, valor, ativo, kanban_visivel, cor, especial, ordem
       FROM ticket_statuses
       ORDER BY ordem ASC, id ASC`
    );
    sendSuccess(res, rows);
  } catch(error: unknown) {
    sendError(res, 'Erro ao buscar categorias de chamados');
  }
});

router.get('/statuses/usage', async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Não autenticado', 401);

    const [ticketRows]: any = await pool.query(
      `SELECT status, COUNT(*) AS total
       FROM tickets
       WHERE deleted_at IS NULL
       GROUP BY status`
    );

    const [automationRows]: any = await pool.query(
      `SELECT id, nome, condicoes_json, acoes_json
       FROM ticket_automacoes
       ORDER BY id`
    );

    const automationUsage: Record<string, number> = {};
    const addAutomationUse = (status: unknown) => {
      if (typeof status !== 'string' || !status) return;
      automationUsage[status] = (automationUsage[status] || 0) + 1;
    };
    const parseJsonArray = (value: any) => {
      if (Array.isArray(value)) return value;
      if (typeof value !== 'string') return [];
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    for (const automation of automationRows) {
      for (const condition of parseJsonArray(automation.condicoes_json)) {
        if (condition?.campo === 'status') addAutomationUse(condition.valor);
      }
      for (const action of parseJsonArray(automation.acoes_json)) {
        if (action?.tipo === 'alterar_status') addAutomationUse(action.valor);
        if (action?.tipo === 'fechar_com_motivo') addAutomationUse('fechado');
      }
    }

    sendSuccess(res, {
      tickets: Object.fromEntries(ticketRows.map((row: any) => [row.status, Number(row.total || 0)])),
      automations: automationUsage
    });
  } catch(error: unknown) {
    sendError(res, 'Erro ao buscar uso dos status');
  }
});

router.put('/statuses', async (req: AuthRequest, res) => {
  const connection = await pool.getConnection();
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Não autenticado', 401);
    const hasConfigPerm = await permissionsService.hasPermission(currentUser, 'configuracoes.atendimento');
    if (!hasConfigPerm) return sendError(res, 'Acesso negado', 403);

    const statuses = Array.isArray(req.body?.statuses) ? req.body.statuses : null;
    if (!statuses) return sendError(res, 'Lista de tipos inválida', 400);
    if (statuses.length > 40) return sendError(res, 'Máximo de 40 status de chamados', 400);

    const remapStatuses = req.body?.remap_statuses && typeof req.body.remap_statuses === 'object'
      ? req.body.remap_statuses
      : {};
    const seen = new Set<string>();
    const sanitized = statuses.map((status: any, index: number) => {
      const nome = typeof status.label === 'string'
        ? status.label.trim()
        : typeof status.nome === 'string'
          ? status.nome.trim()
          : '';
      const valor = typeof status.id === 'string'
        ? status.id.trim()
        : typeof status.valor === 'string'
          ? status.valor.trim()
          : '';
      const ativo = status.active === undefined
        ? Number(status.ativo ?? 1)
        : status.active ? 1 : 0;
      const kanbanVisivel = status.visible === undefined
        ? Number(status.kanban_visivel ?? ativo)
        : status.visible ? 1 : 0;
      const corRaw = typeof status.color === 'string'
        ? status.color.trim()
        : typeof status.cor === 'string'
          ? status.cor.trim()
          : '';
      const cor = /^#[0-9a-fA-F]{6}$/.test(corRaw) ? corRaw : '#0891b2';
      const especial = normalizeTicketStatusSpecial(status.special || status.especial);

      if (!nome || nome.length > 100) throw new Error('Nome de tipo inválido');
      if (!isValidTicketStatusValue(valor)) throw new Error(`Identificador de tipo inválido: ${valor}`);
      if (seen.has(valor)) throw new Error(`Tipo duplicado: ${valor}`);
      seen.add(valor);

      return { nome, valor, ativo, kanban_visivel: kanbanVisivel, cor, especial, ordem: index };
    });

    const activeStatuses = sanitized.filter((status) => status.ativo === 1);
    if (activeStatuses.length === 0) throw new Error('Mantenha ao menos um status ativo');
    if (!activeStatuses.some((status) => status.especial === 'inicial')) {
      throw new Error('Configure um status especial como status inicial');
    }
    if (activeStatuses.filter((status) => status.especial === 'inicial').length > 1) {
      throw new Error('Configure apenas um status inicial');
    }
    if (!activeStatuses.some((status) => status.especial === 'finalizado' || status.especial === 'encerrado')) {
      throw new Error('Configure ao menos um status finalizado ou encerrado');
    }
    for (const special of sanitized.map((status) => status.especial)) {
      if (!TICKET_STATUS_SPECIALS.includes(special)) throw new Error('Status especial inválido');
    }

    await connection.beginTransaction();
    const [oldRows]: any = await connection.query(
      'SELECT valor FROM ticket_statuses'
    );
    const oldStatusValues = oldRows.map((row: any) => row.valor);

    await connection.query('DELETE FROM ticket_statuses');

	    for (const status of sanitized) {
	      await connection.query(
	        `INSERT INTO ticket_statuses
	           (nome, valor, ativo, kanban_visivel, cor, especial, ordem)
	           VALUES (?, ?, ?, ?, ?, ?, ?)`,
	        [status.nome, status.valor, status.ativo, status.kanban_visivel, status.cor, status.especial, status.ordem]
	      );
	    }

	    let affectedTicketIds: number[] = [];
	    if (sanitized.length > 0) {
	      const configuredStatusValues = sanitized.map((status) => status.valor);
	      const fallbackStatus = activeStatuses.find((status) => status.especial === 'inicial')?.valor || activeStatuses[0].valor;
	      const placeholders = configuredStatusValues.map(() => '?').join(', ');

        for (const oldStatus of oldStatusValues) {
          const targetStatus = typeof remapStatuses[oldStatus] === 'string'
            ? remapStatuses[oldStatus]
            : null;
          if (!targetStatus || !configuredStatusValues.includes(targetStatus)) continue;
          if (configuredStatusValues.includes(oldStatus)) continue;

          const [explicitRows]: any = await connection.query(
            'SELECT id FROM tickets WHERE status = ?',
            [oldStatus]
          );
          affectedTicketIds.push(...explicitRows.map((r: any) => Number(r.id)));

          await connection.query(
            `UPDATE tickets
             SET status = ?, updated_at = NOW()
             WHERE status = ?`,
            [targetStatus, oldStatus]
          );
        }

	      // BUG 4 fix: captura os tickets que serão remapeados ANTES do update,
	      // para recomputar o estado materializado deles após o commit.
	      const [affectedRows]: any = await connection.query(
	        `SELECT id FROM tickets
	         WHERE status NOT IN (${placeholders})`,
	        configuredStatusValues
	      );
	      affectedTicketIds.push(...affectedRows.map((r: any) => Number(r.id)));

	      await connection.query(
	        `UPDATE tickets
	         SET status = ?, updated_at = NOW()
	         WHERE status NOT IN (${placeholders})`,
	        [fallbackStatus, ...configuredStatusValues]
	      );
	    }

	    await connection.commit();

	    // BUG 4 fix: recomputa o estado materializado dos tickets remapeados.
	    // Operação administrativa rara; o loop por IDs reusa a regra canônica única.
	    for (const remappedTicketId of Array.from(new Set(affectedTicketIds))) {
	      try {
	        await recomputeTicketMessageState(remappedTicketId);
	      } catch (stateErr) {
	        console.error('[TicketSettings] Falha ao recomputar estado materializado do ticket', remappedTicketId, stateErr);
	      }
	    }

    const [rows]: any = await pool.query(
      `SELECT id, nome, valor, ativo, kanban_visivel, cor, especial, ordem
       FROM ticket_statuses
       ORDER BY ordem ASC, id ASC`
    );
    sendSuccess(res, rows);
  } catch(error: unknown) {
    await connection.rollback();
    const message = error instanceof Error ? error.message : 'Erro ao salvar status de chamados';
    sendError(res, message, 400);
  } finally {
    connection.release();
  }
});

router.get('/sla-policies', async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Não autenticado', 401);

    const [rows] = await pool.query('SELECT * FROM sla_policies ORDER BY ordem ASC');
    sendSuccess(res, rows);
  } catch (error: unknown) {
    sendError(res, 'Erro ao buscar políticas de SLA');
  }
});

router.post('/sla-policies', async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Não autenticado', 401);
    const hasConfigPerm = await permissionsService.hasPermission(currentUser, 'configuracoes.atendimento');
    if (!hasConfigPerm) return sendError(res, 'Acesso negado', 403);

    const { nome, prioridade, categoria, servico, tempo_primeira_resposta_minutos, tempo_resolucao_minutos, ativo, ordem } = req.body;

    const [result]: any = await pool.query(
      'INSERT INTO sla_policies (nome, prioridade, categoria, servico, tempo_primeira_resposta_minutos, tempo_resolucao_minutos, ativo, ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [nome, prioridade || null, categoria || null, servico || null, tempo_primeira_resposta_minutos || null, tempo_resolucao_minutos || 24 * 60, ativo !== undefined ? ativo : 1, ordem || 0]
    );
    sendSuccess(res, { id: result.insertId });
  } catch (error: unknown) {
    sendError(res, 'Erro ao criar política de SLA');
  }
});

router.patch('/sla-policies/:policyId', async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Não autenticado', 401);
    const policyId = parseInt(req.params.policyId);
    const hasConfigPerm = await permissionsService.hasPermission(currentUser, 'configuracoes.atendimento');
    if (!hasConfigPerm) return sendError(res, 'Acesso negado', 403);

    const { nome, prioridade, categoria, servico, tempo_primeira_resposta_minutos, tempo_resolucao_minutos, ativo, ordem } = req.body;

    await pool.query(
      'UPDATE sla_policies SET nome = ?, prioridade = ?, categoria = ?, servico = ?, tempo_primeira_resposta_minutos = ?, tempo_resolucao_minutos = ?, ativo = ?, ordem = ? WHERE id = ?',
      [nome, prioridade || null, categoria || null, servico || null, tempo_primeira_resposta_minutos || null, tempo_resolucao_minutos || 24 * 60, ativo !== undefined ? ativo : 1, ordem || 0, policyId]
    );
    sendSuccess(res, { success: true });
  } catch (error: unknown) {
    sendError(res, 'Erro ao atualizar política de SLA');
  }
});

router.delete('/sla-policies/:policyId', async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Não autenticado', 401);
    const policyId = parseInt(req.params.policyId);
    const hasConfigPerm = await permissionsService.hasPermission(currentUser, 'configuracoes.atendimento');
    if (!hasConfigPerm) return sendError(res, 'Acesso negado', 403);

    await pool.query('DELETE FROM sla_policies WHERE id = ?', [policyId]);
    sendSuccess(res, { success: true });
  } catch (error: unknown) {
    sendError(res, 'Erro ao deletar política de SLA');
  }
});

export default router;
