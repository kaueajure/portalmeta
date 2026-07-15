import { PoolConnection } from 'mysql2/promise';

const LEGACY_TABLES = [
  'empresa_distribuicao_regras',
  'empresa_email_canais',
  'empresa_sla_politicas',
  'empresa_ticket_categorias',
  'empresa_ticket_servicos',
  'empresa_ticket_status',
  'empresas',
];

async function tableExists(connection: PoolConnection, table: string) {
  const [rows]: any = await connection.query(
    `SELECT 1
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     LIMIT 1`,
    [table],
  );
  return rows.length > 0;
}

export async function up(connection: PoolConnection) {
  const existingTables: string[] = [];

  for (const table of LEGACY_TABLES) {
    if (!(await tableExists(connection, table))) continue;

    const [rows]: any = await connection.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
    const total = Number(rows[0]?.total || 0);
    if (total > 0) {
      throw new Error(
        `Reparo single-company abortado: a tabela legada ${table} possui ${total} registro(s).`,
      );
    }
    existingTables.push(table);
  }

  // Child tables must be removed before the former company table because of FKs.
  for (const table of existingTables.filter((table) => table !== 'empresas')) {
    await connection.query(`DROP TABLE \`${table}\``);
  }
  if (existingTables.includes('empresas')) {
    await connection.query('DROP TABLE `empresas`');
  }
}
