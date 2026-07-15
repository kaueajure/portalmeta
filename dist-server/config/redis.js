import { Redis } from 'ioredis';
import { env } from './env.js';
/**
 * Fase 2A (escalabilidade): camada central de Redis com fallback seguro.
 *
 * - Redis é OPCIONAL. Sem REDIS_URL, o sistema continua em modo single-instance
 *   (comportamento atual), e este módulo expõe um cliente nulo/desabilitado.
 * - Com REDIS_URL, conecta via ioredis. Falhas de conexão NÃO derrubam o app:
 *   apenas geram warning e o sistema segue sem Redis.
 * - Nenhuma lógica usa Redis ainda. Este módulo apenas prepara a base para as
 *   próximas fases (Socket.io adapter/emitter, invalidação de cache).
 *
 * IMPORTANTE: este módulo não loga a URL/senha do Redis (evita vazar credenciais).
 */
let client = null;
let redisEnabled = false;
/**
 * Mascara a URL do Redis para logs (oculta credenciais).
 */
function safeRedisTarget(rawUrl) {
    try {
        const u = new URL(rawUrl);
        const port = u.port ? `:${u.port}` : '';
        return `${u.protocol}//${u.hostname}${port}`;
    }
    catch {
        return 'redis (endereço não exibido)';
    }
}
if (!env.REDIS_URL) {
    console.log('[Redis] REDIS_URL não configurada; rodando em modo single-instance (sem Redis).');
}
else {
    try {
        const options = {
            // Falha "preguiçosa": não derruba o boot; tenta conectar em background.
            lazyConnect: false,
            // Reconexão controlada para não poluir logs (cresce até ~10s).
            retryStrategy: (times) => Math.min(times * 500, 10000),
            maxRetriesPerRequest: 2,
            enableOfflineQueue: true,
        };
        client = new Redis(env.REDIS_URL, options);
        client.on('connect', () => {
            console.log(`[Redis] Conectando a ${safeRedisTarget(env.REDIS_URL)}...`);
        });
        client.on('ready', () => {
            redisEnabled = true;
            console.log('[Redis] ✅ Pronto. Recursos distribuídos poderão ser ativados em fases futuras.');
        });
        client.on('error', (err) => {
            // Não vaza a URL; apenas a mensagem do erro.
            console.warn(`[Redis] ⚠️ Erro de conexão: ${err.message}. Seguindo sem Redis (single-instance).`);
        });
        client.on('close', () => {
            redisEnabled = false;
            console.warn('[Redis] Conexão encerrada.');
        });
        client.on('reconnecting', () => {
            console.log('[Redis] Tentando reconectar...');
        });
    }
    catch (err) {
        console.warn(`[Redis] ⚠️ Falha ao inicializar o cliente: ${err?.message || err}. Seguindo sem Redis (single-instance).`);
        client = null;
        redisEnabled = false;
    }
}
/**
 * Retorna o cliente Redis se configurado, ou null se ausente/desabilitado.
 * (Por enquanto nenhum consumidor usa este cliente.)
 */
export function getRedisClient() {
    return client;
}
/**
 * Indica se há REDIS_URL configurada (cliente instanciado).
 * Não garante que a conexão está "ready" neste instante.
 */
export function isRedisConfigured() {
    return client !== null;
}
/**
 * Indica se o Redis está pronto/conectado neste momento.
 */
export function isRedisReady() {
    return redisEnabled && client !== null;
}
