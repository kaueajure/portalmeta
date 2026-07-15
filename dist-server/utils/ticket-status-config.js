import pool from '../db/connection.js';
export const TICKET_STATUS_SPECIALS = [
    'normal',
    'inicial',
    'aguardando_cliente',
    'finalizado',
    'encerrado'
];
const DEFAULT_FINAL_STATUSES = ['resolvido', 'fechado'];
const DEFAULT_CUSTOMER_WAITING_STATUSES = ['aguardando_cliente'];
export function isValidTicketStatusValue(value) {
    return typeof value === 'string' && /^[a-z0-9_]{2,80}$/.test(value);
}
export function normalizeTicketStatusSpecial(value) {
    return TICKET_STATUS_SPECIALS.includes(value)
        ? value
        : 'normal';
}
export function isFinalTicketStatusSpecial(special) {
    return special === 'finalizado' || special === 'encerrado';
}
export function isCustomerWaitingTicketStatusSpecial(special) {
    return special === 'aguardando_cliente';
}
export async function getTicketStatusConfigs(empresaId) {
    if (!empresaId)
        return [];
    const [rows] = await pool.query(`
      SELECT id, empresa_id, nome, valor, ativo, kanban_visivel, cor, especial, ordem
      FROM empresa_ticket_status
      WHERE empresa_id = ?
      ORDER BY ordem ASC, id ASC
    `, [empresaId]);
    return rows.map((row) => ({
        ...row,
        ativo: Number(row.ativo) === 1 ? 1 : 0,
        kanban_visivel: Number(row.kanban_visivel) === 1 ? 1 : 0,
        especial: normalizeTicketStatusSpecial(row.especial)
    }));
}
export async function getTicketStatusConfig(empresaId, status) {
    if (!empresaId || !isValidTicketStatusValue(status))
        return null;
    const [rows] = await pool.query(`
      SELECT id, empresa_id, nome, valor, ativo, kanban_visivel, cor, especial, ordem
      FROM empresa_ticket_status
      WHERE empresa_id = ?
        AND valor = ?
      LIMIT 1
    `, [empresaId, status]);
    if (!rows[0])
        return null;
    return {
        ...rows[0],
        ativo: Number(rows[0].ativo) === 1 ? 1 : 0,
        kanban_visivel: Number(rows[0].kanban_visivel) === 1 ? 1 : 0,
        especial: normalizeTicketStatusSpecial(rows[0].especial)
    };
}
export async function isConfiguredActiveTicketStatus(empresaId, status) {
    const config = await getTicketStatusConfig(empresaId, status);
    return !!config && config.ativo === 1;
}
export async function getTicketStatusValuesBySpecial(empresaId, specials, fallback = []) {
    const configs = await getTicketStatusConfigs(empresaId);
    const values = configs
        .filter(status => status.ativo === 1 && specials.includes(status.especial))
        .map(status => status.valor);
    return values.length > 0 ? values : fallback;
}
export async function getFinalTicketStatusValues(empresaId) {
    return getTicketStatusValuesBySpecial(empresaId, ['finalizado', 'encerrado'], DEFAULT_FINAL_STATUSES);
}
export async function getCustomerWaitingTicketStatusValues(empresaId) {
    return getTicketStatusValuesBySpecial(empresaId, ['aguardando_cliente'], DEFAULT_CUSTOMER_WAITING_STATUSES);
}
export async function getInitialTicketStatusValue(empresaId) {
    const configs = await getTicketStatusConfigs(empresaId);
    const initial = configs.find(status => status.ativo === 1 && status.especial === 'inicial')
        || configs.find(status => status.ativo === 1 && !isFinalTicketStatusSpecial(status.especial));
    if (!initial) {
        throw new Error('Nenhum status inicial ativo configurado para esta empresa');
    }
    return initial.valor;
}
export async function getReopenTicketStatusValue(empresaId) {
    return getInitialTicketStatusValue(empresaId);
}
export async function getInProgressTicketStatusValue(empresaId) {
    const configs = await getTicketStatusConfigs(empresaId);
    const normal = configs.find(status => status.ativo === 1 && status.especial === 'normal');
    if (normal)
        return normal.valor;
    return getInitialTicketStatusValue(empresaId);
}
export async function getClosedTicketStatusValue(empresaId) {
    const configs = await getTicketStatusConfigs(empresaId);
    return configs.find(status => status.ativo === 1 && status.especial === 'encerrado')?.valor || null;
}
export function buildStatusInCondition(column, statuses, negate = false) {
    const safeStatuses = statuses.filter(isValidTicketStatusValue);
    if (safeStatuses.length === 0)
        return { sql: '', params: [] };
    const placeholders = safeStatuses.map(() => '?').join(', ');
    return {
        sql: `${column} ${negate ? 'NOT IN' : 'IN'} (${placeholders})`,
        params: safeStatuses
    };
}
