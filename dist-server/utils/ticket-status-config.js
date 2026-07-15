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
export async function getTicketStatusConfigs() {
    const [rows] = await pool.query(`
      SELECT id, nome, valor, ativo, kanban_visivel, cor, especial, ordem
      FROM ticket_statuses
      ORDER BY ordem ASC, id ASC
    `);
    return rows.map((row) => ({
        ...row,
        ativo: Number(row.ativo) === 1 ? 1 : 0,
        kanban_visivel: Number(row.kanban_visivel) === 1 ? 1 : 0,
        especial: normalizeTicketStatusSpecial(row.especial)
    }));
}
export async function getTicketStatusConfig(status) {
    if (!isValidTicketStatusValue(status))
        return null;
    const [rows] = await pool.query(`
      SELECT id, nome, valor, ativo, kanban_visivel, cor, especial, ordem
      FROM ticket_statuses
      WHERE valor = ?
      LIMIT 1
    `, [status]);
    if (!rows[0])
        return null;
    return {
        ...rows[0],
        ativo: Number(rows[0].ativo) === 1 ? 1 : 0,
        kanban_visivel: Number(rows[0].kanban_visivel) === 1 ? 1 : 0,
        especial: normalizeTicketStatusSpecial(rows[0].especial)
    };
}
export async function isConfiguredActiveTicketStatus(status) {
    const config = await getTicketStatusConfig(status);
    return !!config && config.ativo === 1;
}
export async function getTicketStatusValuesBySpecial(specials, fallback = []) {
    const configs = await getTicketStatusConfigs();
    const values = configs
        .filter(status => status.ativo === 1 && specials.includes(status.especial))
        .map(status => status.valor);
    return values.length > 0 ? values : fallback;
}
export async function getFinalTicketStatusValues() {
    return getTicketStatusValuesBySpecial(['finalizado', 'encerrado'], DEFAULT_FINAL_STATUSES);
}
export async function getCustomerWaitingTicketStatusValues() {
    return getTicketStatusValuesBySpecial(['aguardando_cliente'], DEFAULT_CUSTOMER_WAITING_STATUSES);
}
export async function getInitialTicketStatusValue() {
    const configs = await getTicketStatusConfigs();
    const initial = configs.find(status => status.ativo === 1 && status.especial === 'inicial')
        || configs.find(status => status.ativo === 1 && !isFinalTicketStatusSpecial(status.especial));
    if (!initial) {
        throw new Error('Nenhum status inicial ativo configurado');
    }
    return initial.valor;
}
export async function getReopenTicketStatusValue() {
    return getInitialTicketStatusValue();
}
export async function getInProgressTicketStatusValue() {
    const configs = await getTicketStatusConfigs();
    const normal = configs.find(status => status.ativo === 1 && status.especial === 'normal');
    if (normal)
        return normal.valor;
    return getInitialTicketStatusValue();
}
export async function getClosedTicketStatusValue() {
    const configs = await getTicketStatusConfigs();
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
