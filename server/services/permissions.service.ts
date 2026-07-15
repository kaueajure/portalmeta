import pool from '../db/connection.js';
import { Connection } from 'mysql2/promise';
import { PERMISSIONS_CATALOG, DEFAULT_ROLE_PERMISSIONS, PermissionCatalogItem } from '../constants/permissions.js';
import { isDeveloperUser } from '../utils/user-scope.js';

interface Override {
  permission_key: string;
  effect: 'allow' | 'deny';
}

const userPermissionsCache = new Map<number, { permissions: string[]; expiresAt: number }>();

export function isGlobalOnlyPermission(permissionKey: string): boolean {
  return (
    permissionKey === '*' ||
    permissionKey.startsWith('sistema.') ||
    permissionKey.startsWith('telas.') ||
    ['empresas.criar', 'empresas.excluir', 'empresas.desativar', 'configuracoes.sistema'].includes(permissionKey)
  );
}

export function filterGlobalPermissionsForUser(user: any, permissionKeys: string[]): string[] {
  if (isDeveloperUser(user)) return permissionKeys;
  return permissionKeys.filter(key => !isGlobalOnlyPermission(key));
}

export function resolveEffectivePermissionKeys(user: any, roleKeys: string[], overrides: Override[]): string[] {
  if (!user) return [];
  if (isDeveloperUser(user)) return ['*'];

  if (user.administrador === 1 || user.administrador === true || user.perfil === 'administrador') {
    return filterGlobalPermissionsForUser(user, PERMISSIONS_CATALOG.map(item => item.key));
  }

  const permissionSet = new Set<string>(filterGlobalPermissionsForUser(user, roleKeys));

  const allows = overrides.filter(o => o.effect === 'allow').map(o => o.permission_key);
  const denies = overrides.filter(o => o.effect === 'deny').map(o => o.permission_key);

  for (const key of allows) {
    if (!isGlobalOnlyPermission(key)) {
      permissionSet.add(key);
    }
  }
  for (const key of denies) {
    permissionSet.delete(key);
  }

  return filterGlobalPermissionsForUser(user, Array.from(permissionSet));
}

export const permissionsService = {
  invalidateCache(userId: number) {
    userPermissionsCache.delete(userId);
  },

  async getCatalog(): Promise<any[]> {
    const [rows]: any = await pool.query(`
      SELECT permission_key as \`key\`, modulo, grupo, nome, descricao, nivel_risco as nivel_risk, ativo, ordem
      FROM permissions_catalog
      WHERE ativo = 1
      ORDER BY ordem ASC
    `);
    return rows;
  },

  async syncCatalog(): Promise<void> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Mark all currently active permissions as inactive initially (we will re-activate/upsert in the loop)
      await connection.query('UPDATE permissions_catalog SET ativo = 0');

      for (const item of PERMISSIONS_CATALOG) {
        await connection.query(`
          INSERT INTO permissions_catalog (permission_key, modulo, grupo, nome, descricao, nivel_risco, ativo, ordem)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?)
          ON DUPLICATE KEY UPDATE
            modulo = VALUES(modulo),
            grupo = VALUES(grupo),
            nome = VALUES(nome),
            descricao = VALUES(descricao),
            nivel_risco = VALUES(nivel_risco),
            ativo = 1,
            ordem = VALUES(ordem)
        `, [item.key, item.modulo, item.grupo, item.nome, item.descricao, item.nivel_risk, item.order]);
      }

      // Restore/Add default role permissions that might be missing
      for (const [perfil, keys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
        for (const key of keys) {
          await connection.query(`
            INSERT IGNORE INTO role_permissions (perfil, permission_key, allowed)
            VALUES (?, ?, 1)
          `, [perfil, key]);
        }
      }

      await connection.commit();
      // Invalidate all caches
      userPermissionsCache.clear();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  async getRolePermissions(perfil: string): Promise<string[]> {
    if (!perfil) return [];
    const [rows]: any = await pool.query(
      'SELECT permission_key FROM role_permissions WHERE perfil = ? AND allowed = 1',
      [perfil]
    );
    return rows.map((r: any) => r.permission_key);
  },

  async getAccessProfilePermissions(accessProfileId: number): Promise<string[]> {
    const [rows]: any = await pool.query(
      'SELECT permission_key FROM access_profile_permissions WHERE access_profile_id = ? AND allowed = 1',
      [accessProfileId]
    );
    return rows.map((r: any) => r.permission_key);
  },

  async getUserOverrides(userId: number): Promise<Override[]> {
    const [rows]: any = await pool.query(
      'SELECT permission_key, effect FROM user_permission_overrides WHERE usuario_id = ?',
      [userId]
    );
    return rows;
  },

  async getEffectivePermissions(user: any): Promise<string[]> {
    if (!user) return [];
    if (isDeveloperUser(user)) {
      return ['*'];
    }
    if (user.administrador === 1 || user.administrador === true || user.perfil === 'administrador') {
      return resolveEffectivePermissionKeys(user, [], []);
    }

    const userId = Number(user.id);
    const now = Date.now();
    const cached = userPermissionsCache.get(userId);
    if (cached && cached.expiresAt > now) {
      return cached.permissions;
    }

    const accessProfileId = user.access_profile_id ? Number(user.access_profile_id) : null;

    let roleKeys: string[];
    let overrides: Override[];

    if (accessProfileId) {
      roleKeys = await this.getAccessProfilePermissions(accessProfileId);
      overrides = [];
    } else {
      roleKeys = await this.getRolePermissions(user.perfil);
      overrides = await this.getUserOverrides(userId);
    }

    const effective = resolveEffectivePermissionKeys(user, roleKeys, overrides);
    userPermissionsCache.set(userId, {
      permissions: effective,
      expiresAt: now + 60000 // 60 seconds
    });

    return effective;
  },

  async hasPermission(user: any, permissionKey: string): Promise<boolean> {
    if (!user) return false;
    if (!isDeveloperUser(user) && isGlobalOnlyPermission(permissionKey)) {
      return false;
    }
    const effective = await this.getEffectivePermissions(user);
    if (effective.includes('*')) {
      return isDeveloperUser(user);
    }
    return effective.includes(permissionKey);
  },

  async setUserPermissionOverride(params: {
    usuarioId: number;
    permissionKey: string;
    effect: 'allow' | 'deny';
    grantedBy: number | null;
    motivo?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Get old override if exists
      const [oldRows]: any = await connection.query(
        'SELECT effect FROM user_permission_overrides WHERE usuario_id = ? AND permission_key = ?',
        [params.usuarioId, params.permissionKey]
      );
      const oldEffect = oldRows.length > 0 ? oldRows[0].effect : null;

      // Upsert override
      await connection.query(`
        INSERT INTO user_permission_overrides (usuario_id, permission_key, effect, granted_by, motivo)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          effect = VALUES(effect),
          granted_by = VALUES(granted_by),
          motivo = VALUES(motivo)
      `, [params.usuarioId, params.permissionKey, params.effect, params.grantedBy, params.motivo || null]);

      // Audit Log
      await connection.query(`
        INSERT INTO permission_audit_logs (usuario_alvo_id, usuario_executor_id, action, permission_key, old_effect, new_effect, motivo, ip, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        params.usuarioId,
        params.grantedBy,
        params.effect === 'allow' ? 'grant' : 'deny',
        params.permissionKey,
        oldEffect,
        params.effect,
        params.motivo || null,
        params.ip || null,
        params.userAgent || null
      ]);

      await connection.commit();
      this.invalidateCache(params.usuarioId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  async removeUserPermissionOverride(params: {
    usuarioId: number;
    permissionKey: string;
    executorId: number | null;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Get current override
      const [oldRows]: any = await connection.query(
        'SELECT effect FROM user_permission_overrides WHERE usuario_id = ? AND permission_key = ?',
        [params.usuarioId, params.permissionKey]
      );
      if (oldRows.length === 0) {
        await connection.rollback();
        connection.release();
        return;
      }
      const oldEffect = oldRows[0].effect;

      // Delete override
      await connection.query(
        'DELETE FROM user_permission_overrides WHERE usuario_id = ? AND permission_key = ?',
        [params.usuarioId, params.permissionKey]
      );

      // Audit Log
      await connection.query(`
        INSERT INTO permission_audit_logs (usuario_alvo_id, usuario_executor_id, action, permission_key, old_effect, new_effect, ip, user_agent)
        VALUES (?, ?, 'remove_override', ?, ?, NULL, ?, ?)
      `, [
        params.usuarioId,
        params.executorId,
        params.permissionKey,
        oldEffect,
        params.ip || null,
        params.userAgent || null
      ]);

      await connection.commit();
      this.invalidateCache(params.usuarioId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  async resetUserPermissions(usuarioId: number, executorId: number | null, ip?: string, userAgent?: string): Promise<void> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        'DELETE FROM user_permission_overrides WHERE usuario_id = ?',
        [usuarioId]
      );

      // Audit Log
      await connection.query(`
        INSERT INTO permission_audit_logs (usuario_alvo_id, usuario_executor_id, action, ip, user_agent)
        VALUES (?, ?, 'reset_user', ?, ?)
      `, [usuarioId, executorId, ip || null, userAgent || null]);

      await connection.commit();
      this.invalidateCache(usuarioId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  async setUserPermissionOverridesBulk(params: {
    usuarioId: number;
    permissionKeys: string[];
    effect: 'allow' | 'deny';
    grantedBy: number | null;
    motivo?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const key of params.permissionKeys) {
        // Get old override if exists
        const [oldRows]: any = await connection.query(
          'SELECT effect FROM user_permission_overrides WHERE usuario_id = ? AND permission_key = ?',
          [params.usuarioId, key]
        );
        const oldEffect = oldRows.length > 0 ? oldRows[0].effect : null;

        // Upsert override
        await connection.query(`
          INSERT INTO user_permission_overrides (usuario_id, permission_key, effect, granted_by, motivo)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            effect = VALUES(effect),
            granted_by = VALUES(granted_by),
            motivo = VALUES(motivo)
        `, [params.usuarioId, key, params.effect, params.grantedBy, params.motivo || null]);

        // Audit Log
        await connection.query(`
          INSERT INTO permission_audit_logs (usuario_alvo_id, usuario_executor_id, action, permission_key, old_effect, new_effect, motivo, ip, user_agent)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          params.usuarioId,
          params.grantedBy,
          params.effect === 'allow' ? 'grant' : 'deny',
          key,
          oldEffect,
          params.effect,
          params.motivo || null,
          params.ip || null,
          params.userAgent || null
        ]);
      }

      await connection.commit();
      this.invalidateCache(params.usuarioId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  async removeUserPermissionOverridesBulk(params: {
    usuarioId: number;
    permissionKeys: string[];
    executorId: number | null;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const key of params.permissionKeys) {
        // Get current override
        const [oldRows]: any = await connection.query(
          'SELECT effect FROM user_permission_overrides WHERE usuario_id = ? AND permission_key = ?',
          [params.usuarioId, key]
        );
        if (oldRows.length === 0) continue;
        const oldEffect = oldRows[0].effect;

        // Delete override
        await connection.query(
          'DELETE FROM user_permission_overrides WHERE usuario_id = ? AND permission_key = ?',
          [params.usuarioId, key]
        );

        // Audit Log
        await connection.query(`
          INSERT INTO permission_audit_logs (usuario_alvo_id, usuario_executor_id, action, permission_key, old_effect, new_effect, ip, user_agent)
          VALUES (?, ?, 'remove_override', ?, ?, NULL, ?, ?)
        `, [
          params.usuarioId,
          params.executorId,
          key,
          oldEffect,
          params.ip || null,
          params.userAgent || null
        ]);
      }

      await connection.commit();
      this.invalidateCache(params.usuarioId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  async getUserPermissionMatrix(usuarioId: number): Promise<any> {
    const [userRows]: any = await pool.query(
      `SELECT u.id, u.nome, u.email, u.perfil, u.administrador, u.desenvolvedor, u.empresa_id, u.access_profile_id, ap.nome as access_profile_nome
       FROM usuarios u
       LEFT JOIN access_profiles ap ON ap.id = u.access_profile_id
       WHERE u.id = ?`,
      [usuarioId]
    );
    if (userRows.length === 0) {
      throw new Error('Usuário não encontrado.');
    }
    const user = userRows[0];

    const catalog = await this.getCatalog();
    const accessProfileId = user.access_profile_id ? Number(user.access_profile_id) : null;
    const rolePermissions = accessProfileId
      ? await this.getAccessProfilePermissions(accessProfileId)
      : await this.getRolePermissions(user.perfil);
    const overrides = accessProfileId ? [] : await this.getUserOverrides(usuarioId);
    const effectivePermissions = await this.getEffectivePermissions(user);

    return {
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        perfil: user.perfil,
        administrador: !!user.administrador,
        desenvolvedor: !!user.desenvolvedor,
        empresa_id: user.empresa_id,
        access_profile_id: accessProfileId,
        access_profile_nome: user.access_profile_nome || null,
      },
      rolePermissions,
      overrides,
      effectivePermissions,
      catalog,
      usesAccessProfile: !!accessProfileId,
    };
  }
};
