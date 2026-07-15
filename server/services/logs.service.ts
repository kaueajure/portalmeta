import  pool from  '../db/connection.js';

class LogsService {
  async list(filters: any) {
    const { 
      empresa_id, 
      user_id, 
      action, 
      start_date, 
      end_date, 
      search, 
      company_id,
      is_dev,
      page = 1,
      limit = 20
    } = filters;

    const offset = (page - 1) * limit;

    let queryBase = `
      FROM logs_sistema l
      LEFT JOIN usuarios u ON l.usuario_id = u.id
      LEFT JOIN empresas e ON l.empresa_id = e.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // ACL Logic
    if (!is_dev) {
      if (empresa_id) {
        queryBase += ' AND (l.empresa_id = ? OR l.usuario_id = ?)';
        params.push(empresa_id, user_id);
      } else {
        queryBase += ' AND l.usuario_id = ?';
        params.push(user_id);
      }
    } else if (company_id) {
      queryBase += ' AND l.empresa_id = ?';
      params.push(company_id);
    }

    if (user_id && !(!is_dev && !empresa_id)) { // Already handled in ACL if !is_dev
      if (is_dev) {
        queryBase += ' AND l.usuario_id = ?';
        params.push(user_id);
      }
    }

    if (action) {
      queryBase += ' AND l.acao = ?';
      params.push(action);
    }

    if (search) {
      queryBase += ' AND (l.descricao LIKE ? OR l.acao LIKE ? OR u.nome LIKE ? OR e.nome LIKE ?)';
      const searchVal = `%${search}%`;
      params.push(searchVal, searchVal, searchVal, searchVal);
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

    const selectQuery = `SELECT l.*, u.nome as usuario_nome, e.nome as empresa_nome ${queryBase} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`;
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
