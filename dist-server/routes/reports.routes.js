import { Router } from 'express';
import reportsService from '../services/reports.service.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permissions.middleware.js';
import { permissionsService } from '../services/permissions.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
const router = Router();
router.use(authMiddleware);
function toPositiveInt(value) {
    if (value === undefined || value === null || value === '')
        return undefined;
    const n = Number(Array.isArray(value) ? value[0] : value);
    return Number.isInteger(n) && n > 0 ? n : undefined;
}
function applyReportCompanyScope(currentUser, filters, empresaIdValue) {
    if (currentUser.desenvolvedor) {
        const empresaId = toPositiveInt(empresaIdValue);
        if (!empresaId)
            return 'Selecione uma empresa valida para gerar relatorios.';
        filters.empresa_id = empresaId;
        return null;
    }
    if (!currentUser.empresa_id)
        return 'Sua conta nao possui empresa vinculada.';
    filters.empresa_id = currentUser.empresa_id;
    return null;
}
router.get('/summary', requirePermission('relatorios.visualizar'), async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const { start_date, end_date, empresa_id, responsavel_id, status, prioridade } = req.query;
        const filters = {
            start_date: start_date,
            end_date: end_date,
            responsavel_id: toPositiveInt(responsavel_id),
            status: status,
            prioridade: prioridade
        };
        const scopeError = applyReportCompanyScope(currentUser, filters, empresa_id);
        if (scopeError)
            return sendError(res, scopeError, currentUser.desenvolvedor ? 400 : 403);
        // Resolve reports scoping
        const isSuperUser = !!(currentUser.desenvolvedor || currentUser.administrador);
        if (!isSuperUser) {
            const hasVerTodos = await permissionsService.hasPermission(currentUser, 'relatorios.ver_todos_usuarios');
            if (!hasVerTodos) {
                // Force scoping to own indicators
                filters.responsavel_id = currentUser.id;
            }
        }
        const summary = await reportsService.getSummary(filters);
        sendSuccess(res, summary);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao gerar relatório';
        sendError(res, message);
    }
});
router.post('/generate', requirePermission('relatorios.visualizar'), async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const { start_date, end_date, empresa_id, responsavel_id, status, prioridade } = req.body;
        const filters = {
            start_date,
            end_date,
            responsavel_id: toPositiveInt(responsavel_id),
            status,
            prioridade
        };
        const scopeError = applyReportCompanyScope(currentUser, filters, empresa_id);
        if (scopeError)
            return sendError(res, scopeError, currentUser.desenvolvedor ? 400 : 403);
        // Resolve reports scoping
        const isSuperUser = !!(currentUser.desenvolvedor || currentUser.administrador);
        if (!isSuperUser) {
            const hasVerTodos = await permissionsService.hasPermission(currentUser, 'relatorios.ver_todos_usuarios');
            if (!hasVerTodos) {
                // Force scoping to own indicators
                filters.responsavel_id = currentUser.id;
            }
        }
        const reportData = await reportsService.getReportData(filters);
        sendSuccess(res, reportData);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao gerar relatório';
        sendError(res, message);
    }
});
router.get('/export', requirePermission('relatorios.exportar'), async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const { type, start_date, end_date, empresa_id, responsavel_id, status, prioridade, categoria, servico } = req.query;
        const filters = {
            start_date: start_date,
            end_date: end_date,
            responsavel_id: toPositiveInt(responsavel_id),
            status: status,
            prioridade: prioridade,
            categoria: categoria,
            servico: servico
        };
        const scopeError = applyReportCompanyScope(currentUser, filters, empresa_id);
        if (scopeError)
            return sendError(res, scopeError, currentUser.desenvolvedor ? 400 : 403);
        // Resolve reports scoping
        const isSuperUser = !!(currentUser.desenvolvedor || currentUser.administrador);
        if (!isSuperUser) {
            const hasVerTodos = await permissionsService.hasPermission(currentUser, 'relatorios.ver_todos_usuarios');
            if (!hasVerTodos) {
                // Force scoping to own indicators
                filters.responsavel_id = currentUser.id;
            }
        }
        const csvData = await reportsService.exportCSV(filters, type || 'tickets');
        res.setHeader('Content-Disposition', `attachment; filename="relatorio_${type || 'tickets'}_${new Date().toISOString().substring(0, 10)}.csv"`);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.send('\uFEFF' + csvData); // BOM para excel
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao exportar relatório';
        sendError(res, message);
    }
});
export default router;
