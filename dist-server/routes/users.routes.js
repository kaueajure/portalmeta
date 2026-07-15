import { Router } from 'express';
import usersService from '../services/users.service.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permissions.middleware.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logSystemAction } from '../utils/logger.js';
import { isValidEmail, isValidPassword, PASSWORD_RULE_MESSAGE } from '../utils/validators.js';
import pool from '../db/connection.js';
import { permissionsService } from '../services/permissions.service.js';
import { accessProfilesService } from '../services/access-profiles.service.js';
const router = Router();
router.use(authMiddleware);
function parsePositiveInt(value) {
    if (value === undefined || value === null || value === '')
        return undefined;
    const n = Number(Array.isArray(value) ? value[0] : value);
    return Number.isInteger(n) && n > 0 ? n : undefined;
}
function normalizeUserRoleFlags(data) {
    if (data.perfil === 'desenvolvedor') {
        data.desenvolvedor = true;
        data.administrador = true;
        data.access_profile_id = null;
    }
    else if (data.desenvolvedor === true) {
        data.perfil = 'desenvolvedor';
        data.administrador = true;
        data.access_profile_id = null;
    }
    else if (data.perfil === 'administrador') {
        data.administrador = true;
        data.desenvolvedor = false;
        data.access_profile_id = null;
    }
    else if (data.perfil !== undefined) {
        data.desenvolvedor = false;
        data.administrador = false;
    }
}
async function resolveAccessProfileAssignment(empresaId, accessProfileId) {
    const profileId = parsePositiveInt(accessProfileId);
    if (!profileId)
        return null;
    if (!empresaId)
        throw new Error('Empresa obrigatoria para vincular perfil de acesso.');
    const profile = await accessProfilesService.getById(profileId);
    if (!profile || Number(profile.empresa_id) !== Number(empresaId)) {
        throw new Error('Perfil de acesso invalido para esta empresa.');
    }
    if (!profile.ativo) {
        throw new Error('Perfil de acesso inativo.');
    }
    return profile;
}
router.get('/team', async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        if (!currentUser.empresa_id && !currentUser.desenvolvedor) {
            return sendSuccess(res, []);
        }
        const empresaId = currentUser.empresa_id; // Devs also will have empresa_id filtering if we want, or just get from own current context
        let query = `
          SELECT u.id, u.nome, u.email, u.cargo,
                 (SELECT COUNT(id) FROM tickets t WHERE t.responsavel_id = u.id AND t.deleted_at IS NULL AND t.status NOT IN ('resolvido', 'fechado')) as ticket_count
          FROM usuarios u
          WHERE u.ativo = 1 AND u.empresa_id = ?
          ORDER BY u.nome ASC
        `;
        const params = [empresaId];
        // Dev without company gets empty list or we can pass ?empresa_id= query param
        if (currentUser.desenvolvedor && !empresaId && !req.query.empresa_id) {
            return sendSuccess(res, []);
        }
        if (currentUser.desenvolvedor && req.query.empresa_id) {
            const queryEmpresaId = parsePositiveInt(req.query.empresa_id);
            if (!queryEmpresaId)
                return sendSuccess(res, []);
            params[0] = queryEmpresaId;
        }
        const [rows] = await pool.query(query, params);
        sendSuccess(res, rows);
    }
    catch (e) {
        sendError(res, e.message);
    }
});
router.get('/', requirePermission('usuarios.visualizar'), async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const { search, status } = req.query;
        const empresaId = currentUser.desenvolvedor ? undefined : currentUser.empresa_id;
        if (!currentUser.desenvolvedor && !empresaId) {
            return sendSuccess(res, []);
        }
        const users = await usersService.list({
            empresaId,
            search: search,
            status: status
        });
        sendSuccess(res, users);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao listar usuários';
        sendError(res, message);
    }
});
router.post('/', requirePermission('usuarios.criar'), async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const { nome, email, password, administrador, desenvolvedor, empresa_id, cargo, telefone, perfil, access_profile_id } = req.body;
        if (!nome || !email || !password)
            return sendError(res, 'Nome, email e senha são obrigatórios', 400);
        if (!isValidEmail(email))
            return sendError(res, 'Email inválido', 400);
        if (!isValidPassword(password))
            return sendError(res, PASSWORD_RULE_MESSAGE, 400);
        const wantsDeveloper = desenvolvedor === true || perfil === 'desenvolvedor';
        const wantsAdmin = administrador === true || perfil === 'administrador' || wantsDeveloper;
        if (wantsDeveloper && !currentUser.desenvolvedor) {
            return sendError(res, 'Apenas desenvolvedores podem criar usuarios com perfil de desenvolvedor', 403);
        }
        if (wantsAdmin && !currentUser.desenvolvedor && !currentUser.administrador) {
            return sendError(res, 'Apenas administradores podem criar usuarios administradores', 403);
        }
        const targetEmpresaId = currentUser.desenvolvedor ? parsePositiveInt(empresa_id) : currentUser.empresa_id;
        if (!currentUser.desenvolvedor && !targetEmpresaId) {
            return sendError(res, 'Sua conta não possui uma empresa vinculada para realizar esta ação', 403);
        }
        if (!wantsDeveloper && !targetEmpresaId) {
            return sendError(res, 'Empresa e obrigatoria para criar usuarios sem perfil de desenvolvedor', 400);
        }
        let resolvedProfile = null;
        if (!wantsDeveloper && !wantsAdmin) {
            resolvedProfile = await resolveAccessProfileAssignment(targetEmpresaId, access_profile_id);
            if (!resolvedProfile && targetEmpresaId) {
                const [defaultRows] = await pool.query('SELECT id, base_perfil FROM access_profiles WHERE empresa_id = ? AND nome = ? AND ativo = 1 LIMIT 1', [targetEmpresaId, 'Atendente']);
                resolvedProfile = defaultRows[0] || null;
            }
        }
        const buildData = {
            nome, email, password, cargo, telefone,
            empresa_id: targetEmpresaId,
            administrador: wantsAdmin,
            desenvolvedor: currentUser.desenvolvedor ? wantsDeveloper : false,
            perfil: wantsDeveloper
                ? 'desenvolvedor'
                : wantsAdmin
                    ? 'administrador'
                    : (resolvedProfile?.base_perfil || perfil || 'atendente'),
            access_profile_id: wantsDeveloper || wantsAdmin ? null : (resolvedProfile?.id || null),
        };
        const newUser = await usersService.create(buildData);
        await logSystemAction(req, currentUser.id, currentUser.empresa_id, 'USER_CREATE', `Criou novo usuário: ${email}`);
        sendSuccess(res, newUser, 'Usuário criado com sucesso', 201);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao criar usuário';
        sendError(res, message);
    }
});
router.patch('/:id', requirePermission('usuarios.editar'), async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const id = parsePositiveInt(req.params.id);
        if (!id)
            return sendError(res, 'ID invalido', 400);
        const targetUser = await usersService.getById(id);
        if (!targetUser)
            return sendError(res, 'Usuário não encontrado', 404);
        // Security checks
        if (!currentUser.desenvolvedor) {
            if (targetUser.empresa_id !== currentUser.empresa_id) {
                return sendError(res, 'Acesso proibido', 403);
            }
            if (targetUser.desenvolvedor) {
                return sendError(res, 'Você não tem permissão para editar um desenvolvedor', 403);
            }
            if (targetUser.administrador && !currentUser.administrador) {
                return sendError(res, 'Voce nao tem permissao para editar um administrador', 403);
            }
            // Admin cannot change empresa_id, administrador (to dev level) or desenvolvedor
            delete req.body.empresa_id;
            delete req.body.desenvolvedor;
            if (!currentUser.administrador) {
                delete req.body.administrador;
                if (req.body.perfil === 'administrador') {
                    delete req.body.perfil;
                }
            }
            if (req.body.perfil === 'desenvolvedor') {
                delete req.body.perfil;
            }
        }
        normalizeUserRoleFlags(req.body);
        if (!req.user.desenvolvedor && !req.body.desenvolvedor && !req.body.administrador) {
            const empresaId = req.body.empresa_id ?? targetUser.empresa_id;
            if (req.body.access_profile_id !== undefined) {
                const profile = await resolveAccessProfileAssignment(empresaId, req.body.access_profile_id);
                if (profile) {
                    req.body.access_profile_id = profile.id;
                    req.body.perfil = profile.base_perfil || req.body.perfil || targetUser.perfil || 'atendente';
                }
                else {
                    req.body.access_profile_id = null;
                }
            }
            else if (req.body.perfil && !['desenvolvedor', 'administrador'].includes(req.body.perfil)) {
                const [profileRows] = await pool.query('SELECT id, base_perfil FROM access_profiles WHERE empresa_id = ? AND base_perfil = ? AND ativo = 1 ORDER BY sistema DESC LIMIT 1', [empresaId, req.body.perfil]);
                if (profileRows[0]) {
                    req.body.access_profile_id = profileRows[0].id;
                    req.body.perfil = profileRows[0].base_perfil || req.body.perfil;
                }
            }
        }
        // Validate email if present
        if (req.body.email && req.body.email !== targetUser.email) {
            if (!isValidEmail(req.body.email)) {
                return sendError(res, 'Email inválido', 400);
            }
        }
        await usersService.update(id, req.body);
        permissionsService.invalidateCache(id);
        await logSystemAction(req, currentUser.id, currentUser.empresa_id, 'USER_UPDATE', `Atualizou usuário ID ${id}`);
        sendSuccess(res, null, 'Usuário atualizado com sucesso');
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao atualizar usuário';
        sendError(res, message);
    }
});
router.patch('/:id/status', async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const id = parsePositiveInt(req.params.id);
        if (!id)
            return sendError(res, 'ID invalido', 400);
        const { ativo } = req.body;
        if (typeof ativo !== 'boolean' && ativo !== 0 && ativo !== 1) {
            return sendError(res, 'Status invalido', 400);
        }
        const normalizedAtivo = Boolean(ativo);
        const targetUser = await usersService.getById(id);
        if (!targetUser)
            return sendError(res, 'Usuário não encontrado', 404);
        if (targetUser.id === currentUser.id && !normalizedAtivo) {
            return sendError(res, 'Voce nao pode desativar o proprio usuario', 400);
        }
        const requiredPerm = normalizedAtivo ? 'usuarios.reativar' : 'usuarios.desativar';
        const hasStatusPerm = await permissionsService.hasPermission(currentUser, requiredPerm);
        if (!hasStatusPerm) {
            return sendError(res, `Acesso proibido: Você não possui a permissão ${requiredPerm}.`, 403);
        }
        if (!currentUser.desenvolvedor && (targetUser.empresa_id !== currentUser.empresa_id || targetUser.desenvolvedor)) {
            return sendError(res, 'Acesso proibido', 403);
        }
        await usersService.update(id, { ativo: normalizedAtivo ? 1 : 0 });
        permissionsService.invalidateCache(id);
        if (!normalizedAtivo) {
            // Unassign tickets and flag them for review
            try {
                await pool.query(`
                   UPDATE tickets 
                   SET responsavel_id = NULL, precisa_revisao_responsavel = 1 
                   WHERE responsavel_id = ? AND deleted_at IS NULL AND status NOT IN ('resolvido', 'fechado')
               `, [id]);
            }
            catch (e) {
                console.error("Erro ao liberar tickets do usuário desativado:", e);
            }
        }
        await logSystemAction(req, currentUser.id, currentUser.empresa_id, 'USER_STATUS', `${normalizedAtivo ? 'Ativou' : 'Desativou'} usuário ID ${id}`);
        sendSuccess(res, null, `Usuário ${normalizedAtivo ? 'ativado' : 'desativado'} com sucesso`);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao alterar status';
        sendError(res, message);
    }
});
router.patch('/:id/password', requirePermission('usuarios.resetar_senha'), async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser)
            return sendError(res, 'Não autenticado', 401);
        const id = parsePositiveInt(req.params.id);
        if (!id)
            return sendError(res, 'ID invalido', 400);
        const { password } = req.body;
        if (!password || !isValidPassword(password))
            return sendError(res, PASSWORD_RULE_MESSAGE, 400);
        const targetUser = await usersService.getById(id);
        if (!targetUser)
            return sendError(res, 'Usuário não encontrado', 404);
        if (!currentUser.desenvolvedor && (targetUser.empresa_id !== currentUser.empresa_id || targetUser.desenvolvedor)) {
            return sendError(res, 'Acesso proibido', 403);
        }
        if (!currentUser.desenvolvedor && targetUser.administrador && !currentUser.administrador) {
            return sendError(res, 'Voce nao tem permissao para redefinir senha de um administrador', 403);
        }
        await usersService.update(id, { password });
        await logSystemAction(req, currentUser.id, currentUser.empresa_id, 'USER_PASSWORD', `Alterou senha do usuário ID ${id}`);
        sendSuccess(res, null, 'Senha alterada com sucesso');
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao alterar senha';
        sendError(res, message);
    }
});
export default router;
