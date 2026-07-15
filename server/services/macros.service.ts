import pool from '../db/connection.js';

class MacrosService {
  async list(onlyActive = true) {
    let query = 'SELECT * FROM ticket_macros WHERE 1 = 1';
    if (onlyActive) query += ' AND ativo = 1';
    query += ' ORDER BY titulo ASC';
    
    const [rows]: any = await pool.query(query);
    return rows.map((r: any) => ({
      ...r,
      ativo: Number(r.ativo) === 1
    }));
  }

  async getById(id: number) {
    const [rows]: any = await pool.query(
      'SELECT * FROM ticket_macros WHERE id = ?',
      [id]
    );
    if (!rows[0]) return null;
    return {
      ...rows[0],
      ativo: Number(rows[0].ativo) === 1
    };
  }

  async create(data: any) {
    const { titulo, conteudo, categoria, servico, tags_json, created_by } = data;
    const [result]: any = await pool.query(
      'INSERT INTO ticket_macros (titulo, conteudo, categoria, servico, tags_json, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [titulo, conteudo, categoria || null, servico || null, tags_json ? JSON.stringify(tags_json) : null, created_by]
    );
    return result.insertId;
  }

  async update(id: number, data: any) {
    const fields: string[] = [];
    const params: any[] = [];

    if (data.titulo !== undefined) {
      fields.push('titulo = ?');
      params.push(data.titulo);
    }
    if (data.conteudo !== undefined) {
      fields.push('conteudo = ?');
      params.push(data.conteudo);
    }
    if (data.categoria !== undefined) {
      fields.push('categoria = ?');
      params.push(data.categoria || null);
    }
    if (data.servico !== undefined) {
      fields.push('servico = ?');
      params.push(data.servico || null);
    }
    if (data.tags_json !== undefined) {
      fields.push('tags_json = ?');
      params.push(JSON.stringify(data.tags_json || []));
    }
    if (data.ativo !== undefined) {
      fields.push('ativo = ?');
      params.push(data.ativo ? 1 : 0);
    }

    if (fields.length === 0) return true;

    params.push(id);
    await pool.query(
      `UPDATE ticket_macros SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      params
    );
    return true;
  }

  async incrementUse(id: number) {
    await pool.query('UPDATE ticket_macros SET uso_count = COALESCE(uso_count, 0) + 1 WHERE id = ?', [id]);
  }

  async applyMacro(id: number, ticketId: number) {
    const macro = await this.getById(id);
    if (!macro) throw new Error('Macro não encontrada');

    const [tickets]: any = await pool.query(`
      SELECT t.*, u.nome as cliente_nome, u.email as cliente_email, 
             r.nome as responsavel_nome
      FROM tickets t
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      LEFT JOIN usuarios r ON t.responsavel_id = r.id
      WHERE t.id = ?
    `, [ticketId]);

    const ticket = tickets[0];
    if (!ticket) throw new Error('Ticket não encontrado');

    let conteudo = macro.conteudo || '';
    conteudo = conteudo.replace(/{{cliente_nome}}/g, ticket.cliente_nome || '');
    conteudo = conteudo.replace(/{{cliente_email}}/g, ticket.cliente_email || '');
    conteudo = conteudo.replace(/{{ticket_id}}/g, String(ticket.id));
    conteudo = conteudo.replace(/{{ticket_titulo}}/g, ticket.titulo || '');
    conteudo = conteudo.replace(/{{responsavel_nome}}/g, ticket.responsavel_nome || '');
    conteudo = conteudo.replace(/{{categoria}}/g, ticket.categoria || '');
    conteudo = conteudo.replace(/{{servico}}/g, ticket.servico || '');
    conteudo = conteudo.replace(/{{status}}/g, ticket.status || '');
    conteudo = conteudo.replace(/{{prioridade}}/g, ticket.prioridade || '');

    // Increment usage
    await this.incrementUse(id);

    // Try to record event, but if it fails don't break the macro apply
    try {
      const { recordTicketEvent } = await import('./ticket-events.service.js');
      await recordTicketEvent({
        ticket_id: ticket.id,
        tipo: 'macro_usada',
        descricao: `Macro utilizada: ${macro.titulo}`
      });
    } catch (e) {
      console.warn('Could not record macro use event', e);
    }

    return conteudo;
  }

  async delete(id: number, softDelete = true) {
    if (softDelete) {
      await pool.query(
        'UPDATE ticket_macros SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
    } else {
      await pool.query(
        'DELETE FROM ticket_macros WHERE id = ?',
        [id]
      );
    }
    return true;
  }
}

export default new MacrosService();
