import crypto from 'crypto';
import pool from '../db/connection.js';
import { env } from '../config/env.js';

const GRAPH_API_BASE = 'https://graph.facebook.com';

export type WhatsAppInboundMessage = {
  id: number;
  wa_message_id: string | null;
  direction: 'inbound' | 'outbound';
  from_phone: string | null;
  to_phone: string | null;
  contact_name: string | null;
  message_type: string;
  body: string | null;
  status: string | null;
  created_at: string;
};

export type WhatsAppConversation = {
  contact_phone: string;
  contact_name: string | null;
  last_body: string | null;
  last_direction: 'inbound' | 'outbound' | null;
  last_message_at: string;
  message_count: number;
};

function normalizePhone(value?: string | null): string {
  return String(value || '').replace(/\D/g, '');
}

function contactPhoneExpr(): string {
  return `CASE WHEN direction = 'inbound' THEN from_phone ELSE to_phone END`;
}

type WelcomeButton = { id: string; title: string };

function parseWelcomeButtons(raw: string): WelcomeButton[] {
  return String(raw || '')
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf(':');
      if (idx <= 0) return null;
      const id = part.slice(0, idx).trim().slice(0, 256);
      const title = part.slice(idx + 1).trim().slice(0, 20);
      if (!id || !title) return null;
      return { id, title };
    })
    .filter((b): b is WelcomeButton => Boolean(b))
    .slice(0, 3);
}

function maskToken(token?: string | null): string | null {
  if (!token) return null;
  if (token.length <= 12) return '••••';
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export const whatsappService = {
  isConfigured(): boolean {
    return Boolean(
      env.WHATSAPP.ENABLED &&
        env.WHATSAPP.ACCESS_TOKEN &&
        env.WHATSAPP.PHONE_NUMBER_ID &&
        env.WHATSAPP.VERIFY_TOKEN,
    );
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

  verifyWebhookChallenge(params: {
    mode?: string;
    token?: string;
    challenge?: string;
  }): { ok: true; challenge: string } | { ok: false; reason: string } {
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

  verifySignature(rawBody: Buffer | string | undefined, signatureHeader?: string): boolean {
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

  async persistMessage(input: {
    waMessageId?: string | null;
    direction: 'inbound' | 'outbound';
    fromPhone?: string | null;
    toPhone?: string | null;
    contactName?: string | null;
    messageType?: string;
    body?: string | null;
    status?: string | null;
    rawPayload?: unknown;
  }) {
    try {
      await pool.query(
        `
          INSERT INTO whatsapp_messages (
            wa_message_id, direction, from_phone, to_phone, contact_name,
            message_type, body, status, raw_payload
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            status = COALESCE(VALUES(status), status),
            body = COALESCE(VALUES(body), body),
            raw_payload = VALUES(raw_payload)
        `,
        [
          input.waMessageId || null,
          input.direction,
          input.fromPhone || null,
          input.toPhone || null,
          input.contactName || null,
          input.messageType || 'text',
          input.body || null,
          input.status || null,
          input.rawPayload ? JSON.stringify(input.rawPayload) : null,
        ],
      );
    } catch (err: any) {
      // Tabela pode ainda não existir se a migration não rodou.
      if (err?.code === 'ER_NO_SUCH_TABLE') {
        console.warn('[WhatsApp] Tabela whatsapp_messages ausente. Rode as migrations.');
        return;
      }
      throw err;
    }
  },

  async handleWebhookPayload(payload: any): Promise<{ processed: number }> {
    let processed = 0;
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value;
        if (!value) continue;

        const contacts = Array.isArray(value.contacts) ? value.contacts : [];
        const contactName = contacts[0]?.profile?.name || null;
        const metadataPhone = value?.metadata?.display_phone_number || null;

        const messages = Array.isArray(value.messages) ? value.messages : [];
        for (const msg of messages) {
          const textBody =
            msg?.text?.body ||
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

          // Menu com botões: só quando o texto for exatamente a palavra-gatilho (ex.: "teste").
          const trigger = env.WHATSAPP.AUTO_REPLY_TRIGGER;
          const inboundText = String(textBody || '').trim().toLowerCase();
          if (
            env.WHATSAPP.AUTO_REPLY &&
            trigger &&
            inboundText === trigger &&
            msg?.from &&
            msg?.type === 'text'
          ) {
            void this.sendWelcomeMenu(msg.from).catch((err) => {
              console.error('[WhatsApp] Falha no auto-reply de boas-vindas:', err);
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

  async listMessages(limit = 50): Promise<WhatsAppInboundMessage[]> {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    try {
      const [rows]: any = await pool.query(
        `
          SELECT id, wa_message_id, direction, from_phone, to_phone, contact_name,
                 message_type, body, status, created_at
          FROM whatsapp_messages
          WHERE message_type <> 'status'
          ORDER BY created_at DESC, id DESC
          LIMIT ?
        `,
        [safeLimit],
      );
      return rows;
    } catch (err: any) {
      if (err?.code === 'ER_NO_SUCH_TABLE') return [];
      throw err;
    }
  },

  async listConversations(limit = 80): Promise<WhatsAppConversation[]> {
    const safeLimit = Math.min(Math.max(Number(limit) || 80, 1), 200);
    const contactPhone = contactPhoneExpr();
    try {
      const [rows]: any = await pool.query(
        `
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
              ${contactPhone} AS contact_phone,
              contact_name,
              body,
              created_at
            FROM whatsapp_messages
            WHERE message_type <> 'status'
              AND ${contactPhone} IS NOT NULL
              AND ${contactPhone} <> ''
          ) AS threads
          GROUP BY contact_phone
          ORDER BY last_message_at DESC
          LIMIT ?
        `,
        [safeLimit],
      );
      return rows.map((row: any) => ({
        ...row,
        last_body: row.last_body || null,
        last_direction: row.last_direction || null,
      }));
    } catch (err: any) {
      if (err?.code === 'ER_NO_SUCH_TABLE') return [];
      throw err;
    }
  },

  async listThreadMessages(phone: string, limit = 200): Promise<WhatsAppInboundMessage[]> {
    const normalized = normalizePhone(phone);
    if (!normalized) return [];

    const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
    try {
      const [rows]: any = await pool.query(
        `
          SELECT id, wa_message_id, direction, from_phone, to_phone, contact_name,
                 message_type, body, status, created_at
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
        `,
        [normalized, normalized, safeLimit],
      );
      return rows;
    } catch (err: any) {
      if (err?.code === 'ER_NO_SUCH_TABLE') return [];
      throw err;
    }
  },

  async sendWelcomeMenu(to: string) {
    if (!this.isConfigured()) {
      throw Object.assign(new Error('WhatsApp não configurado'), { status: 400 });
    }

    const buttons = parseWelcomeButtons(env.WHATSAPP.WELCOME_BUTTONS);
    if (buttons.length === 0) {
      throw Object.assign(new Error('Nenhum botão de boas-vindas configurado'), { status: 400 });
    }

    return this.sendInteractiveButtons({
      to,
      header: env.WHATSAPP.WELCOME_HEADER,
      body: env.WHATSAPP.WELCOME_BODY,
      buttons,
    });
  },

  async sendInteractiveButtons(input: {
    to: string;
    header?: string;
    body: string;
    buttons: WelcomeButton[];
  }) {
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
    const payload: Record<string, unknown> = {
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

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg =
        data?.error?.message ||
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

  async sendTextMessage(to: string, text: string) {
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

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg =
        data?.error?.message ||
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

    return data;
  },

  async sendTemplateMessage(input: {
    to: string;
    templateName: string;
    languageCode?: string;
    bodyParams?: string[];
  }) {
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

    const components =
      input.bodyParams && input.bodyParams.length > 0
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

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg =
        data?.error?.message ||
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
