import { Router } from 'express';
import { env } from '../config/env.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { emailOutboxService, normalizeOutboxProcessLimit } from '../services/email-outbox.service.js';

const router = Router();

function getProvidedToken(req: any): { token: string; source: 'header' | 'query' | 'none' } {
  const headerToken = String(req.headers['x-internal-job-token'] || '').trim();
  if (headerToken) return { token: headerToken, source: 'header' };

  // Compatibilidade com cron simples da Hostinger. Use somente se headers customizados
  // nao estiverem disponiveis, pois query string pode aparecer em logs de servidor.
  if (env.ALLOW_INTERNAL_JOB_TOKEN_IN_QUERY && typeof req.query.token === 'string') {
    return { token: req.query.token.trim(), source: 'query' };
  }

  return { token: '', source: 'none' };
}

function isAuthorized(req: any): boolean {
  const configuredToken = String(env.INTERNAL_JOB_TOKEN || '').trim();
  if (!configuredToken) return false;

  const provided = getProvidedToken(req);
  return provided.token === configuredToken;
}

async function processEmailOutbox(req: any, res: any) {
  if (!isAuthorized(req)) {
    return sendError(res, 'Nao autorizado', 401);
  }

  try {
    const limit = normalizeOutboxProcessLimit(req.body?.limit ?? req.query.limit ?? 20);
    const tokenSource = getProvidedToken(req).source;
    console.log(`[InternalJobs] Processando email outbox via ${req.method}; token_source=${tokenSource}; limit=${limit}`);
    const result = await emailOutboxService.processPending(limit);
    return sendSuccess(res, result, 'Outbox processada');
  } catch (error) {
    console.error('[InternalJobs] Falha ao processar outbox:', error);
    return sendError(res, 'Erro ao processar outbox', 500);
  }
}

router.post('/process-email-outbox', processEmailOutbox);
router.get('/process-email-outbox', processEmailOutbox);

export default router;
