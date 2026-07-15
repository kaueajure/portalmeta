import { Router } from 'express';
import companyCompatibilityRoutes from './companies.routes.js';

/**
 * Superfície singleton para as configurações de chamados. Durante a etapa
 * de contrato do banco, reaproveita os handlers já validados sem expor um
 * identificador de empresa ao cliente.
 */
const router = Router();

const resourceMap: Record<string, string> = {
  categories: 'ticket-categories',
  services: 'ticket-services',
  statuses: 'ticket-statuses',
  'sla-policies': 'sla-policies',
};

router.use((req, res, next) => {
  const [path, query = ''] = req.url.split('?');
  const segments = path.split('/').filter(Boolean);
  const mapped = resourceMap[segments[0]];

  if (!mapped) return next();

  segments[0] = mapped;
  req.url = `/1/${segments.join('/')}${query ? `?${query}` : ''}`;
  return companyCompatibilityRoutes(req, res, next);
});

export default router;
