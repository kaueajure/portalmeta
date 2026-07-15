import  pool from  '../db/connection.js';
import { seedDefaultProfilesForEmpresa } from './access-profiles.service.js';

const EMAIL_SIGNATURE_MAX_LENGTH = 2000;

class CompaniesService {
  async list(filters: { search?: string; status?: string; empresaId?: number } = {}) {
    let query = `
      SELECT e.*, 
             (SELECT COUNT(*) FROM usuarios u WHERE u.empresa_id = e.id) as total_usuarios,
             (SELECT COUNT(*) FROM tickets t WHERE t.empresa_id = e.id AND t.deleted_at IS NULL) as total_tickets
      FROM empresas e
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.empresaId !== undefined) {
      const empresaId = Number(filters.empresaId);
      if (Number.isInteger(empresaId) && empresaId > 0) {
        query += ' AND e.id = ?';
        params.push(empresaId);
      } else {
        query += ' AND 1=0';
      }
    }

    if (filters.search) {
      query += ' AND (e.nome LIKE ? OR e.cnpj LIKE ? OR e.email LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }

    if (filters.status === 'ativo') {
      query += ' AND e.ativo = 1';
    } else if (filters.status === 'inativo') {
      query += ' AND e.ativo = 0';
    }

    query += ' ORDER BY e.nome ASC';

    const [rows] = await pool.query(query, params);
    return rows;
  }

  async getById(id: number) {
    const [rows]: any = await pool.query('SELECT * FROM empresas WHERE id = ?', [id]);
    return rows[0] || null;
  }

  async create(data: any) {
    const { nome, cnpj, email, email_suporte, telefone, cor_principal = '#2563eb', logo } = data;
    const email_assinatura = typeof data.email_assinatura === 'string' && data.email_assinatura.trim()
      ? data.email_assinatura.trim()
      : `Atenciosamente,\nEquipe de Atendimento\n${nome}`;

    if (email_assinatura.length > EMAIL_SIGNATURE_MAX_LENGTH) {
      throw new Error('Assinatura de e-mail muito longa.');
    }

    // Duplication Check
    if (cnpj) {
      const [existing]: any = await pool.query('SELECT id FROM empresas WHERE cnpj = ?', [cnpj]);
      if (existing.length > 0) throw new Error('Este CNPJ já está cadastrado.');
    }
    if (email) {
      const [existing]: any = await pool.query('SELECT id FROM empresas WHERE email = ?', [email]);
      if (existing.length > 0) throw new Error('Este E-mail institucional já está cadastrado.');
    }
    if (email_suporte) {
      const [existing]: any = await pool.query('SELECT id FROM empresas WHERE email_suporte = ?', [email_suporte]);
      if (existing.length > 0) throw new Error('Este E-mail de suporte já está em uso por outra empresa.');
    }

    const [result]: any = await pool.query(
      'INSERT INTO empresas (nome, cnpj, email, email_suporte, telefone, cor_principal, logo, email_assinatura) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [nome, cnpj, email, email_suporte || null, telefone, cor_principal, logo, email_assinatura]
    );
    const companyId = result.insertId;

    await pool.query(
      `INSERT IGNORE INTO empresa_ticket_status
       (empresa_id, nome, valor, ativo, kanban_visivel, cor, especial, ordem)
       VALUES (?, 'Aberto', 'aberto', 1, 1, '#2563eb', 'inicial', 0),
              (?, 'Em Atendimento', 'em_andamento', 1, 1, '#4f46e5', 'normal', 1),
              (?, 'Finalizado', 'resolvido', 1, 1, '#059669', 'finalizado', 2)`,
      [companyId, companyId, companyId]
    );

    await seedDefaultProfilesForEmpresa(companyId);

    return companyId;
  }

  async update(id: number, data: any) {
    const { cnpj, email, email_suporte } = data;

    if (data.email_assinatura !== undefined && String(data.email_assinatura).length > EMAIL_SIGNATURE_MAX_LENGTH) {
      throw new Error('Assinatura de e-mail muito longa.');
    }

    // Duplication Check (Excluding self)
    if (cnpj) {
      const [existing]: any = await pool.query('SELECT id FROM empresas WHERE cnpj = ? AND id != ?', [cnpj, id]);
      if (existing.length > 0) throw new Error('Este CNPJ já está sendo usado por outra empresa.');
    }
    if (email) {
      const [existing]: any = await pool.query('SELECT id FROM empresas WHERE email = ? AND id != ?', [email, id]);
      if (existing.length > 0) throw new Error('Este E-mail já está sendo usado por outra empresa.');
    }
    if (email_suporte) {
      const [existing]: any = await pool.query('SELECT id FROM empresas WHERE email_suporte = ? AND id != ?', [email_suporte, id]);
      if (existing.length > 0) throw new Error('Este E-mail de suporte já está sendo usado por outra empresa.');
    }

    const fields: string[] = [];
    const params: any[] = [];
    Object.keys(data).forEach(key => {
      if (['nome', 'cnpj', 'email', 'email_suporte', 'telefone', 'ativo', 'cor_principal', 'logo', 'endereco', 'email_assinatura'].includes(key)) {
        fields.push(`${key} = ?`);
        if ((key === 'email_suporte' || key === 'email_assinatura') && data[key] === '') {
          params.push(null);
        } else {
          params.push(data[key]);
        }
      }
    });
    if (fields.length === 0) return;
    params.push(id);
    await pool.query(`UPDATE empresas SET ${fields.join(', ')} WHERE id = ?`, params);
  }
  async deleteCascade(id: number, currentUser: any) {
    if (Number(currentUser.empresa_id) === Number(id)) {
      throw new Error('Não é possível excluir a empresa à qual você está logado no momento.');
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [empresaRows]: any = await connection.query('SELECT nome FROM empresas WHERE id = ?', [id]);
      if (empresaRows.length === 0) {
        throw new Error('Empresa não encontrada.');
      }
      const nomeEmpresa = empresaRows[0].nome;

      // 1. Get attachments paths to delete files (physical)
      let attachments: any[] = [];
      try {
        const [anexosRows]: any = await connection.query('SELECT caminho FROM ticket_anexos WHERE empresa_id = ? AND caminho IS NOT NULL', [id]);
        attachments = anexosRows;
      } catch (err) {
        console.error(`[CompaniesService] Erro ao buscar anexos para deleção da empresa ${id}:`, err);
      }

      // 2. Cascade delete
      const tablesWithEmpresaId = [
        'processed_emails',
        'ticket_satisfacao',
        'ticket_eventos',
        'ticket_macros',
        'ticket_views',
        'ticket_anexos',
        'notificacoes',
        'ticket_automacoes',
        'knowledge_articles',
        'empresa_email_canais',
        'empresa_ticket_categorias',
        'empresa_ticket_servicos',
        'empresa_ticket_status',
        'empresa_sla_politicas',
        'empresa_distribuicao_regras',
        'logs_sistema',
        'usuarios',
        'access_profiles'
      ];

      // Delete references using ticket_id first to avoid foreign key issues if ON DELETE CASCADE is missing
      await connection.query('DELETE FROM ticket_leituras WHERE ticket_id IN (SELECT id FROM tickets WHERE empresa_id = ?)', [id]);
      await connection.query('DELETE FROM ticket_custom_fields WHERE ticket_id IN (SELECT id FROM tickets WHERE empresa_id = ?)', [id]);
      await connection.query('DELETE FROM ticket_tags WHERE ticket_id IN (SELECT id FROM tickets WHERE empresa_id = ?)', [id]);
      await connection.query('DELETE FROM ticket_mensagens WHERE ticket_id IN (SELECT id FROM tickets WHERE empresa_id = ?)', [id]);

      // Delete specific tables with empresa_id
      for (const table of tablesWithEmpresaId) {
        try {
          await connection.query(`DELETE FROM ${table} WHERE empresa_id = ?`, [id]);
        } catch (e: any) {
          console.warn(`[CompaniesService] Warning: Could not delete from ${table} for company ${id} - ${e.message}`);
          // Proceed cautiously, maybe table doesn't exist or is empty
        }
      }

      // Delete tickets
      await connection.query('DELETE FROM tickets WHERE empresa_id = ?', [id]);

      // Finally delete company
      await connection.query('DELETE FROM empresas WHERE id = ?', [id]);

      await connection.commit();

      // Attempt to physically delete attachments (we don't fail transaction if this fails)
      if (attachments.length > 0) {
        const fs = await import('fs/promises');
        for (const file of attachments) {
          if (file.caminho) {
            try {
              await fs.unlink(file.caminho);
            } catch (e: any) {
              console.warn(`[CompaniesService] Warning: Could not delete physical file ${file.caminho}: ${e.message}`);
            }
          }
        }
      }

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export default new CompaniesService();
