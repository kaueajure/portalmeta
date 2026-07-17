import { Router } from 'express';
import  logsService from  '../services/logs.service.js';
import  { authMiddleware, AuthRequest } from  '../middlewares/auth.js';
import  { isAdmin } from  '../middlewares/permissions.js';
import  { sendSuccess, sendError } from  '../utils/response.js';

const router = Router();

/** Único e-mail autorizado a ver auditoria de todos os usuários. */
const AUDIT_ALL_LOGS_EMAIL = 'kaueajure@gmail.com';

function canSeeAllAuditLogs(email?: string | null): boolean {
  return String(email || '').trim().toLowerCase() === AUDIT_ALL_LOGS_EMAIL;
}

router.use(authMiddleware);
router.use(isAdmin);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Não autenticado', 401);

    const seeAll = canSeeAllAuditLogs(currentUser.email);
    const filters = {
      ...req.query,
      // Demais usuários: só as próprias alterações. kaueajure@gmail.com: todos.
      user_id: seeAll ? undefined : currentUser.id,
      is_dev: seeAll || Boolean(currentUser.desenvolvedor),
    };
    const logs = await logsService.list(filters);
    sendSuccess(res, logs);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar logs';
    sendError(res, message);
  }
});

export default router;
