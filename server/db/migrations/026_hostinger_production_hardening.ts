import { PoolConnection } from 'mysql2/promise';

async function tableExists(connection: PoolConnection, table: string): Promise<boolean> {
  const [rows]: any = await connection.query(
    `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
    `,
    [table]
  );
  return rows.length > 0;
}

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

async function indexExists(connection: PoolConnection, table: string, indexName: string): Promise<boolean> {
  const [rows]: any = await connection.query(
    `
      SELECT INDEX_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
    `,
    [table, indexName]
  );
  return rows.length > 0;
}

export async function up(connection: PoolConnection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS email_outbox (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NULL,
      ticket_id INT NULL,
      tipo VARCHAR(60) NOT NULL,
      destinatario VARCHAR(255) NOT NULL,
      assunto VARCHAR(255) NULL,
      payload_json JSON NOT NULL,
      dedupe_key VARCHAR(191) NULL,
      status ENUM('pendente', 'processando', 'enviado', 'erro') NOT NULL DEFAULT 'pendente',
      tentativas INT NOT NULL DEFAULT 0,
      ultimo_erro TEXT NULL,
      next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      locked_at DATETIME NULL,
      sent_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_email_outbox_dedupe (dedupe_key),
      KEY idx_email_outbox_status_next (status, next_attempt_at, id),
      KEY idx_email_outbox_ticket (empresa_id, ticket_id),
      KEY idx_email_outbox_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  if (!await columnExists(connection, 'tickets', 'deleted_at')) {
    await connection.query('ALTER TABLE tickets ADD COLUMN deleted_at DATETIME NULL AFTER updated_at');
  }

  if (!await columnExists(connection, 'tickets', 'deleted_by')) {
    await connection.query('ALTER TABLE tickets ADD COLUMN deleted_by INT NULL AFTER deleted_at');
  }

  if (!await columnExists(connection, 'tickets', 'delete_reason')) {
    await connection.query('ALTER TABLE tickets ADD COLUMN delete_reason VARCHAR(255) NULL AFTER deleted_by');
  }

  if (!await indexExists(connection, 'tickets', 'idx_tickets_deleted_scope')) {
    await connection.query('ALTER TABLE tickets ADD INDEX idx_tickets_deleted_scope (empresa_id, deleted_at, status, updated_at)');
  }

  if (!await indexExists(connection, 'tickets', 'idx_tickets_deleted_id')) {
    await connection.query('ALTER TABLE tickets ADD INDEX idx_tickets_deleted_id (deleted_at, id)');
  }

  if (await tableExists(connection, 'ticket_eventos') && !await indexExists(connection, 'ticket_eventos', 'idx_ticket_eventos_ticket_created')) {
    await connection.query('ALTER TABLE ticket_eventos ADD INDEX idx_ticket_eventos_ticket_created (ticket_id, created_at, id)');
  }

  if (await tableExists(connection, 'ticket_mensagens') && !await indexExists(connection, 'ticket_mensagens', 'idx_ticket_mensagens_ticket_created_id')) {
    await connection.query('ALTER TABLE ticket_mensagens ADD INDEX idx_ticket_mensagens_ticket_created_id (ticket_id, created_at, id)');
  }
}
