import pool from './connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export async function ensureMigrationTable(connection) {
    await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    // Migration Lock Table to prevent parallel runs
    await connection.query(`
    CREATE TABLE IF NOT EXISTS migration_lock (
      id INT PRIMARY KEY,
      is_locked TINYINT(1) DEFAULT 0,
      locked_at TIMESTAMP NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    const [locks] = await connection.query('SELECT * FROM migration_lock WHERE id = 1');
    if (locks.length === 0) {
        await connection.query('INSERT INTO migration_lock (id, is_locked) VALUES (1, 0)');
    }
}
async function acquireLock(connection) {
    const [result] = await connection.query('UPDATE migration_lock SET is_locked = 1, locked_at = NOW() WHERE id = 1 AND is_locked = 0');
    return result.affectedRows > 0;
}
async function releaseLock(connection) {
    await connection.query('UPDATE migration_lock SET is_locked = 0, locked_at = NULL WHERE id = 1');
}
export async function runMigrations() {
    const connection = await pool.getConnection();
    try {
        await ensureMigrationTable(connection);
        const locked = await acquireLock(connection);
        if (!locked) {
            console.log('[MIGRATE] 🔒 Outra migração já está em curso. Abortando.');
            return;
        }
        try {
            const migrationsDir = path.join(__dirname, 'migrations');
            if (!fs.existsSync(migrationsDir)) {
                fs.mkdirSync(migrationsDir, { recursive: true });
            }
            const files = fs.readdirSync(migrationsDir)
                .filter(f => f.endsWith('.ts') || f.endsWith('.js'))
                .sort();
            const [executed] = await connection.query('SELECT name FROM schema_migrations');
            const executedNames = new Set(executed.map((m) => m.name));
            for (const file of files) {
                if (!executedNames.has(file)) {
                    console.log(`[MIGRATE] 🚀 Rodando migração: ${file}`);
                    const migrationPath = path.join(migrationsDir, file);
                    // Standard dynamic import for ESM/TS
                    const migration = await import(`file://${migrationPath}`);
                    if (typeof migration.up === 'function') {
                        await connection.beginTransaction();
                        try {
                            await migration.up(connection);
                            await connection.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
                            await connection.commit();
                            console.log(`[MIGRATE] ✅ Migração ${file} concluída.`);
                        }
                        catch (error) {
                            await connection.rollback();
                            console.error(`[MIGRATE] ❌ Erro na migração ${file}:`, error);
                            throw error;
                        }
                    }
                    else {
                        console.warn(`[MIGRATE] ⚠️ Migração ${file} não exporta função 'up'.`);
                    }
                }
            }
            console.log('[MIGRATE] ✨ Todas as migrações foram verificadas/executadas.');
        }
        finally {
            await releaseLock(connection);
        }
    }
    catch (error) {
        console.error('[MIGRATE] 💥 Erro fatal no runner de migrations:', error);
        throw error;
    }
    finally {
        connection.release();
    }
}
