import pool from '../db/connection.js';
class NotificationsService {
    async create(data) {
        const [result] = await pool.query('INSERT INTO notificacoes (usuario_id, empresa_id, tipo, titulo, mensagem, link, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)', [
            data.usuario_id,
            data.empresa_id || null,
            data.tipo,
            data.titulo,
            data.mensagem || null,
            data.link || null,
            data.metadata ? JSON.stringify(data.metadata) : null
        ]);
        return result.insertId;
    }
    async createMany(userIds, data) {
        if (userIds.length === 0)
            return;
        const values = userIds.map(userId => [
            userId,
            data.empresa_id || null,
            data.tipo,
            data.titulo,
            data.mensagem || null,
            data.link || null,
            data.metadata ? JSON.stringify(data.metadata) : null
        ]);
        await pool.query('INSERT INTO notificacoes (usuario_id, empresa_id, tipo, titulo, mensagem, link, metadata) VALUES ?', [values]);
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
        return rows.map((r) => ({
            ...r,
            lida: Boolean(r.lida),
            metadata: r.metadata ? (typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata) : null
        }));
    }
    async countUnread(userId) {
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM notificacoes WHERE usuario_id = ? AND lida = 0', [userId]);
        return Number(rows[0].count || 0);
    }
    async markAsRead(notificationId, userId) {
        await pool.query('UPDATE notificacoes SET lida = 1, read_at = NOW() WHERE id = ? AND usuario_id = ?', [notificationId, userId]);
    }
    async markAllAsRead(userId) {
        await pool.query('UPDATE notificacoes SET lida = 1, read_at = NOW() WHERE usuario_id = ? AND lida = 0', [userId]);
    }
    async delete(notificationId, userId) {
        await pool.query('DELETE FROM notificacoes WHERE id = ? AND usuario_id = ?', [notificationId, userId]);
    }
}
export default new NotificationsService();
