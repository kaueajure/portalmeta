import pool from './connection.js';
import { env } from '../config/env.js';
import { runMigrations } from './migration-runner.js';

async function initDB() {
  let connection;
  try {
    console.log(`[BOOT] 🔌 Tentando conectar ao banco em: ${env.DB.HOST}...`);
    connection = await pool.getConnection();
    console.log('[BOOT] ✅ Conexão estabelecida.');

    // Migrations devem rodar em etapa controlada em producao.
    if (env.AUTO_RUN_MIGRATIONS) {
      console.log('[BOOT] AUTO_RUN_MIGRATIONS=true; executando migrations pendentes...');
      await runMigrations();
    } else {
      console.log('[BOOT] AUTO_RUN_MIGRATIONS=false; execute npm run db:migrate antes do start em producao.');
    }

    console.log('[BOOT] ✨ Inicialização do banco concluída com sucesso.');

  } catch (error) {
    console.error('[BOOT] ❌ Erro ao inicializar banco de dados:', error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

export { initDB };
