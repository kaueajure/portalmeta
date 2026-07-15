import { Router } from 'express';
import  logsService from  '../services/logs.service.js';
import  { authMiddleware, AuthRequest } from  '../middlewares/auth.js';
import  { isAdmin } from  '../middlewares/permissions.js';
import  { sendSuccess, sendError } from  '../utils/response.js';

const router = Router();

router.use(authMiddleware);
router.use(isAdmin);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Não autenticado', 401);

    const filters = {
      ...req.query,
      empresa_id: currentUser.empresa_id,
      user_id: currentUser.id,
      is_dev: currentUser.desenvolvedor
    };
    const logs = await logsService.list(filters);
    sendSuccess(res, logs);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar logs';
    sendError(res, message);
  }
});

export default router;
