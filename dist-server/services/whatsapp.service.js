import crypto from 'crypto';
import pool from '../db/connection.js';
import { env } from '../config/env.js';
import { emitWhatsAppChanged } from '../realtime.js';
const GRAPH_API_BASE = 'https://graph.facebook.com';
function normalizePhone(value) {
    return String(value || '').replace(/\D/g, '');
}
function contactPhoneExpr() {
    return `CASE WHEN direction = 'inbound' THEN from_phone ELSE to_phone END`;
}
const DEFAULT_CLOSING_MESSAGE = 'Como não recebemos uma resposta nos últimos 60 minutos, este atendimento será encerrado automaticamente. Quando precisar, envie uma nova mensagem para iniciar um novo atendimento.';
const DEFAULT_BOT_SETTINGS = {
    autoReplyEnabled: true,
    menuType: 'buttons',
    welcomeHeader: 'MetaBit - Sistemas para Gestão Pública',
    welcomeBody: 'Seja Bem-Vindo, antes de iniciarmos seu atendimento, sobre qual sistema gostaria de falar?',
    buttons: [
        { id: 'pgp', title: 'Gestão Pública', description: 'Sistemas de gestão pública' },
        { id: 'pci', title: 'Controle Interno', description: 'Controle e auditoria' },
        { id: 'pts', title: 'Terceiro Setor', description: 'Entidades do terceiro setor' },
    ],
    listButtonText: 'Ver opções',
    listSectionTitle: 'Atendimento',
    inactivityMinutes: 60,
    closingMessage: DEFAULT_CLOSING_MESSAGE,
    updatedAt: null,
};
let botSettingsCache = null;
const BOT_SETTINGS_CACHE_MS = 2_000;
/** Evita reenvio do menu se a Meta entregar o mesmo evento duas vezes em sequência. */
const recentWelcomeSentAt = new Map();
const WELCOME_DEBOUNCE_MS = 8_000;
function parseOptionsRaw(input) {
    if (typeof input === 'string') {
        try {
            const parsed = JSON.parse(input);
            return Array.isArray(parsed) ? parsed : [];
        }
        catch {
            return [];
        }
    }
    return Array.isArray(input) ? input : [];
}
function normalizeMenuOptions(input, menuType) {
    const maxItems = menuType === 'list' ? 10 : 3;
    const titleMax = menuType === 'list' ? 24 : 20;
    const options = [];
    for (const item of parseOptionsRaw(input)) {
        const id = String(item?.id || '').trim().slice(0, 200);
        const title = String(item?.title || '').trim().slice(0, titleMax);
        const description = String(item?.description || '')
            .trim()
            .slice(0, 72);
        if (!id || !title)
            continue;
        const option = description ? { id, title, description } : { id, title };
        options.push(option);
        if (options.length >= maxItems)
            break;
    }
    return options;
}
function mapRowToBotSettings(row) {
    const inactivity = Number(row?.inactivity_minutes);
    const menuType = row?.menu_type === 'list' ? 'list' : 'buttons';
    const options = normalizeMenuOptions(row?.welcome_buttons_json, menuType);
    return {
        autoReplyEnabled: Boolean(row?.auto_reply_enabled),
        menuType,
        welcomeHeader: String(row?.welcome_header || DEFAULT_BOT_SETTINGS.welcomeHeader)
            .trim()
            .slice(0, 60),
        welcomeBody: String(row?.welcome_body || DEFAULT_BOT_SETTINGS.welcomeBody).trim(),
        buttons: options.length ? options : DEFAULT_BOT_SETTINGS.buttons.map((b) => ({ ...b })),
        listButtonText: String(row?.list_button_text || DEFAULT_BOT_SETTINGS.listButtonText)
            .trim()
            .slice(0, 20) || DEFAULT_BOT_SETTINGS.listButtonText,
        listSectionTitle: String(row?.list_section_title || DEFAULT_BOT_SETTINGS.listSectionTitle)
            .trim()
            .slice(0, 24) || DEFAULT_BOT_SETTINGS.listSectionTitle,
        inactivityMinutes: Number.isInteger(inactivity) && inactivity >= 1 && inactivity <= 24 * 60
            ? inactivity
            : DEFAULT_BOT_SETTINGS.inactivityMinutes,
        closingMessage: String(row?.closing_message || DEFAULT_CLOSING_MESSAGE).trim() || DEFAULT_CLOSING_MESSAGE,
        updatedAt: row?.updated_at ? String(row.updated_at) : null,
    };
}
function invalidateBotSettingsCache() {
    botSettingsCache = null;
}
function cloneDefaultSettings() {
    return {
        ...DEFAULT_BOT_SETTINGS,
        buttons: DEFAULT_BOT_SETTINGS.buttons.map((b) => ({ ...b })),
    };
}
function maskToken(token) {
    if (!token)
        return null;
    if (token.length <= 12)
        return '••••';
    return `${token.slice(0, 6)}…${token.slice(-4)}`;
}
function timingSafeEqualString(a, b) {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length)
        return false;
    return crypto.timingSafeEqual(bufA, bufB);
}
export const whatsappService = {
    isConfigured() {
        return Boolean(env.WHATSAPP.ENABLED &&
            env.WHATSAPP.ACCESS_TOKEN &&
            env.WHATSAPP.PHONE_NUMBER_ID &&
            env.WHATSAPP.VERIFY_TOKEN);
    },
    getPublicStatus() {
        const configured = this.isConfigured();
        const appUrl = (env.FRONTEND_URL || '').replace(/\/$/, '');
        const callbackUrl = appUrl
            ? `${appUrl}/api/whatsapp/webhook`
            : '/api/whatsapp/webhook';
        return {
            enabled: env.WHATSAPP.ENABLED,
            configured,
            phoneNumberId: env.WHATSAPP.PHONE_NUMBER_ID || null,
            businessAccountId: env.WHATSAPP.BUSINESS_ACCOUNT_ID || null,
            apiVersion: env.WHATSAPP.API_VERSION,
            hasAccessToken: Boolean(env.WHATSAPP.ACCESS_TOKEN),
            accessTokenPreview: maskToken(env.WHATSAPP.ACCESS_TOKEN),
            hasAppSecret: Boolean(env.WHATSAPP.APP_SECRET),
            verifyToken: env.WHATSAPP.VERIFY_TOKEN || null,
            callbackUrl,
            displayPhoneNumber: env.WHATSAPP.DISPLAY_PHONE_NUMBER || null,
        };
    },
    async getBotSettings() {
        const now = Date.now();
        if (botSettingsCache && now - botSettingsCache.at < BOT_SETTINGS_CACHE_MS) {
            return botSettingsCache.value;
        }
        try {
            const [rows] = await pool.query(`
          SELECT auto_reply_enabled, menu_type, welcome_header, welcome_body, welcome_buttons_json,
                 list_button_text, list_section_title,
                 inactivity_minutes, closing_message, updated_at
          FROM whatsapp_settings
          WHERE id = 1
          LIMIT 1
        `);
            const settings = rows?.[0] ? mapRowToBotSettings(rows[0]) : cloneDefaultSettings();
            botSettingsCache = { value: settings, at: now };
            return settings;
        }
        catch (err) {
            if (err?.code === 'ER_NO_SUCH_TABLE' || err?.code === 'ER_BAD_FIELD_ERROR') {
                return cloneDefaultSettings();
            }
            throw err;
        }
    },
    async updateBotSettings(input) {
        const current = await this.getBotSettings();
        const inactivityRaw = input.inactivityMinutes !== undefined ? Number(input.inactivityMinutes) : current.inactivityMinutes;
        const menuType = input.menuType === 'list' || input.menuType === 'buttons'
            ? input.menuType
            : current.menuType;
        const next = {
            autoReplyEnabled: input.autoReplyEnabled !== undefined ? Boolean(input.autoReplyEnabled) : current.autoReplyEnabled,
            menuType,
            welcomeHeader: String(input.welcomeHeader !== undefined ? input.welcomeHeader : current.welcomeHeader)
                .trim()
                .slice(0, 60),
            welcomeBody: String(input.welcomeBody !== undefined ? input.welcomeBody : current.welcomeBody).trim(),
            buttons: input.buttons !== undefined
                ? normalizeMenuOptions(input.buttons, menuType)
                : normalizeMenuOptions(current.buttons, menuType),
            listButtonText: String(input.listButtonText !== undefined ? input.listButtonText : current.listButtonText)
                .trim()
                .slice(0, 20),
            listSectionTitle: String(input.listSectionTitle !== undefined ? input.listSectionTitle : current.listSectionTitle)
                .trim()
                .slice(0, 24),
            inactivityMinutes: Number.isInteger(inactivityRaw) && inactivityRaw >= 1 && inactivityRaw <= 24 * 60
                ? inactivityRaw
                : current.inactivityMinutes,
            closingMessage: String(input.closingMessage !== undefined ? input.closingMessage : current.closingMessage).trim(),
            updatedAt: current.updatedAt,
        };
        if (!next.welcomeBody) {
            throw Object.assign(new Error('Informe o texto do menu de boas-vindas'), { status: 400 });
        }
        if (next.buttons.length === 0) {
            throw Object.assign(new Error(next.menuType === 'list'
                ? 'Configure de 1 a 10 itens na lista (título máx. 24 caracteres)'
                : 'Configure de 1 a 3 botões (título máx. 20 caracteres)'), { status: 400 });
        }
        if (next.menuType === 'list') {
            if (!next.listButtonText) {
                throw Object.assign(new Error('Informe o texto do botão que abre a lista'), { status: 400 });
            }
            if (!next.listSectionTitle) {
                throw Object.assign(new Error('Informe o título da seção da lista'), { status: 400 });
            }
        }
        if (!next.closingMessage) {
            throw Object.assign(new Error('Informe a mensagem de encerramento por inatividade'), {
                status: 400,
            });
        }
        await pool.query(`
        INSERT INTO whatsapp_settings (
          id, auto_reply_enabled, auto_reply_trigger,
          menu_type, welcome_header, welcome_body, welcome_buttons_json,
          list_button_text, list_section_title,
          inactivity_minutes, closing_message
        ) VALUES (1, ?, '', ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          auto_reply_enabled = VALUES(auto_reply_enabled),
          menu_type = VALUES(menu_type),
          welcome_header = VALUES(welcome_header),
          welcome_body = VALUES(welcome_body),
          welcome_buttons_json = VALUES(welcome_buttons_json),
          list_button_text = VALUES(list_button_text),
          list_section_title = VALUES(list_section_title),
          inactivity_minutes = VALUES(inactivity_minutes),
          closing_message = VALUES(closing_message)
      `, [
            next.autoReplyEnabled ? 1 : 0,
            next.menuType,
            next.welcomeHeader,
            next.welcomeBody,
            JSON.stringify(next.buttons),
            next.listButtonText,
            next.listSectionTitle,
            next.inactivityMinutes,
            next.closingMessage,
        ]);
        invalidateBotSettingsCache();
        return this.getBotSettings();
    },
    async getSession(phone) {
        const normalized = normalizePhone(phone);
        if (!normalized)
            return null;
        try {
            const [rows] = await pool.query(`
          SELECT contact_phone, contact_name, status, selected_option_id, selected_option_title,
                 last_client_message_at, last_company_message_at, attendance_started_at,
                 assigned_user_id, assigned_at, closed_at
          FROM whatsapp_sessions
          WHERE contact_phone = ?
          LIMIT 1
        `, [normalized]);
            return rows?.[0] || null;
        }
        catch (err) {
            if (err?.code === 'ER_NO_SUCH_TABLE')
                return null;
            throw err;
        }
    },
    async ensureSessionRow(phone, contactName) {
        await pool.query(`
        INSERT INTO whatsapp_sessions (contact_phone, contact_name, status)
        VALUES (?, ?, 'idle')
        ON DUPLICATE KEY UPDATE
          contact_name = COALESCE(VALUES(contact_name), contact_name)
      `, [phone, contactName || null]);
    },
    async startAttendance(phone, optionId, optionTitle, contactName) {
        const normalized = normalizePhone(phone);
        if (!normalized)
            return;
        try {
            await this.ensureSessionRow(normalized, contactName);
            await pool.query(`
          UPDATE whatsapp_sessions
          SET status = 'active',
              selected_option_id = ?,
              selected_option_title = ?,
              attendance_started_at = NOW(),
              last_client_message_at = NOW(),
              last_company_message_at = NULL,
              closed_at = NULL,
              contact_name = COALESCE(?, contact_name)
          WHERE contact_phone = ?
        `, [
                String(optionId || '').trim().toUpperCase().slice(0, 256),
                optionTitle,
                contactName || null,
                normalized,
            ]);
            emitWhatsAppChanged();
        }
        catch (err) {
            if (err?.code === 'ER_NO_SUCH_TABLE') {
                console.warn('[WhatsApp] Tabela whatsapp_sessions ausente. Rode as migrations.');
                return;
            }
            throw err;
        }
    },
    async closeAttendance(phone) {
        const normalized = normalizePhone(phone);
        if (!normalized)
            return;
        try {
            await pool.query(`
          UPDATE whatsapp_sessions
          SET status = 'idle',
              selected_option_id = NULL,
              selected_option_title = NULL,
              attendance_started_at = NULL,
              assigned_user_id = NULL,
              assigned_at = NULL,
              last_company_message_at = NULL,
              closed_at = NOW()
          WHERE contact_phone = ?
        `, [normalized]);
            emitWhatsAppChanged();
        }
        catch (err) {
            if (err?.code === 'ER_NO_SUCH_TABLE')
                return;
            throw err;
        }
    },
    async touchClientMessage(phone, contactName) {
        const normalized = normalizePhone(phone);
        if (!normalized)
            return;
        try {
            await this.ensureSessionRow(normalized, contactName);
            await pool.query(`
          UPDATE whatsapp_sessions
          SET last_client_message_at = NOW(),
              contact_name = COALESCE(?, contact_name)
          WHERE contact_phone = ?
        `, [contactName || null, normalized]);
        }
        catch (err) {
            if (err?.code === 'ER_NO_SUCH_TABLE')
                return;
            throw err;
        }
    },
    async markCompanyMessage(phone) {
        const normalized = normalizePhone(phone);
        if (!normalized)
            return;
        try {
            const session = await this.getSession(normalized);
            if (!session || session.status !== 'active')
                return;
            await pool.query(`
          UPDATE whatsapp_sessions
          SET last_company_message_at = NOW()
          WHERE contact_phone = ? AND status = 'active'
        `, [normalized]);
        }
        catch (err) {
            if (err?.code === 'ER_NO_SUCH_TABLE')
                return;
            throw err;
        }
    },
    async getAssignmentDetails(phone) {
        const normalized = normalizePhone(phone);
        if (!normalized)
            return { current: null, history: [] };
        const [currentRows, historyRows] = await Promise.all([
            pool.query(`
          SELECT s.status, s.assigned_user_id AS user_id, u.nome AS user_name,
                 DATE_FORMAT(s.assigned_at, '%Y-%m-%dT%H:%i:%sZ') AS assigned_at
          FROM whatsapp_sessions s
          LEFT JOIN usuarios u ON u.id = s.assigned_user_id
          WHERE s.contact_phone = ?
          LIMIT 1
        `, [normalized]),
            pool.query(`
          SELECT id, user_id, user_name,
                 DATE_FORMAT(assigned_at, '%Y-%m-%dT%H:%i:%sZ') AS assigned_at
          FROM whatsapp_assignment_history
          WHERE contact_phone = ?
          ORDER BY assigned_at ASC, id ASC
        `, [normalized]),
        ]);
        const currentRow = currentRows?.[0]?.[0];
        const current = currentRow?.status === 'active'
            && currentRow?.user_id
            && currentRow?.user_name
            && currentRow?.assigned_at
            ? {
                user_id: Number(currentRow.user_id),
                user_name: String(currentRow.user_name),
                assigned_at: String(currentRow.assigned_at),
            }
            : null;
        return {
            current,
            history: (historyRows?.[0] || []).map((row) => ({
                id: Number(row.id),
                user_id: Number(row.user_id),
                user_name: String(row.user_name || 'Atendente removido'),
                assigned_at: String(row.assigned_at),
            })),
        };
    },
    async claimAttendance(phone, actor) {
        const normalized = normalizePhone(phone);
        const actorId = Number(actor.id);
        const actorName = String(actor.name || '').trim();
        if (!normalized || !Number.isInteger(actorId) || actorId <= 0 || !actorName) {
            throw Object.assign(new Error('N\u00e3o foi poss\u00edvel identificar o atendimento ou o atendente.'), {
                status: 400,
            });
        }
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            await connection.query(`
          INSERT INTO whatsapp_sessions (contact_phone, status)
          VALUES (?, 'idle')
          ON DUPLICATE KEY UPDATE contact_phone = VALUES(contact_phone)
        `, [normalized]);
            const [rows] = await connection.query(`
          SELECT s.status, s.selected_option_id, s.assigned_user_id, s.assigned_at,
                 u.nome AS assigned_user_name
          FROM whatsapp_sessions s
          LEFT JOIN usuarios u ON u.id = s.assigned_user_id
          WHERE s.contact_phone = ?
          FOR UPDATE
        `, [normalized]);
            const session = rows?.[0];
            if (session?.status !== 'active' || !String(session?.selected_option_id || '').trim()) {
                throw Object.assign(new Error('Este atendimento n\u00e3o est\u00e1 ativo. Aguarde o cliente iniciar uma nova conversa.'), { status: 409 });
            }
            if (session?.assigned_user_id && Number(session.assigned_user_id) !== actorId) {
                throw Object.assign(new Error(`Este atendimento j\u00e1 est\u00e1 sob responsabilidade de ${session.assigned_user_name || 'outro atendente'}.`), { status: 409 });
            }
            if (!session?.assigned_user_id) {
                await connection.query(`
            UPDATE whatsapp_sessions
            SET assigned_user_id = ?, assigned_at = NOW()
            WHERE contact_phone = ? AND assigned_user_id IS NULL
          `, [actorId, normalized]);
                await connection.query(`
            INSERT INTO whatsapp_assignment_history (contact_phone, user_id, user_name, assigned_at)
            VALUES (?, ?, ?, NOW())
          `, [normalized, actorId, actorName]);
            }
            await connection.commit();
            emitWhatsAppChanged();
            return this.getAssignmentDetails(normalized);
        }
        catch (err) {
            try {
                await connection.rollback();
            }
            catch {
                // A transacao pode ja ter sido encerrada no conflito de atribuicao.
            }
            throw err;
        }
        finally {
            connection.release();
        }
    },
    /**
     * Fluxo sem palavra-gatilho:
     * - sem atendimento ativo → menu inicial (ou inicia se clicou em botão)
     * - atendimento ativo → só registra a mensagem do cliente
     */
    async processInboundAttendanceFlow(input) {
        const settings = await this.getBotSettings();
        if (!settings.autoReplyEnabled || !this.isConfigured())
            return;
        const phone = normalizePhone(input.fromPhone);
        if (!phone)
            return;
        const session = await this.getSession(phone);
        const isActive = session?.status === 'active';
        const optionReply = input.rawMessage?.interactive?.button_reply ||
            input.rawMessage?.interactive?.list_reply ||
            (input.rawMessage?.button
                ? { id: input.rawMessage.button.payload, title: input.rawMessage.button.text }
                : null);
        // Clique no menu (ou troca de serviço): grava escolha e abre/renova atendimento.
        if (optionReply?.id) {
            await this.startAttendance(phone, String(optionReply.id).slice(0, 256), String(optionReply.title || '').slice(0, 40), input.contactName);
            return;
        }
        if (isActive) {
            await this.touchClientMessage(phone, input.contactName);
            return;
        }
        // Sem atendimento ativo: qualquer mensagem dispara o menu inicial.
        await this.touchClientMessage(phone, input.contactName);
        const lastWelcome = recentWelcomeSentAt.get(phone) || 0;
        if (Date.now() - lastWelcome < WELCOME_DEBOUNCE_MS)
            return;
        recentWelcomeSentAt.set(phone, Date.now());
        await this.sendWelcomeMenu(phone);
    },
    async closeInactiveAttendances() {
        const settings = await this.getBotSettings();
        if (!settings.autoReplyEnabled || !this.isConfigured()) {
            return { closed: 0 };
        }
        const minutes = settings.inactivityMinutes;
        let rows = [];
        try {
            const [found] = await pool.query(`
          SELECT contact_phone
          FROM whatsapp_sessions
          WHERE status = 'active'
            AND last_company_message_at IS NOT NULL
            AND last_company_message_at <= DATE_SUB(NOW(), INTERVAL ? MINUTE)
            AND (
              last_client_message_at IS NULL
              OR last_client_message_at < last_company_message_at
            )
        `, [minutes]);
            rows = found || [];
        }
        catch (err) {
            if (err?.code === 'ER_NO_SUCH_TABLE')
                return { closed: 0 };
            throw err;
        }
        let closed = 0;
        for (const row of rows) {
            const phone = normalizePhone(row.contact_phone);
            if (!phone)
                continue;
            try {
                await this.sendTextMessage(phone, settings.closingMessage, { skipAttendanceTouch: true });
                await this.closeAttendance(phone);
                closed += 1;
            }
            catch (err) {
                console.error(`[WhatsApp] Falha ao encerrar atendimento ${phone}:`, err);
            }
        }
        return { closed };
    },
    verifyWebhookChallenge(params) {
        const verifyToken = env.WHATSAPP.VERIFY_TOKEN;
        if (!verifyToken) {
            return { ok: false, reason: 'WHATSAPP_VERIFY_TOKEN não configurado' };
        }
        if (params.mode !== 'subscribe') {
            return { ok: false, reason: 'hub.mode inválido' };
        }
        if (!params.token || !timingSafeEqualString(params.token, verifyToken)) {
            return { ok: false, reason: 'verify_token inválido' };
        }
        if (!params.challenge) {
            return { ok: false, reason: 'hub.challenge ausente' };
        }
        return { ok: true, challenge: params.challenge };
    },
    verifySignature(rawBody, signatureHeader) {
        const appSecret = env.WHATSAPP.APP_SECRET;
        if (!appSecret) {
            // Sem App Secret, aceita (útil no setup inicial). Em produção, configure META_APP_SECRET.
            return true;
        }
        if (!rawBody || !signatureHeader?.startsWith('sha256=')) {
            return false;
        }
        const expected = signatureHeader.slice('sha256='.length);
        const hmac = crypto
            .createHmac('sha256', appSecret)
            .update(typeof rawBody === 'string' ? rawBody : rawBody)
            .digest('hex');
        return timingSafeEqualString(hmac, expected);
    },
    async persistMessage(input) {
        try {
            await pool.query(`
          INSERT INTO whatsapp_messages (
            wa_message_id, direction, from_phone, to_phone, contact_name,
            message_type, body, status, raw_payload
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            status = COALESCE(VALUES(status), status),
            body = COALESCE(VALUES(body), body),
            raw_payload = VALUES(raw_payload)
        `, [
                input.waMessageId || null,
                input.direction,
                input.fromPhone || null,
                input.toPhone || null,
                input.contactName || null,
                input.messageType || 'text',
                input.body || null,
                input.status || null,
                input.rawPayload ? JSON.stringify(input.rawPayload) : null,
            ]);
            emitWhatsAppChanged();
        }
        catch (err) {
            // Tabela pode ainda não existir se a migration não rodou.
            if (err?.code === 'ER_NO_SUCH_TABLE') {
                console.warn('[WhatsApp] Tabela whatsapp_messages ausente. Rode as migrations.');
                return;
            }
            throw err;
        }
    },
    async handleWebhookPayload(payload) {
        let processed = 0;
        const entries = Array.isArray(payload?.entry) ? payload.entry : [];
        for (const entry of entries) {
            const changes = Array.isArray(entry?.changes) ? entry.changes : [];
            for (const change of changes) {
                const value = change?.value;
                if (!value)
                    continue;
                const contacts = Array.isArray(value.contacts) ? value.contacts : [];
                const contactName = contacts[0]?.profile?.name || null;
                const metadataPhone = value?.metadata?.display_phone_number || null;
                const messages = Array.isArray(value.messages) ? value.messages : [];
                for (const msg of messages) {
                    const textBody = msg?.text?.body ||
                        msg?.button?.text ||
                        msg?.interactive?.button_reply?.title ||
                        msg?.interactive?.list_reply?.title ||
                        (msg?.type ? `[${msg.type}]` : null);
                    await this.persistMessage({
                        waMessageId: msg.id || null,
                        direction: 'inbound',
                        fromPhone: msg.from || null,
                        toPhone: metadataPhone,
                        contactName,
                        messageType: msg.type || 'text',
                        body: textBody,
                        status: 'received',
                        rawPayload: msg,
                    });
                    processed += 1;
                    if (msg?.from) {
                        void this.processInboundAttendanceFlow({
                            fromPhone: msg.from,
                            contactName,
                            messageType: msg.type || 'text',
                            rawMessage: msg,
                        }).catch((err) => {
                            console.error('[WhatsApp] Falha no fluxo de atendimento:', err);
                        });
                    }
                }
                const statuses = Array.isArray(value.statuses) ? value.statuses : [];
                for (const st of statuses) {
                    await this.persistMessage({
                        waMessageId: st.id || null,
                        direction: 'outbound',
                        fromPhone: metadataPhone,
                        toPhone: st.recipient_id || null,
                        messageType: 'status',
                        body: null,
                        status: st.status || null,
                        rawPayload: st,
                    });
                    processed += 1;
                }
            }
        }
        return { processed };
    },
    async listMessages(limit = 50) {
        const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
        try {
            const [rows] = await pool.query(`
          SELECT id, wa_message_id, direction, from_phone, to_phone, contact_name,
                 message_type, body, status,
                 DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at
          FROM whatsapp_messages
          WHERE message_type <> 'status'
          ORDER BY created_at DESC, id DESC
          LIMIT ?
        `, [safeLimit]);
            return rows;
        }
        catch (err) {
            if (err?.code === 'ER_NO_SUCH_TABLE')
                return [];
            throw err;
        }
    },
    async listConversations(limit = 80) {
        const safeLimit = Math.min(Math.max(Number(limit) || 80, 1), 200);
        const contactPhone = contactPhoneExpr();
        try {
            const [rows] = await pool.query(`
          SELECT
            t.contact_phone,
            COALESCE(NULLIF(s.contact_name, ''), t.contact_name) AS contact_name,
            t.last_body,
            t.last_direction,
            DATE_FORMAT(t.last_message_at, '%Y-%m-%dT%H:%i:%sZ') AS last_message_at,
            t.message_count,
            CASE
              WHEN s.status = 'active' THEN NULLIF(s.selected_option_id, '')
              ELSE NULL
            END AS service_id,
            CASE
              WHEN s.status = 'active' THEN NULLIF(s.selected_option_title, '')
              ELSE NULL
            END AS service_title,
            s.status AS attendance_status,
            CASE WHEN s.status = 'active' THEN s.assigned_user_id ELSE NULL END AS assigned_user_id,
            CASE WHEN s.status = 'active' THEN u.nome ELSE NULL END AS assigned_user_name,
            CASE
              WHEN s.status = 'active'
                THEN DATE_FORMAT(s.assigned_at, '%Y-%m-%dT%H:%i:%sZ')
              ELSE NULL
            END AS assigned_at
          FROM (
            SELECT
              contact_phone,
              MAX(NULLIF(contact_name, '')) AS contact_name,
              SUBSTRING_INDEX(
                GROUP_CONCAT(
                  IFNULL(body, '')
                  ORDER BY created_at DESC, id DESC
                  SEPARATOR '|||'
                ),
                '|||',
                1
              ) AS last_body,
              SUBSTRING_INDEX(
                GROUP_CONCAT(
                  direction
                  ORDER BY created_at DESC, id DESC
                  SEPARATOR '|||'
                ),
                '|||',
                1
              ) AS last_direction,
              MAX(created_at) AS last_message_at,
              COUNT(*) AS message_count
            FROM (
              SELECT
                id,
                direction,
                REPLACE(REPLACE(REPLACE(IFNULL(${contactPhone}, ''), '+', ''), '-', ''), ' ', '') AS contact_phone,
                contact_name,
                body,
                created_at
              FROM whatsapp_messages
              WHERE message_type <> 'status'
                AND ${contactPhone} IS NOT NULL
                AND ${contactPhone} <> ''
            ) AS threads
            WHERE contact_phone <> ''
            GROUP BY contact_phone
            ORDER BY last_message_at DESC
            LIMIT ?
          ) AS t
          LEFT JOIN whatsapp_sessions s
            ON s.contact_phone = t.contact_phone
          LEFT JOIN usuarios u
            ON u.id = s.assigned_user_id
          ORDER BY t.last_message_at DESC
        `, [safeLimit]);
            return rows.map((row) => ({
                contact_phone: String(row.contact_phone || ''),
                contact_name: row.contact_name || null,
                last_body: row.last_body || null,
                last_direction: row.last_direction || null,
                last_message_at: row.last_message_at,
                message_count: Number(row.message_count) || 0,
                service_id: row.service_id ? String(row.service_id).trim().toUpperCase() : null,
                service_title: row.service_title || null,
                attendance_status: row.attendance_status === 'active' ? 'active' : row.attendance_status === 'idle' ? 'idle' : null,
                assigned_user_id: row.assigned_user_id ? Number(row.assigned_user_id) : null,
                assigned_user_name: row.assigned_user_name || null,
                assigned_at: row.assigned_at || null,
            }));
        }
        catch (err) {
            if (err?.code === 'ER_NO_SUCH_TABLE')
                return [];
            throw err;
        }
    },
    async listThreadMessages(phone, limit = 200) {
        const normalized = normalizePhone(phone);
        if (!normalized)
            return [];
        const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
        try {
            const [rows] = await pool.query(`
          SELECT id, wa_message_id, direction, from_phone, to_phone, contact_name,
                 message_type, body, status,
                 DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at
          FROM whatsapp_messages
          WHERE message_type <> 'status'
            AND (
              (
                direction = 'inbound'
                AND REPLACE(REPLACE(REPLACE(IFNULL(from_phone, ''), '+', ''), '-', ''), ' ', '') = ?
              )
              OR (
                direction = 'outbound'
                AND REPLACE(REPLACE(REPLACE(IFNULL(to_phone, ''), '+', ''), '-', ''), ' ', '') = ?
              )
            )
          ORDER BY created_at ASC, id ASC
          LIMIT ?
        `, [normalized, normalized, safeLimit]);
            return rows;
        }
        catch (err) {
            if (err?.code === 'ER_NO_SUCH_TABLE')
                return [];
            throw err;
        }
    },
    async sendWelcomeMenu(to) {
        if (!this.isConfigured()) {
            throw Object.assign(new Error('WhatsApp não configurado'), { status: 400 });
        }
        const settings = await this.getBotSettings();
        if (settings.buttons.length === 0) {
            throw Object.assign(new Error('Nenhuma opção de menu configurada'), { status: 400 });
        }
        if (settings.menuType === 'list') {
            return this.sendInteractiveList({
                to,
                header: settings.welcomeHeader,
                body: settings.welcomeBody,
                buttonText: settings.listButtonText,
                sectionTitle: settings.listSectionTitle,
                rows: settings.buttons,
            });
        }
        return this.sendInteractiveButtons({
            to,
            header: settings.welcomeHeader,
            body: settings.welcomeBody,
            buttons: settings.buttons,
        });
    },
    async sendInteractiveList(input) {
        if (!this.isConfigured()) {
            throw Object.assign(new Error('WhatsApp não configurado'), { status: 400 });
        }
        const phone = normalizePhone(input.to);
        const body = String(input.body || '').trim();
        const header = String(input.header || '').trim().slice(0, 60);
        const buttonText = String(input.buttonText || '').trim().slice(0, 20);
        const sectionTitle = String(input.sectionTitle || '').trim().slice(0, 24);
        const rows = normalizeMenuOptions(input.rows, 'list');
        if (!phone || phone.length < 10) {
            throw Object.assign(new Error('Número de destino inválido'), { status: 400 });
        }
        if (!body) {
            throw Object.assign(new Error('Mensagem vazia'), { status: 400 });
        }
        if (!buttonText || !sectionTitle || rows.length === 0) {
            throw Object.assign(new Error('Lista incompleta: botão, seção e itens são obrigatórios'), {
                status: 400,
            });
        }
        const url = `${GRAPH_API_BASE}/${env.WHATSAPP.API_VERSION}/${env.WHATSAPP.PHONE_NUMBER_ID}/messages`;
        const payload = {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'interactive',
            interactive: {
                type: 'list',
                body: { text: body.slice(0, 1024) },
                action: {
                    button: buttonText,
                    sections: [
                        {
                            title: sectionTitle,
                            rows: rows.map((row) => ({
                                id: row.id,
                                title: row.title,
                                ...(row.description ? { description: row.description } : {}),
                            })),
                        },
                    ],
                },
                ...(header ? { header: { type: 'text', text: header } } : {}),
            },
        };
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.WHATSAPP.ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const msg = data?.error?.message ||
                data?.message ||
                `Falha ao enviar lista interativa (${response.status})`;
            throw Object.assign(new Error(msg), { status: 502, details: data });
        }
        const waMessageId = data?.messages?.[0]?.id || null;
        const preview = `${header ? `${header}\n` : ''}${body}\n[Lista: ${rows.map((r) => r.title).join(' | ')}]`;
        await this.persistMessage({
            waMessageId,
            direction: 'outbound',
            fromPhone: env.WHATSAPP.DISPLAY_PHONE_NUMBER || null,
            toPhone: phone,
            messageType: 'interactive',
            body: preview,
            status: 'sent',
            rawPayload: data,
        });
        return data;
    },
    async sendInteractiveButtons(input) {
        if (!this.isConfigured()) {
            throw Object.assign(new Error('WhatsApp não configurado'), { status: 400 });
        }
        const phone = normalizePhone(input.to);
        const body = String(input.body || '').trim();
        const header = String(input.header || '').trim().slice(0, 60);
        const buttons = (input.buttons || [])
            .map((b) => ({
            id: String(b.id || '').trim().slice(0, 256),
            title: String(b.title || '').trim().slice(0, 20),
        }))
            .filter((b) => b.id && b.title)
            .slice(0, 3);
        if (!phone || phone.length < 10) {
            throw Object.assign(new Error('Número de destino inválido'), { status: 400 });
        }
        if (!body) {
            throw Object.assign(new Error('Mensagem vazia'), { status: 400 });
        }
        if (buttons.length === 0) {
            throw Object.assign(new Error('Informe de 1 a 3 botões'), { status: 400 });
        }
        const url = `${GRAPH_API_BASE}/${env.WHATSAPP.API_VERSION}/${env.WHATSAPP.PHONE_NUMBER_ID}/messages`;
        const payload = {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: { text: body.slice(0, 1024) },
                action: {
                    buttons: buttons.map((b) => ({
                        type: 'reply',
                        reply: { id: b.id, title: b.title },
                    })),
                },
                ...(header
                    ? {
                        header: { type: 'text', text: header },
                    }
                    : {}),
            },
        };
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.WHATSAPP.ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const msg = data?.error?.message ||
                data?.message ||
                `Falha ao enviar mensagem interativa (${response.status})`;
            throw Object.assign(new Error(msg), { status: 502, details: data });
        }
        const waMessageId = data?.messages?.[0]?.id || null;
        const preview = `${header ? `${header}\n` : ''}${body}\n[${buttons.map((b) => b.title).join(' | ')}]`;
        await this.persistMessage({
            waMessageId,
            direction: 'outbound',
            fromPhone: env.WHATSAPP.DISPLAY_PHONE_NUMBER || null,
            toPhone: phone,
            messageType: 'interactive',
            body: preview,
            status: 'sent',
            rawPayload: data,
        });
        return data;
    },
    async sendTextMessage(to, text, options) {
        if (!this.isConfigured()) {
            throw Object.assign(new Error('WhatsApp não configurado'), { status: 400 });
        }
        const phone = String(to || '').replace(/\D/g, '');
        const body = String(text || '').trim();
        if (!phone || phone.length < 10) {
            throw Object.assign(new Error('Número de destino inválido'), { status: 400 });
        }
        if (!body) {
            throw Object.assign(new Error('Mensagem vazia'), { status: 400 });
        }
        const url = `${GRAPH_API_BASE}/${env.WHATSAPP.API_VERSION}/${env.WHATSAPP.PHONE_NUMBER_ID}/messages`;
        const payload = {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { preview_url: false, body },
        };
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.WHATSAPP.ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const msg = data?.error?.message ||
                data?.message ||
                `Falha ao enviar mensagem (${response.status})`;
            throw Object.assign(new Error(msg), { status: 502, details: data });
        }
        const waMessageId = data?.messages?.[0]?.id || null;
        await this.persistMessage({
            waMessageId,
            direction: 'outbound',
            fromPhone: env.WHATSAPP.DISPLAY_PHONE_NUMBER || null,
            toPhone: phone,
            messageType: 'text',
            body,
            status: 'sent',
            rawPayload: data,
        });
        if (!options?.skipAttendanceTouch) {
            await this.markCompanyMessage(phone);
        }
        return data;
    },
    async sendAgentTextMessage(to, text, actor) {
        const phone = normalizePhone(to);
        const details = await this.getAssignmentDetails(phone);
        if (!details.current) {
            throw Object.assign(new Error('Defina um respons\u00e1vel pelo atendimento antes de enviar mensagens.'), { status: 409 });
        }
        if (details.current.user_id !== Number(actor.id)) {
            throw Object.assign(new Error(`Somente ${details.current.user_name}, respons\u00e1vel por este atendimento, pode responder ao cliente.`), { status: 403 });
        }
        const agentName = details.current.user_name.trim();
        const message = String(text || '').trim();
        return this.sendTextMessage(phone, `*${agentName}*:\n${message}`);
    },
    async sendTemplateMessage(input) {
        if (!this.isConfigured()) {
            throw Object.assign(new Error('WhatsApp não configurado'), { status: 400 });
        }
        const phone = String(input.to || '').replace(/\D/g, '');
        const templateName = String(input.templateName || '').trim();
        if (!phone || !templateName) {
            throw Object.assign(new Error('Destino e nome do template são obrigatórios'), {
                status: 400,
            });
        }
        const components = input.bodyParams && input.bodyParams.length > 0
            ? [
                {
                    type: 'body',
                    parameters: input.bodyParams.map((text) => ({ type: 'text', text })),
                },
            ]
            : undefined;
        const url = `${GRAPH_API_BASE}/${env.WHATSAPP.API_VERSION}/${env.WHATSAPP.PHONE_NUMBER_ID}/messages`;
        const payload = {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'template',
            template: {
                name: templateName,
                language: { code: input.languageCode || 'en_US' },
                ...(components ? { components } : {}),
            },
        };
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.WHATSAPP.ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const msg = data?.error?.message ||
                data?.message ||
                `Falha ao enviar template (${response.status})`;
            throw Object.assign(new Error(msg), { status: 502, details: data });
        }
        const waMessageId = data?.messages?.[0]?.id || null;
        await this.persistMessage({
            waMessageId,
            direction: 'outbound',
            fromPhone: env.WHATSAPP.DISPLAY_PHONE_NUMBER || null,
            toPhone: phone,
            messageType: 'template',
            body: `template:${templateName}`,
            status: 'sent',
            rawPayload: data,
        });
        return data;
    },
};
