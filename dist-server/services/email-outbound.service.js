import pool from '../db/connection.js';
import { sendTicketEmail } from '../utils/mailer.js';
import { emailChannelsService } from './email-channels.service.js';
import { decryptSecret } from '../utils/crypto.js';
import { env } from '../config/env.js';
// Sanitiza o nome do remetente para evitar header injection no campo From.
function sanitizeFromName(name) {
    return String(name || '').replace(/[\r\n"<>]/g, ' ').trim().slice(0, 120) || 'Atendimento';
}
async function getCompanyTicketEmailIdentity(empresaId) {
    try {
        const [rows] = await pool.query('SELECT nome, email_assinatura FROM empresas WHERE id = ?', [empresaId]);
        const company = rows[0];
        return {
            companyName: company?.nome,
            emailSignature: company?.email_assinatura,
        };
    }
    catch (err) {
        if (err?.code !== 'ER_BAD_FIELD_ERROR')
            throw err;
        const [rows] = await pool.query('SELECT nome FROM empresas WHERE id = ?', [empresaId]);
        return { companyName: rows[0]?.nome };
    }
}
export async function trackTicketEmailMessageIds(empresaId, ticketId, outboundMessageId, result) {
    if (!result.success)
        return;
    const idsToTrack = [
        outboundMessageId,
        result.messageId,
        result.providerMessageId,
    ].filter((id) => typeof id === 'string' && id.trim().length > 0);
    for (const idToTrack of new Set(idsToTrack)) {
        try {
            await pool.query('INSERT IGNORE INTO processed_emails (message_id, empresa_id, ticket_id) VALUES (?, ?, ?)', [idToTrack.trim(), empresaId, ticketId]);
        }
        catch (dbErr) {
            console.error('[EmailOutbound] Error storing tracked message ID:', dbErr);
        }
    }
}
class EmailOutboundService {
    async sendTicketEmail(params) {
        const msgId = params.messageId || `<ticket-${params.ticketId}-${Date.now()}@gestifique.com.br>`;
        const emailIdentity = await getCompanyTicketEmailIdentity(params.empresaId);
        const ticketEmailParams = {
            ...params,
            companyName: params.companyName || emailIdentity.companyName,
            emailSignature: params.emailSignature || emailIdentity.emailSignature,
        };
        let channel = null;
        if (params.emailChannelId) {
            channel = await emailChannelsService.getByIdAndCompany(params.emailChannelId, params.empresaId);
        }
        // CAMINHO PRINCIPAL: SMTP do canal (identidade da empresa).
        if (channel && emailChannelsService.isChannelSmtpReady(channel)) {
            try {
                const pass = decryptSecret(channel.smtp_pass_enc);
                const fromName = sanitizeFromName(channel.smtp_from_name || channel.nome || channel.email_publico);
                const from = `"${fromName}" <${channel.email_publico}>`;
                const result = await sendTicketEmail({ ...ticketEmailParams, messageId: msgId, replyTo: channel.email_publico }, {
                    transportConfig: {
                        host: channel.smtp_host,
                        port: Number(channel.smtp_port) || 587,
                        secure: Number(channel.smtp_secure) === 1,
                        auth: { user: channel.smtp_user, pass }
                    },
                    from
                });
                if (result.success) {
                    await emailChannelsService.setSmtpStatus(channel.id, 'verified').catch(() => { });
                    return {
                        success: true,
                        messageId: result.messageId,
                        providerMessageId: result.providerMessageId,
                        provider: 'channel_smtp'
                    };
                }
                await emailChannelsService.setSmtpStatus(channel.id, 'error', result.error).catch(() => { });
                if (!env.ALLOW_GLOBAL_TICKET_EMAIL_FALLBACK) {
                    return { success: false, provider: 'channel_smtp', error: result.error || 'Falha no envio pelo SMTP do canal.' };
                }
                // Caso contrário, segue para o fallback global explícito abaixo.
            }
            catch (err) {
                await emailChannelsService.setSmtpStatus(channel.id, 'error', err?.message).catch(() => { });
                if (!env.ALLOW_GLOBAL_TICKET_EMAIL_FALLBACK) {
                    return { success: false, provider: 'channel_smtp', error: `Falha ao usar SMTP do canal: ${err?.message || 'erro desconhecido'}` };
                }
            }
        }
        else if (!env.ALLOW_GLOBAL_TICKET_EMAIL_FALLBACK) {
            // Canal sem SMTP configurado: NÃO enviar como Gestifique para o cliente final.
            return {
                success: false,
                error: 'Canal de envio não configurado: configure o SMTP do canal para responder ao cliente por e-mail com a identidade da empresa.'
            };
        }
        // FALLBACK GLOBAL EXPLÍCITO (somente com ALLOW_GLOBAL_TICKET_EMAIL_FALLBACK=true).
        const replyTo = channel?.email_publico || params.replyTo;
        const smtpResult = await sendTicketEmail({ ...ticketEmailParams, messageId: msgId, replyTo });
        return {
            success: smtpResult.success,
            messageId: smtpResult.messageId,
            providerMessageId: smtpResult.providerMessageId,
            provider: 'smtp_global',
            error: smtpResult.error,
        };
    }
}
export const emailOutboundService = new EmailOutboundService();
