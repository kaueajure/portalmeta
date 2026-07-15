import pool from '../db/connection.js';
import { filterGlobalPermissionsForUser } from './permissions.service.js';
import { DEFAULT_ROLE_PERMISSIONS } from '../constants/permissions.js';
const DEFAULT_COMPANY_PROFILES = [
    { perfil: 'gestor', nome: 'Gestor' },
    { perfil: 'atendente', nome: 'Atendente' },
    { perfil: 'cliente', nome: 'Cliente' },
];
export async function seedDefaultProfilesForEmpresa(empresaId) {
    for (const profile of DEFAULT_COMPANY_PROFILES) {
        await pool.query(`
        INSERT IGNORE INTO access_profiles (empresa_id, nome, descricao, base_perfil, sistema)
        VALUES (?, ?, ?, ?, 1)
      `, [empresaId, profile.nome, `Perfil padrao ${profile.nome}`, profile.perfil]);
        const [profileRows] = await pool.query('SELECT id FROM access_profiles WHERE empresa_id = ? AND nome = ? LIMIT 1', [empresaId, profile.nome]);
        const accessProfileId = profileRows[0]?.id;
        if (!accessProfileId)
            continue;
        for (const key of DEFAULT_ROLE_PERMISSIONS[profile.perfil] || []) {
            await pool.query(`
          INSERT IGNORE INTO access_profile_permissions (access_profile_id, permission_key, allowed)
          VALUES (?, ?, 1)
        `, [accessProfileId, key]);
        }
    }
}
export const accessProfilesService = {
    async list(empresaId) {
        const [rows] = await pool.query(`
        SELECT ap.*,
          (SELECT COUNT(*) FROM usuarios u WHERE u.access_profile_id = ap.id) as usuarios_count,
          (SELECT COUNT(*) FROM access_profile_permissions app WHERE app.access_profile_id = ap.id AND app.allowed = 1) as permissions_count
        FROM access_profiles ap
        WHERE ap.empresa_id = ? AND ap.ativo = 1
        ORDER BY ap.sistema DESC, ap.nome ASC
      `, [empresaId]);
        return rows;
    },
    async getById(id) {
        const [rows] = await pool.query('SELECT * FROM access_profiles WHERE id = ?', [id]);
        return rows[0] || null;
    },
    async create(data) {
        const [result] = await pool.query(`
        INSERT INTO access_profiles (empresa_id, nome, descricao, base_perfil, sistema, created_by)
        VALUES (?, ?, ?, ?, 0, ?)
      `, [
            data.empresa_id,
            data.nome.trim(),
            data.descricao || null,
            data.base_perfil || null,
            data.created_by || null,
        ]);
        return this.getById(result.insertId);
    },
    async update(id, data) {
        const fields = [];
        const params = [];
        if (data.nome !== undefined) {
            fields.push('nome = ?');
            params.push(data.nome.trim());
        }
        if (data.descricao !== undefined) {
            fields.push('descricao = ?');
            params.push(data.descricao || null);
        }
        if (fields.length === 0)
            return this.getById(id);
        params.push(id);
        await pool.query(`UPDATE access_profiles SET ${fields.join(', ')} WHERE id = ?`, params);
        return this.getById(id);
    },
    async getPermissions(profileId) {
        const [rows] = await pool.query('SELECT permission_key FROM access_profile_permissions WHERE access_profile_id = ? AND allowed = 1', [profileId]);
        return rows.map((row) => row.permission_key);
    },
    async setPermissions(profileId, permissionKeys, caller) {
        const allowedKeys = filterGlobalPermissionsForUser(caller, permissionKeys);
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            await connection.query('DELETE FROM access_profile_permissions WHERE access_profile_id = ?', [profileId]);
            for (const key of allowedKeys) {
                await connection.query(`
            INSERT INTO access_profile_permissions (access_profile_id, permission_key, allowed)
            VALUES (?, ?, 1)
          `, [profileId, key]);
            }
            await connection.commit();
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    },
    async getMatrix(profileId, caller) {
        const profile = await this.getById(profileId);
        if (!profile)
            throw new Error('Perfil de acesso nao encontrado.');
        const [catalogRows] = await pool.query(`
      SELECT permission_key as \`key\`, modulo, grupo, nome, descricao, nivel_risco as nivel_risk, ativo, ordem
      FROM permissions_catalog
      WHERE ativo = 1
      ORDER BY ordem ASC
    `);
        const catalog = caller.desenvolvedor
            ? catalogRows
            : catalogRows.filter((item) => filterGlobalPermissionsForUser(caller, [item.key]).length > 0);
        const permissions = await this.getPermissions(profileId);
        return {
            profile,
            permissions,
            catalog,
        };
    },
    async archive(id) {
        await pool.query('UPDATE access_profiles SET ativo = 0 WHERE id = ?', [id]);
    },
};
