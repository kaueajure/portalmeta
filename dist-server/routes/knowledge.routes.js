import { Router } from 'express';
import pool from '../db/connection.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireAnyPermission } from '../middlewares/permissions.middleware.js';
const router = Router();
router.use(authMiddleware);
const sendSuccess = (res, data) => res.json({ success: true, data });
const sendError = (res, error, num = 500) => res.status(num).json({ success: false, message: error, error });
function toPositiveInt(value) {
    if (value === undefined || value === null || value === '')
        return undefined;
    const n = Number(Array.isArray(value) ? value[0] : value);
    return Number.isInteger(n) && n > 0 ? n : undefined;
}
router.get('/categories', async (req, res) => {
    try {
        const empresaId = req.user.desenvolvedor
            ? toPositiveInt(req.query.empresa_id)
            : req.user.empresa_id;
        if (req.user.desenvolvedor && !empresaId) {
            return sendSuccess(res, []);
        }
        if (!empresaId && !req.user.desenvolvedor) {
            return sendError(res, 'Empresa não identificada', 400);
        }
        let query = 'SELECT DISTINCT categoria FROM knowledge_articles';
        const params = [];
        if (empresaId) {
            query += ' WHERE empresa_id = ?';
            params.push(empresaId);
        }
        query += ' ORDER BY categoria ASC';
        const [rows] = await pool.query(query, params);
        sendSuccess(res, rows.filter((r) => r.categoria).map((r) => r.categoria));
    }
    catch (err) {
        sendError(res, 'Erro ao buscar categorias');
    }
});
router.get('/', async (req, res) => {
    try {
        if (!req.user)
            return sendError(res, 'Não autenticado', 401);
        let query = 'SELECT * FROM knowledge_articles';
        let params = [];
        const requestedEmpresaId = req.user.desenvolvedor
            ? toPositiveInt(req.query.empresa_id)
            : req.user.empresa_id;
        if (requestedEmpresaId) {
            query += ' WHERE empresa_id = ?';
            params.push(requestedEmpresaId);
        }
        else if (req.user.desenvolvedor) {
            return sendSuccess(res, []);
        }
        else {
            return sendError(res, 'Empresa não identificada', 400);
        }
        // User can see public or internal, let's just show all for employee (since we don't have portal yet)
        query += ' ORDER BY created_at DESC';
        const [rows] = await pool.query(query, params);
        sendSuccess(res, rows);
    }
    catch (err) {
        sendError(res, 'Erro ao buscar artigos');
    }
});
router.post('/', requireAnyPermission(['base_conhecimento.criar', 'base_conhecimento.gerenciar']), async (req, res) => {
    try {
        const { titulo, conteudo, categoria, publico, ativo } = req.body;
        const empresaId = req.user.desenvolvedor
            ? toPositiveInt(req.body.empresa_id)
            : req.user.empresa_id;
        if (!empresaId) {
            return sendError(res, 'Empresa é obrigatória para criar artigo', 400);
        }
        const [result] = await pool.query('INSERT INTO knowledge_articles (empresa_id, titulo, conteudo, categoria, publico, ativo, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', [empresaId, titulo, conteudo, categoria || null, publico ? 1 : 0, ativo !== undefined ? ativo : 1, req.user.id]);
        sendSuccess(res, { id: result.insertId });
    }
    catch (err) {
        sendError(res, 'Erro ao criar artigo');
    }
});
router.patch('/:id', requireAnyPermission(['base_conhecimento.editar', 'base_conhecimento.gerenciar']), async (req, res) => {
    try {
        const { titulo, conteudo, categoria, publico, ativo } = req.body;
        const id = toPositiveInt(req.params.id);
        if (!id)
            return sendError(res, 'ID invalido', 400);
        const empresaId = req.user.empresa_id;
        const [existing] = await pool.query('SELECT empresa_id FROM knowledge_articles WHERE id = ?', [id]);
        if (existing.length === 0)
            return sendError(res, 'Artigo não encontrado', 404);
        if (!req.user.desenvolvedor && existing[0].empresa_id !== empresaId)
            return sendError(res, 'Acesso negado', 403);
        const fieldsToUpdate = [];
        const values = [];
        if (titulo !== undefined) {
            fieldsToUpdate.push('titulo = ?');
            values.push(titulo);
        }
        if (conteudo !== undefined) {
            fieldsToUpdate.push('conteudo = ?');
            values.push(conteudo);
        }
        if (categoria !== undefined) {
            fieldsToUpdate.push('categoria = ?');
            values.push(categoria);
        }
        if (publico !== undefined) {
            fieldsToUpdate.push('publico = ?');
            values.push(publico);
        }
        if (ativo !== undefined) {
            fieldsToUpdate.push('ativo = ?');
            values.push(ativo);
        }
        if (fieldsToUpdate.length === 0)
            return sendSuccess(res, { success: true });
        fieldsToUpdate.push('updated_by = ?');
        values.push(req.user.id);
        values.push(id);
        await pool.query(`UPDATE knowledge_articles SET ${fieldsToUpdate.join(', ')} WHERE id = ?`, values);
        sendSuccess(res, { success: true });
    }
    catch (err) {
        sendError(res, 'Erro ao editar artigo');
    }
});
router.delete('/:id', requireAnyPermission(['base_conhecimento.excluir', 'base_conhecimento.gerenciar']), async (req, res) => {
    try {
        const id = toPositiveInt(req.params.id);
        if (!id)
            return sendError(res, 'ID invalido', 400);
        const empresaId = req.user.empresa_id;
        const [existing] = await pool.query('SELECT empresa_id FROM knowledge_articles WHERE id = ?', [id]);
        if (existing.length === 0)
            return sendError(res, 'Artigo não encontrado', 404);
        if (!req.user.desenvolvedor && existing[0].empresa_id !== empresaId)
            return sendError(res, 'Acesso negado', 403);
        await pool.query('DELETE FROM knowledge_articles WHERE id = ?', [id]);
        sendSuccess(res, { success: true });
    }
    catch (err) {
        sendError(res, 'Erro ao deletar artigo');
    }
});
export default router;
