import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../db/connection.js';
import { emitNotificationCreated, emitNotificationsRead } from '../realtime.js';

export interface CreateNotificationData {
  usuario_id: number;
  event_key?: string | null;
  tipo: string;
  titulo: string;
  mensagem?: string | null;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface NotificationRow extends RowDataPacket {
  id: number;
  usuario_id: number;
  tipo: string;
  event_key: string | null;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  lida: number;
  metadata: string | Record<string, unknown> | null;
  created_at: string | Date;
  read_at: string | Date | null;
}

class NotificationsService {
  private normalize(row: NotificationRow) {
    return {
      ...row,
      lida: Boolean(row.lida),
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null,
    };
  }

  async create(data: CreateNotificationData) {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT IGNORE INTO notificacoes
       (usuario_id, tipo, event_key, titulo, mensagem, link, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.usuario_id,
        data.tipo,
        data.event_key || null,
        data.titulo, 
        data.mensagem || null, 
        data.link || null, 
        data.metadata ? JSON.stringify(data.metadata) : null
      ]
    );
    if (!result.insertId) return null;
    const [rows] = await pool.query<NotificationRow[]>(
      'SELECT * FROM notificacoes WHERE id = ?',
      [result.insertId],
    );
    const notification = rows[0] ? this.normalize(rows[0]) : null;
    if (notification) emitNotificationCreated(data.usuario_id, notification);
    return notification;
  }

  async createMany(userIds: number[], data: Omit<CreateNotificationData, 'usuario_id'>) {
    const uniqueIds = Array.from(new Set(userIds.map(Number).filter(Boolean)));
    if (uniqueIds.length === 0) return [];
    if (data.event_key) {
      const placeholders = uniqueIds.map(() => '?').join(',');
      const [existing]: any = await pool.query(
        `SELECT usuario_id FROM notificacoes WHERE event_key = ? AND usuario_id IN (${placeholders})`,
        [data.event_key, ...uniqueIds],
      );
      const existingIds = new Set(existing.map((row: any) => Number(row.usuario_id)));
      const pendingIds = uniqueIds.filter((id) => !existingIds.has(id));
      if (pendingIds.length === 0) return [];
      const values = pendingIds.map((usuario_id) => [
        usuario_id, data.tipo, data.event_key, data.titulo, data.mensagem || null,
        data.link || null, data.metadata ? JSON.stringify(data.metadata) : null,
      ]);
      await pool.query<ResultSetHeader>(
        `INSERT IGNORE INTO notificacoes
         (usuario_id, tipo, event_key, titulo, mensagem, link, metadata) VALUES ?`,
        [values],
      );
      const insertedPlaceholders = pendingIds.map(() => '?').join(',');
      const [rows] = await pool.query<NotificationRow[]>(
        `SELECT * FROM notificacoes WHERE event_key = ? AND usuario_id IN (${insertedPlaceholders})`,
        [data.event_key, ...pendingIds],
      );
      const notifications = rows.map((row) => this.normalize(row));
      notifications.forEach((notification) => emitNotificationCreated(notification.usuario_id, notification));
      return notifications;
    }
    await Promise.all(uniqueIds.map((usuario_id) => this.create({ ...data, usuario_id })));
    return [];
  }

  async listForUser(userId: number, filters: { unread_only?: boolean; limit?: number; offset?: number }) {
    let query = 'SELECT * FROM notificacoes WHERE usuario_id = ?';
    const params: (string | number | boolean)[] = [userId];

    if (filters.unread_only) {
      query += ' AND lida = 0';
    }

    query += ' ORDER BY created_at DESC';

    const limit = filters.limit ? Number(filters.limit) : 20;
    const offset = filters.offset ? Number(filters.offset) : 0;

    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query<NotificationRow[]>(query, params);
    
    return rows.map((r) => this.normalize(r));
  }

  async countUnread(userId: number): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM notificacoes WHERE usuario_id = ? AND lida = 0',
      [userId]
    );
    return Number(rows[0].count || 0);
  }

  async markAsRead(notificationId: number, userId: number) {
    await pool.query<ResultSetHeader>(
      'UPDATE notificacoes SET lida = 1, read_at = NOW() WHERE id = ? AND usuario_id = ?',
      [notificationId, userId]
    );
    emitNotificationsRead(userId, { id: notificationId });
  }

  async markAllAsRead(userId: number) {
    await pool.query<ResultSetHeader>(
      'UPDATE notificacoes SET lida = 1, read_at = NOW() WHERE usuario_id = ? AND lida = 0',
      [userId]
    );
    emitNotificationsRead(userId, { all: true });
  }

  async getPreferences(userId: number) {
    await pool.query(
      `INSERT IGNORE INTO notification_preferences (usuario_id) VALUES (?)`,
      [userId],
    );
    const [rows]: any = await pool.query(
      `SELECT sounds_enabled, volume, ticket_enabled, whatsapp_general_enabled,
              whatsapp_assigned_enabled, browser_enabled
       FROM notification_preferences WHERE usuario_id = ?`,
      [userId],
    );
    const row = rows[0] || {};
    return {
      sounds_enabled: Boolean(row.sounds_enabled ?? 1),
      volume: Math.max(0, Math.min(1, Number(row.volume ?? 0.7))),
      ticket_enabled: Boolean(row.ticket_enabled ?? 1),
      whatsapp_general_enabled: Boolean(row.whatsapp_general_enabled ?? 1),
      whatsapp_assigned_enabled: Boolean(row.whatsapp_assigned_enabled ?? 1),
      browser_enabled: Boolean(row.browser_enabled ?? 0),
    };
  }

  async updatePreferences(userId: number, input: Record<string, unknown>) {
    const current = await this.getPreferences(userId);
    const bool = (key: keyof typeof current) =>
      typeof input[key] === 'boolean' ? input[key] : current[key];
    const volume = input.volume === undefined
      ? current.volume
      : Math.max(0, Math.min(1, Number(input.volume)));
    await pool.query(
      `INSERT INTO notification_preferences
       (usuario_id, sounds_enabled, volume, ticket_enabled, whatsapp_general_enabled,
        whatsapp_assigned_enabled, browser_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE sounds_enabled = VALUES(sounds_enabled), volume = VALUES(volume),
         ticket_enabled = VALUES(ticket_enabled),
         whatsapp_general_enabled = VALUES(whatsapp_general_enabled),
         whatsapp_assigned_enabled = VALUES(whatsapp_assigned_enabled),
         browser_enabled = VALUES(browser_enabled)`,
      [userId, bool('sounds_enabled') ? 1 : 0, volume, bool('ticket_enabled') ? 1 : 0,
       bool('whatsapp_general_enabled') ? 1 : 0, bool('whatsapp_assigned_enabled') ? 1 : 0,
       bool('browser_enabled') ? 1 : 0],
    );
    return this.getPreferences(userId);
  }

  async delete(notificationId: number, userId: number) {
    await pool.query<ResultSetHeader>(
      'DELETE FROM notificacoes WHERE id = ? AND usuario_id = ?',
      [notificationId, userId]
    );
  }
}

export default new NotificationsService();
