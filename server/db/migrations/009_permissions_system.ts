import { Connection } from 'mysql2/promise';
import { PERMISSIONS_CATALOG, DEFAULT_ROLE_PERMISSIONS } from '../../constants/permissions.js';

export async function up(connection: Connection) {
  // 1. permissions_catalog
  await connection.query(`
    CREATE TABLE IF NOT EXISTS permissions_catalog (
      id INT AUTO_INCREMENT PRIMARY KEY,
      permission_key VARCHAR(150) NOT NULL UNIQUE,
      modulo VARCHAR(80) NOT NULL,
      grupo VARCHAR(120) NOT NULL,
      nome VARCHAR(150) NOT NULL,
      descricao TEXT NULL,
      nivel_risco ENUM('baixo', 'medio', 'alto', 'critico') NOT NULL DEFAULT 'medio',
      ativo TINYINT(1) NOT NULL DEFAULT 1,
      ordem INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_permissions_catalog_modulo (modulo),
      INDEX idx_permissions_catalog_grupo (grupo),
      INDEX idx_permissions_catalog_ativo (ativo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 2. role_permissions
  await connection.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      perfil VARCHAR(50) NOT NULL,
      permission_key VARCHAR(150) NOT NULL,
      allowed TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

      UNIQUE KEY uq_role_permission (perfil, permission_key),
      INDEX idx_role_permissions_perfil (perfil),
      INDEX idx_role_permissions_permission (permission_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 3. user_permission_overrides
  await connection.query(`
    CREATE TABLE IF NOT EXISTS user_permission_overrides (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      permission_key VARCHAR(150) NOT NULL,
      effect ENUM('allow', 'deny') NOT NULL,
      granted_by INT NULL,
      motivo TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      UNIQUE KEY uq_user_permission_override (usuario_id, permission_key),
      INDEX idx_user_permission_usuario (usuario_id),
      INDEX idx_user_permission_key (permission_key),
      INDEX idx_user_permission_effect (effect)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 4. permission_audit_logs
  await connection.query(`
    CREATE TABLE IF NOT EXISTS permission_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_alvo_id INT NOT NULL,
      usuario_executor_id INT NULL,
      action ENUM('grant', 'deny', 'remove_override', 'reset_user', 'sync_defaults') NOT NULL,
      permission_key VARCHAR(150) NULL,
      old_effect VARCHAR(20) NULL,
      new_effect VARCHAR(20) NULL,
      motivo TEXT NULL,
      ip VARCHAR(100) NULL,
      user_agent TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

      INDEX idx_permission_audit_target (usuario_alvo_id),
      INDEX idx_permission_audit_executor (usuario_executor_id),
      INDEX idx_permission_audit_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Populate catalog
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
        ordem = VALUES(ordem)
    `, [item.key, item.modulo, item.grupo, item.nome, item.descricao, item.nivel_risk, item.order]);
  }

  // Populate default roles
  for (const [perfil, keys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    for (const key of keys) {
      await connection.query(`
        INSERT IGNORE INTO role_permissions (perfil, permission_key, allowed)
        VALUES (?, ?, 1)
      `, [perfil, key]);
    }
  }
}
