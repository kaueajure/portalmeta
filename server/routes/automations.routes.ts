import { Router } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permissions.middleware.js';

const router = Router();
router.use(authMiddleware);

const sendSuccess = (res: any, data: any) => res.json({ success: true, data });
const sendError = (res: any, error: string, num = 500) => res.status(num).json({ success: false, error });

router.get('/company/:companyId', requirePermission('automacoes.gerenciar'), async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Não autenticado', 401);
    const companyId = parseInt(req.params.companyId);
    if (!currentUser.desenvolvedor && currentUser.empresa_id !== companyId) return sendError(res, 'Acesso negado', 403);
    
    const [rows] = await pool.query('SELECT * FROM ticket_automacoes WHERE empresa_id = ? ORDER BY ordem ASC', [companyId]);
    sendSuccess(res, rows);
  } catch (error: unknown) {
    sendError(res, 'Erro ao buscar automações');
  }
});

router.post('/company/:companyId', requirePermission('automacoes.gerenciar'), async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user;
    const companyId = parseInt(req.params.companyId);
    if (!currentUser!.desenvolvedor && currentUser!.empresa_id !== companyId) return sendError(res, 'Acesso negado', 403);
    
    const { nome, descricao, evento, condicoes_json, acoes_json, ativo, ordem } = req.body;
    
    const [result]: any = await pool.query(
      'INSERT INTO ticket_automacoes (empresa_id, nome, descricao, evento, condicoes_json, acoes_json, ativo, ordem, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [companyId, nome, descricao || null, evento, JSON.stringify(condicoes_json || []), JSON.stringify(acoes_json || []), ativo !== undefined ? ativo : 1, ordem || 0, currentUser!.id]
    );
    sendSuccess(res, { id: result.insertId });
  } catch (error: unknown) {
    sendError(res, 'Erro ao criar automação');
  }
});

router.patch('/:id', requirePermission('automacoes.gerenciar'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing]: any = await pool.query('SELECT empresa_id FROM ticket_automacoes WHERE id = ?', [id]);
    if (existing.length === 0) return sendError(res, 'Automação não encontrada', 404);
    
    const companyId = existing[0].empresa_id;
    if (!req.user!.desenvolvedor && req.user!.empresa_id !== companyId) return sendError(res, 'Acesso negado', 403);

    const { nome, descricao, evento, condicoes_json, acoes_json, ativo, ordem } = req.body;
    
    const fieldsToUpdate = [];
    const values = [];
    
    if (nome !== undefined) { fieldsToUpdate.push('nome = ?'); values.push(nome); }
    if (descricao !== undefined) { fieldsToUpdate.push('descricao = ?'); values.push(descricao); }
    if (evento !== undefined) { fieldsToUpdate.push('evento = ?'); values.push(evento); }
    if (condicoes_json !== undefined) { fieldsToUpdate.push('condicoes_json = ?'); values.push(JSON.stringify(condicoes_json)); }
    if (acoes_json !== undefined) { fieldsToUpdate.push('acoes_json = ?'); values.push(JSON.stringify(acoes_json)); }
    if (ativo !== undefined) { fieldsToUpdate.push('ativo = ?'); values.push(ativo); }
    if (ordem !== undefined) { fieldsToUpdate.push('ordem = ?'); values.push(ordem); }

    if (fieldsToUpdate.length === 0) return sendSuccess(res, { success: true });

    values.push(id);
    await pool.query(`UPDATE ticket_automacoes SET ${fieldsToUpdate.join(', ')} WHERE id = ?`, values);
    
    sendSuccess(res, { success: true });
  } catch (error: unknown) {
    sendError(res, 'Erro ao atualizar automação');
  }
});

router.delete('/:id', requirePermission('automacoes.gerenciar'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing]: any = await pool.query('SELECT empresa_id FROM ticket_automacoes WHERE id = ?', [id]);
    if (existing.length === 0) return sendError(res, 'Automação não encontrada', 404);
    
    if (!req.user!.desenvolvedor && req.user!.empresa_id !== existing[0].empresa_id) return sendError(res, 'Acesso negado', 403);

    await pool.query('DELETE FROM ticket_automacoes WHERE id = ?', [id]);
    sendSuccess(res, { success: true });
  } catch (error: unknown) {
    sendError(res, 'Erro ao excluir automação');
  }
});

export default router;
