import { PoolConnection } from 'mysql2/promise';

/**
 * 018_channel_smtp
 *
 * Fase 1 (envio por canal): adiciona credenciais/identidade SMTP por canal em
 * empresa_email_canais, para que respostas de ticket saiam com a identidade da
 * EMPRESA (email_publico) e não com o e-mail global do Gestifique.
 *
 * - A senha SMTP é armazenada CIFRADA (smtp_pass_enc) via utils/crypto.ts.
 * - Idempotente (columnExists).
 * - NÃO usa DROP/DELETE/TRUNCATE em dados.
 */

async function columnExists(connection: PoolConnection, table: string, column: string): Promise<boolean> {
  const [rows]: any = await connection.query(
    `
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [table, column]
  );
  return Number(rows[0]?.count || 0) > 0;
}

export async function up(connection: PoolConnection) {
  const table = 'empresa_email_canais';
  const columns: { name: string; def: string }[] = [
    { name: 'smtp_enabled', def: 'TINYINT(1) NOT NULL DEFAULT 0' },
    { name: 'smtp_host', def: 'VARCHAR(255) NULL' },
    { name: 'smtp_port', def: 'INT NULL' },
    { name: 'smtp_secure', def: 'TINYINT(1) NOT NULL DEFAULT 0' },
    { name: 'smtp_user', def: 'VARCHAR(255) NULL' },
    { name: 'smtp_pass_enc', def: 'TEXT NULL' },
    { name: 'smtp_from_name', def: 'VARCHAR(150) NULL' },
    { name: 'smtp_status', def: "VARCHAR(30) NOT NULL DEFAULT 'not_configured'" },
    { name: 'smtp_last_test_at', def: 'DATETIME NULL' },
    { name: 'smtp_last_error', def: 'TEXT NULL' },
    { name: 'smtp_updated_at', def: 'DATETIME NULL' },
  ];

  for (const col of columns) {
    if (!(await columnExists(connection, table, col.name))) {
      await connection.query(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.def}`);
    }
  }
}

export async function down(connection: PoolConnection) {
  const table = 'empresa_email_canais';
  const columns = [
    'smtp_updated_at',
    'smtp_last_error',
    'smtp_last_test_at',
    'smtp_status',
    'smtp_from_name',
    'smtp_pass_enc',
    'smtp_user',
    'smtp_secure',
    'smtp_port',
    'smtp_host',
    'smtp_enabled',
  ];
  for (const col of columns) {
    if (await columnExists(connection, table, col)) {
      await connection.query(`ALTER TABLE ${table} DROP COLUMN ${col}`);
    }
  }
}
