import cron from 'node-cron';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import pool from '../db/connection.js';
import ticketsService from './tickets.service.js';
import attachmentsService from './attachments.service.js';
import storageService from './storage.service.js';
import { env } from '../config/env.js';
import { io } from '../server.js';
import path from 'path';
import { createHash } from 'crypto';
import { validateAttachmentBuffer } from '../utils/file-security.js';
import { maskEmail, maskIdentifier } from '../utils/sanitize.js';
function normalizeEmailAddress(value) {
    if (!value)
        return null;
    const lowered = value.toLowerCase().trim();
    const match = lowered.match(/<([^>]+)>/);
    return (match ? match[1] : lowered).trim();
}
function extractTicketIdFromGestifiqueMessageId(value) {
    if (!value)
        return null;
    const raw = Array.isArray(value) ? value.join(' ') : String(value);
    const match = raw.match(/ticket-(\d+)(?:-|@)/i);
    if (!match)
        return null;
    const id = Number(match[1]);
    return Number.isInteger(id) && id > 0 ? id : null;
}
function looksLikeGestifiqueTicketThread(subject, parsed) {
    const normalizedSubject = subject || '';
    const hasTicketSubject = /\[Ticket\s*#\d+\]/i.test(normalizedSubject) ||
        /Chamado\s*#\d+/i.test(normalizedSubject) ||
        /Ticket\s*#\d+/i.test(normalizedSubject);
    const hasGestifiqueHeader = !!parsed.headers.get('x-gestifique-ticket-id');
    const refs = [
        parsed.messageId,
        parsed.inReplyTo,
        ...(Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [])
    ].filter(Boolean).join(' ');
    const hasGestifiqueMessageId = /ticket-\d+(?:-|@)/i.test(refs);
    return hasTicketSubject || hasGestifiqueHeader || hasGestifiqueMessageId;
}
function normalizeDedupText(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 20000);
}
function headerToString(value) {
    if (!value)
        return '';
    if (Array.isArray(value))
        return value.map(headerToString).filter(Boolean).join(' ');
    return String(value);
}
function buildFallbackEmailDedupKey(parsed, subject, senderEmail, recipients = []) {
    const dateHeader = parsed.date?.toISOString() || headerToString(parsed.headers.get('date'));
    const html = typeof parsed.html === 'string' ? parsed.html : '';
    const body = normalizeDedupText(parsed.text || html);
    const attachments = (parsed.attachments || [])
        .map(att => `${att.filename || ''}:${att.size || 0}:${att.contentType || ''}`)
        .sort();
    const raw = JSON.stringify({
        from: normalizeEmailAddress(senderEmail),
        recipients: [...new Set(recipients.map(r => r.toLowerCase().trim()).filter(Boolean))].sort(),
        subject: normalizeDedupText(subject).toLowerCase(),
        date: normalizeDedupText(dateHeader),
        body,
        attachments,
    });
    const digest = createHash('sha256').update(raw).digest('hex').slice(0, 48);
    return `<fallback-${digest}@gestifique.local>`;
}
function decodeHtmlEntities(value) {
    return String(value || '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}
function normalizeUrlCandidate(value) {
    return decodeHtmlEntities(value)
        .trim()
        .replace(/[)\].,;'"<>]+$/g, '');
}
function getForwardingConfirmationHosts() {
    return new Set((env.FORWARDING_CONFIRMATION_ALLOWED_HOSTS || []).map(host => host.toLowerCase()));
}
const GOOGLE_FORWARDING_CONFIRMATION_HOSTS = new Set([
    'mail.google.com',
    'mail-settings.google.com',
    'isolated.mail.google.com',
]);
const YAHOO_AOL_FORWARDING_CONFIRMATION_HOSTS = new Set([
    'login.yahoo.com',
    'mail.yahoo.com',
    'account.yahoo.com',
    'api.login.yahoo.com',
    'login.aol.com',
    'mail.aol.com',
    'account.aol.com',
    'api.login.aol.com',
]);
const CLOUDFLARE_FORWARDING_CONFIRMATION_HOSTS = new Set([
    'dash.cloudflare.com',
]);
const PROTON_FORWARDING_CONFIRMATION_HOSTS = new Set([
    'account.proton.me',
    'mail.proton.me',
    'proton.me',
]);
const SQUARESPACE_FORWARDING_CONFIRMATION_HOSTS = new Set([
    'account.squarespace.com',
    'domains.squarespace.com',
    'squarespace.com',
    'www.squarespace.com',
]);
const ZOHO_FORWARDING_CONFIRMATION_HOSTS = new Set([
    'accounts.zoho.com',
    'mail.zoho.com',
    'accounts.zoho.eu',
    'mail.zoho.eu',
    'accounts.zoho.in',
    'mail.zoho.in',
    'accounts.zoho.com.au',
    'mail.zoho.com.au',
    'accounts.zoho.jp',
    'mail.zoho.jp',
    'accounts.zohocloud.ca',
    'mail.zohocloud.ca',
]);
function getUrlActionText(url) {
    try {
        return decodeURIComponent(`${url.pathname} ${url.search}`).toLowerCase();
    }
    catch {
        return `${url.pathname} ${url.search}`.toLowerCase();
    }
}
function hasForwardingConfirmationAction(url) {
    const text = getUrlActionText(url);
    return /verify|verification|confirm|confirmation|accept|forward|forwarding|routing|autorizar|aceitar|confirma|verifica/.test(text);
}
function isRejectedForwardingConfirmationAction(url) {
    const text = getUrlActionText(url);
    return /unsubscribe|cancel|decline|deny|reject|remove|optout|opt-out|descadastr|cancelar|recusar|remover/.test(text);
}
function isKnownProviderForwardingConfirmationUrl(url) {
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    if (GOOGLE_FORWARDING_CONFIRMATION_HOSTS.has(host)) {
        return path.startsWith('/mail/vf-') || /^\/mail\/u\/\d+\/vf-/.test(path);
    }
    if (CLOUDFLARE_FORWARDING_CONFIRMATION_HOSTS.has(host)) {
        return path.startsWith('/email_fwdr/verify');
    }
    if (YAHOO_AOL_FORWARDING_CONFIRMATION_HOSTS.has(host)) {
        return hasForwardingConfirmationAction(url);
    }
    if (PROTON_FORWARDING_CONFIRMATION_HOSTS.has(host)) {
        return hasForwardingConfirmationAction(url);
    }
    if (SQUARESPACE_FORWARDING_CONFIRMATION_HOSTS.has(host)) {
        return hasForwardingConfirmationAction(url);
    }
    if (ZOHO_FORWARDING_CONFIRMATION_HOSTS.has(host)) {
        return hasForwardingConfirmationAction(url);
    }
    return hasForwardingConfirmationAction(url);
}
function isAllowedForwardingConfirmationUrl(value) {
    const normalized = normalizeUrlCandidate(value);
    if (!normalized)
        return null;
    try {
        const url = new URL(normalized);
        const host = url.hostname.toLowerCase();
        const allowedHosts = getForwardingConfirmationHosts();
        if (url.protocol !== 'https:' || !allowedHosts.has(host)) {
            return null;
        }
        if (isRejectedForwardingConfirmationAction(url)) {
            return null;
        }
        if (!isKnownProviderForwardingConfirmationUrl(url)) {
            return null;
        }
        return url.toString();
    }
    catch {
        return null;
    }
}
function extractForwardingConfirmationUrls(parsed) {
    const candidates = [];
    const sources = [
        parsed.text || '',
        typeof parsed.html === 'string' ? parsed.html : '',
    ].filter(Boolean);
    for (const source of sources) {
        const raw = String(source);
        const hrefRegex = /href\s*=\s*["']([^"']+)["']/gi;
        for (const match of raw.matchAll(hrefRegex)) {
            candidates.push(match[1]);
        }
        const urlRegex = /https?:\/\/[^\s"'<>]+/gi;
        for (const match of raw.matchAll(urlRegex)) {
            candidates.push(match[0]);
        }
    }
    const allowed = candidates
        .map(isAllowedForwardingConfirmationUrl)
        .filter((url) => !!url);
    return Array.from(new Set(allowed));
}
function looksLikeForwardingConfirmation(subject, parsed, senderEmail) {
    const sender = normalizeEmailAddress(senderEmail) || '';
    const text = [
        subject,
        parsed.text || '',
        typeof parsed.html === 'string' ? parsed.html : '',
    ].join('\n').toLowerCase();
    const fromKnownGoogleSender = sender === 'forwarding-noreply@google.com' ||
        sender === 'mail-noreply@google.com';
    const hasForwardingTerm = /forwarding|email routing|routing address|encaminhamento|redirecionamento|reenvi(o|ar|amento)/i.test(text);
    const hasConfirmationTerm = /confirmation|confirmacao|confirma[cç][aã]o|confirmar|verification|verify|verifica[cç][aã]o|accept|aceitar|autorizar|allow|permitir/i.test(text);
    return (hasForwardingTerm && hasConfirmationTerm) || (fromKnownGoogleSender && hasConfirmationTerm);
}
function getResponseTextPreview(value) {
    return value.slice(0, 12000).toLowerCase();
}
function responseLooksLikeInteractiveAuth(finalUrl, body) {
    let finalUrlText = '';
    try {
        const url = new URL(finalUrl);
        finalUrlText = `${url.hostname} ${url.pathname} ${url.search}`.toLowerCase();
    }
    catch {
        finalUrlText = finalUrl.toLowerCase();
    }
    const page = getResponseTextPreview(body);
    if (/accounts\.google\.com|\/login\b|\/signin\b|\/sign-in\b|\/account\/challenge|\/checkpoint|\/reauth/i.test(finalUrlText)) {
        return true;
    }
    return /type=["']password["']|name=["']password["']|id=["']password["']|sign in to|log in to|login to|enter your password|two-step|2-step|two factor|captcha|human verification|enter (?:the )?verification code|verification code (?:is )?required|codigo de verificacao/.test(page);
}
export class EmailListenerService {
    static connection = null;
    static isProcessing = false;
    static init() {
        if (!env.IMAP.HOST || !env.IMAP.USER || !env.IMAP.PASS) {
            console.warn('[Email Listener] Missing IMAP credentials, skipping init.');
            return;
        }
        // Connect and start IDLE
        this.connect();
        // Heartbeat Cron: Run every 15 minutes to ensure connection is alive
        cron.schedule('*/15 * * * *', async () => {
            console.log('[Email Listener] Heartbeat check...');
            if (!this.connection || !this.connection.imap || this.connection.imap.state === 'disconnected') {
                console.warn('[Email Listener] Connection dead in heartbeat. Reconnecting...');
                this.reconnect();
            }
        });
    }
    static async connect() {
        const config = {
            imap: {
                user: env.IMAP.USER,
                password: env.IMAP.PASS,
                host: env.IMAP.HOST,
                port: env.IMAP.PORT ? Number(env.IMAP.PORT) : 993,
                tls: true,
                tlsOptions: { rejectUnauthorized: !env.MAIL_TLS_INSECURE },
                authTimeout: 15000,
                keepalive: true
            }
        };
        try {
            console.log('[IMAP] Tentando conectar à caixa de entrada (IDLE mode)...');
            this.connection = await imaps.connect(config);
            await this.connection.openBox('INBOX');
            console.log('[IMAP] Ligação estabelecida e IDLE ativo.');
            // Process existing unseen emails on startup
            await this.processInbox();
            // Listen for new mail
            this.connection.imap.on('mail', (numNewMsgs) => {
                console.log(`[IMAP IDLE] ⚡ ${numNewMsgs} novo(s) e-mail(s) detectado(s) em tempo real!`);
                this.processInbox();
            });
            // Handle connection issues
            this.connection.imap.on('error', (err) => {
                console.error('[IMAP ERROR] Erro na conexão imap:', err);
                this.reconnect();
            });
            this.connection.imap.on('end', () => {
                console.warn('[IMAP WARN] Conexão encerrada pelo servidor.');
                this.reconnect();
            });
        }
        catch (e) {
            console.error('[IMAP ERROR] Falha ao conectar:', e);
            this.reconnect();
        }
    }
    static reconnect() {
        if (this.connection) {
            try {
                this.connection.imap.removeAllListeners();
                this.connection.end();
            }
            catch (e) { }
            this.connection = null;
        }
        console.log('[IMAP] Agendando reconexão em 10 segundos...');
        setTimeout(() => {
            this.connect();
        }, 10000);
    }
    static async logSystem(empresa_id, acao, descricao) {
        try {
            await pool.query('INSERT INTO logs_sistema (empresa_id, acao, descricao, user_agent, ip) VALUES (?, ?, ?, ?, ?)', [empresa_id, acao, descricao, 'SYSTEM_EMAIL_LISTENER', '127.0.0.1']);
        }
        catch (e) {
            console.error('[Email Listener] Error writing system log:', e);
        }
    }
    static async trackProcessedConfirmationEmail(messageId, empresaId, channelId) {
        if (!messageId)
            return;
        try {
            await pool.query('INSERT IGNORE INTO processed_emails (message_id, empresa_id, ticket_id) VALUES (?, ?, NULL)', [messageId, empresaId]);
        }
        catch (err) {
            console.error(`[Email Listener] Failed to track forwarding confirmation email for channel ${channelId}:`, err);
        }
    }
    static async claimEmailForProcessing(messageKey, empresaId) {
        const [result] = await pool.query('INSERT IGNORE INTO processed_emails (message_id, empresa_id, ticket_id) VALUES (?, ?, NULL)', [messageKey, empresaId]);
        return Number(result?.affectedRows || 0) === 1;
    }
    static async attachProcessedEmailToTicket(messageKey, ticketId, empresaId) {
        if (!messageKey)
            return;
        await pool.query('UPDATE processed_emails SET ticket_id = ? WHERE message_id = ? AND empresa_id = ?', [ticketId, messageKey, empresaId]);
    }
    static async findPersistedEmailTicket(messageId, empresaId) {
        if (!messageId)
            return null;
        const [ticketRows] = await pool.query('SELECT id FROM tickets WHERE message_id = ? AND empresa_id = ? AND deleted_at IS NULL ORDER BY id ASC LIMIT 1', [messageId, empresaId]);
        if (ticketRows.length > 0)
            return Number(ticketRows[0].id);
        const [messageRows] = await pool.query(`SELECT m.ticket_id
       FROM ticket_mensagens m
       INNER JOIN tickets t ON t.id = m.ticket_id
       WHERE m.message_id = ? AND t.empresa_id = ? AND t.deleted_at IS NULL
       ORDER BY m.id ASC
       LIMIT 1`, [messageId, empresaId]);
        if (messageRows.length > 0)
            return Number(messageRows[0].ticket_id);
        return null;
    }
    static async releasePendingEmailClaim(messageKey, empresaId) {
        if (!messageKey || !empresaId)
            return;
        try {
            await pool.query('DELETE FROM processed_emails WHERE message_id = ? AND empresa_id = ? AND ticket_id IS NULL', [messageKey, empresaId]);
        }
        catch (err) {
            console.error(`[Email Listener] Failed to release pending email claim ${messageKey}:`, err);
        }
    }
    static async confirmForwardingUrl(url) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(url, {
                method: 'GET',
                redirect: 'follow',
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Gestifique-Forwarding-Confirmation/1.0',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
            });
            const finalUrl = response.url || url;
            const finalHost = new URL(finalUrl).hostname.toLowerCase();
            const finalHostAllowed = getForwardingConfirmationHosts().has(finalHost);
            const body = await response.text().catch(() => '');
            if (!finalHostAllowed) {
                return {
                    success: false,
                    status: response.status,
                    finalUrl,
                    error: `Redirecionado para host nao permitido (${finalHost}).`,
                };
            }
            if (response.status < 200 || response.status >= 400) {
                return {
                    success: false,
                    status: response.status,
                    finalUrl,
                    error: `HTTP ${response.status}`,
                };
            }
            if (responseLooksLikeInteractiveAuth(finalUrl, body)) {
                return {
                    success: false,
                    status: response.status,
                    finalUrl,
                    error: 'O link exige login, senha, captcha ou outra acao interativa.',
                };
            }
            return {
                success: true,
                status: response.status,
                finalUrl,
            };
        }
        catch (err) {
            return {
                success: false,
                error: err?.name === 'AbortError' ? 'Timeout ao confirmar encaminhamento.' : (err?.message || 'Erro desconhecido'),
            };
        }
        finally {
            clearTimeout(timeout);
        }
    }
    static async handleForwardingConfirmationEmail(params) {
        const { parsed, subject, senderEmail, empresaId, channelId, messageId } = params;
        if (!env.AUTO_CONFIRM_EMAIL_FORWARDING)
            return false;
        if (!looksLikeForwardingConfirmation(subject, parsed, senderEmail))
            return false;
        const urls = extractForwardingConfirmationUrls(parsed);
        if (urls.length === 0) {
            const msg = `E-mail de confirmacao de encaminhamento recebido para o canal ${channelId}, mas nenhum link permitido foi encontrado.`;
            await pool.query(`UPDATE empresa_email_canais
         SET ultimo_erro = ?, last_received_at = NOW()
         WHERE id = ?`, [msg, channelId]);
            await this.trackProcessedConfirmationEmail(messageId, empresaId, channelId);
            await this.logSystem(empresaId, 'EMAIL_FORWARDING_CONFIRMATION_NO_LINK', msg);
            return true;
        }
        let lastError = '';
        for (const url of urls) {
            const result = await this.confirmForwardingUrl(url);
            if (result.success) {
                await pool.query(`UPDATE empresa_email_canais
           SET status = ?, verified_at = NOW(), last_received_at = NOW(), ultimo_erro = NULL
           WHERE id = ?`, ['verificado', channelId]);
                await this.trackProcessedConfirmationEmail(messageId, empresaId, channelId);
                await this.logSystem(empresaId, 'EMAIL_FORWARDING_AUTO_CONFIRMED', `Encaminhamento confirmado automaticamente para o canal ${channelId} (HTTP ${result.status || 'ok'}).`);
                console.log(`[Email Listener] Forwarding confirmation accepted automatically for channel ${channelId}.`);
                return true;
            }
            lastError = result.error || `HTTP ${result.status || 'desconhecido'}`;
        }
        const failureMessage = `Falha ao confirmar encaminhamento automaticamente para o canal ${channelId}: ${lastError || 'link nao aceito'}`;
        await pool.query(`UPDATE empresa_email_canais
       SET status = CASE WHEN status IN ('pendente', 'erro') THEN 'erro' ELSE status END,
           ultimo_erro = ?,
           last_received_at = NOW()
       WHERE id = ?`, [failureMessage, channelId]);
        await this.trackProcessedConfirmationEmail(messageId, empresaId, channelId);
        await this.logSystem(empresaId, 'EMAIL_FORWARDING_AUTO_CONFIRM_FAILED', failureMessage);
        return true;
    }
    static async processInbox() {
        if (this.isProcessing)
            return;
        if (!this.connection)
            return;
        this.isProcessing = true;
        try {
            console.log('[IMAP] Processando e-mails não lidos...');
            const searchCriteria = ['UNSEEN'];
            const fetchOptions = {
                bodies: [''],
                markSeen: false
            };
            const messages = await this.connection.search(searchCriteria, fetchOptions);
            console.log(`[IMAP] Encontrados ${messages.length} e-mails não lidos (UNSEEN).`);
            if (messages.length === 0) {
                return;
            }
            for (const item of messages) {
                const uid = item.attributes.uid;
                let senderEmailStr = 'unknown';
                let claimedMessageKey = null;
                let claimedEmpresaId = null;
                let claimedMessageHandled = false;
                try {
                    const bodyPart = item.parts.find((part) => part.which === '');
                    if (!bodyPart)
                        continue;
                    const parsed = await simpleParser(bodyPart.body);
                    const messageId = parsed.messageId?.trim();
                    const fromObj = parsed.from?.value[0];
                    const senderEmail = fromObj?.address?.toLowerCase();
                    senderEmailStr = senderEmail || 'unknown';
                    const senderName = fromObj?.name || senderEmail || 'Sem Nome';
                    const subject = parsed.subject || 'Sem Assunto';
                    // 1. Identify recipient company/channel before any ticket lookup
                    let targetTicketId = null;
                    let targetEmpresaId = null;
                    let matchedChannelId = null;
                    console.log(`[Email Listener] [UID:${uid}] Processing message from ${maskEmail(senderEmail)}: "${subject}" (MessageID: ${maskIdentifier(messageId)})`);
                    let potentialRecipients = [];
                    const extractAddresses = (field) => {
                        if (!field)
                            return [];
                        if (Array.isArray(field)) {
                            return field.flatMap(f => extractAddresses(f));
                        }
                        if (field.value && Array.isArray(field.value)) {
                            return field.value.map((v) => v.address).filter(Boolean).map((a) => a.toLowerCase().trim());
                        }
                        if (typeof field === 'string') {
                            const match = field.match(/<(.+?)>/);
                            return [match ? match[1].toLowerCase().trim() : field.toLowerCase().trim()];
                        }
                        if (field.address)
                            return [field.address.toLowerCase().trim()];
                        return [];
                    };
                    potentialRecipients.push(...extractAddresses(parsed.to));
                    potentialRecipients.push(...extractAddresses(parsed.cc));
                    potentialRecipients.push(...extractAddresses(parsed.bcc));
                    const headerKeys = ['delivered-to', 'x-original-to', 'envelope-to', 'x-forwarded-to', 'apparently-to', 'x-real-to'];
                    for (const key of headerKeys) {
                        const val = parsed.headers.get(key);
                        potentialRecipients.push(...extractAddresses(val));
                    }
                    potentialRecipients = [...new Set(potentialRecipients.filter(a => !!a).map(a => a.toLowerCase().trim()))];
                    const maskedRecipients = potentialRecipients.map(recipient => maskEmail(recipient)).join(', ');
                    console.log(`[Email Listener] [UID:${uid}] Detected recipients: ${maskedRecipients}`);
                    if (potentialRecipients.length > 0) {
                        const [canaisMatch] = await pool.query('SELECT id, empresa_id, status FROM empresa_email_canais WHERE LOWER(TRIM(inbound_address)) IN (?) OR LOWER(TRIM(email_publico)) IN (?) LIMIT 2', [potentialRecipients, potentialRecipients]);
                        if (canaisMatch.length === 1) {
                            matchedChannelId = canaisMatch[0].id;
                            targetEmpresaId = canaisMatch[0].empresa_id;
                            console.log(`[Email Listener] [UID:${uid}] Matched channel ID ${matchedChannelId} for company ${targetEmpresaId}`);
                        }
                        else if (canaisMatch.length > 1) {
                            console.warn(`[Email Listener] [UID:${uid}] Ambiguous channel match for recipients: ${maskedRecipients}. Skipping.`);
                            await this.logSystem(null, 'EMAIL_AMBIGUOUS_CHANNEL', `Mais de um canal encontrado para destinatarios: ${maskedRecipients}. E-mail ignorado.`);
                            await this.connection.addFlags(uid, '\\Seen');
                            continue;
                        }
                        else {
                            const [empresasMatch] = await pool.query('SELECT id FROM empresas WHERE LOWER(TRIM(email)) IN (?) OR LOWER(TRIM(email_suporte)) IN (?) LIMIT 2', [potentialRecipients, potentialRecipients]);
                            if (empresasMatch.length === 1) {
                                targetEmpresaId = empresasMatch[0].id;
                                console.log(`[Email Listener] [UID:${uid}] Matched company ${targetEmpresaId} via legacy support email fallback.`);
                            }
                            else if (empresasMatch.length > 1) {
                                console.warn(`[Email Listener] [UID:${uid}] Ambiguous legacy company match for recipients: ${maskedRecipients}. Skipping.`);
                                await this.logSystem(null, 'EMAIL_AMBIGUOUS_COMPANY', `Mais de uma empresa encontrada para destinatarios: ${maskedRecipients}. E-mail ignorado.`);
                                await this.connection.addFlags(uid, '\\Seen');
                                continue;
                            }
                        }
                    }
                    if (!targetEmpresaId) {
                        console.warn(`[Email Listener] [UID:${uid}] No company found for recipients: ${maskedRecipients}. From: ${maskEmail(senderEmail)}.`);
                        await this.logSystem(null, 'EMAIL_WITHOUT_COMPANY', `Falha ao identificar empresa para email de ${maskEmail(senderEmail)} (Para: ${maskedRecipients}).`);
                        continue;
                    }
                    const identifyTicket = async (companyId) => {
                        // A) By X-Gestifique-Ticket-ID in headers, scoped to the recipient company
                        const headerTicketIdStr = parsed.headers.get('x-gestifique-ticket-id');
                        if (headerTicketIdStr && typeof headerTicketIdStr === 'string' && !isNaN(parseInt(headerTicketIdStr))) {
                            const id = parseInt(headerTicketIdStr);
                            const [rows] = await pool.query('SELECT id, empresa_id FROM tickets WHERE id = ? AND empresa_id = ? AND deleted_at IS NULL LIMIT 1', [id, companyId]);
                            if (rows.length > 0) {
                                console.log(`[Email Listener] Identified existing ticket #${id} via X-Gestifique-Ticket-ID header for company ${companyId}.`);
                                return { ticketId: id, hadExplicitTicketReference: true };
                            }
                            console.warn(`[Email Listener] X-Gestifique-Ticket-ID header indicated ticket #${id}, but it is not in company ${companyId}.`);
                            return { ticketId: null, hadExplicitTicketReference: true, invalidTicketId: id };
                        }
                        // B) By [Ticket #ID], Chamado #ID, etc in subject, scoped to the recipient company
                        const subjectMatch = subject.match(/(?:\[Ticket\s*#(\d+)\]|Chamado\s*#(\d+)|Ticket\s*#(\d+))/i);
                        if (subjectMatch) {
                            const id = parseInt(subjectMatch[1] || subjectMatch[2] || subjectMatch[3]);
                            const [rows] = await pool.query('SELECT id, empresa_id FROM tickets WHERE id = ? AND empresa_id = ? AND deleted_at IS NULL LIMIT 1', [id, companyId]);
                            if (rows.length > 0) {
                                console.log(`[Email Listener] Identified existing ticket #${id} via Subject for company ${companyId}.`);
                                return { ticketId: id, hadExplicitTicketReference: true };
                            }
                            console.warn(`[Email Listener] Subject indicated ticket #${id}, but it is not in company ${companyId}.`);
                            return { ticketId: null, hadExplicitTicketReference: true, invalidTicketId: id };
                        }
                        // C) Try pattern-based extraction on Message-ID / In-Reply-To / References, scoped to company
                        const inReplyTo = parsed.inReplyTo;
                        const references = Array.isArray(parsed.references) ? parsed.references : (parsed.references ? [parsed.references] : []);
                        const candidates = [
                            parsed.messageId,
                            inReplyTo,
                            ...references
                        ].filter(Boolean);
                        for (const candidate of candidates) {
                            const extractedTicketId = extractTicketIdFromGestifiqueMessageId(candidate);
                            if (extractedTicketId) {
                                const [rows] = await pool.query('SELECT id, empresa_id FROM tickets WHERE id = ? AND empresa_id = ? AND deleted_at IS NULL LIMIT 1', [extractedTicketId, companyId]);
                                if (rows.length > 0) {
                                    console.log(`[Email Listener] Identified existing ticket #${extractedTicketId} via Gestifique Message-ID pattern for company ${companyId}.`);
                                    return { ticketId: extractedTicketId, hadExplicitTicketReference: true };
                                }
                                console.warn(`[Email Listener] Gestifique Message-ID pattern indicated ticket #${extractedTicketId}, but it is not in company ${companyId}.`);
                                return { ticketId: null, hadExplicitTicketReference: true, invalidTicketId: extractedTicketId };
                            }
                        }
                        // D) By In-Reply-To or References headers inside processed_emails table, scoped to company
                        const allRefs = [inReplyTo, ...references].filter((r) => !!r);
                        if (allRefs.length > 0) {
                            const [refMatch] = await pool.query(`SELECT pe.ticket_id
                   FROM processed_emails pe
                   INNER JOIN tickets t ON t.id = pe.ticket_id AND t.empresa_id = pe.empresa_id AND t.deleted_at IS NULL
                   WHERE pe.empresa_id = ? AND pe.message_id IN (?) AND pe.ticket_id IS NOT NULL
                   ORDER BY pe.created_at DESC
                   LIMIT 1`, [companyId, allRefs]);
                            if (refMatch.length > 0) {
                                const dbTicketId = Number(refMatch[0].ticket_id);
                                console.log(`[Email Listener] Identified existing ticket #${dbTicketId} via headers (References DB) for company ${companyId}.`);
                                return { ticketId: dbTicketId, hadExplicitTicketReference: false };
                            }
                        }
                        return { ticketId: null, hadExplicitTicketReference: false };
                    };
                    const identificationResult = await identifyTicket(targetEmpresaId);
                    targetTicketId = identificationResult.ticketId;
                    if (identificationResult.hadExplicitTicketReference && !targetTicketId) {
                        const invalidId = identificationResult.invalidTicketId || 'Desconhecido';
                        console.warn(`[Email Listener] [UID:${uid}] Email referenced ticket #${invalidId} outside company ${targetEmpresaId}. Skipping.`);
                        await this.logSystem(targetEmpresaId, 'EMAIL_TICKET_REFERENCE_NOT_FOUND', `E-mail de ${maskEmail(senderEmail)} com referencia explicita para ticket invalido/fora da empresa #${invalidId}. Ignorado.`);
                        await this.connection.addFlags(uid, '\\Seen');
                        continue;
                    }
                    const messageKey = messageId || buildFallbackEmailDedupKey(parsed, subject, senderEmail, potentialRecipients);
                    const claimed = await this.claimEmailForProcessing(messageKey, targetEmpresaId);
                    if (!claimed) {
                        console.log(`[Email Listener] [UID:${uid}] Email already claimed/processed for company ${targetEmpresaId} (${maskIdentifier(messageKey)}). Skipping duplicate.`);
                        await this.connection.addFlags(uid, '\\Seen');
                        continue;
                    }
                    claimedMessageKey = messageKey;
                    claimedEmpresaId = targetEmpresaId;
                    const persistedEmailTicketId = await this.findPersistedEmailTicket(messageId, targetEmpresaId);
                    if (persistedEmailTicketId) {
                        await this.attachProcessedEmailToTicket(claimedMessageKey, persistedEmailTicketId, targetEmpresaId);
                        console.log(`[Email Listener] [UID:${uid}] Message-ID already persisted in ticket #${persistedEmailTicketId} for company ${targetEmpresaId}. Skipping duplicate.`);
                        claimedMessageHandled = true;
                        await this.connection.addFlags(uid, '\\Seen');
                        continue;
                    }
                    if (matchedChannelId) {
                        const forwardingConfirmationHandled = await this.handleForwardingConfirmationEmail({
                            parsed,
                            subject,
                            senderEmail,
                            empresaId: targetEmpresaId,
                            channelId: matchedChannelId,
                            messageId: claimedMessageKey,
                        });
                        if (forwardingConfirmationHandled) {
                            claimedMessageHandled = true;
                            await this.connection.addFlags(uid, '\\Seen');
                            continue;
                        }
                        await pool.query('UPDATE empresa_email_canais SET last_received_at = NOW(), ultimo_erro = NULL WHERE id = ?', [matchedChannelId]);
                        await pool.query(`UPDATE empresa_email_canais
                 SET status = ?, verified_at = IF(verified_at IS NULL, NOW(), verified_at)
                 WHERE id = ? AND status IN ('pendente', 'verificado', 'erro')`, ['ativo', matchedChannelId]);
                    }
                    // 4. Anti-Loop & System Prevention
                    const precedence = (parsed.headers.get('precedence') || '').toLowerCase();
                    const autoSubmitted = (parsed.headers.get('auto-submitted') || '').toLowerCase();
                    const isSystemHeader = parsed.headers.get('x-gestifique-system') === 'true';
                    // Better checks for system emails using normalized helpers
                    const systemEmailsNormalized = [
                        normalizeEmailAddress(env.IMAP.USER),
                        normalizeEmailAddress(env.SMTP.USER),
                        'mailer-daemon',
                        'postmaster',
                        'noreply',
                        'no-reply'
                    ].filter(Boolean);
                    const senderNormalized = normalizeEmailAddress(senderEmail);
                    const isSystemSender = senderNormalized ? systemEmailsNormalized.some(sys => senderNormalized.includes(sys)) : false;
                    const isAutoMsg = precedence === 'bulk' || precedence === 'junk' || precedence === 'list' || (autoSubmitted && autoSubmitted !== 'no');
                    if (isSystemSender || isAutoMsg || isSystemHeader) {
                        console.warn(`[Email Listener] [UID:${uid}] Anti-Loop triggered for ${maskEmail(senderEmail)} (isSystemSender: ${isSystemSender}, isAuto: ${isAutoMsg}, isSystemHeader: ${isSystemHeader})`);
                        await this.logSystem(targetEmpresaId, 'EMAIL_LOOP_PREVENTED', `Email de ${maskEmail(senderEmail)} ignorado via anti-loop (Precedence: ${precedence}, Auto-Submitted: ${autoSubmitted}, HeaderSistema: ${isSystemHeader}).`);
                        claimedMessageHandled = true;
                        await this.connection.addFlags(uid, '\\Seen');
                        continue;
                    }
                    // Thread duplication prevention check for responses that look like Gestifique thread and have system indicators but no valid DB match
                    if (!targetTicketId && looksLikeGestifiqueTicketThread(subject, parsed)) {
                        console.warn(`[Email Listener] [UID:${uid}] Ignored email from ${maskEmail(senderEmail)} because it looks like a Gestifique ticket thread fallback replica without active matching ticket.`);
                        await this.logSystem(targetEmpresaId, 'EMAIL_THREAD_REPLICA_IGNORED', `Email de ${maskEmail(senderEmail)} (Assunto: "${subject}") ignorado pois aparenta ser uma réplica antiga/inválida de thread sem ticket correspondente ativo.`);
                        claimedMessageHandled = true;
                        await this.connection.addFlags(uid, '\\Seen');
                        continue;
                    }
                    // 5. Resolve Sender Context
                    const { userId } = await this.resolveSenderContext(senderEmail, targetEmpresaId);
                    // 6. Cleanup Message Body
                    let text = parsed.text || '';
                    // Common patterns to strip previous conversation
                    text = text.split(/Em \d+ de [a-zç]+ de \d{4}.*pelo Gestifique.*escreveu:/i)[0]; // Gestifique specific
                    text = text.split(/Em \d+ de \w+ de \d{4}.*escreveu:/i)[0]; // Generic Portuguese
                    text = text.split(/On .* wrote:/i)[0]; // Generic English
                    text = text.split(/\r?\n\s*-+\s*Mensagem original\s*-+\s*/i)[0]; // "Original Message" separator
                    text = text.split(/\r?\n\s*>+/)[0]; // Blockquote entries
                    text = text.trim();
                    if (!text && parsed.text)
                        text = parsed.text.trim(); // Safety fallback
                    // 7. Handle Create or Update
                    if (!targetTicketId) {
                        // Smart deduplication fallback (Subject + Sender in 48h) because identifyTicket didn't find matched tickets via header
                        const [dupRows] = await pool.query('SELECT id FROM tickets WHERE titulo = ? AND (solicitante_email = ? OR usuario_id = ?) AND empresa_id = ? AND deleted_at IS NULL AND created_at > (NOW() - INTERVAL 2 DAY) AND status != "fechado" ORDER BY created_at DESC LIMIT 1', [subject, senderEmail, userId, targetEmpresaId]);
                        if (dupRows.length > 0) {
                            console.log(`[Email Listener] Identified duplicate ticket #${dupRows[0].id} via subject/sender matching.`);
                            targetTicketId = dupRows[0].id;
                        }
                    }
                    if (targetTicketId) {
                        const msgId = await ticketsService.addMessage({
                            ticket_id: targetTicketId,
                            usuario_id: userId || null, // Allow system fallback down line if needed
                            mensagem: text,
                            interno: 0,
                            message_id: messageId,
                            empresa_id: targetEmpresaId
                        });
                        await this.attachProcessedEmailToTicket(claimedMessageKey, targetTicketId, targetEmpresaId);
                        await this.logSystem(targetEmpresaId, 'EMAIL_MESSAGE_ADDED', `Nova mensagem via e-mail no ticket #${targetTicketId} de ${maskEmail(senderEmail)}.`);
                        await this.processAttachments(parsed, targetTicketId, msgId, userId, targetEmpresaId);
                        // MARK AS SEEN ONLY ON SUCCESS
                        claimedMessageHandled = true;
                        await this.connection.addFlags(uid, '\\Seen');
                        console.log(`[Email Listener] [UID:${uid}] Ticket #${targetTicketId} updated and email marked as seen.`);
                    }
                    if (!targetTicketId) {
                        const newTicketId = await ticketsService.create({
                            empresa_id: targetEmpresaId,
                            usuario_id: userId || null,
                            solicitante_nome: senderName,
                            solicitante_email: senderEmail,
                            titulo: subject,
                            descricao: text,
                            prioridade: 'media',
                            categoria: 'suporte',
                            origem: 'email',
                            email_channel_id: matchedChannelId,
                            message_id: messageId
                        });
                        await this.attachProcessedEmailToTicket(claimedMessageKey, newTicketId, targetEmpresaId);
                        await this.logSystem(targetEmpresaId, 'EMAIL_TICKET_CREATED', `Ticket #${newTicketId} criado via e-mail de ${maskEmail(senderEmail)}.`);
                        const newTicket = await ticketsService.getById(newTicketId);
                        if (newTicket && io) {
                            io.to(`empresa_${targetEmpresaId}`).emit('ticketCreated', newTicket);
                        }
                        await this.processAttachments(parsed, newTicketId, null, userId, targetEmpresaId);
                        // MARK AS SEEN ONLY ON SUCCESS
                        claimedMessageHandled = true;
                        await this.connection.addFlags(uid, '\\Seen');
                        console.log(`[Email Listener] [UID:${uid}] Ticket #${newTicketId} created from email and marked as seen.`);
                    }
                }
                catch (itemError) {
                    if (!claimedMessageHandled) {
                        await this.releasePendingEmailClaim(claimedMessageKey, claimedEmpresaId);
                    }
                    console.error(`[Email Listener] [UID:${uid}] Error processing item:`, itemError);
                    await this.logSystem(null, 'EMAIL_PROCESS_ERROR', `Erro ao processar e-mail UID ${uid} de ${maskEmail(senderEmailStr)}: ${itemError.message}`);
                }
            }
        }
        catch (e) {
            console.error('[IMAP ERROR] Falha no loop processInbox:', e);
        }
        finally {
            this.isProcessing = false;
        }
    }
    static async processAttachments(parsed, ticketId, msgId, userId, empresaId) {
        if (!parsed.attachments || parsed.attachments.length === 0)
            return;
        for (const att of parsed.attachments) {
            // Basic security validation
            const originalName = att.filename || 'anexo_email.bin';
            const contentType = att.contentType || 'application/octet-stream';
            const contentValidation = validateAttachmentBuffer(att.content, originalName, contentType);
            if (!contentValidation.ok) {
                console.warn(`[Email Listener] Blocked attachment ${originalName}: ${contentValidation.error}`);
                await this.logSystem(empresaId, 'ATTACHMENT_BLOCKED', `Anexo bloqueado: ${originalName} no Ticket #${ticketId}. Motivo: ${contentValidation.error}`);
                continue;
            }
            const forbiddenExts = ['.exe', '.bat', '.sh', '.js', '.vbs', '.scr', '.cmd'];
            const ext = path.extname(originalName).toLowerCase();
            if (forbiddenExts.includes(ext)) {
                console.warn(`[Email Listener] Blocked dangerous attachment: ${originalName}`);
                await this.logSystem(empresaId, 'ATTACHMENT_BLOCKED', `Anexo perigoso bloqueado: ${originalName} no Ticket #${ticketId}.`);
                continue;
            }
            // Max size check: 10MB
            if (att.size > 10 * 1024 * 1024) {
                console.warn(`[Email Listener] Attachment too large: ${originalName} (${att.size} bytes)`);
                await this.logSystem(empresaId, 'ATTACHMENT_REJECTED', `Anexo muito grande rejeitado: ${originalName} (${Math.round(att.size / 1024 / 1024)}MB).`);
                continue;
            }
            // Small noise check (e.g. small tracking pixels or icons)
            if (att.size < 500)
                continue;
            try {
                const uniqueFilename = `email-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext || '.bin'}`;
                // Usar StorageService em vez de fs direto
                const filePath = await storageService.save(att.content, {
                    filename: uniqueFilename,
                    mimeType: contentType
                });
                await attachmentsService.create({
                    ticket_id: ticketId,
                    mensagem_id: msgId,
                    usuario_id: userId || null,
                    empresa_id: empresaId,
                    nome_original: originalName,
                    nome_arquivo: uniqueFilename,
                    caminho: filePath,
                    mime_type: contentType,
                    tamanho_bytes: att.size,
                    interno: false
                });
                console.log(`[Email Listener] Attachment saved: ${originalName}`);
            }
            catch (err) {
                console.error(`[Email Listener] Error processing attachment ${originalName}:`, err);
            }
        }
    }
    static async resolveSenderContext(email, targetEmpresaId) {
        // 1. Look for verified user in the target company
        const [rows] = await pool.query('SELECT id, empresa_id FROM usuarios WHERE email = ? AND ativo = 1', [email]);
        if (rows.length > 0) {
            // Find matching company or first one if dev/global admin
            const match = rows.find((r) => r.empresa_id === targetEmpresaId);
            if (match)
                return { userId: match.id };
            // If user exists but in another company
            await this.logSystem(targetEmpresaId, 'EMAIL_SENDER_CROSS_COMPANY', `Email de ${maskEmail(email)} recebido, mas usuario pertence a empresa ${rows[0].empresa_id}. Tratado como externo.`);
            return { userId: null };
        }
        return { userId: null };
    }
}
