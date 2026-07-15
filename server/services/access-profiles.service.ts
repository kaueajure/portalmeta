import pool from '../db/connection.js';
import { filterGlobalPermissionsForUser } from './permissions.service.js';

export type AccessProfileInput = {
  nome: string;
  descricao?: string | null;
  base_perfil?: string | null;
  created_by?: number | null;
};

export const accessProfilesService = {
  async list() {
    const [rows]: any = await pool.query(
      `
        SELECT ap.*,
          (SELECT COUNT(*) FROM usuarios u WHERE u.access_profile_id = ap.id) as usuarios_count,
          (SELECT COUNT(*) FROM access_profile_permissions app WHERE app.access_profile_id = ap.id AND app.allowed = 1) as permissions_count
        FROM access_profiles ap
        WHERE ap.ativo = 1
        ORDER BY ap.sistema DESC, ap.nome ASC
      `,
      []
    );
    return rows;
  },

  async getById(id: number) {
    const [rows]: any = await pool.query('SELECT * FROM access_profiles WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async create(data: AccessProfileInput) {
    const [result]: any = await pool.query(
      `
        INSERT INTO access_profiles (nome, descricao, base_perfil, sistema, created_by)
        VALUES (?, ?, ?, 0, ?)
      `,
      [
        data.nome.trim(),
        data.descricao || null,
        data.base_perfil || null,
        data.created_by || null,
      ]
    );
    return this.getById(result.insertId);
  },

  async update(id: number, data: Partial<AccessProfileInput>) {
    const fields: string[] = [];
    const params: any[] = [];

    if (data.nome !== undefined) {
      fields.push('nome = ?');
      params.push(data.nome.trim());
    }
    if (data.descricao !== undefined) {
      fields.push('descricao = ?');
      params.push(data.descricao || null);
    }

    if (fields.length === 0) return this.getById(id);
    params.push(id);
    await pool.query(`UPDATE access_profiles SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.getById(id);
  },

  async getPermissions(profileId: number): Promise<string[]> {
    const [rows]: any = await pool.query(
      'SELECT permission_key FROM access_profile_permissions WHERE access_profile_id = ? AND allowed = 1',
      [profileId]
    );
    return rows.map((row: any) => row.permission_key);
  },

  async setPermissions(profileId: number, permissionKeys: string[], caller: any) {
    const allowedKeys = filterGlobalPermissionsForUser(caller, permissionKeys);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('DELETE FROM access_profile_permissions WHERE access_profile_id = ?', [profileId]);
      for (const key of allowedKeys) {
        await connection.query(
          `
            INSERT INTO access_profile_permissions (access_profile_id, permission_key, allowed)
            VALUES (?, ?, 1)
          `,
          [profileId, key]
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async getMatrix(profileId: number, caller: any) {
    const profile = await this.getById(profileId);
    if (!profile) throw new Error('Perfil de acesso nao encontrado.');

    const [catalogRows]: any = await pool.query(`
      SELECT permission_key as \`key\`, modulo, grupo, nome, descricao, nivel_risco as nivel_risk, ativo, ordem
      FROM permissions_catalog
      WHERE ativo = 1
      ORDER BY ordem ASC
    `);
    const catalog = caller.desenvolvedor
      ? catalogRows
      : catalogRows.filter((item: any) => filterGlobalPermissionsForUser(caller, [item.key]).length > 0);
    const permissions = await this.getPermissions(profileId);

    return {
      profile,
      permissions,
      catalog,
    };
  },

  async archive(id: number) {
    await pool.query('UPDATE access_profiles SET ativo = 0 WHERE id = ?', [id]);
  },
};
