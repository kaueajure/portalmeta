import { Router } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middlewares/auth.js';
import { requirePermission, requireAnyPermission } from '../middlewares/permissions.middleware.js';

const router = Router();

router.use(authMiddleware as any);

const sendSuccess = (res: any, data: any) => res.json({ success: true, data });
const sendError = (res: any, error: string, num = 500) => res.status(num).json({ success: false, message: error, error });

function toPositiveInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

router.get('/categories', async (req: AuthRequest, res) => {
  try {
    const [rows]: any = await pool.query('SELECT DISTINCT categoria FROM knowledge_articles ORDER BY categoria ASC');
    sendSuccess(res, rows.filter((r: any) => r.categoria).map((r: any) => r.categoria));
  } catch (err) {
    sendError(res, 'Erro ao buscar categorias');
  }
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    if (!req.user) return sendError(res, 'Não autenticado', 401);
    
    const [rows] = await pool.query('SELECT * FROM knowledge_articles ORDER BY created_at DESC');
    sendSuccess(res, rows);
  } catch (err) {
    sendError(res, 'Erro ao buscar artigos');
  }
});

router.post('/', requireAnyPermission(['base_conhecimento.criar', 'base_conhecimento.gerenciar']), async (req: AuthRequest, res) => {
  try {
    const { titulo, conteudo, categoria, publico, ativo } = req.body;
    
    const [result]: any = await pool.query(
      'INSERT INTO knowledge_articles (titulo, conteudo, categoria, publico, ativo, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [titulo, conteudo, categoria || null, publico ? 1 : 0, ativo !== undefined ? ativo : 1, req.user!.id]
    );
    sendSuccess(res, { id: result.insertId });
  } catch (err) {
    sendError(res, 'Erro ao criar artigo');
  }
});

router.patch('/:id', requireAnyPermission(['base_conhecimento.editar', 'base_conhecimento.gerenciar']), async (req: AuthRequest, res) => {
  try {
    const { titulo, conteudo, categoria, publico, ativo } = req.body;
    const id = toPositiveInt(req.params.id);
    if (!id) return sendError(res, 'ID invalido', 400);
    const [existing]: any = await pool.query('SELECT id FROM knowledge_articles WHERE id = ?', [id]);
    if (existing.length === 0) return sendError(res, 'Artigo não encontrado', 404);
    
    const fieldsToUpdate = [];
    const values = [];
    
    if (titulo !== undefined) { fieldsToUpdate.push('titulo = ?'); values.push(titulo); }
    if (conteudo !== undefined) { fieldsToUpdate.push('conteudo = ?'); values.push(conteudo); }
    if (categoria !== undefined) { fieldsToUpdate.push('categoria = ?'); values.push(categoria); }
    if (publico !== undefined) { fieldsToUpdate.push('publico = ?'); values.push(publico); }
    if (ativo !== undefined) { fieldsToUpdate.push('ativo = ?'); values.push(ativo); }
    
    if (fieldsToUpdate.length === 0) return sendSuccess(res, { success: true });
    
    fieldsToUpdate.push('updated_by = ?'); values.push(req.user!.id);
    values.push(id);
    
    await pool.query(`UPDATE knowledge_articles SET ${fieldsToUpdate.join(', ')} WHERE id = ?`, values);
    sendSuccess(res, { success: true });
  } catch (err) {
    sendError(res, 'Erro ao editar artigo');
  }
});

router.delete('/:id', requireAnyPermission(['base_conhecimento.excluir', 'base_conhecimento.gerenciar']), async (req: AuthRequest, res) => {
  try {
    const id = toPositiveInt(req.params.id);
    if (!id) return sendError(res, 'ID invalido', 400);
    const [existing]: any = await pool.query('SELECT id FROM knowledge_articles WHERE id = ?', [id]);
    if (existing.length === 0) return sendError(res, 'Artigo não encontrado', 404);
    
    await pool.query('DELETE FROM knowledge_articles WHERE id = ?', [id]);
    sendSuccess(res, { success: true });
  } catch (err) {
    sendError(res, 'Erro ao deletar artigo');
  }
});

export default router;
