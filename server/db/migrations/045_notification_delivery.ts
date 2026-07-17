import { PoolConnection } from 'mysql2/promise';

async function columnExists(connection: PoolConnection, table: string, column: string): Promise<boolean> {
  const [rows]: any = await connection.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return rows.length > 0;
}

async function indexExists(connection: PoolConnection, table: string, index: string): Promise<boolean> {
  const [rows]: any = await connection.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, index],
  );
  return rows.length > 0;
}

export async function up(connection: PoolConnection) {
  if (!(await columnExists(connection, 'notificacoes', 'event_key'))) {
    await connection.query(`ALTER TABLE notificacoes ADD COLUMN event_key VARCHAR(191) NULL AFTER tipo`);
  }
  if (!(await indexExists(connection, 'notificacoes', 'uq_notificacoes_usuario_evento'))) {
    await connection.query(
      `ALTER TABLE notificacoes
       ADD UNIQUE KEY uq_notificacoes_usuario_evento (usuario_id, event_key)`,
    );
  }
  if (!(await indexExists(connection, 'notificacoes', 'idx_notificacoes_usuario_lida_data'))) {
    await connection.query(
      `ALTER TABLE notificacoes
       ADD INDEX idx_notificacoes_usuario_lida_data (usuario_id, lida, created_at)`,
    );
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      usuario_id INT NOT NULL PRIMARY KEY,
      sounds_enabled TINYINT(1) NOT NULL DEFAULT 1,
      volume DECIMAL(3,2) NOT NULL DEFAULT 0.70,
      ticket_enabled TINYINT(1) NOT NULL DEFAULT 1,
      whatsapp_general_enabled TINYINT(1) NOT NULL DEFAULT 1,
      whatsapp_assigned_enabled TINYINT(1) NOT NULL DEFAULT 1,
      browser_enabled TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_notification_preferences_user
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}
