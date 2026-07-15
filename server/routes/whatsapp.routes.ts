import { Router, Request, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permissions.middleware.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { whatsappService } from '../services/whatsapp.service.js';

const router = Router();

/**
 * Meta webhook verification (GET) + event delivery (POST).
 * Public endpoints — no auth cookie. Secured by verify token / signature.
 */
router.get('/webhook', (req: Request, res: Response) => {
  const mode = String(req.query['hub.mode'] || '');
  const token = String(req.query['hub.verify_token'] || '');
  const challenge = String(req.query['hub.challenge'] || '');

  const result = whatsappService.verifyWebhookChallenge({ mode, token, challenge });
  if (result.ok === false) {
    console.warn('[WhatsApp] Webhook verify failed:', result.reason);
    return res.status(403).send('Forbidden');
  }

  console.log('[WhatsApp] WEBHOOK VERIFIED');
  return res.status(200).type('text/plain').send(result.challenge);
});

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.header('x-hub-signature-256') || undefined;
    const rawBody = (req as any).rawBody as Buffer | undefined;

    if (!whatsappService.verifySignature(rawBody, signature)) {
      console.warn('[WhatsApp] Assinatura de webhook inválida');
      return res.status(403).json({ success: false, message: 'Assinatura inválida' });
    }

    // Responde 200 rapidamente (Meta exige resposta rápida).
    res.status(200).json({ success: true });

    const { processed } = await whatsappService.handleWebhookPayload(req.body);
    if (processed > 0) {
      console.log(`[WhatsApp] Webhook processado: ${processed} evento(s)`);
    }
  } catch (err) {
    console.error('[WhatsApp] Erro ao processar webhook:', err);
    if (!res.headersSent) {
      return res.status(200).json({ success: true });
    }
  }
});

router.use(authMiddleware as any);

router.get(
  '/status',
  requirePermission('integracoes.whatsapp.visualizar', { allowDeveloper: true }),
  async (_req: AuthRequest, res: Response) => {
    try {
      return sendSuccess(res, whatsappService.getPublicStatus());
    } catch (err) {
      console.error(err);
      return sendError(res, 'Erro ao obter status do WhatsApp', 500);
    }
  },
);

router.get(
  '/conversations',
  requirePermission('integracoes.whatsapp.visualizar', { allowDeveloper: true }),
  async (req: AuthRequest, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 80;
      const conversations = await whatsappService.listConversations(limit);
      return sendSuccess(res, conversations);
    } catch (err) {
      console.error(err);
      return sendError(res, 'Erro ao listar conversas do WhatsApp', 500);
    }
  },
);

router.get(
  '/conversations/:phone/messages',
  requirePermission('integracoes.whatsapp.visualizar', { allowDeveloper: true }),
  async (req: AuthRequest, res: Response) => {
    try {
      const phone = String(req.params.phone || '');
      const limit = Number(req.query.limit) || 200;
      const messages = await whatsappService.listThreadMessages(phone, limit);
      return sendSuccess(res, messages);
    } catch (err) {
      console.error(err);
      return sendError(res, 'Erro ao listar mensagens da conversa', 500);
    }
  },
);

router.get(
  '/messages',
  requirePermission('integracoes.whatsapp.visualizar', { allowDeveloper: true }),
  async (req: AuthRequest, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 50;
      const phone = req.query.phone ? String(req.query.phone) : '';
      const messages = phone
        ? await whatsappService.listThreadMessages(phone, limit)
        : await whatsappService.listMessages(limit);
      return sendSuccess(res, messages);
    } catch (err) {
      console.error(err);
      return sendError(res, 'Erro ao listar mensagens do WhatsApp', 500);
    }
  },
);

router.post(
  '/messages',
  requirePermission('integracoes.whatsapp.gerenciar', { allowDeveloper: true }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { to, text } = req.body || {};
      const data = await whatsappService.sendTextMessage(to, text);
      return sendSuccess(res, data, 'Mensagem enviada');
    } catch (err: any) {
      console.error('[WhatsApp] send text error:', err);
      return sendError(
        res,
        err?.message || 'Erro ao enviar mensagem',
        err?.status || 500,
        err?.details ? [err.details] : [],
      );
    }
  },
);

router.post(
  '/messages/template',
  requirePermission('integracoes.whatsapp.gerenciar', { allowDeveloper: true }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { to, templateName, languageCode, bodyParams } = req.body || {};
      const data = await whatsappService.sendTemplateMessage({
        to,
        templateName,
        languageCode,
        bodyParams,
      });
      return sendSuccess(res, data, 'Template enviado');
    } catch (err: any) {
      console.error('[WhatsApp] send template error:', err);
      return sendError(
        res,
        err?.message || 'Erro ao enviar template',
        err?.status || 500,
        err?.details ? [err.details] : [],
      );
    }
  },
);

export default router;
