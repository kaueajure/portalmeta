import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { maskEmail, maskIdentifier } from './sanitize.js';
const transporter = nodemailer.createTransport({
    host: env.SMTP.HOST,
    port: env.SMTP.PORT,
    secure: env.SMTP.PORT === 465,
    auth: {
        user: env.SMTP.USER,
        pass: env.SMTP.PASS,
    },
    tls: {
        // S1: padrão seguro (valida o certificado). Só relaxa via MAIL_TLS_INSECURE=true.
        rejectUnauthorized: !env.MAIL_TLS_INSECURE
    }
});
/**
 * Verifica conexão/autenticação de um SMTP de canal (sem enviar e-mail).
 */
export const verifyChannelSmtp = async (config) => {
    try {
        const t = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: config.auth,
            tls: { rejectUnauthorized: !env.MAIL_TLS_INSECURE }
        });
        await t.verify();
        return { success: true, message: 'SMTP do canal conectado com sucesso.' };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
};
export const verifySMTP = async () => {
    try {
        if (!env.SMTP.HOST || !env.SMTP.USER) {
            throw new Error('Configuração SMTP incompleta.');
        }
        await transporter.verify();
        return { success: true, message: 'SMTP conectado com sucesso.' };
    }
    catch (error) {
        console.error('[Mailer] SMTP Verification failed:', error.message);
        return { success: false, error: error.message };
    }
};
export const sendTestEmail = async (to) => {
    const mailOptions = {
        from: env.SMTP.FROM,
        to,
        subject: 'Teste de E-mail - Gestifique',
        text: 'Se você está recebendo isso, a configuração SMTP do Gestifique está funcionando corretamente!',
        html: '<b>Se você está recebendo isso, a configuração SMTP do Gestifique está funcionando corretamente!</b>',
    };
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`[Mailer] Test email sent to ${maskEmail(to)} (Message-ID: ${maskIdentifier(info.messageId)})`);
        return { success: true, messageId: info.messageId };
    }
    catch (error) {
        console.error(`[Mailer] Failed to send test email to ${maskEmail(to)}:`, error.message);
        return { success: false, error: error.message };
    }
};
export const sendPasswordRecoveryEmail = async (email, token) => {
    const mailOptions = {
        from: env.SMTP.FROM,
        to: email,
        subject: 'Recuperação de Senha - Gestifique',
        html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #2563eb; padding: 24px; text-align: center;">
          <h2 style="color: white; margin: 0;">Recuperação de Senha</h2>
        </div>
        <div style="padding: 32px; color: #334155;">
          <p style="font-size: 16px;">Você solicitou a redefinição de sua senha. Use o código abaixo para criar uma nova senha:</p>
          <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
            <span style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #0f172a;">${token}</span>
          </div>
          <p style="font-size: 14px; color: #64748b;">Este código é válido por 30 minutos. Se você não solicitou esta redefinição, apenas ignore este e-mail.</p>
        </div>
      </div>
    `,
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`[Mailer] Recovery email sent to ${maskEmail(email)}`);
    }
    catch (error) {
        console.error(`[Mailer] Failed to send recovery email to ${maskEmail(email)}:`, error.message);
    }
};
const escapeHtml = (unsafe) => {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/\n/g, "<br>");
};
const buildDefaultTicketSignature = (companyName) => `Atenciosamente,\nEquipe de Atendimento\n${String(companyName || 'Atendimento').trim()}`;
const normalizeTicketSignature = (signature, companyName) => {
    const value = String(signature || '').trim();
    return value || buildDefaultTicketSignature(companyName);
};
export const buildTicketEmailTemplate = (params) => {
    const { type, title, companyName, emailSignature, customerName = 'Cliente', message = '', resolutionReason = '', resolutionObservation = '' } = params;
    let subject = '';
    let headline = '';
    let leadText = '';
    let messageLabel = 'Mensagem';
    let messageHtml = '';
    let actionHtml = '';
    const safeTitle = escapeHtml(title);
    const safeCustomerName = escapeHtml(customerName);
    const safeMessage = escapeHtml(message);
    const safeResolutionReason = escapeHtml(resolutionReason);
    const safeResolutionObservation = escapeHtml(resolutionObservation);
    const safeSignature = escapeHtml(normalizeTicketSignature(emailSignature, companyName));
    const safeSubjectTitle = String(title || '').replace(/[\r\n]+/g, ' ').trim();
    switch (type) {
        case 'ticket_created':
            subject = `Recebemos sua solicitação: ${safeSubjectTitle}`;
            headline = 'Recebemos sua solicitação';
            leadText = `Olá, ${safeCustomerName}. Abrimos sua solicitação e nossa equipe vai acompanhar por este mesmo e-mail.`;
            messageLabel = 'Mensagem recebida';
            messageHtml = safeMessage;
            actionHtml = 'Para adicionar novas informações, basta responder este e-mail. Sua resposta será registrada automaticamente no chamado.';
            break;
        case 'agent_reply':
            subject = `Nova mensagem no seu chamado: ${safeSubjectTitle}`;
            headline = 'Nova mensagem no seu chamado';
            leadText = `Olá, ${safeCustomerName}.<br><br>A equipe de atendimento enviou uma nova resposta para o seu chamado.`;
            messageLabel = 'Resposta da equipe';
            messageHtml = safeMessage;
            actionHtml = 'Precisa enviar mais alguma informação?<br>Responda diretamente este e-mail. Sua mensagem será registrada automaticamente no chamado.';
            break;
        case 'ticket_resolved':
            subject = `Chamado resolvido: ${safeSubjectTitle}`;
            headline = 'Chamado resolvido';
            leadText = `Olá, ${safeCustomerName}. Seu chamado foi marcado como resolvido.`;
            messageLabel = 'Resumo do fechamento';
            messageHtml = `
        ${safeResolutionReason ? `<p style="margin:0 0 8px 0;"><strong>Motivo:</strong> ${safeResolutionReason}</p>` : ''}
        ${safeResolutionObservation ? `<p style="margin:0;"><strong>Observação:</strong> ${safeResolutionObservation}</p>` : '<p style="margin:0;">O atendimento foi marcado como resolvido pela nossa equipe.</p>'}
      `;
            actionHtml = 'Se ainda precisar de ajuda, responda este e-mail. Nossa equipe poderá reavaliar o atendimento.';
            break;
        case 'ticket_closed':
            subject = `Chamado encerrado: ${safeSubjectTitle}`;
            headline = 'Chamado encerrado';
            leadText = `Olá, ${safeCustomerName}. Seu chamado foi encerrado.`;
            messageLabel = 'Encerramento';
            messageHtml = `
        <p style="margin:0 0 8px 0;"><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
        <p style="margin:0;">Este atendimento foi finalizado.</p>
      `;
            actionHtml = 'Caso precise de ajuda novamente, responda este e-mail ou abra uma nova solicitação.';
            break;
    }
    const html = `
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
      ${headline}: ${safeSubjectTitle}
    </div>
    <style>
      @media only screen and (max-width: 620px) {
        .email-outer { padding:20px 10px !important; }
        .email-header { padding:24px 22px 22px 22px !important; }
        .email-body { padding:24px 22px 18px 22px !important; }
        .email-block { padding-left:22px !important; padding-right:22px !important; }
        .email-title { font-size:21px !important; }
        .email-header-row,
        .email-header-cell { display:block !important; width:100% !important; text-align:left !important; }
      }
    </style>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%; background:#f3f6fa; margin:0; padding:0; border-collapse:collapse;">
      <tr>
        <td align="center" class="email-outer" style="padding:32px 12px;">
          <table role="presentation" width="660" cellspacing="0" cellpadding="0" style="width:100%; max-width:660px; border-collapse:separate; border-spacing:0;">
            <tr>
              <td style="border-radius:18px; background:#ffffff; border:1px solid #dbe3ee; box-shadow:0 14px 38px rgba(15,23,42,0.10); overflow:hidden;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td class="email-header" style="background:#ffffff; padding:26px 32px 24px 32px; border-radius:18px 18px 0 0; border-bottom:1px solid #e2e8f0;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-header-row" style="border-collapse:collapse;">
                        <tr>
                          <td class="email-header-cell" style="font-family:Arial, Helvetica, sans-serif; color:#0f172a; vertical-align:top;">
                            <div style="font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:#0f172a; font-weight:700;">Gestifique</div>
                            <div style="font-size:13px; line-height:1.5; color:#64748b; font-weight:600; margin-top:4px;">Central de Atendimento</div>
                            <div class="email-title" style="font-size:22px; line-height:1.25; color:#0f172a; font-weight:700; margin:18px 0 8px 0;">${headline}</div>
                            <div style="font-size:14px; line-height:1.55; color:#64748b; font-weight:500; margin:0;">${safeTitle}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td class="email-body" style="padding:32px 32px 18px 32px; font-family:Arial, Helvetica, sans-serif; color:#1f2937;">
                      <p style="margin:0; font-size:15px; line-height:1.7; color:#334155;">${leadText}</p>
                    </td>
                  </tr>
                  <tr>
                    <td class="email-block" style="padding:0 32px 22px 32px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate; border-spacing:0; border:1px solid #e2e8f0; border-radius:14px; background:#ffffff;">
                        <tr>
                          <td style="padding:24px 26px; font-family:Arial, Helvetica, sans-serif;">
                            <div style="font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:#334155; font-weight:700; margin-bottom:14px;">${messageLabel}</div>
                            <div style="font-size:16px; line-height:1.78; color:#0f172a;">${messageHtml}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td class="email-block" style="padding:0 32px 28px 32px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate; border-spacing:0; background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px;">
                        <tr>
                          <td style="padding:16px 20px; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:1.65; color:#334155;">
                            ${actionHtml}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 32px 24px 32px; background:#f8fafc; border-top:1px solid #e5eaf1; font-family:Arial, Helvetica, sans-serif;">
                      <div style="font-size:12px; line-height:1.65; color:#64748b;">${safeSignature}</div>
                      <div style="font-size:11px; line-height:1.55; color:#94a3b8; margin-top:12px;">Esta é uma mensagem automática. Não é necessário abrir um novo chamado.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
    return { subject, html, text: html.replace(/<[^>]*>?/gm, '') };
};
export const sendTicketEmail = async (params, options) => {
    const useChannelTransport = !!options?.transportConfig;
    // Transporter por canal (identidade da empresa) ou global (fallback técnico).
    const activeTransporter = useChannelTransport
        ? nodemailer.createTransport({
            host: options.transportConfig.host,
            port: options.transportConfig.port,
            secure: options.transportConfig.secure,
            auth: options.transportConfig.auth,
            tls: {
                // S1: validação de certificado segura por padrão.
                rejectUnauthorized: !env.MAIL_TLS_INSECURE
            }
        })
        : transporter;
    if (!useChannelTransport && !env.SMTP.HOST) {
        console.error('[Mailer] SMTP not configured. Skipping email notification.');
        return { success: false, error: 'SMTP not configured' };
    }
    const msgId = params.messageId || `<ticket-${params.ticketId}-${Date.now()}@gestifique.com.br>`;
    const template = buildTicketEmailTemplate(params);
    const mailOptions = {
        // From: identidade do canal quando fornecida; senão, global (fallback técnico).
        from: options?.from || env.SMTP.FROM,
        to: params.to,
        subject: template.subject,
        messageId: msgId,
        replyTo: params.replyTo || env.IMAP.USER || env.SMTP.FROM,
        headers: {
            'X-Auto-Response-Suppress': 'OOF, AutoReply',
            'X-Gestifique-Ticket-ID': params.ticketId.toString(),
            'Auto-Submitted': 'no',
            'X-Gestifique-System': 'true',
            'X-Gestifique-Message-Type': params.type,
            'X-Gestifique-Thread-Key': `ticket-${params.ticketId}`
        },
        html: template.html,
        text: template.text,
    };
    if (params.attachments && params.attachments.length > 0) {
        mailOptions.attachments = params.attachments.map(attachment => ({
            filename: attachment.filename,
            path: attachment.path,
            contentType: attachment.contentType
        }));
    }
    if (params.inReplyTo) {
        mailOptions.inReplyTo = params.inReplyTo;
        mailOptions.references = params.references || [params.inReplyTo];
    }
    try {
        const info = await activeTransporter.sendMail(mailOptions);
        console.log(`[Mailer] Ticket email (${params.type}) sent to ${maskEmail(params.to)} (ID: ${params.ticketId}, via: ${useChannelTransport ? 'channel' : 'global'}, Message-ID: ${maskIdentifier(info.messageId)})`);
        return {
            success: true,
            messageId: msgId,
            providerMessageId: info.messageId
        };
    }
    catch (error) {
        console.error(`[Mailer] Failed to send ticket email (${params.type}) to ${maskEmail(params.to)}:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
};
export const sendPortalAccessCodeEmail = async (params) => {
    const { to, code, empresaNome = 'Gestifique', expiresMinutes = 10 } = params;
    const safeEmpresaNome = escapeHtml(empresaNome);
    const mailOptions = {
        from: env.SMTP.FROM,
        to,
        subject: 'Código de acesso ao Portal do Cliente',
        html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #2563eb; padding: 24px; text-align: center;">
          <h2 style="color: white; margin: 0;">Código de Acesso</h2>
        </div>
        <div style="padding: 32px; color: #334155;">
          <p style="font-size: 16px;">Você solicitou acesso ao Portal do Cliente da <strong>${safeEmpresaNome}</strong>. Use o código abaixo para entrar:</p>
          <div style="background-color: #f1f5f9; padding: 24px; border-radius: 8px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 12px; color: #0f172a; font-family: monospace;">${code}</span>
          </div>
          <p style="font-size: 14px; color: #64748b;">Este código é válido por ${expiresMinutes} minutos.</p>
          <p style="font-size: 14px; color: #94a3b8; margin-top: 24px;">Se você não solicitou este acesso, pode ignorar este e-mail com segurança.</p>
        </div>
        <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          Enviado por Gestifique - Gestão de Atendimento
        </div>
      </div>
    `,
    };
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`[Mailer] Portal access code sent to ${maskEmail(to)} (Message-ID: ${maskIdentifier(info.messageId)})`);
        return { success: true, messageId: info.messageId };
    }
    catch (error) {
        console.error(`[Mailer] Failed to send portal access code to ${maskEmail(to)}:`, error.message);
        return { success: false, error: error.message };
    }
};
export const sendTicketNotification = async (email, ticketId, titulo, mensagem, options = {}) => {
    // Legacy support for basic notifications using exactly the new system
    return sendTicketEmail({
        to: email,
        ticketId,
        type: 'agent_reply',
        title: titulo,
        message: mensagem,
        messageId: options.messageId,
        inReplyTo: options.inReplyTo,
        references: options.references,
        replyTo: options.replyTo,
    });
};
