import { Router } from 'express';
import { emailChannelsService } from '../services/email-channels.service.js';
import { authMiddleware } from '../middlewares/auth.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { isValidEmail } from '../utils/validators.js';
import { isEncryptionConfigured, decryptSecret } from '../utils/crypto.js';
import { verifyChannelSmtp, sendTicketEmail } from '../utils/mailer.js';
const router = Router();
router.use(authMiddleware);
// Dev can manage any company; admins can manage only their own company.
const canManage = (req, targetEmpresaId) => {
    return req.user.desenvolvedor || (req.user.administrador && req.user.empresa_id === targetEmpresaId);
};
router.get('/companies/:companyId/email-channels', async (req, res) => {
    try {
        const companyId = parseInt(req.params.companyId, 10);
        if (!canManage(req, companyId)) {
            return sendError(res, 'Permissao negada', 403);
        }
        const canais = await emailChannelsService.listByCompany(companyId);
        return sendSuccess(res, canais);
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
router.post('/companies/:companyId/email-channels', async (req, res) => {
    try {
        const companyId = parseInt(req.params.companyId, 10);
        if (!canManage(req, companyId)) {
            return sendError(res, 'Permissao negada', 403);
        }
        const { email_publico, nome } = req.body;
        if (!email_publico || !isValidEmail(email_publico)) {
            return sendError(res, 'E-mail publico invalido', 400);
        }
        const id = await emailChannelsService.createChannel({
            empresa_id: companyId,
            email_publico,
            nome,
        });
        return sendSuccess(res, { id }, 'Canal criado com sucesso');
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
router.delete('/companies/:companyId/email-channels/:id', async (req, res) => {
    try {
        const companyId = parseInt(req.params.companyId, 10);
        if (!canManage(req, companyId)) {
            return sendError(res, 'Permissao negada', 403);
        }
        const id = parseInt(req.params.id, 10);
        await emailChannelsService.deleteChannel(id, companyId);
        return sendSuccess(res, null, 'Canal deletado com sucesso');
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
router.post('/companies/:companyId/email-channels/:id/regenerate', async (req, res) => {
    try {
        const companyId = parseInt(req.params.companyId, 10);
        if (!canManage(req, companyId)) {
            return sendError(res, 'Permissao negada', 403);
        }
        const id = parseInt(req.params.id, 10);
        await emailChannelsService.regenerate(id, companyId);
        return sendSuccess(res, null, 'Canal regenerado com sucesso');
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
// Fase 1: configurar SMTP do canal (envio com a identidade da empresa).
// A senha nunca é retornada; é cifrada no serviço.
router.put('/companies/:companyId/email-channels/:id/smtp', async (req, res) => {
    try {
        const companyId = parseInt(req.params.companyId, 10);
        if (!canManage(req, companyId)) {
            return sendError(res, 'Permissao negada', 403);
        }
        const id = parseInt(req.params.id, 10);
        const { smtp_enabled, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_from_name, password } = req.body || {};
        if (smtp_enabled && !isEncryptionConfigured()) {
            return sendError(res, 'ENCRYPTION_KEY não configurada no servidor; não é possível salvar a senha SMTP com segurança.', 400);
        }
        const portNum = smtp_port !== undefined && smtp_port !== null && smtp_port !== '' ? parseInt(String(smtp_port), 10) : null;
        if (smtp_enabled && (!portNum || portNum <= 0 || portNum > 65535)) {
            return sendError(res, 'Porta SMTP inválida.', 400);
        }
        const updated = await emailChannelsService.updateSmtpConfig(id, companyId, {
            smtp_enabled: !!smtp_enabled,
            smtp_host: smtp_host ? String(smtp_host).trim() : null,
            smtp_port: portNum,
            smtp_secure: !!smtp_secure,
            smtp_user: smtp_user ? String(smtp_user).trim() : null,
            smtp_from_name: smtp_from_name ? String(smtp_from_name).trim() : null,
            password: typeof password === 'string' && password.length > 0 ? password : null,
        });
        // Resposta saneada: nunca expõe smtp_pass_enc.
        const safe = updated ? { ...updated } : null;
        if (safe)
            delete safe.smtp_pass_enc;
        return sendSuccess(res, safe, 'Configuração SMTP do canal salva.');
    }
    catch (err) {
        return sendError(res, err.message, 400);
    }
});
// Fase 1: testar o SMTP do canal (verifica conexão e, opcionalmente, envia teste).
router.post('/companies/:companyId/email-channels/:id/smtp/test', async (req, res) => {
    try {
        const companyId = parseInt(req.params.companyId, 10);
        if (!canManage(req, companyId)) {
            return sendError(res, 'Permissao negada', 403);
        }
        const id = parseInt(req.params.id, 10);
        const channel = await emailChannelsService.getByIdAndCompany(id, companyId);
        if (!channel)
            return sendError(res, 'Canal não encontrado', 404);
        if (!emailChannelsService.isChannelSmtpReady(channel)) {
            return sendError(res, 'Canal sem SMTP configurado/ativo.', 400);
        }
        let pass;
        try {
            pass = decryptSecret(channel.smtp_pass_enc);
        }
        catch (e) {
            await emailChannelsService.setSmtpStatus(channel.id, 'error', e?.message).catch(() => { });
            return sendError(res, 'Falha ao ler a senha SMTP (verifique ENCRYPTION_KEY).', 400);
        }
        const config = {
            host: channel.smtp_host,
            port: Number(channel.smtp_port) || 587,
            secure: Number(channel.smtp_secure) === 1,
            auth: { user: channel.smtp_user, pass }
        };
        const verifyResult = await verifyChannelSmtp(config);
        if (!verifyResult.success) {
            await emailChannelsService.setSmtpStatus(channel.id, 'error', verifyResult.error).catch(() => { });
            return sendError(res, `Falha na conexão SMTP: ${verifyResult.error}`, 400);
        }
        // Envio de teste opcional para o próprio e-mail público do canal.
        const sendResult = await sendTicketEmail({
            to: channel.email_publico,
            ticketId: 0,
            type: 'agent_reply',
            title: 'Teste de envio do canal',
            customerName: channel.nome || 'Equipe',
            agentName: 'Gestifique',
            message: 'Este é um e-mail de teste do canal. Se você recebeu, o envio pela identidade da empresa está funcionando.',
            status: 'Teste'
        }, {
            transportConfig: config,
            from: `"${(channel.smtp_from_name || channel.nome || channel.email_publico)}" <${channel.email_publico}>`
        });
        if (!sendResult.success) {
            await emailChannelsService.setSmtpStatus(channel.id, 'error', sendResult.error).catch(() => { });
            return sendError(res, `Conexão OK, mas o envio de teste falhou: ${sendResult.error}`, 400);
        }
        await emailChannelsService.setSmtpStatus(channel.id, 'verified', null).catch(() => { });
        return sendSuccess(res, { sentTo: channel.email_publico }, 'SMTP do canal verificado e e-mail de teste enviado.');
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
export const emailChannelsRoutes = router;
