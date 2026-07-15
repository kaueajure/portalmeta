import { PoolConnection } from 'mysql2/promise';

async function tableExists(connection: PoolConnection, table: string): Promise<boolean> {
  const [rows]: any = await connection.query(
    `
      SELECT COUNT(*) AS count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
    `,
    [table]
  );

  return Number(rows[0]?.count || 0) > 0;
}

async function getColumnNullability(
  connection: PoolConnection,
  table: string,
  column: string
): Promise<'YES' | 'NO' | null> {
  const [rows]: any = await connection.query(
    `
      SELECT IS_NULLABLE AS isNullable
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [table, column]
  );

  return rows[0]?.isNullable || null;
}

async function ensureNullableColumn(
  connection: PoolConnection,
  table: string,
  column: string,
  definition: string
) {
  if (!(await tableExists(connection, table))) return;

  const nullability = await getColumnNullability(connection, table, column);
  if (nullability === 'NO') {
    await connection.query(`ALTER TABLE ${table} MODIFY COLUMN ${column} ${definition} NULL`);
  }
}

export async function up(connection: PoolConnection) {
  if (await tableExists(connection, 'usuarios')) {
    await connection.query(`
      UPDATE usuarios
      SET perfil = CASE
        WHEN desenvolvedor = 1 THEN 'desenvolvedor'
        WHEN administrador = 1 THEN 'administrador'
        WHEN perfil IS NULL OR perfil = '' THEN 'atendente'
        ELSE perfil
      END
      WHERE perfil IS NULL OR perfil = '' OR desenvolvedor = 1 OR administrador = 1
    `);
  }

  await ensureNullableColumn(connection, 'tickets', 'usuario_id', 'INT');
  await ensureNullableColumn(connection, 'tickets', 'responsavel_id', 'INT');
  await ensureNullableColumn(connection, 'ticket_mensagens', 'usuario_id', 'INT');
}

export async function down() {
  // No-op: profile backfill and nullable FK relaxations are not safely reversible.
}
