import { runMigrations } from './migration-runner.js';

async function main() {
  try {
    console.log('[MIGRATE-CLI] 🛠️ Iniciando processo de migração manual...');
    await runMigrations();
    console.log('[MIGRATE-CLI] ✅ Processo finalizado com sucesso.');
    process.exit(0);
  } catch (error) {
    console.error('[MIGRATE-CLI] ❌ Erro no processo de migração:', error);
    process.exit(1);
  }
}

main();
