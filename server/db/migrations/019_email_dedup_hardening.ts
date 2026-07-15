import { PoolConnection } from 'mysql2/promise';

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

async function duplicateMessageIdCount(connection: PoolConnection, table: string): Promise<number> {
  const [rows]: any = await connection.query(
    `
      SELECT COUNT(*) AS count
      FROM (
        SELECT message_id
        FROM ${table}
        WHERE message_id IS NOT NULL AND message_id <> ''
        GROUP BY message_id
        HAVING COUNT(*) > 1
      ) duplicates
    `
  );

  return Number(rows[0]?.count || 0);
}

export async function up(connection: PoolConnection) {
  const duplicateTicketMessages = await duplicateMessageIdCount(connection, 'ticket_mensagens');
  if (duplicateTicketMessages === 0) {
    if (!(await indexExists(connection, 'ticket_mensagens', 'uniq_ticket_mensagens_message_id'))) {
      await connection.query(
        'ALTER TABLE ticket_mensagens ADD UNIQUE INDEX uniq_ticket_mensagens_message_id (message_id)'
      );
    }
  } else {
    console.warn(
      `[MIGRATE] ticket_mensagens possui ${duplicateTicketMessages} Message-ID(s) duplicado(s); indice unico nao foi criado.`
    );
  }

  const duplicateTickets = await duplicateMessageIdCount(connection, 'tickets');
  if (duplicateTickets === 0) {
    if (!(await indexExists(connection, 'tickets', 'uniq_tickets_message_id'))) {
      await connection.query(
        'ALTER TABLE tickets ADD UNIQUE INDEX uniq_tickets_message_id (message_id)'
      );
    }
  } else {
    console.warn(
      `[MIGRATE] tickets possui ${duplicateTickets} Message-ID(s) duplicado(s); indice unico nao foi criado.`
    );
  }
}

export async function down(connection: PoolConnection) {
  if (await indexExists(connection, 'ticket_mensagens', 'uniq_ticket_mensagens_message_id')) {
    await connection.query('ALTER TABLE ticket_mensagens DROP INDEX uniq_ticket_mensagens_message_id');
  }

  if (await indexExists(connection, 'tickets', 'uniq_tickets_message_id')) {
    await connection.query('ALTER TABLE tickets DROP INDEX uniq_tickets_message_id');
  }
}
