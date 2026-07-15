import { Router } from 'express';
import macrosService from '../services/macros.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireAnyPermission } from '../middlewares/permissions.middleware.js';
const router = Router();
// Aplicar middleware de autenticação em todas as rotas
router.use(authMiddleware);
// Listar macros da empresa
router.get('/', requireAnyPermission(['macros.visualizar', 'macros.gerenciar']), async (req, res) => {
    try {
        if (!req.user)
            return sendError(res, 'Não autorizado', 401);
        // Qualquer usuário autenticado com empresa vínculos pode ver macros
        const macros = await macrosService.list(req.user.empresa_id);
        sendSuccess(res, macros);
    }
    catch (error) {
        sendError(res, error.message);
    }
});
// Criar macro
router.post('/', requireAnyPermission(['macros.criar', 'macros.gerenciar']), async (req, res) => {
    try {
        if (!req.user)
            return sendError(res, 'Não autorizado', 401);
        const { titulo, conteudo, categoria, servico, tags_json } = req.body;
        if (!titulo || !conteudo) {
            return sendError(res, 'Título e conteúdo são obrigatórios', 400);
        }
        if (titulo.length > 120)
            return sendError(res, 'Título muito longo (máx 120)', 400);
        const macroId = await macrosService.create({
            empresa_id: req.user.empresa_id,
            titulo,
            conteudo,
            categoria,
            servico,
            tags_json,
            created_by: req.user.id
        });
        sendSuccess(res, { id: macroId }, 'Macro criada com sucesso', 201);
    }
    catch (error) {
        sendError(res, error.message);
    }
});
// Atualizar macro
router.put('/:id', requireAnyPermission(['macros.editar', 'macros.gerenciar']), async (req, res) => {
    try {
        if (!req.user)
            return sendError(res, 'Não autorizado', 401);
        const { id } = req.params;
        const { titulo, conteudo, categoria, servico, tags_json, ativo } = req.body;
        await macrosService.update(Number(id), req.user.empresa_id, {
            titulo,
            conteudo,
            categoria,
            servico,
            tags_json,
            ativo
        });
        sendSuccess(res, null, 'Macro atualizada com sucesso');
    }
    catch (error) {
        sendError(res, error.message);
    }
});
// Excluir macro
router.delete('/:id', requireAnyPermission(['macros.excluir', 'macros.gerenciar']), async (req, res) => {
    try {
        if (!req.user)
            return sendError(res, 'Não autorizado', 401);
        const { id } = req.params;
        await macrosService.delete(Number(id), req.user.empresa_id);
        sendSuccess(res, null, 'Macro excluída com sucesso');
    }
    catch (error) {
        sendError(res, error.message);
    }
});
// Registrar uso de macro
router.post('/:id/use', requireAnyPermission(['macros.usar', 'macros.gerenciar']), async (req, res) => {
    try {
        if (!req.user)
            return sendError(res, 'Não autorizado', 401);
        const { id } = req.params;
        await macrosService.incrementUse(Number(id), req.user.empresa_id);
        sendSuccess(res, { success: true });
    }
    catch (error) {
        sendError(res, error.message);
    }
});
// Aplicar macro (substituir tags, registrar uso e evento)
router.post('/:id/apply', requireAnyPermission(['macros.usar', 'macros.gerenciar']), async (req, res) => {
    try {
        if (!req.user)
            return sendError(res, 'Não autorizado', 401);
        const { id } = req.params;
        const { ticket_id } = req.body;
        if (!ticket_id)
            return sendError(res, 'ticket_id é obrigatório', 400);
        const conteudoFinal = await macrosService.applyMacro(Number(id), req.user.empresa_id, Number(ticket_id));
        sendSuccess(res, { conteudo: conteudoFinal });
    }
    catch (error) {
        sendError(res, error.message);
    }
});
export default router;
