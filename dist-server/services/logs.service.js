import pool from '../db/connection.js';
class LogsService {
    async list(filters) {
        const { user_id, action, start_date, end_date, search, is_dev, page = 1, limit = 20 } = filters;
        const offset = (page - 1) * limit;
        let queryBase = `
      FROM logs_sistema l
      LEFT JOIN usuarios u ON l.usuario_id = u.id
      WHERE 1=1
    `;
        const params = [];
        // ACL Logic
        if (!is_dev) {
            queryBase += ' AND l.usuario_id = ?';
            params.push(user_id);
        }
        if (user_id && is_dev) {
            queryBase += ' AND l.usuario_id = ?';
            params.push(user_id);
        }
        if (action) {
            queryBase += ' AND l.acao = ?';
            params.push(action);
        }
        if (search) {
            queryBase += ' AND (l.descricao LIKE ? OR l.acao LIKE ? OR u.nome LIKE ?)';
            const searchVal = `%${search}%`;
            params.push(searchVal, searchVal, searchVal);
        }
        if (start_date) {
            queryBase += ' AND l.created_at >= ?';
            params.push(`${start_date} 00:00:00`);
        }
        if (end_date) {
            queryBase += ' AND l.created_at <= ?';
            params.push(`${end_date} 23:59:59`);
        }
        const countQuery = `SELECT COUNT(*) as total ${queryBase}`;
        const [[{ total }]] = await pool.query(countQuery, params);
        const selectQuery = `SELECT l.*, u.nome as usuario_nome ${queryBase} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`;
        const [rows] = await pool.query(selectQuery, [...params, Number(limit), Number(offset)]);
        return {
            items: rows,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
}
export default new LogsService();
