import { PoolConnection } from 'mysql2/promise';
import { DEFAULT_ROLE_PERMISSIONS } from '../../constants/permissions.js';

async function columnExists(connection: PoolConnection, table: string, column: string): Promise<boolean> {
  const [rows]: any = await connection.query(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [table, column]
  );
  return rows.length > 0;
}

export async function up(connection: PoolConnection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS access_profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NULL,
      nome VARCHAR(120) NOT NULL,
      descricao VARCHAR(255) NULL,
      base_perfil VARCHAR(50) NULL,
      sistema TINYINT(1) NOT NULL DEFAULT 0,
      ativo TINYINT(1) NOT NULL DEFAULT 1,
      created_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_access_profiles_empresa_nome (empresa_id, nome),
      INDEX idx_access_profiles_empresa (empresa_id),
      INDEX idx_access_profiles_base (base_perfil),
      INDEX idx_access_profiles_ativo (ativo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS access_profile_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      access_profile_id INT NOT NULL,
      permission_key VARCHAR(150) NOT NULL,
      allowed TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_access_profile_permission (access_profile_id, permission_key),
      INDEX idx_access_profile_permission_profile (access_profile_id),
      INDEX idx_access_profile_permission_key (permission_key),
      CONSTRAINT fk_access_profile_permissions_profile
        FOREIGN KEY (access_profile_id) REFERENCES access_profiles(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  if (!await columnExists(connection, 'usuarios', 'access_profile_id')) {
    await connection.query('ALTER TABLE usuarios ADD COLUMN access_profile_id INT NULL AFTER perfil');
    await connection.query('ALTER TABLE usuarios ADD INDEX idx_usuarios_access_profile (access_profile_id)');
  }

  const [empresaRows]: any = await connection.query(`
    SELECT DISTINCT empresa_id
    FROM usuarios
    WHERE empresa_id IS NOT NULL
  `);

  const defaultProfiles = [
    { perfil: 'gestor', nome: 'Gestor' },
    { perfil: 'atendente', nome: 'Atendente' },
    { perfil: 'cliente', nome: 'Cliente' },
  ];

  for (const row of empresaRows) {
    const empresaId = row.empresa_id;

    for (const profile of defaultProfiles) {
      await connection.query(
        `
          INSERT IGNORE INTO access_profiles (empresa_id, nome, descricao, base_perfil, sistema)
          VALUES (?, ?, ?, ?, 1)
        `,
        [empresaId, profile.nome, `Perfil padrao ${profile.nome}`, profile.perfil]
      );

      const [profileRows]: any = await connection.query(
        'SELECT id FROM access_profiles WHERE empresa_id = ? AND nome = ? LIMIT 1',
        [empresaId, profile.nome]
      );
      const accessProfileId = profileRows[0]?.id;
      if (!accessProfileId) continue;

      for (const key of DEFAULT_ROLE_PERMISSIONS[profile.perfil] || []) {
        await connection.query(
          `
            INSERT IGNORE INTO access_profile_permissions (access_profile_id, permission_key, allowed)
            VALUES (?, ?, 1)
          `,
          [accessProfileId, key]
        );
      }
    }

    await connection.query(
      `
        UPDATE usuarios u
        JOIN access_profiles ap
          ON ap.empresa_id = u.empresa_id
         AND ap.base_perfil = u.perfil
        SET u.access_profile_id = ap.id
        WHERE u.empresa_id = ?
          AND u.access_profile_id IS NULL
          AND u.perfil IN ('gestor', 'atendente', 'cliente')
      `,
      [empresaId]
    );
  }
}
