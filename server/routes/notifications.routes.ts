import { Router } from 'express';
import notificationsService from '../services/notifications.service.js';
import { authMiddleware, AuthRequest } from '../middlewares/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';

const router = Router();

router.get('/unread-count', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
    if (!token) return sendSuccess(res, { count: 0 });

    const { env } = await import('../config/env.js');
    const jwt = (await import('jsonwebtoken')).default;
    
    try {
      const decoded: any = jwt.verify(token, env.JWT_SECRET);
      if (!decoded || !decoded.id) return sendSuccess(res, { count: 0 });
      
      const count = await notificationsService.countUnread(decoded.id);
      return sendSuccess(res, { count });
    } catch (e) {
      return sendSuccess(res, { count: 0 });
    }
  } catch (error: unknown) {
    return sendSuccess(res, { count: 0 });
  }
});

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const currentUser = (req as AuthRequest).user;
    if (!currentUser) return sendError(res, 'Não autenticado', 401);
    
    const userId = currentUser.id;
    const { unread_only, limit, offset } = req.query;
    
    const items = await notificationsService.listForUser(userId, {
      unread_only: unread_only === 'true',
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0
    });
    
    const unread_count = await notificationsService.countUnread(userId);
    
    sendSuccess(res, { items, unread_count });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao listar notificações';
    sendError(res, message);
  }
});

// Important: Move specific action routes BEFORE parameterized :id routes
router.patch('/read-all', async (req, res) => {
  try {
    const currentUser = (req as AuthRequest).user;
    if (!currentUser) return sendError(res, 'Não autenticado', 401);

    const userId = currentUser.id;
    await notificationsService.markAllAsRead(userId);
    sendSuccess(res, null, 'Notificações marcadas como lidas');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao marcar notificações como lidas';
    sendError(res, message);
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    const currentUser = (req as AuthRequest).user;
    if (!currentUser) return sendError(res, 'Não autenticado', 401);

    const userId = currentUser.id;
    const id = Number(req.params.id);
    if (!isNaN(id)) {
      await notificationsService.markAsRead(id, userId);
    }
    sendSuccess(res, null, 'Notificação marcada como lida');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao marcar notificação como lida';
    sendError(res, message);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const currentUser = (req as AuthRequest).user;
    if (!currentUser) return sendError(res, 'Não autenticado', 401);

    const userId = currentUser.id;
    const id = Number(req.params.id);
    if (!isNaN(id)) {
      await notificationsService.delete(id, userId);
    }
    sendSuccess(res, null, 'Notificação removida');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao remover notificação';
    sendError(res, message);
  }
});

export default router;
