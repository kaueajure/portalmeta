import { Connection } from 'mysql2/promise';

export async function up(connection: Connection) {
  try {
    // 1. Align permissions_catalog to have DEFAULT 'baixo' for nivel_risco
    await connection.query(`
      ALTER TABLE permissions_catalog 
      MODIFY COLUMN nivel_risco ENUM('baixo', 'medio', 'alto', 'critico') NOT NULL DEFAULT 'baixo'
    `);
    console.log('[MIGRATE] Modified level risk default column in permissions_catalog.');
  } catch (err: any) {
    console.warn('[MIGRATE] Option to alter permissions_catalog columns skipped/already applied:', err.message);
  }

  try {
    // 2. Align permission_audit_logs: action column to VARCHAR(50)
    await connection.query(`
      ALTER TABLE permission_audit_logs 
      MODIFY COLUMN action VARCHAR(50) NOT NULL
    `);
    console.log('[MIGRATE] Modified action column in permission_audit_logs.');
  } catch (err: any) {
    console.warn('[MIGRATE] Option to alter action column in permission_audit_logs skipped/already applied:', err.message);
  }
}
