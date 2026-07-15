import pool from '../db/connection.js';
import bcrypt from 'bcryptjs';
import { sanitizeUser, sanitizeUsers } from '../utils/sanitize.js';
class UsersService {
    async list(filters) {
        let query = `
      SELECT u.id, u.nome, u.email, u.cargo, u.administrador, u.desenvolvedor, 
             u.ativo, u.empresa_id, u.perfil, u.access_profile_id,
             ap.nome as access_profile_nome,
             e.nome as empresa_nome 
      FROM usuarios u
      LEFT JOIN empresas e ON u.empresa_id = e.id
      LEFT JOIN access_profiles ap ON ap.id = u.access_profile_id
      WHERE 1=1
    `;
        const params = [];
        if (filters.empresaId) {
            query += ' AND u.empresa_id = ?';
            params.push(filters.empresaId);
        }
        if (filters.search) {
            query += ' AND (u.nome LIKE ? OR u.email LIKE ?)';
            params.push(`%${filters.search}%`, `%${filters.search}%`);
        }
        if (filters.status === 'ativo') {
            query += ' AND u.ativo = 1';
        }
        else if (filters.status === 'inativo') {
            query += ' AND u.ativo = 0';
        }
        query += ' ORDER BY u.nome ASC';
        const [rows] = await pool.query(query, params);
        return sanitizeUsers(rows);
    }
    async getById(id) {
        let rows = [];
        try {
            const [result] = await pool.query(`SELECT u.*, 
              e.nome as empresa_nome,
              e.email as empresa_email,
              e.telefone as empresa_telefone,
              e.cnpj as empresa_cnpj,
              e.logo as empresa_logo,
              e.cor_principal as empresa_cor_principal,
              e.endereco as empresa_endereco,
              e.email_assinatura as empresa_email_assinatura
       FROM usuarios u 
       LEFT JOIN empresas e ON u.empresa_id = e.id 
       WHERE u.id = ?`, [id]);
            rows = result;
        }
        catch (err) {
            if (err?.code !== 'ER_BAD_FIELD_ERROR')
                throw err;
            const [result] = await pool.query(`SELECT u.*, 
              e.nome as empresa_nome,
              e.email as empresa_email,
              e.telefone as empresa_telefone,
              e.cnpj as empresa_cnpj,
              e.logo as empresa_logo,
              e.cor_principal as empresa_cor_principal,
              e.endereco as empresa_endereco
       FROM usuarios u 
       LEFT JOIN empresas e ON u.empresa_id = e.id 
       WHERE u.id = ?`, [id]);
            rows = result;
        }
        if (rows.length === 0)
            return null;
        return sanitizeUser(rows[0]);
    }
    async create(data) {
        const { nome, email, password, empresa_id, cargo, telefone, administrador, desenvolvedor, perfil, access_profile_id } = data;
        const hash = await bcrypt.hash(password, 10);
        const perfilFinal = perfil || (desenvolvedor ? 'desenvolvedor' : administrador ? 'administrador' : 'atendente');
        const [result] = await pool.query('INSERT INTO usuarios (nome, email, senha_hash, empresa_id, cargo, telefone, administrador, desenvolvedor, ativo, perfil, access_profile_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)', [nome, email, hash, empresa_id, cargo, telefone, administrador ? 1 : 0, desenvolvedor ? 1 : 0, perfilFinal, access_profile_id || null]);
        return { id: result.insertId, nome, email };
    }
    async update(id, data) {
        const fields = [];
        const params = [];
        Object.keys(data).forEach(key => {
            if (['nome', 'email', 'cargo', 'administrador', 'desenvolvedor', 'ativo', 'telefone', 'foto', 'empresa_id', 'perfil', 'access_profile_id'].includes(key)) {
                fields.push(`${key} = ?`);
                params.push(data[key]);
            }
        });
        if (data.password) {
            fields.push('senha_hash = ?');
            params.push(await bcrypt.hash(data.password, 10));
        }
        if (fields.length === 0)
            return;
        params.push(id);
        await pool.query(`UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`, params);
    }
    async updatePassword(id, currentPassword, newPassword) {
        const [rows] = await pool.query('SELECT senha_hash FROM usuarios WHERE id = ?', [id]);
        if (rows.length === 0)
            throw new Error('Usuário não encontrado');
        const isValid = await bcrypt.compare(currentPassword, rows[0].senha_hash);
        if (!isValid)
            throw new Error('Senha atual incorreta');
        const hash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [hash, id]);
    }
    async deleteUser(id) {
        // 1. First ensure tickets are de-referenced (orphan recovery)
        await pool.query('UPDATE tickets SET usuario_id = NULL WHERE usuario_id = ?', [id]);
        await pool.query('UPDATE tickets SET responsavel_id = NULL WHERE responsavel_id = ?', [id]);
        // 2. Perform Soft Delete by setting active to 0
        await pool.query('UPDATE usuarios SET ativo = 0 WHERE id = ?', [id]);
    }
}
export default new UsersService();
