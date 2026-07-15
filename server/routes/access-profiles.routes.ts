import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permissions.middleware.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { accessProfilesService } from '../services/access-profiles.service.js';
import { permissionsService } from '../services/permissions.service.js';
import { logSystemAction } from '../utils/logger.js';
import pool from '../db/connection.js';

const router = Router();
router.use(authMiddleware);

function parsePositiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function resolveEmpresaId(req: AuthRequest): number | null {
  if (req.user?.desenvolvedor && req.query.empresa_id) {
    return parsePositiveInt(req.query.empresa_id);
  }
  return req.user?.empresa_id ? Number(req.user.empresa_id) : null;
}

async function ensureProfileAccess(req: AuthRequest, profileId: number) {
  const profile = await accessProfilesService.getById(profileId);
  if (!profile) return { profile: null, error: 'Perfil de acesso nao encontrado.', status: 404 };
  if (!req.user?.desenvolvedor && Number(profile.empresa_id) !== Number(req.user?.empresa_id)) {
    return { profile: null, error: 'Acesso proibido ao perfil de outra empresa.', status: 403 };
  }
  return { profile, error: null, status: 200 };
}

router.get('/', requirePermission('usuarios.ver_permissoes'), async (req: AuthRequest, res) => {
  try {
    const empresaId = resolveEmpresaId(req);
    if (!empresaId) return sendSuccess(res, []);
    const profiles = await accessProfilesService.list(empresaId);
    sendSuccess(res, profiles);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao listar perfis de acesso';
    sendError(res, message);
  }
});

router.post('/', requirePermission('usuarios.gerenciar_permissoes'), async (req: AuthRequest, res) => {
  try {
    const empresaId = req.user?.desenvolvedor
      ? parsePositiveInt(req.body.empresa_id)
      : req.user?.empresa_id;
    if (!empresaId) return sendError(res, 'Empresa obrigatoria para criar perfil de acesso.', 400);

    const nome = String(req.body.nome || '').trim();
    if (!nome) return sendError(res, 'Nome do perfil e obrigatorio.', 400);

    const profile = await accessProfilesService.create({
      empresa_id: Number(empresaId),
      nome,
      descricao: req.body.descricao || null,
      base_perfil: req.body.base_perfil || null,
      created_by: req.user?.id || null,
    });

    if (Array.isArray(req.body.permissions)) {
      await accessProfilesService.setPermissions(profile.id, req.body.permissions, req.user);
    }

    await logSystemAction(req, req.user!.id, Number(empresaId), 'ACCESS_PROFILE_CREATE', `Criou perfil de acesso: ${nome}`);
    sendSuccess(res, await accessProfilesService.getById(profile.id), 'Perfil de acesso criado com sucesso', 201);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao criar perfil de acesso';
    sendError(res, message);
  }
});

router.get('/:id/matrix', requirePermission('usuarios.ver_permissoes'), async (req: AuthRequest, res) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) return sendError(res, 'ID invalido', 400);
    const access = await ensureProfileAccess(req, id);
    if (access.error) return sendError(res, access.error, access.status);

    const matrix = await accessProfilesService.getMatrix(id, req.user);
    sendSuccess(res, matrix);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar matriz do perfil';
    sendError(res, message);
  }
});

router.patch('/:id', requirePermission('usuarios.gerenciar_permissoes'), async (req: AuthRequest, res) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) return sendError(res, 'ID invalido', 400);
    const access = await ensureProfileAccess(req, id);
    if (access.error) return sendError(res, access.error, access.status);

    const profile = await accessProfilesService.update(id, {
      nome: req.body.nome,
      descricao: req.body.descricao,
    });

    if (Array.isArray(req.body.permissions)) {
      const [users]: any = await pool.query('SELECT id FROM usuarios WHERE access_profile_id = ?', [id]);
      await accessProfilesService.setPermissions(id, req.body.permissions, req.user);
      users.forEach((user: any) => permissionsService.invalidateCache(user.id));
    }

    await logSystemAction(req, req.user!.id, access.profile.empresa_id, 'ACCESS_PROFILE_UPDATE', `Atualizou perfil de acesso ID ${id}`);
    sendSuccess(res, profile, 'Perfil de acesso atualizado com sucesso');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar perfil de acesso';
    sendError(res, message);
  }
});

router.delete('/:id', requirePermission('usuarios.gerenciar_permissoes'), async (req: AuthRequest, res) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) return sendError(res, 'ID invalido', 400);
    const access = await ensureProfileAccess(req, id);
    if (access.error) return sendError(res, access.error, access.status);

    const [users]: any = await pool.query('SELECT COUNT(*) as total FROM usuarios WHERE access_profile_id = ?', [id]);
    if (Number(users[0]?.total || 0) > 0) {
      return sendError(res, 'Nao e possivel excluir um perfil com usuarios vinculados.', 400);
    }

    await accessProfilesService.archive(id);
    await logSystemAction(req, req.user!.id, access.profile.empresa_id, 'ACCESS_PROFILE_DELETE', `Arquivou perfil de acesso ID ${id}`);
    sendSuccess(res, null, 'Perfil de acesso removido com sucesso');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao remover perfil de acesso';
    sendError(res, message);
  }
});

export default router;
