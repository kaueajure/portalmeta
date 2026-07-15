import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { emailOutboxService, normalizeOutboxProcessLimit } from '../services/email-outbox.service.js';
import { toPositiveInt } from '../utils/pagination.js';
const router = Router();
router.use(authMiddleware);
function canManageOutbox(user) {
    return Boolean(user?.desenvolvedor || user?.administrador);
}
function getOutboxScope(user) {
    if (user?.desenvolvedor)
        return { isDev: true };
    const empresaId = toPositiveInt(user?.empresa_id);
    if (user?.administrador && empresaId) {
        return { isDev: false, empresaId };
    }
    return null;
}
router.get('/summary', async (req, res) => {
    const scope = getOutboxScope(req.user);
    if (!canManageOutbox(req.user) || !scope) {
        return sendError(res, 'Voce nao tem permissao para visualizar a fila de e-mails.', 403);
    }
    try {
        const summary = await emailOutboxService.getSummary(scope);
        return sendSuccess(res, summary);
    }
    catch (error) {
        console.error('[OutboxRoutes] Falha ao carregar resumo da outbox:', error);
        return sendError(res, 'Erro ao carregar fila de e-mails.', 500);
    }
});
router.get('/errors', async (req, res) => {
    const scope = getOutboxScope(req.user);
    if (!canManageOutbox(req.user) || !scope) {
        return sendError(res, 'Voce nao tem permissao para visualizar a fila de e-mails.', 403);
    }
    try {
        const limit = normalizeOutboxProcessLimit(req.query.limit ?? 20);
        const errors = await emailOutboxService.getErrors(limit, scope);
        return sendSuccess(res, errors);
    }
    catch (error) {
        console.error('[OutboxRoutes] Falha ao carregar erros da outbox:', error);
        return sendError(res, 'Erro ao carregar erros da fila de e-mails.', 500);
    }
});
router.post('/retry-errors', async (req, res) => {
    const scope = getOutboxScope(req.user);
    if (!canManageOutbox(req.user) || !scope) {
        return sendError(res, 'Voce nao tem permissao para reprocessar e-mails.', 403);
    }
    try {
        const limit = normalizeOutboxProcessLimit(req.body?.limit ?? req.query.limit ?? 20);
        const retried = await emailOutboxService.retryRecentErrors(limit, scope);
        return sendSuccess(res, { retried }, 'E-mails reenfileirados.');
    }
    catch (error) {
        console.error('[OutboxRoutes] Falha ao reenfileirar erros da outbox:', error);
        return sendError(res, 'Erro ao reenfileirar e-mails.', 500);
    }
});
router.post('/:id/retry', async (req, res) => {
    const scope = getOutboxScope(req.user);
    if (!canManageOutbox(req.user) || !scope) {
        return sendError(res, 'Voce nao tem permissao para reprocessar e-mails.', 403);
    }
    const id = toPositiveInt(req.params.id);
    if (!id)
        return sendError(res, 'ID invalido.', 400);
    try {
        const retried = await emailOutboxService.retryById(id, scope);
        if (!retried)
            return sendError(res, 'E-mail nao encontrado ou nao esta em erro.', 404);
        return sendSuccess(res, { id }, 'E-mail reenfileirado.');
    }
    catch (error) {
        console.error('[OutboxRoutes] Falha ao reenfileirar e-mail da outbox:', error);
        return sendError(res, 'Erro ao reenfileirar e-mail.', 500);
    }
});
export default router;
