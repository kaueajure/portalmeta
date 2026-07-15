import { Router } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permissions.middleware.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { isValidEmail, isValidHexColor } from '../utils/validators.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req, res) => {
  try {
    const [rows]: any = await pool.query('SELECT * FROM application_settings WHERE id = 1 LIMIT 1');
    return sendSuccess(res, rows[0] || null);
  } catch (error) {
    return sendError(res, error instanceof Error ? error.message : 'Erro ao carregar a identidade institucional');
  }
});

router.patch('/', requirePermission('configuracoes.identidade'), async (req: AuthRequest, res) => {
  try {
    const allowed = [
      'nome', 'cnpj', 'email', 'email_suporte', 'telefone', 'logo',
      'cor_principal', 'endereco', 'email_assinatura', 'site_url',
    ] as const;
    const updates: string[] = [];
    const values: unknown[] = [];

    if (req.body.email && !isValidEmail(req.body.email)) {
      return sendError(res, 'E-mail institucional inválido', 400);
    }
    if (req.body.email_suporte && !isValidEmail(req.body.email_suporte)) {
      return sendError(res, 'E-mail de suporte inválido', 400);
    }
    if (req.body.cor_principal && !isValidHexColor(req.body.cor_principal)) {
      return sendError(res, 'Cor principal inválida', 400);
    }

    for (const field of allowed) {
      if (req.body[field] === undefined) continue;
      updates.push(`${field} = ?`);
      values.push(req.body[field] === '' ? null : req.body[field]);
    }

    if (updates.length === 0) return sendSuccess(res, null);

    await pool.query(`UPDATE application_settings SET ${updates.join(', ')} WHERE id = 1`, values);

    const [rows]: any = await pool.query('SELECT * FROM application_settings WHERE id = 1 LIMIT 1');
    return sendSuccess(res, rows[0] || null, 'Identidade institucional atualizada');
  } catch (error) {
    return sendError(res, error instanceof Error ? error.message : 'Erro ao atualizar a identidade institucional');
  }
});

export default router;
