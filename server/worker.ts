/**
 * Gestifique Worker Entrypoint
 * 
 * Este arquivo é um alias para rodar o processo como worker.
 * Ele configura as variáveis de ambiente para desativar o servidor web 
 * e focar apenas nas tarefas de background (jobs e listeners).
 */

// CRITICAL: Set environment flags BEFORE any other imports that might use 'env'
if (process.env.ENABLE_WEB_SERVER === undefined) {
  process.env.ENABLE_WEB_SERVER = 'false';
}

console.log('--------------------------------------------------');
console.log('🛠️  GESTIFIQUE WORKER MODE');
console.log('--------------------------------------------------');

// Dynamic import ensures that the environment variable set above is picked up
// when server.ts (and consequently config/env.ts) is loaded.
import('./server.js').catch(err => {
  console.error('❌ Falha ao iniciar worker:', err);
  process.exit(1);
});
