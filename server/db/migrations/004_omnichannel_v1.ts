import { PoolConnection } from 'mysql2/promise';

async function columnExists(connection: PoolConnection, table: string, column: string): Promise<boolean> {
  const [rows]: any = await connection.query(`
    SELECT COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = ? 
    AND COLUMN_NAME = ?
  `, [table, column]);
  return rows.length > 0;
}

async function foreignKeyExists(connection: PoolConnection, table: string, constraintName: string): Promise<boolean> {
  const [rows]: any = await connection.query(`
    SELECT CONSTRAINT_NAME 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = ? 
    AND CONSTRAINT_NAME = ?
  `, [table, constraintName]);
  return rows.length > 0;
}

async function indexExists(connection: PoolConnection, table: string, indexName: string): Promise<boolean> {
  const [rows]: any = await connection.query(`
    SELECT INDEX_NAME 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = ? 
    AND INDEX_NAME = ?
  `, [table, indexName]);
  return rows.length > 0;
}

export async function up(connection: PoolConnection) {
  // 1. Add email_channel_id to tickets
  if (!(await columnExists(connection, 'tickets', 'email_channel_id'))) {
    await connection.query(`ALTER TABLE tickets ADD COLUMN email_channel_id INT NULL AFTER origem`);
  }

  // 2. Add FK for email_channel_id
  if (!(await foreignKeyExists(connection, 'tickets', 'fk_tickets_email_channel'))) {
    await connection.query(`
      ALTER TABLE tickets 
      ADD CONSTRAINT fk_tickets_email_channel 
      FOREIGN KEY (email_channel_id) REFERENCES empresa_email_canais(id) ON DELETE SET NULL
    `);
  }

  // 3. Add message_id to tickets
  if (!(await columnExists(connection, 'tickets', 'message_id'))) {
    await connection.query(`ALTER TABLE tickets ADD COLUMN message_id VARCHAR(255) NULL AFTER email_channel_id`);
  }

  // 4. Add index to tickets message_id
  if (!(await indexExists(connection, 'tickets', 'idx_tickets_message_id'))) {
    await connection.query(`ALTER TABLE tickets ADD INDEX idx_tickets_message_id (message_id)`);
  }

  // 5. Add message_id to ticket_mensagens
  if (!(await columnExists(connection, 'ticket_mensagens', 'message_id'))) {
    await connection.query(`ALTER TABLE ticket_mensagens ADD COLUMN message_id VARCHAR(255) NULL AFTER mensagem`);
  }

  // 6. Add index to ticket_mensagens message_id
  if (!(await indexExists(connection, 'ticket_mensagens', 'idx_mensagens_message_id'))) {
    await connection.query(`ALTER TABLE ticket_mensagens ADD INDEX idx_mensagens_message_id (message_id)`);
  }

  // 7. Create processed_emails table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS processed_emails (
      message_id VARCHAR(255) PRIMARY KEY,
      empresa_id INT NOT NULL,
      ticket_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_processed_empresa (empresa_id),
      INDEX idx_processed_ticket (ticket_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

export async function down(connection: PoolConnection) {
  // O runner não costuma usar down em produção, mas implementamos de forma segura se necessário
  if (await foreignKeyExists(connection, 'tickets', 'fk_tickets_email_channel')) {
    await connection.query(`ALTER TABLE tickets DROP FOREIGN KEY fk_tickets_email_channel`);
  }
}
