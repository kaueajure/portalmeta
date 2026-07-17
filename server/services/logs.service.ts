import  pool from  '../db/connection.js';

class LogsService {
  async list(filters: any) {
    const { 
      user_id, 
      action, 
      start_date, 
      end_date, 
      search, 
      is_dev,
      page = 1,
      limit = 20
    } = filters;

    const offset = (page - 1) * limit;

    let queryBase = `
      FROM logs_sistema l
      LEFT JOIN usuarios u ON l.usuario_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // ACL: sem user_id + is_dev → vê todos; com user_id → só aquele operador
    if (user_id) {
      queryBase += ' AND l.usuario_id = ?';
      params.push(user_id);
    } else if (!is_dev) {
      // Sem escopo explícito e sem privilégio de ver todos → lista vazia
      queryBase += ' AND 1=0';
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
    const [[{ total }]]: any = await pool.query(countQuery, params);

    const selectQuery = `SELECT l.*, u.nome as usuario_nome ${queryBase} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`;
    const [rows]: any = await pool.query(selectQuery, [...params, Number(limit), Number(offset)]);

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
