import { PoolConnection } from 'mysql2/promise';

export async function up(connection: PoolConnection) {
  await connection.query(`
    ALTER TABLE tickets
    MODIFY COLUMN status VARCHAR(80) NOT NULL DEFAULT 'aberto'
  `);
}
