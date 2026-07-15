import { Router } from 'express';
import pool from '../db/connection.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permissions.middleware.js';
import { permissionsService } from '../services/permissions.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
const router = Router();
router.use(authMiddleware);
const toPositiveInt = (value) => {
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw !== 'string' && typeof raw !== 'number')
        return undefined;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};
const toQueryString = (value) => {
    const raw = Array.isArray(value) ? value[0] : value;
    return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
};
const padDatePart = (value) => String(value).padStart(2, '0');
const toSqlDateTime = (date) => [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
].join('-') +
    ' ' +
    [
        padDatePart(date.getHours()),
        padDatePart(date.getMinutes()),
        padDatePart(date.getSeconds()),
    ].join(':');
const toDateInputValue = (date) => [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
].join('-');
const parseDateInput = (value, endOfDay = false) => {
    const raw = toQueryString(value);
    if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw))
        return null;
    const date = new Date(`${raw}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
    return Number.isNaN(date.getTime()) ? null : date;
};
const resolvePeriod = (query) => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const period = toQueryString(query.period) || 'month';
    if (period === 'custom') {
        const customStart = parseDateInput(query.from);
        const customEnd = parseDateInput(query.to, true);
        if (customStart && customEnd && customStart <= customEnd) {
            return { period, start: customStart, end: customEnd };
        }
    }
    if (period === '7d' || period === '30d' || period === '90d') {
        const days = Number(period.replace('d', ''));
        const start = new Date(end);
        start.setDate(start.getDate() - (days - 1));
        start.setHours(0, 0, 0, 0);
        return { period, start, end };
    }
    const start = new Date(now);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return { period: 'month', start, end };
};
router.get('/summary', requirePermission('dashboard.visualizar'), async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const isDev = Boolean(currentUser.desenvolvedor);
        const empresaId = currentUser.empresa_id;
        const queryEmpresaId = toPositiveInt(req.query.empresa_id);
        const responsavelId = toPositiveInt(req.query.responsavel_id);
        const { period, start, end } = resolvePeriod(req.query);
        const startSql = toSqlDateTime(start);
        const endSql = toSqlDateTime(end);
        let targetEmpresaId = null;
        if (isDev) {
            targetEmpresaId = queryEmpresaId || null;
        }
        else {
            if (!empresaId)
                return sendError(res, 'Empresa inválida para o usuário atual.', 403);
            if (queryEmpresaId && Number(queryEmpresaId) !== Number(empresaId)) {
                return sendError(res, 'Você não pode visualizar métricas de outra empresa.', 403);
            }
            targetEmpresaId = Number(empresaId);
        }
        const canFilterAllResponsaveis = isDev ||
            Boolean(currentUser.administrador) ||
            await permissionsService.hasPermission(currentUser, 'relatorios.ver_todos_usuarios');
        if (responsavelId && !canFilterAllResponsaveis && Number(responsavelId) !== Number(currentUser.id)) {
            return sendError(res, 'Você só pode filtrar métricas do seu próprio usuário.', 403);
        }
        if (responsavelId) {
            const responsibleParams = [responsavelId];
            let responsibleWhere = 'id = ? AND ativo = 1';
            if (targetEmpresaId) {
                responsibleWhere += ' AND empresa_id = ?';
                responsibleParams.push(targetEmpresaId);
            }
            const [responsibleRows] = await pool.query(`SELECT id FROM usuarios WHERE ${responsibleWhere} LIMIT 1`, responsibleParams);
            if (responsibleRows.length === 0) {
                return sendError(res, 'Responsável inválido para este escopo.', 400);
            }
        }
        const ticketScope = [];
        const ticketScopeParams = [];
        ticketScope.push('t.deleted_at IS NULL');
        if (targetEmpresaId) {
            ticketScope.push('t.empresa_id = ?');
            ticketScopeParams.push(targetEmpresaId);
        }
        if (responsavelId) {
            ticketScope.push('t.responsavel_id = ?');
            ticketScopeParams.push(responsavelId);
        }
        const ticketScopeWhere = ticketScope.length ? `AND ${ticketScope.join(' AND ')}` : '';
        const periodCondition = 't.created_at >= ? AND t.created_at <= ?';
        const finalizadoPeriodCondition = 't.finalizado_em >= ? AND t.finalizado_em <= ?';
        const [ticketMetricsRows] = await pool.query(`
        SELECT
          SUM(CASE WHEN ${periodCondition} AND t.status NOT IN ('resolvido', 'fechado') THEN 1 ELSE 0 END) as chamadosAtivos,
          SUM(CASE WHEN ${finalizadoPeriodCondition} AND t.status IN ('resolvido', 'fechado') THEN 1 ELSE 0 END) as resolvidosMes,
          SUM(CASE WHEN ${periodCondition} AND t.status NOT IN ('resolvido', 'fechado') AND t.prazo_sla < NOW() THEN 1 ELSE 0 END) as slaAtrasados,
          SUM(CASE WHEN ${periodCondition} AND t.status NOT IN ('resolvido', 'fechado') AND t.prazo_sla IS NOT NULL AND DATE(t.prazo_sla) = CURDATE() THEN 1 ELSE 0 END) as vencendoHoje,
          AVG(CASE WHEN ${periodCondition} AND t.primeira_resposta_em IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, t.created_at, t.primeira_resposta_em) ELSE NULL END) as tempoMedioPrimeiraRespostaMinutos,
          AVG(CASE WHEN ${finalizadoPeriodCondition} AND t.finalizado_em IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, t.created_at, t.finalizado_em) ELSE NULL END) as tempoMedioResolucaoMinutos,
          SUM(CASE WHEN ${periodCondition} AND COALESCE(t.sla_resolucao_status, '') IN ('cumprido', 'dentro_do_prazo') THEN 1 ELSE 0 END) as slaCumprido,
          SUM(CASE WHEN ${periodCondition} AND (t.sla_resolucao_status = 'violado' OR (t.status NOT IN ('resolvido', 'fechado') AND t.prazo_sla < NOW())) THEN 1 ELSE 0 END) as slaViolado
        FROM tickets t
        WHERE 1=1 ${ticketScopeWhere}
      `, [
            startSql, endSql,
            startSql, endSql,
            startSql, endSql,
            startSql, endSql,
            startSql, endSql,
            startSql, endSql,
            startSql, endSql,
            startSql, endSql,
            ...ticketScopeParams,
        ]);
        let totalEmpresas = 0;
        if (isDev) {
            const [empresasResult] = targetEmpresaId
                ? await pool.query('SELECT COUNT(*) as count FROM empresas WHERE ativo = 1 AND id = ?', [targetEmpresaId])
                : await pool.query('SELECT COUNT(*) as count FROM empresas WHERE ativo = 1');
            totalEmpresas = Number(empresasResult[0]?.count || 0);
        }
        const usuarioScopeParams = [];
        const usuarioCompanyFilter = targetEmpresaId ? 'AND empresa_id = ?' : '';
        if (targetEmpresaId)
            usuarioScopeParams.push(targetEmpresaId);
        const [usuariosResult] = await pool.query(`SELECT COUNT(*) as count FROM usuarios WHERE ativo = 1 ${usuarioCompanyFilter}`, usuarioScopeParams);
        const [recentTickets] = await pool.query(`
        SELECT
          t.id,
          t.titulo,
          t.status,
          t.prioridade,
          t.created_at,
          t.updated_at,
          t.prazo_sla,
          t.prazo_primeira_resposta,
          t.primeira_resposta_em,
          t.finalizado_em,
          t.sla_resolucao_status,
          t.sla_primeira_resposta_status,
          t.responsavel_id,
          u.nome as cliente_nome,
          r.nome as responsavel_nome,
          e.nome as empresa_nome
        FROM tickets t
        LEFT JOIN usuarios u ON t.usuario_id = u.id
        LEFT JOIN usuarios r ON t.responsavel_id = r.id
        LEFT JOIN empresas e ON t.empresa_id = e.id
        WHERE 1=1 ${ticketScopeWhere}
          AND ${periodCondition}
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT 5
      `, [...ticketScopeParams, startSql, endSql]);
        const [statusResult] = await pool.query(`
        SELECT t.status, COUNT(*) as qtd
        FROM tickets t
        WHERE 1=1 ${ticketScopeWhere}
          AND ${periodCondition}
        GROUP BY t.status
      `, [...ticketScopeParams, startSql, endSql]);
        const [priorityResult] = await pool.query(`
        SELECT COALESCE(t.prioridade, 'sem_prioridade') as prioridade, COUNT(*) as qtd
        FROM tickets t
        WHERE 1=1 ${ticketScopeWhere}
          AND ${periodCondition}
        GROUP BY t.prioridade
      `, [...ticketScopeParams, startSql, endSql]);
        const [responsavelResult] = await pool.query(`
        SELECT COALESCE(u.nome, 'Sem responsável') as responsavel, COUNT(*) as qtd
        FROM tickets t
        LEFT JOIN usuarios u ON t.responsavel_id = u.id
        WHERE t.status NOT IN ('resolvido', 'fechado') ${ticketScopeWhere}
          AND ${periodCondition}
        GROUP BY COALESCE(u.nome, 'Sem responsável')
        ORDER BY qtd DESC
        LIMIT 8
      `, [...ticketScopeParams, startSql, endSql]);
        const [backlogResult] = await pool.query(`
        SELECT faixa, COUNT(*) as qtd
        FROM (
          SELECT
            CASE
              WHEN DATEDIFF(NOW(), created_at) <= 1 THEN '0-1 dia'
              WHEN DATEDIFF(NOW(), created_at) <= 3 THEN '2-3 dias'
              WHEN DATEDIFF(NOW(), created_at) <= 7 THEN '4-7 dias'
              WHEN DATEDIFF(NOW(), created_at) <= 14 THEN '8-14 dias'
              ELSE '15+ dias'
            END as faixa
          FROM tickets t
          WHERE t.status NOT IN ('resolvido', 'fechado') ${ticketScopeWhere}
            AND ${periodCondition}
        ) backlog
        GROUP BY faixa
      `, [...ticketScopeParams, startSql, endSql]);
        const ticketMetrics = ticketMetricsRows[0] || {};
        const firstResponseMinutes = ticketMetrics.tempoMedioPrimeiraRespostaMinutos;
        const resolutionMinutes = ticketMetrics.tempoMedioResolucaoMinutos;
        sendSuccess(res, {
            chamadosAtivos: Number(ticketMetrics.chamadosAtivos || 0),
            resolvidosMes: Number(ticketMetrics.resolvidosMes || 0),
            totalEmpresas,
            totalUsuarios: Number(usuariosResult[0]?.count || 0),
            slaAtrasados: Number(ticketMetrics.slaAtrasados || 0),
            vencendoHoje: Number(ticketMetrics.vencendoHoje || 0),
            tempoMedioPrimeiraRespostaHoras: firstResponseMinutes === null || firstResponseMinutes === undefined ? null : Number(firstResponseMinutes) / 60,
            tempoMedioResolucaoHoras: resolutionMinutes === null || resolutionMinutes === undefined ? null : Number(resolutionMinutes) / 60,
            slaCumprido: Number(ticketMetrics.slaCumprido || 0),
            slaViolado: Number(ticketMetrics.slaViolado || 0),
            recentTickets: recentTickets || [],
            byStatus: statusResult || [],
            byPriority: priorityResult || [],
            byResponsavel: responsavelResult || [],
            backlogPorIdade: backlogResult || [],
            filters: {
                period,
                from: toDateInputValue(start),
                to: toDateInputValue(end),
                empresa_id: targetEmpresaId,
                responsavel_id: responsavelId || null,
            },
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao carregar dashboard';
        sendError(res, message);
    }
});
export default router;
