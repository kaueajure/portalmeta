import { Router, Response } from 'express';
import attachmentsService from '../services/attachments.service.js';
import ticketsService from '../services/tickets.service.js';
import { authMiddleware, AuthRequest } from '../middlewares/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logSystemAction } from '../utils/logger.js';
import { permissionsService } from '../services/permissions.service.js';
import { env } from '../config/env.js';
import { promises as fs } from 'fs';
import path from 'path';

const router = Router();

router.use(authMiddleware);

router.get('/:id/download', async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Nao autenticado', 401);

    const id = parseInt(req.params.id);
    const attachment = await attachmentsService.getById(id);

    if (!attachment) return sendError(res, 'Anexo nao encontrado', 404);

    const ticketResult: any = await ticketsService.getByIdForUser(attachment.ticket_id, currentUser);
    if (!ticketResult) return sendError(res, 'Chamado nao encontrado', 404);
    if (ticketResult.error === 'forbidden') return sendError(res, 'Acesso negado ao anexo', 403);

    const ticket = ticketResult;

    if (!currentUser.desenvolvedor && ticket.empresa_id !== currentUser.empresa_id) {
      return sendError(res, 'Acesso negado ao anexo (outra empresa)', 403);
    }

    const isAdminOrDev = currentUser.administrador || currentUser.desenvolvedor;
    const canViewInternal = isAdminOrDev || await permissionsService.hasPermission(currentUser, 'ticket_mensagens.ver_internos');

    if (attachment.interno && !canViewInternal) {
       return sendError(res, 'Acesso negado a anexo interno', 403);
    }

    const absolutePath = path.resolve(attachment.caminho);
    const allowedUploadDirs = [
      path.resolve(process.cwd(), env.STORAGE_CONFIG.LOCAL_PATH),
      path.resolve(process.cwd(), 'uploads/tickets')
    ];
    const isAllowedPath = allowedUploadDirs.some((uploadsDir) => {
      const relativePath = path.relative(uploadsDir, absolutePath);
      return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
    });

    if (!isAllowedPath) {
       return sendError(res, 'Caminho de arquivo invalido', 400);
    }

    try {
      await fs.access(absolutePath);
    } catch {
       return sendError(res, 'Arquivo fisico nao encontrado no servidor', 404);
    }

    const wantsInlinePreview = req.query.inline === '1' && /^image\//i.test(attachment.mime_type || '');
    const safeFileName = String(attachment.nome_original || 'anexo')
      .replace(/[\r\n"]/g, '_')
      .slice(0, 180);

    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (wantsInlinePreview) {
      res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`);
      res.setHeader('Cache-Control', 'private, max-age=300');
      return res.sendFile(absolutePath);
    }

    res.download(absolutePath, attachment.nome_original);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao processar download';
    sendError(res, message);
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Nao autenticado', 401);

    const id = parseInt(req.params.id);
    const attachment = await attachmentsService.getById(id);

    if (!attachment) return sendError(res, 'Anexo nao encontrado', 404);

    const isAdminOrDev = currentUser.administrador || currentUser.desenvolvedor;
    const isOwner = attachment.usuario_id === currentUser.id;

    if (!isAdminOrDev && !isOwner) {
       return sendError(res, 'Permissao negada para excluir anexo', 403);
    }

    if (!currentUser.desenvolvedor && attachment.empresa_id !== currentUser.empresa_id) {
       return sendError(res, 'Acesso negado', 403);
    }

    await attachmentsService.delete(id);
    await logSystemAction(req, currentUser.id, currentUser.empresa_id, 'ATTACHMENT_DELETE', `Anexo excluido: ${attachment.nome_original} (ID: ${id})`);

    const io = req.app.get('io');
    if (io) {
      io.to(`empresa_${attachment.empresa_id}`).emit('ticketMessagesChanged', {
        ticketId: attachment.ticket_id,
        empresaId: attachment.empresa_id
      });
    }

    sendSuccess(res, null, 'Anexo excluido com sucesso');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao excluir anexo';
    sendError(res, message);
  }
});

export default router;
