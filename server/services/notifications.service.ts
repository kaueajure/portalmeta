import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../db/connection.js';

export interface CreateNotificationData {
  usuario_id: number;
  empresa_id?: number | null;
  tipo: string;
  titulo: string;
  mensagem?: string | null;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface NotificationRow extends RowDataPacket {
  id: number;
  usuario_id: number;
  empresa_id: number | null;
  tipo: string;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  lida: number;
  metadata: string | Record<string, unknown> | null;
  created_at: string | Date;
  read_at: string | Date | null;
}

class NotificationsService {
  async create(data: CreateNotificationData) {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO notificacoes (usuario_id, empresa_id, tipo, titulo, mensagem, link, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        data.usuario_id, 
        data.empresa_id || null, 
        data.tipo, 
        data.titulo, 
        data.mensagem || null, 
        data.link || null, 
        data.metadata ? JSON.stringify(data.metadata) : null
      ]
    );
    return result.insertId;
  }

  async createMany(userIds: number[], data: Omit<CreateNotificationData, 'usuario_id'>) {
    if (userIds.length === 0) return;

    const values = userIds.map(userId => [
      userId,
      data.empresa_id || null,
      data.tipo,
      data.titulo,
      data.mensagem || null,
      data.link || null,
      data.metadata ? JSON.stringify(data.metadata) : null
    ]);

    await pool.query<ResultSetHeader>(
      'INSERT INTO notificacoes (usuario_id, empresa_id, tipo, titulo, mensagem, link, metadata) VALUES ?',
      [values]
    );
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
    
    return rows.map((r) => ({
      ...r,
      lida: Boolean(r.lida),
      metadata: r.metadata ? (typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata) : null
    }));
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
  }

  async markAllAsRead(userId: number) {
    await pool.query<ResultSetHeader>(
      'UPDATE notificacoes SET lida = 1, read_at = NOW() WHERE usuario_id = ? AND lida = 0',
      [userId]
    );
  }

  async delete(notificationId: number, userId: number) {
    await pool.query<ResultSetHeader>(
      'DELETE FROM notificacoes WHERE id = ? AND usuario_id = ?',
      [notificationId, userId]
    );
  }
}

export default new NotificationsService();
