import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permissions.middleware.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { whatsappService } from '../services/whatsapp.service.js';
const router = Router();
/**
 * Meta webhook verification (GET) + event delivery (POST).
 * Public endpoints — no auth cookie. Secured by verify token / signature.
 */
router.get('/webhook', (req, res) => {
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
router.post('/webhook', async (req, res) => {
    try {
        const signature = req.header('x-hub-signature-256') || undefined;
        const rawBody = req.rawBody;
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
    }
    catch (err) {
        console.error('[WhatsApp] Erro ao processar webhook:', err);
        if (!res.headersSent) {
            return res.status(200).json({ success: true });
        }
    }
});
router.use(authMiddleware);
const META_CREDENTIALS_ALLOWED_EMAIL = 'kaueajure@gmail.com';
function canViewMetaCredentials(email) {
    return String(email || '').trim().toLowerCase() === META_CREDENTIALS_ALLOWED_EMAIL;
}
router.get('/status', requirePermission('integracoes.whatsapp.visualizar', { allowDeveloper: true }), async (req, res) => {
    try {
        const status = whatsappService.getPublicStatus();
        if (canViewMetaCredentials(req.user?.email)) {
            return sendSuccess(res, status);
        }
        // Demais usuários veem só o essencial da inbox — sem IDs/token/webhook.
        return sendSuccess(res, {
            enabled: status.enabled,
            configured: status.configured,
            phoneNumberId: null,
            businessAccountId: null,
            apiVersion: status.apiVersion,
            hasAccessToken: status.hasAccessToken,
            accessTokenPreview: null,
            hasAppSecret: status.hasAppSecret,
            verifyToken: null,
            callbackUrl: null,
            displayPhoneNumber: status.displayPhoneNumber,
        });
    }
    catch (err) {
        console.error(err);
        return sendError(res, 'Erro ao obter status do WhatsApp', 500);
    }
});
router.get('/settings', requirePermission('integracoes.whatsapp.visualizar', { allowDeveloper: true }), async (_req, res) => {
    try {
        const settings = await whatsappService.getBotSettings();
        return sendSuccess(res, settings);
    }
    catch (err) {
        console.error(err);
        return sendError(res, 'Erro ao obter configurações do WhatsApp', 500);
    }
});
router.put('/settings', requirePermission('integracoes.whatsapp.gerenciar', { allowDeveloper: true }), async (req, res) => {
    try {
        const body = req.body || {};
        const settings = await whatsappService.updateBotSettings({
            autoReplyEnabled: body.autoReplyEnabled,
            menuType: body.menuType,
            welcomeHeader: body.welcomeHeader,
            welcomeBody: body.welcomeBody,
            buttons: body.buttons,
            listButtonText: body.listButtonText,
            listSectionTitle: body.listSectionTitle,
            inactivityMinutes: body.inactivityMinutes,
            closingMessage: body.closingMessage,
        });
        return sendSuccess(res, settings, 'Configurações do WhatsApp salvas');
    }
    catch (err) {
        console.error('[WhatsApp] update settings error:', err);
        return sendError(res, err?.message || 'Erro ao salvar configurações do WhatsApp', err?.status || 500);
    }
});
router.get('/conversations', requirePermission('integracoes.whatsapp.visualizar', { allowDeveloper: true }), async (req, res) => {
    try {
        const limit = Number(req.query.limit) || 80;
        const conversations = await whatsappService.listConversations(limit);
        return sendSuccess(res, conversations);
    }
    catch (err) {
        console.error(err);
        return sendError(res, 'Erro ao listar conversas do WhatsApp', 500);
    }
});
router.get('/conversations/:phone/messages', requirePermission('integracoes.whatsapp.visualizar', { allowDeveloper: true }), async (req, res) => {
    try {
        const phone = String(req.params.phone || '');
        const limit = Number(req.query.limit) || 200;
        const messages = await whatsappService.listThreadMessages(phone, limit);
        return sendSuccess(res, messages);
    }
    catch (err) {
        console.error(err);
        return sendError(res, 'Erro ao listar mensagens da conversa', 500);
    }
});
router.get('/conversations/:phone/assignment', requirePermission('integracoes.whatsapp.visualizar', { allowDeveloper: true }), async (req, res) => {
    try {
        const data = await whatsappService.getAssignmentDetails(String(req.params.phone || ''));
        return sendSuccess(res, data);
    }
    catch (err) {
        console.error('[WhatsApp] assignment details error:', err);
        return sendError(res, 'Erro ao obter a responsabilidade do atendimento', 500);
    }
});
router.post('/conversations/:phone/claim', requirePermission('integracoes.whatsapp.gerenciar', { allowDeveloper: true }), async (req, res) => {
    try {
        if (!req.user)
            return sendError(res, 'Usu\u00e1rio n\u00e3o autenticado', 401);
        const data = await whatsappService.claimAttendance(String(req.params.phone || ''), {
            id: req.user.id,
            name: req.user.nome,
        });
        return sendSuccess(res, data, 'Atendimento iniciado com sucesso');
    }
    catch (err) {
        console.error('[WhatsApp] claim attendance error:', err);
        return sendError(res, err?.message || 'N\u00e3o foi poss\u00edvel iniciar o atendimento', err?.status || 500);
    }
});
router.get('/messages', requirePermission('integracoes.whatsapp.visualizar', { allowDeveloper: true }), async (req, res) => {
    try {
        const limit = Number(req.query.limit) || 50;
        const phone = req.query.phone ? String(req.query.phone) : '';
        const messages = phone
            ? await whatsappService.listThreadMessages(phone, limit)
            : await whatsappService.listMessages(limit);
        return sendSuccess(res, messages);
    }
    catch (err) {
        console.error(err);
        return sendError(res, 'Erro ao listar mensagens do WhatsApp', 500);
    }
});
router.post('/messages', requirePermission('integracoes.whatsapp.gerenciar', { allowDeveloper: true }), async (req, res) => {
    try {
        const { to, text } = req.body || {};
        if (!req.user)
            return sendError(res, 'Usu\u00e1rio n\u00e3o autenticado', 401);
        const data = await whatsappService.sendAgentTextMessage(to, text, {
            id: req.user.id,
            name: req.user.nome,
        });
        return sendSuccess(res, data, 'Mensagem enviada');
    }
    catch (err) {
        console.error('[WhatsApp] send text error:', err);
        return sendError(res, err?.message || 'Erro ao enviar mensagem', err?.status || 500, err?.details ? [err.details] : []);
    }
});
router.post('/messages/template', requirePermission('integracoes.whatsapp.gerenciar', { allowDeveloper: true }), async (req, res) => {
    try {
        const { to, templateName, languageCode, bodyParams } = req.body || {};
        const data = await whatsappService.sendTemplateMessage({
            to,
            templateName,
            languageCode,
            bodyParams,
        });
        return sendSuccess(res, data, 'Template enviado');
    }
    catch (err) {
        console.error('[WhatsApp] send template error:', err);
        return sendError(res, err?.message || 'Erro ao enviar template', err?.status || 500, err?.details ? [err.details] : []);
    }
});
export default router;
