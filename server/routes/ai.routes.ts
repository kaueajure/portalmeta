import { Router } from 'express';
import { AIService } from '../services/ai.service.js';
import ticketsService from '../services/tickets.service.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permissions.middleware.js';
import { sendError, sendSuccess } from '../utils/response.js';

const router = Router();

const unavailableMessage = 'Servico de IA indisponivel no servidor.';

router.get('/status', authMiddleware, requirePermission('ia.visualizar'), (_req, res) => {
  return sendSuccess(res, { available: AIService.isAvailable() });
});

router.get('/tickets/:id/summary', authMiddleware, requirePermission('ia.usar_resumo'), async (req: any, res) => {
  const ticketId = Number(req.params.id);
  const user = req.user;

  if (!AIService.isAvailable()) {
    return sendError(res, unavailableMessage, 503);
  }

  try {
    const ticket = await ticketsService.getByIdForUser(ticketId, user);
    if (!ticket || ticket.error === 'forbidden') {
      return sendError(res, 'Chamado não encontrado', 404);
    }

    const mensagensResult = (await ticketsService.getMessages(ticketId, false)) as any[];
    const timeline = mensagensResult.map((m: any) => ({
      role: m.usuario_id === ticket.usuario_id ? 'user' : 'model',
      content: m.mensagem,
      text: m.mensagem,
    }));

    if (timeline.length === 0) {
      timeline.push({
        role: 'user',
        content: ticket.descricao || ticket.titulo,
        text: ticket.descricao || ticket.titulo,
      });
    }

    const summary = await AIService.summarizeTimeline(timeline);
    return sendSuccess(res, { summary });
  } catch (error: any) {
    console.error('Error generating summary:', error);
    return sendError(res, 'Erro ao gerar resumo da conversa', 500);
  }
});

router.post('/tickets/:id/suggest-reply', authMiddleware, requirePermission('ia.sugerir_resposta'), async (req: any, res) => {
  const ticketId = Number(req.params.id);
  const { agentDraft } = req.body;
  const user = req.user;

  if (!AIService.isAvailable()) {
    return sendError(res, unavailableMessage, 503);
  }

  try {
    const ticket = await ticketsService.getByIdForUser(ticketId, user);
    if (!ticket || ticket.error === 'forbidden') {
      return sendError(res, 'Chamado não encontrado', 404);
    }

    const mensagensResult = (await ticketsService.getMessages(ticketId, false)) as any[];
    const timeline = mensagensResult.map((m: any) => ({
      role: m.usuario_id === ticket.usuario_id ? 'user' : 'model',
      content: m.mensagem,
      text: m.mensagem,
    }));

    if (timeline.length === 0) {
      timeline.push({
        role: 'user',
        content: ticket.descricao || ticket.titulo,
        text: ticket.descricao || ticket.titulo,
      });
    }

    const suggestion = await AIService.suggestResponse(ticket.titulo, timeline, agentDraft);
    return sendSuccess(res, { suggestion });
  } catch (error: any) {
    console.error('Error suggesting reply:', error);
    return sendError(res, 'Erro ao sugerir resposta', 500);
  }
});

router.post('/chat', authMiddleware, requirePermission('ia.chat'), async (req: any, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return sendError(res, 'Prompt is required', 400);
  }

  return sendError(res, unavailableMessage, 503);
});

export default router;
