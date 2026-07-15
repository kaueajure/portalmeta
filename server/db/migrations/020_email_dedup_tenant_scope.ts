import { PoolConnection } from 'mysql2/promise';

async function columnExists(connection: PoolConnection, table: string, column: string): Promise<boolean> {
  const [rows]: any = await connection.query(
    `
      SELECT COUNT(*) AS count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [table, column]
  );

  return Number(rows[0]?.count || 0) > 0;
}

async function indexExists(connection: PoolConnection, table: string, indexName: string): Promise<boolean> {
  const [rows]: any = await connection.query(
    `
      SELECT COUNT(*) AS count
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
    `,
    [table, indexName]
  );

  return Number(rows[0]?.count || 0) > 0;
}

async function primaryKeyColumns(connection: PoolConnection, table: string): Promise<string[]> {
  const [rows]: any = await connection.query(
    `
      SELECT COLUMN_NAME AS column_name
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND CONSTRAINT_NAME = 'PRIMARY'
      ORDER BY ORDINAL_POSITION ASC
    `,
    [table]
  );

  return rows.map((row: any) => row.column_name);
}

async function duplicateProcessedEmailsByCompany(connection: PoolConnection): Promise<number> {
  const [rows]: any = await connection.query(
    `
      SELECT COUNT(*) AS count
      FROM (
        SELECT empresa_id, message_id
        FROM processed_emails
        WHERE message_id IS NOT NULL AND message_id <> ''
        GROUP BY empresa_id, message_id
        HAVING COUNT(*) > 1
      ) duplicates
    `
  );

  return Number(rows[0]?.count || 0);
}

async function duplicateTicketsByCompany(connection: PoolConnection): Promise<number> {
  const [rows]: any = await connection.query(
    `
      SELECT COUNT(*) AS count
      FROM (
        SELECT empresa_id, message_id
        FROM tickets
        WHERE message_id IS NOT NULL AND message_id <> ''
        GROUP BY empresa_id, message_id
        HAVING COUNT(*) > 1
      ) duplicates
    `
  );

  return Number(rows[0]?.count || 0);
}

export async function up(connection: PoolConnection) {
  if (await indexExists(connection, 'ticket_mensagens', 'uniq_ticket_mensagens_message_id')) {
    await connection.query('ALTER TABLE ticket_mensagens DROP INDEX uniq_ticket_mensagens_message_id');
  }

  if (await indexExists(connection, 'tickets', 'uniq_tickets_message_id')) {
    await connection.query('ALTER TABLE tickets DROP INDEX uniq_tickets_message_id');
  }

  const ticketDuplicates = await duplicateTicketsByCompany(connection);
  if (ticketDuplicates === 0) {
    if (!(await indexExists(connection, 'tickets', 'uniq_tickets_empresa_message_id'))) {
      await connection.query('ALTER TABLE tickets ADD UNIQUE INDEX uniq_tickets_empresa_message_id (empresa_id, message_id)');
    }
  } else {
    console.warn(
      `[MIGRATE] tickets possui ${ticketDuplicates} Message-ID(s) duplicado(s) por empresa; indice unico por tenant nao foi criado.`
    );
  }

  if (!(await indexExists(connection, 'ticket_mensagens', 'idx_mensagens_message_id'))) {
    await connection.query('ALTER TABLE ticket_mensagens ADD INDEX idx_mensagens_message_id (message_id)');
  }

  const pkColumns = await primaryKeyColumns(connection, 'processed_emails');
  const hasId = await columnExists(connection, 'processed_emails', 'id');

  if (pkColumns.includes('message_id') && !pkColumns.includes('id')) {
    await connection.query('ALTER TABLE processed_emails DROP PRIMARY KEY');
  }

  if (!hasId) {
    await connection.query('ALTER TABLE processed_emails ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST');
  } else if ((await primaryKeyColumns(connection, 'processed_emails')).length === 0) {
    await connection.query('ALTER TABLE processed_emails ADD PRIMARY KEY (id)');
  }

  const processedDuplicates = await duplicateProcessedEmailsByCompany(connection);
  if (processedDuplicates === 0) {
    if (!(await indexExists(connection, 'processed_emails', 'uniq_processed_emails_empresa_message_id'))) {
      await connection.query('ALTER TABLE processed_emails ADD UNIQUE INDEX uniq_processed_emails_empresa_message_id (empresa_id, message_id)');
    }
  } else {
    console.warn(
      `[MIGRATE] processed_emails possui ${processedDuplicates} Message-ID(s) duplicado(s) por empresa; indice unico por tenant nao foi criado.`
    );
  }

  if (!(await indexExists(connection, 'processed_emails', 'idx_processed_emails_message_id'))) {
    await connection.query('ALTER TABLE processed_emails ADD INDEX idx_processed_emails_message_id (message_id)');
  }
}

export async function down(connection: PoolConnection) {
  if (await indexExists(connection, 'processed_emails', 'uniq_processed_emails_empresa_message_id')) {
    await connection.query('ALTER TABLE processed_emails DROP INDEX uniq_processed_emails_empresa_message_id');
  }

  if (await indexExists(connection, 'processed_emails', 'idx_processed_emails_message_id')) {
    await connection.query('ALTER TABLE processed_emails DROP INDEX idx_processed_emails_message_id');
  }

  if (await indexExists(connection, 'tickets', 'uniq_tickets_empresa_message_id')) {
    await connection.query('ALTER TABLE tickets DROP INDEX uniq_tickets_empresa_message_id');
  }
}
