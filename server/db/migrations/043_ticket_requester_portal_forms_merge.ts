import { PoolConnection } from 'mysql2/promise';

async function addColumnIfMissing(connection: PoolConnection, table: string, column: string, definition: string) {
  const [rows]: any = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  if (rows.length === 0) await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
}

export async function up(connection: PoolConnection) {
  await addColumnIfMissing(connection, 'ticket_services', 'formulario_json', 'JSON NULL AFTER ordem');
  await addColumnIfMissing(connection, 'tickets', 'unido_em', 'DATETIME NULL AFTER deleted_at');
  await addColumnIfMissing(connection, 'tickets', 'unido_por', 'INT NULL AFTER unido_em');
  await addColumnIfMissing(connection, 'tickets', 'unido_ao_ticket_id', 'INT NULL AFTER unido_por');

  const [indexRows]: any = await connection.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND INDEX_NAME = 'idx_tickets_unido_ao'`,
  );
  if (indexRows.length === 0) {
    await connection.query('ALTER TABLE tickets ADD INDEX idx_tickets_unido_ao (unido_ao_ticket_id)');
  }
}
