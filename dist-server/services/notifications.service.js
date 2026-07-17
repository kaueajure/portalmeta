import pool from '../db/connection.js';
import { emitNotificationCreated, emitNotificationsRead } from '../realtime.js';
class NotificationsService {
    normalize(row) {
        return {
            ...row,
            lida: Boolean(row.lida),
            metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null,
        };
    }
    async create(data) {
        const [result] = await pool.query(`INSERT IGNORE INTO notificacoes
       (usuario_id, tipo, event_key, titulo, mensagem, link, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            data.usuario_id,
            data.tipo,
            data.event_key || null,
            data.titulo,
            data.mensagem || null,
            data.link || null,
            data.metadata ? JSON.stringify(data.metadata) : null
        ]);
        if (!result.insertId)
            return null;
        const [rows] = await pool.query('SELECT * FROM notificacoes WHERE id = ?', [result.insertId]);
        const notification = rows[0] ? this.normalize(rows[0]) : null;
        if (notification)
            emitNotificationCreated(data.usuario_id, notification);
        return notification;
    }
    async createMany(userIds, data) {
        const uniqueIds = Array.from(new Set(userIds.map(Number).filter(Boolean)));
        if (uniqueIds.length === 0)
            return [];
        if (data.event_key) {
            const placeholders = uniqueIds.map(() => '?').join(',');
            const [existing] = await pool.query(`SELECT usuario_id FROM notificacoes WHERE event_key = ? AND usuario_id IN (${placeholders})`, [data.event_key, ...uniqueIds]);
            const existingIds = new Set(existing.map((row) => Number(row.usuario_id)));
            const pendingIds = uniqueIds.filter((id) => !existingIds.has(id));
            if (pendingIds.length === 0)
                return [];
            const values = pendingIds.map((usuario_id) => [
                usuario_id, data.tipo, data.event_key, data.titulo, data.mensagem || null,
                data.link || null, data.metadata ? JSON.stringify(data.metadata) : null,
            ]);
            await pool.query(`INSERT IGNORE INTO notificacoes
         (usuario_id, tipo, event_key, titulo, mensagem, link, metadata) VALUES ?`, [values]);
            const insertedPlaceholders = pendingIds.map(() => '?').join(',');
            const [rows] = await pool.query(`SELECT * FROM notificacoes WHERE event_key = ? AND usuario_id IN (${insertedPlaceholders})`, [data.event_key, ...pendingIds]);
            const notifications = rows.map((row) => this.normalize(row));
            notifications.forEach((notification) => emitNotificationCreated(notification.usuario_id, notification));
            return notifications;
        }
        await Promise.all(uniqueIds.map((usuario_id) => this.create({ ...data, usuario_id })));
        return [];
    }
    async listForUser(userId, filters) {
        let query = 'SELECT * FROM notificacoes WHERE usuario_id = ?';
        const params = [userId];
        if (filters.unread_only) {
            query += ' AND lida = 0';
        }
        query += ' ORDER BY created_at DESC';
        const limit = filters.limit ? Number(filters.limit) : 20;
        const offset = filters.offset ? Number(filters.offset) : 0;
        query += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const [rows] = await pool.query(query, params);
        return rows.map((r) => this.normalize(r));
    }
    async countUnread(userId) {
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM notificacoes WHERE usuario_id = ? AND lida = 0', [userId]);
        return Number(rows[0].count || 0);
    }
    async markAsRead(notificationId, userId) {
        await pool.query('UPDATE notificacoes SET lida = 1, read_at = NOW() WHERE id = ? AND usuario_id = ?', [notificationId, userId]);
        emitNotificationsRead(userId, { id: notificationId });
    }
    async markAllAsRead(userId) {
        await pool.query('UPDATE notificacoes SET lida = 1, read_at = NOW() WHERE usuario_id = ? AND lida = 0', [userId]);
        emitNotificationsRead(userId, { all: true });
    }
    async getPreferences(userId) {
        await pool.query(`INSERT IGNORE INTO notification_preferences (usuario_id) VALUES (?)`, [userId]);
        const [rows] = await pool.query(`SELECT sounds_enabled, volume, ticket_enabled, whatsapp_general_enabled,
              whatsapp_assigned_enabled, browser_enabled
       FROM notification_preferences WHERE usuario_id = ?`, [userId]);
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
    async updatePreferences(userId, input) {
        const current = await this.getPreferences(userId);
        const bool = (key) => typeof input[key] === 'boolean' ? input[key] : current[key];
        const volume = input.volume === undefined
            ? current.volume
            : Math.max(0, Math.min(1, Number(input.volume)));
        await pool.query(`INSERT INTO notification_preferences
       (usuario_id, sounds_enabled, volume, ticket_enabled, whatsapp_general_enabled,
        whatsapp_assigned_enabled, browser_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE sounds_enabled = VALUES(sounds_enabled), volume = VALUES(volume),
         ticket_enabled = VALUES(ticket_enabled),
         whatsapp_general_enabled = VALUES(whatsapp_general_enabled),
         whatsapp_assigned_enabled = VALUES(whatsapp_assigned_enabled),
         browser_enabled = VALUES(browser_enabled)`, [userId, bool('sounds_enabled') ? 1 : 0, volume, bool('ticket_enabled') ? 1 : 0,
            bool('whatsapp_general_enabled') ? 1 : 0, bool('whatsapp_assigned_enabled') ? 1 : 0,
            bool('browser_enabled') ? 1 : 0]);
        return this.getPreferences(userId);
    }
    async delete(notificationId, userId) {
        await pool.query('DELETE FROM notificacoes WHERE id = ? AND usuario_id = ?', [notificationId, userId]);
    }
}
export default new NotificationsService();
