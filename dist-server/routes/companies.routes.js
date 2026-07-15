import { Router } from 'express';
import companiesService from '../services/companies.service.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permissions.middleware.js';
import { permissionsService } from '../services/permissions.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logSystemAction } from '../utils/logger.js';
import { isValidEmail, isValidHexColor } from '../utils/validators.js';
import { isValidTicketStatusValue, normalizeTicketStatusSpecial, TICKET_STATUS_SPECIALS } from '../utils/ticket-status-config.js';
import { recomputeTicketMessageState } from '../utils/ticket-state.js';
import { isDeveloperUser } from '../utils/user-scope.js';
const router = Router();
router.use(authMiddleware);
// Listar e Criar empresas
router.get('/', requirePermission('empresas.visualizar'), async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Nao autenticado', 401);
        const { search, status } = req.query;
        const companies = await companiesService.list({
            search: search,
            status: status,
            empresaId: isDeveloperUser(currentUser) ? undefined : Number(currentUser.empresa_id)
        });
        sendSuccess(res, companies);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao listar empresas';
        sendError(res, message);
    }
});
router.post('/', requirePermission('empresas.criar'), async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const { nome, email, email_suporte, cor_principal } = req.body;
        if (!nome)
            return sendError(res, 'Nome é obrigatório', 400);
        if (email_suporte && !isValidEmail(email_suporte))
            return sendError(res, 'E-mail de suporte inválido', 400);
        if (email && !isValidEmail(email))
            return sendError(res, 'Email institucional inválido', 400);
        if (cor_principal && !isValidHexColor(cor_principal))
            return sendError(res, 'Cor principal inválida (formato #RRGGBB)', 400);
        const id = await companiesService.create(req.body);
        await logSystemAction(req, currentUser.id, null, 'COMPANY_CREATE', `Criou empresa: ${nome}`);
        sendSuccess(res, { id }, 'Empresa criada com sucesso', 201);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao criar empresa';
        sendError(res, message);
    }
});
// Update company
router.patch('/:id', async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const id = parseInt(req.params.id);
        const hasEditPerm = await permissionsService.hasPermission(currentUser, 'empresas.editar');
        if (!hasEditPerm) {
            return sendError(res, 'Acesso negado', 403);
        }
        if (!currentUser.desenvolvedor && currentUser.empresa_id !== id) {
            return sendError(res, 'Acesso negado: Você só pode atualizar a sua própria empresa.', 403);
        }
        const { email, email_suporte, cor_principal } = req.body;
        if (email_suporte !== undefined && email_suporte !== '') {
            if (!isValidEmail(email_suporte))
                return sendError(res, 'E-mail de suporte inválido', 400);
        }
        if (email && !isValidEmail(email))
            return sendError(res, 'Email institucional inválido', 400);
        if (cor_principal && !isValidHexColor(cor_principal))
            return sendError(res, 'Cor principal inválida (formato #RRGGBB)', 400);
        await companiesService.update(id, req.body);
        await logSystemAction(req, currentUser.id, id, 'COMPANY_UPDATE', `Atualizou informações da empresa ID: ${id}`);
        sendSuccess(res, null, 'Empresa atualizada com sucesso');
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao atualizar empresa';
        sendError(res, message);
    }
});
import pool from '../db/connection.js';
const CATEGORY_SIGLA_MAX_LENGTH = 6;
function normalizeCategorySigla(value) {
    return typeof value === 'string'
        ? value.trim().toUpperCase().slice(0, CATEGORY_SIGLA_MAX_LENGTH)
        : '';
}
function isSiglaTooLong(value) {
    return typeof value === 'string' && value.trim().length > CATEGORY_SIGLA_MAX_LENGTH;
}
function slugifyOptionValue(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}
router.patch('/:id/status', requirePermission('empresas.desativar'), async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const id = parseInt(req.params.id);
        if (!id || isNaN(id))
            return sendError(res, 'ID invalido', 400);
        if (!currentUser.desenvolvedor) {
            return sendError(res, 'Acesso negado: apenas desenvolvedores podem alterar status de empresas.', 403);
        }
        const { ativo } = req.body;
        if (typeof ativo !== 'boolean' && ativo !== 0 && ativo !== 1) {
            return sendError(res, 'Status invalido', 400);
        }
        const normalizedAtivo = Boolean(ativo);
        await companiesService.update(id, { ativo: normalizedAtivo ? 1 : 0 });
        await logSystemAction(req, currentUser.id, null, 'COMPANY_STATUS', `${normalizedAtivo ? 'Ativou' : 'Desativou'} empresa ID ${id}`);
        sendSuccess(res, null, `Empresa ${normalizedAtivo ? 'ativada' : 'desativada'} com sucesso`);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao alterar status da empresa';
        sendError(res, message);
    }
});
router.delete('/:id', requirePermission('empresas.excluir'), async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const id = parseInt(req.params.id);
        if (!id || isNaN(id))
            return sendError(res, 'ID inválido', 400);
        if (!currentUser.desenvolvedor) {
            return sendError(res, 'Acesso negado: apenas desenvolvedores podem excluir empresas.', 403);
        }
        await companiesService.deleteCascade(id, currentUser);
        await logSystemAction(req, currentUser.id, null, 'COMPANY_DELETE', `Excluiu empresa ID ${id} e todos os seus dados vinculados`);
        sendSuccess(res, null, 'Empresa e todos os seus dados foram excluídos com sucesso');
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao excluir empresa';
        sendError(res, message);
    }
});
// Settings: Ticket Categories
router.get('/:id/ticket-categories', async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const id = parseInt(req.params.id);
        if (!currentUser.desenvolvedor && currentUser.empresa_id !== id)
            return sendError(res, 'Acesso negado', 403);
        // Everyone in company can list categories
        const [rows] = await pool.query('SELECT * FROM empresa_ticket_categorias WHERE empresa_id = ? ORDER BY ordem ASC, id ASC', [id]);
        sendSuccess(res, rows);
    }
    catch (error) {
        sendError(res, 'Erro ao buscar categorias');
    }
});
router.post('/:id/ticket-categories', async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const id = parseInt(req.params.id);
        const hasConfigPerm = await permissionsService.hasPermission(currentUser, 'empresas.gerenciar_configuracoes');
        if (!hasConfigPerm)
            return sendError(res, 'Acesso negado', 403);
        if (!currentUser.desenvolvedor && currentUser.empresa_id !== id)
            return sendError(res, 'Acesso negado', 403);
        let { nome, valor, ativo, ordem } = req.body;
        const normalizedNome = typeof nome === 'string' ? nome.trim() : '';
        const sigla = normalizeCategorySigla(req.body.sigla);
        const normalizedValor = slugifyOptionValue(valor || sigla || normalizedNome);
        if (!normalizedNome || !sigla)
            return sendError(res, 'Nome e sigla sao obrigatorios', 400);
        if (isSiglaTooLong(req.body.sigla))
            return sendError(res, 'A sigla deve ter no maximo 6 caracteres', 400);
        if (!normalizedValor)
            return sendError(res, 'Valor da categoria invalido', 400);
        valor = normalizedValor;
        if (!nome || !valor)
            return sendError(res, 'Nome e valor são obrigatórios', 400);
        const [result] = await pool.query('INSERT INTO empresa_ticket_categorias (empresa_id, nome, sigla, valor, ativo, ordem) VALUES (?, ?, ?, ?, ?, ?)', [id, normalizedNome, sigla, normalizedValor, ativo !== undefined ? ativo : 1, ordem || 0]);
        sendSuccess(res, { id: result.insertId });
    }
    catch (error) {
        sendError(res, 'Erro ao criar categoria. Tente usar um valor único.');
    }
});
router.patch('/:id/ticket-categories/:catId', async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const id = parseInt(req.params.id);
        const catId = parseInt(req.params.catId);
        const hasConfigPerm = await permissionsService.hasPermission(currentUser, 'empresas.gerenciar_configuracoes');
        if (!hasConfigPerm)
            return sendError(res, 'Acesso negado', 403);
        if (!currentUser.desenvolvedor && currentUser.empresa_id !== id)
            return sendError(res, 'Acesso negado', 403);
        const { nome, valor, ativo, ordem, sigla } = req.body;
        let updates = [];
        let params = [];
        if (nome !== undefined) {
            const normalizedNome = typeof nome === 'string' ? nome.trim() : '';
            if (!normalizedNome)
                return sendError(res, 'Nome da categoria e obrigatorio', 400);
            updates.push('nome = ?');
            params.push(normalizedNome);
        }
        if (sigla !== undefined) {
            const normalizedSigla = normalizeCategorySigla(sigla);
            if (!normalizedSigla)
                return sendError(res, 'Sigla da categoria e obrigatoria', 400);
            if (isSiglaTooLong(sigla))
                return sendError(res, 'A sigla deve ter no maximo 6 caracteres', 400);
            updates.push('sigla = ?');
            params.push(normalizedSigla);
        }
        if (valor !== undefined) {
            const normalizedValor = slugifyOptionValue(valor);
            if (!normalizedValor)
                return sendError(res, 'Valor da categoria invalido', 400);
            updates.push('valor = ?');
            params.push(normalizedValor);
        }
        if (ativo !== undefined) {
            updates.push('ativo = ?');
            params.push(ativo);
        }
        if (ordem !== undefined) {
            updates.push('ordem = ?');
            params.push(ordem);
        }
        if (updates.length > 0) {
            params.push(id, catId);
            await pool.query(`UPDATE empresa_ticket_categorias SET ${updates.join(', ')} WHERE empresa_id = ? AND id = ?`, params);
        }
        sendSuccess(res, null);
    }
    catch (error) {
        sendError(res, 'Erro ao atualizar categoria');
    }
});
router.delete('/:id/ticket-categories/:catId', async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const id = parseInt(req.params.id);
        const catId = parseInt(req.params.catId);
        const hasConfigPerm = await permissionsService.hasPermission(currentUser, 'empresas.gerenciar_configuracoes');
        if (!hasConfigPerm)
            return sendError(res, 'Acesso negado', 403);
        if (!currentUser.desenvolvedor && currentUser.empresa_id !== id)
            return sendError(res, 'Acesso negado', 403);
        await pool.query('DELETE FROM empresa_ticket_categorias WHERE empresa_id = ? AND id = ?', [id, catId]);
        sendSuccess(res, null);
    }
    catch (error) {
        sendError(res, 'Erro ao deletar categoria');
    }
});
// Settings: Ticket Services
router.get('/:id/ticket-services', async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const id = parseInt(req.params.id);
        if (!currentUser.desenvolvedor && currentUser.empresa_id !== id)
            return sendError(res, 'Acesso negado', 403);
        // Everyone in company can list services
        const [rows] = await pool.query('SELECT * FROM empresa_ticket_servicos WHERE empresa_id = ? ORDER BY ordem ASC, id ASC', [id]);
        sendSuccess(res, rows);
    }
    catch (error) {
        sendError(res, 'Erro ao buscar servicos');
    }
});
router.post('/:id/ticket-services', async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const id = parseInt(req.params.id);
        const hasConfigPerm = await permissionsService.hasPermission(currentUser, 'empresas.gerenciar_configuracoes');
        if (!hasConfigPerm)
            return sendError(res, 'Acesso negado', 403);
        if (!currentUser.desenvolvedor && currentUser.empresa_id !== id)
            return sendError(res, 'Acesso negado', 403);
        const { nome, valor, ativo, ordem } = req.body;
        if (!nome || !valor)
            return sendError(res, 'Nome e valor são obrigatórios', 400);
        const [result] = await pool.query('INSERT INTO empresa_ticket_servicos (empresa_id, nome, valor, ativo, ordem) VALUES (?, ?, ?, ?, ?)', [id, nome, valor, ativo !== undefined ? ativo : 1, ordem || 0]);
        sendSuccess(res, { id: result.insertId });
    }
    catch (error) {
        sendError(res, 'Erro ao criar serviço. Tente usar um valor único.');
    }
});
router.patch('/:id/ticket-services/:servId', async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const id = parseInt(req.params.id);
        const servId = parseInt(req.params.servId);
        const hasConfigPerm = await permissionsService.hasPermission(currentUser, 'empresas.gerenciar_configuracoes');
        if (!hasConfigPerm)
            return sendError(res, 'Acesso negado', 403);
        if (!currentUser.desenvolvedor && currentUser.empresa_id !== id)
            return sendError(res, 'Acesso negado', 403);
        const { nome, valor, ativo, ordem } = req.body;
        let updates = [];
        let params = [];
        if (nome !== undefined) {
            updates.push('nome = ?');
            params.push(nome);
        }
        if (valor !== undefined) {
            updates.push('valor = ?');
            params.push(valor);
        }
        if (ativo !== undefined) {
            updates.push('ativo = ?');
            params.push(ativo);
        }
        if (ordem !== undefined) {
            updates.push('ordem = ?');
            params.push(ordem);
        }
        if (updates.length > 0) {
            params.push(id, servId);
            await pool.query(`UPDATE empresa_ticket_servicos SET ${updates.join(', ')} WHERE empresa_id = ? AND id = ?`, params);
        }
        sendSuccess(res, null);
    }
    catch (error) {
        sendError(res, 'Erro ao atualizar serviço');
    }
});
router.delete('/:id/ticket-services/:servId', async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const id = parseInt(req.params.id);
        const servId = parseInt(req.params.servId);
        const hasConfigPerm = await permissionsService.hasPermission(currentUser, 'empresas.gerenciar_configuracoes');
        if (!hasConfigPerm)
            return sendError(res, 'Acesso negado', 403);
        if (!currentUser.desenvolvedor && currentUser.empresa_id !== id)
            return sendError(res, 'Acesso negado', 403);
        await pool.query('DELETE FROM empresa_ticket_servicos WHERE empresa_id = ? AND id = ?', [id, servId]);
        sendSuccess(res, null);
    }
    catch (error) {
        sendError(res, 'Erro ao deletar serviço');
    }
});
// Settings: Ticket Status Workflow
router.get('/:id/ticket-statuses', async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const id = parseInt(req.params.id);
        if (!currentUser.desenvolvedor && currentUser.empresa_id !== id)
            return sendError(res, 'Acesso negado', 403);
        const [rows] = await pool.query(`SELECT id, nome, valor, ativo, kanban_visivel, cor, especial, ordem
       FROM empresa_ticket_status
       WHERE empresa_id = ?
       ORDER BY ordem ASC, id ASC`, [id]);
        sendSuccess(res, rows);
    }
    catch (error) {
        sendError(res, 'Erro ao buscar categorias de chamados');
    }
});
router.get('/:id/ticket-statuses/usage', async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const id = parseInt(req.params.id);
        if (!currentUser.desenvolvedor && currentUser.empresa_id !== id)
            return sendError(res, 'Acesso negado', 403);
        const [ticketRows] = await pool.query(`SELECT status, COUNT(*) AS total
       FROM tickets
       WHERE empresa_id = ?
       GROUP BY status`, [id]);
        const [automationRows] = await pool.query(`SELECT id, nome, condicoes_json, acoes_json
       FROM ticket_automacoes
       WHERE empresa_id = ?`, [id]);
        const automationUsage = {};
        const addAutomationUse = (status) => {
            if (typeof status !== 'string' || !status)
                return;
            automationUsage[status] = (automationUsage[status] || 0) + 1;
        };
        const parseJsonArray = (value) => {
            if (Array.isArray(value))
                return value;
            if (typeof value !== 'string')
                return [];
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed : [];
            }
            catch {
                return [];
            }
        };
        for (const automation of automationRows) {
            for (const condition of parseJsonArray(automation.condicoes_json)) {
                if (condition?.campo === 'status')
                    addAutomationUse(condition.valor);
            }
            for (const action of parseJsonArray(automation.acoes_json)) {
                if (action?.tipo === 'alterar_status')
                    addAutomationUse(action.valor);
                if (action?.tipo === 'fechar_com_motivo')
                    addAutomationUse('fechado');
            }
        }
        sendSuccess(res, {
            tickets: Object.fromEntries(ticketRows.map((row) => [row.status, Number(row.total || 0)])),
            automations: automationUsage
        });
    }
    catch (error) {
        sendError(res, 'Erro ao buscar uso dos status');
    }
});
router.put('/:id/ticket-statuses', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const id = parseInt(req.params.id);
        const hasConfigPerm = await permissionsService.hasPermission(currentUser, 'empresas.gerenciar_configuracoes');
        if (!hasConfigPerm)
            return sendError(res, 'Acesso negado', 403);
        if (!currentUser.desenvolvedor && currentUser.empresa_id !== id)
            return sendError(res, 'Acesso negado', 403);
        const statuses = Array.isArray(req.body?.statuses) ? req.body.statuses : null;
        if (!statuses)
            return sendError(res, 'Lista de tipos inválida', 400);
        if (statuses.length > 40)
            return sendError(res, 'Máximo de 40 status de chamados', 400);
        const remapStatuses = req.body?.remap_statuses && typeof req.body.remap_statuses === 'object'
            ? req.body.remap_statuses
            : {};
        const seen = new Set();
        const sanitized = statuses.map((status, index) => {
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
            if (!nome || nome.length > 100)
                throw new Error('Nome de tipo inválido');
            if (!isValidTicketStatusValue(valor))
                throw new Error(`Identificador de tipo inválido: ${valor}`);
            if (seen.has(valor))
                throw new Error(`Tipo duplicado: ${valor}`);
            seen.add(valor);
            return { nome, valor, ativo, kanban_visivel: kanbanVisivel, cor, especial, ordem: index };
        });
        const activeStatuses = sanitized.filter((status) => status.ativo === 1);
        if (activeStatuses.length === 0)
            throw new Error('Mantenha ao menos um status ativo');
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
            if (!TICKET_STATUS_SPECIALS.includes(special))
                throw new Error('Status especial inválido');
        }
        await connection.beginTransaction();
        const [oldRows] = await connection.query('SELECT valor FROM empresa_ticket_status WHERE empresa_id = ?', [id]);
        const oldStatusValues = oldRows.map((row) => row.valor);
        await connection.query('DELETE FROM empresa_ticket_status WHERE empresa_id = ?', [id]);
        for (const status of sanitized) {
            await connection.query(`INSERT INTO empresa_ticket_status
           (empresa_id, nome, valor, ativo, kanban_visivel, cor, especial, ordem)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [id, status.nome, status.valor, status.ativo, status.kanban_visivel, status.cor, status.especial, status.ordem]);
        }
        let affectedTicketIds = [];
        if (sanitized.length > 0) {
            const configuredStatusValues = sanitized.map((status) => status.valor);
            const fallbackStatus = activeStatuses.find((status) => status.especial === 'inicial')?.valor || activeStatuses[0].valor;
            const placeholders = configuredStatusValues.map(() => '?').join(', ');
            for (const oldStatus of oldStatusValues) {
                const targetStatus = typeof remapStatuses[oldStatus] === 'string'
                    ? remapStatuses[oldStatus]
                    : null;
                if (!targetStatus || !configuredStatusValues.includes(targetStatus))
                    continue;
                if (configuredStatusValues.includes(oldStatus))
                    continue;
                const [explicitRows] = await connection.query(`SELECT id FROM tickets WHERE empresa_id = ? AND status = ?`, [id, oldStatus]);
                affectedTicketIds.push(...explicitRows.map((r) => Number(r.id)));
                await connection.query(`UPDATE tickets
             SET status = ?, updated_at = NOW()
             WHERE empresa_id = ? AND status = ?`, [targetStatus, id, oldStatus]);
            }
            // BUG 4 fix: captura os tickets que serão remapeados ANTES do update,
            // para recomputar o estado materializado deles após o commit.
            const [affectedRows] = await connection.query(`SELECT id FROM tickets
	         WHERE empresa_id = ?
	         AND status NOT IN (${placeholders})`, [id, ...configuredStatusValues]);
            affectedTicketIds.push(...affectedRows.map((r) => Number(r.id)));
            await connection.query(`UPDATE tickets
	         SET status = ?, updated_at = NOW()
	         WHERE empresa_id = ?
	         AND status NOT IN (${placeholders})`, [fallbackStatus, id, ...configuredStatusValues]);
        }
        await connection.commit();
        // BUG 4 fix: recomputa o estado materializado dos tickets remapeados.
        // Operação administrativa rara; o loop por IDs reusa a regra canônica única.
        for (const remappedTicketId of Array.from(new Set(affectedTicketIds))) {
            try {
                await recomputeTicketMessageState(remappedTicketId);
            }
            catch (stateErr) {
                console.error('[Companies] Falha ao recomputar estado materializado do ticket', remappedTicketId, stateErr);
            }
        }
        const [rows] = await pool.query(`SELECT id, nome, valor, ativo, kanban_visivel, cor, especial, ordem
       FROM empresa_ticket_status
       WHERE empresa_id = ?
       ORDER BY ordem ASC, id ASC`, [id]);
        sendSuccess(res, rows);
    }
    catch (error) {
        await connection.rollback();
        const message = error instanceof Error ? error.message : 'Erro ao salvar status de chamados';
        sendError(res, message, 400);
    }
    finally {
        connection.release();
    }
});
router.get('/:id/sla-policies', async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const id = parseInt(req.params.id);
        if (!currentUser.desenvolvedor && currentUser.empresa_id !== id)
            return sendError(res, 'Acesso negado', 403);
        const [rows] = await pool.query('SELECT * FROM empresa_sla_politicas WHERE empresa_id = ? ORDER BY ordem ASC', [id]);
        sendSuccess(res, rows);
    }
    catch (error) {
        sendError(res, 'Erro ao buscar políticas de SLA');
    }
});
router.post('/:id/sla-policies', async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const id = parseInt(req.params.id);
        const hasConfigPerm = await permissionsService.hasPermission(currentUser, 'empresas.gerenciar_configuracoes');
        if (!hasConfigPerm)
            return sendError(res, 'Acesso negado', 403);
        if (!currentUser.desenvolvedor && currentUser.empresa_id !== id)
            return sendError(res, 'Acesso negado', 403);
        const { nome, prioridade, categoria, servico, tempo_primeira_resposta_minutos, tempo_resolucao_minutos, ativo, ordem } = req.body;
        const [result] = await pool.query('INSERT INTO empresa_sla_politicas (empresa_id, nome, prioridade, categoria, servico, tempo_primeira_resposta_minutos, tempo_resolucao_minutos, ativo, ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, nome, prioridade || null, categoria || null, servico || null, tempo_primeira_resposta_minutos || null, tempo_resolucao_minutos || 24 * 60, ativo !== undefined ? ativo : 1, ordem || 0]);
        sendSuccess(res, { id: result.insertId });
    }
    catch (error) {
        sendError(res, 'Erro ao criar política de SLA');
    }
});
router.patch('/:id/sla-policies/:policyId', async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const id = parseInt(req.params.id);
        const policyId = parseInt(req.params.policyId);
        const hasConfigPerm = await permissionsService.hasPermission(currentUser, 'empresas.gerenciar_configuracoes');
        if (!hasConfigPerm)
            return sendError(res, 'Acesso negado', 403);
        if (!currentUser.desenvolvedor && currentUser.empresa_id !== id)
            return sendError(res, 'Acesso negado', 403);
        const { nome, prioridade, categoria, servico, tempo_primeira_resposta_minutos, tempo_resolucao_minutos, ativo, ordem } = req.body;
        await pool.query('UPDATE empresa_sla_politicas SET nome = ?, prioridade = ?, categoria = ?, servico = ?, tempo_primeira_resposta_minutos = ?, tempo_resolucao_minutos = ?, ativo = ?, ordem = ? WHERE id = ? AND empresa_id = ?', [nome, prioridade || null, categoria || null, servico || null, tempo_primeira_resposta_minutos || null, tempo_resolucao_minutos || 24 * 60, ativo !== undefined ? ativo : 1, ordem || 0, policyId, id]);
        sendSuccess(res, { success: true });
    }
    catch (error) {
        sendError(res, 'Erro ao atualizar política de SLA');
    }
});
router.delete('/:id/sla-policies/:policyId', async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const id = parseInt(req.params.id);
        const policyId = parseInt(req.params.policyId);
        const hasConfigPerm = await permissionsService.hasPermission(currentUser, 'empresas.gerenciar_configuracoes');
        if (!hasConfigPerm)
            return sendError(res, 'Acesso negado', 403);
        if (!currentUser.desenvolvedor && currentUser.empresa_id !== id)
            return sendError(res, 'Acesso negado', 403);
        await pool.query('DELETE FROM empresa_sla_politicas WHERE id = ? AND empresa_id = ?', [policyId, id]);
        sendSuccess(res, { success: true });
    }
    catch (error) {
        sendError(res, 'Erro ao deletar política de SLA');
    }
});
export default router;
