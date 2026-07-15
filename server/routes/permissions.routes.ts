import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/permissions.middleware.js';
import { isGlobalOnlyPermission, permissionsService } from '../services/permissions.service.js';
import pool from '../db/connection.js';

const router = Router();

// Apply authentication to all permission routes
router.use(authMiddleware);

function parsePositiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function validateTargetAccess(caller: any, targetUser: any): string | null {
  if (!caller.desenvolvedor && (!caller.empresa_id || Number(caller.empresa_id) !== Number(targetUser.empresa_id))) {
    return 'Acesso negado: usuario alvo pertence a outra empresa.';
  }

  if ((targetUser.desenvolvedor || targetUser.perfil === 'desenvolvedor') && !caller.desenvolvedor) {
    return 'Apenas desenvolvedores podem alterar permissoes de outro desenvolvedor.';
  }

  if (caller.perfil === 'gestor' && (targetUser.desenvolvedor || targetUser.administrador || targetUser.perfil === 'administrador')) {
    return 'Gestores nao podem alterar permissoes de administradores ou desenvolvedores.';
  }

  return null;
}

async function getTargetUser(targetUserId: number) {
  const [targetUserRows]: any = await pool.query(
    'SELECT id, empresa_id, desenvolvedor, administrador, perfil, access_profile_id FROM usuarios WHERE id = ?',
    [targetUserId]
  );
  return targetUserRows[0] || null;
}

function accessProfileManagedError(targetUser: any): string | null {
  if (targetUser?.access_profile_id) {
    return 'Permissoes deste usuario sao gerenciadas pelo perfil de acesso vinculado. Edite o perfil em Perfis de Acesso.';
  }
  return null;
}

function globalPermissionAllowError(caller: any, permissionKeys: string[], effect: 'allow' | 'deny'): string | null {
  if (effect !== 'allow' || caller.desenvolvedor) return null;

  const globalKeys = permissionKeys.filter(isGlobalOnlyPermission);
  if (globalKeys.length === 0) return null;

  return `Apenas desenvolvedores podem conceder permissoes globais do SaaS (${globalKeys.join(', ')}).`;
}

// 1. GET /api/permissions/me
router.get('/me', async (req: AuthRequest, res) => {
  try {
    const permissions = await permissionsService.getEffectivePermissions(req.user);
    const isSuperUser = !!req.user?.desenvolvedor;
    return res.json({
      success: true,
      data: {
        permissions,
        isSuperUser,
        isTenantAdmin: !!req.user?.administrador && !req.user?.desenvolvedor
      }
    });
  } catch (err: any) {
    console.error('Erro ao buscar permissões do usuário atual:', err);
    return res.status(500).json({ success: false, message: 'Erro ao buscar perfil.' });
  }
});

// 2. GET /api/permissions/catalog
router.get('/catalog', requirePermission('usuarios.ver_permissoes'), async (req: AuthRequest, res) => {
  try {
    const catalog = await permissionsService.getCatalog();
    return res.json({
      success: true,
      data: {
        catalog
      }
    });
  } catch (err: any) {
    console.error('Erro ao buscar catálogo de permissões:', err);
    return res.status(500).json({ success: false, message: 'Erro interno ao buscar catálogo.' });
  }
});

// 3. GET /api/permissions/users/:id
router.get('/users/:id', requirePermission('usuarios.ver_permissoes'), async (req: AuthRequest, res) => {
  try {
    const userId = parsePositiveInt(req.params.id);
    if (!userId) {
      return res.status(400).json({ success: false, message: 'ID de usuario invalido.' });
    }

    const targetUser = await getTargetUser(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Usuario alvo nao encontrado.' });
    }

    const accessError = validateTargetAccess(req.user!, targetUser);
    if (accessError) {
      return res.status(403).json({ success: false, message: accessError });
    }

    const matrix = await permissionsService.getUserPermissionMatrix(userId);
    return res.json({
      success: true,
      data: matrix
    });
  } catch (err: any) {
    console.error('Erro ao carregar matriz de permissões:', err);
    return res.status(500).json({ success: false, message: err.message || 'Erro ao carregar matriz.' });
  }
});

// 4. PUT /api/permissions/users/:id/override
router.put('/users/:id/override', requirePermission('usuarios.gerenciar_permissoes'), async (req: AuthRequest, res) => {
  try {
    const targetUserId = parsePositiveInt(req.params.id);
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'ID de usuario invalido.' });
    }
    const { permission_key, effect, motivo } = req.body;

    if (!permission_key || !['allow', 'deny'].includes(effect)) {
      return res.status(400).json({ success: false, message: 'Campos chaves ausentes ou inválidos.' });
    }

    const caller = req.user!;

    // Load target user's details
    const [targetUserRows]: any = await pool.query(
      'SELECT id, empresa_id, desenvolvedor, administrador, perfil, access_profile_id FROM usuarios WHERE id = ?',
      [targetUserId]
    );

    if (targetUserRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuário alvo não encontrado.' });
    }
    const targetUser = targetUserRows[0];
    const accessError = validateTargetAccess(caller, targetUser);
    if (accessError) {
      return res.status(403).json({ success: false, message: accessError });
    }

    const profileManagedError = accessProfileManagedError(targetUser);
    if (profileManagedError) {
      return res.status(400).json({ success: false, message: profileManagedError });
    }

    // Hierarchy check:
    // Only developer can edit developer
    if ((targetUser.desenvolvedor || targetUser.perfil === 'desenvolvedor') && !caller.desenvolvedor) {
      return res.status(403).json({ success: false, message: 'Apenas desenvolvedores podem alterar permissões de outro desenvolvedor.' });
    }

    // Gestor cannot edit admin/developer
    if (caller.perfil === 'gestor' && (targetUser.desenvolvedor || targetUser.administrador || targetUser.perfil === 'administrador')) {
      return res.status(403).json({ success: false, message: 'Gestores não podem alterar permissões de administradores ou desenvolvedores.' });
    }

    // Don't let oneself lock themselves out of critical permissions
    if (targetUserId === caller.id && permission_key === 'usuarios.gerenciar_permissoes' && effect === 'deny') {
      return res.status(400).json({ success: false, message: 'Você não pode revogar seu próprio acesso para gerenciar permissões.' });
    }

    if (targetUserId === caller.id && permission_key === 'sistema.developer' && effect === 'deny') {
      return res.status(400).json({ success: false, message: 'Você não pode revogar seu próprio acesso de desenvolvedor.' });
    }

    const [validPermissionRows]: any = await pool.query(
      'SELECT permission_key FROM permissions_catalog WHERE permission_key = ? AND ativo = 1',
      [permission_key]
    );
    if (validPermissionRows.length === 0) {
      return res.status(400).json({ success: false, message: 'Permissao inexistente ou inativa no catalogo.' });
    }

    const globalAllowError = globalPermissionAllowError(caller, [permission_key], effect);
    if (globalAllowError) {
      return res.status(403).json({ success: false, message: globalAllowError });
    }

    await permissionsService.setUserPermissionOverride({
      usuarioId: targetUserId,
      permissionKey: permission_key,
      effect,
      grantedBy: caller.id,
      motivo,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.json({
      success: true,
      message: 'Permissão personalizada atualizada com sucesso.',
      data: null
    });
  } catch (err: any) {
    console.error('Erro ao salvar override de permissão:', err);
    return res.status(500).json({ success: false, message: 'Erro ao salvar override.' });
  }
});

// 5. DELETE /api/permissions/users/:id/override/:permissionKey
router.delete('/users/:id/override/:permissionKey', requirePermission('usuarios.gerenciar_permissoes'), async (req: AuthRequest, res) => {
  try {
    const targetUserId = parsePositiveInt(req.params.id);
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'ID de usuario invalido.' });
    }
    const { permissionKey } = req.params;
    const caller = req.user!;

    // Load target user's details
    const [targetUserRows]: any = await pool.query(
      'SELECT id, empresa_id, desenvolvedor, administrador, perfil, access_profile_id FROM usuarios WHERE id = ?',
      [targetUserId]
    );

    if (targetUserRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuário alvo não encontrado.' });
    }
    const targetUser = targetUserRows[0];
    const accessError = validateTargetAccess(caller, targetUser);
    if (accessError) {
      return res.status(403).json({ success: false, message: accessError });
    }

    const profileManagedError = accessProfileManagedError(targetUser);
    if (profileManagedError) {
      return res.status(400).json({ success: false, message: profileManagedError });
    }

    // Hierarchy check
    if ((targetUser.desenvolvedor || targetUser.perfil === 'desenvolvedor') && !caller.desenvolvedor) {
      return res.status(403).json({ success: false, message: 'Apenas desenvolvedores podem alterar permissões de outro desenvolvedor.' });
    }

    if (caller.perfil === 'gestor' && (targetUser.desenvolvedor || targetUser.administrador || targetUser.perfil === 'administrador')) {
      return res.status(403).json({ success: false, message: 'Gestores não podem alterar permissões de administradores ou desenvolvedores.' });
    }

    await permissionsService.removeUserPermissionOverride({
      usuarioId: targetUserId,
      permissionKey,
      executorId: caller.id,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.json({
      success: true,
      message: 'Override de permissão removido, redefinindo para o padrão.',
      data: null
    });
  } catch (err: any) {
    console.error('Erro ao remover override de permissão:', err);
    return res.status(500).json({ success: false, message: 'Erro ao remover override de permissão.' });
  }
});

// 6. POST /api/permissions/users/:id/reset
router.post('/users/:id/reset', requirePermission('usuarios.gerenciar_permissoes'), async (req: AuthRequest, res) => {
  try {
    const targetUserId = parsePositiveInt(req.params.id);
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'ID de usuario invalido.' });
    }
    const caller = req.user!;

    // Load target user's details
    const [targetUserRows]: any = await pool.query(
      'SELECT id, empresa_id, desenvolvedor, administrador, perfil, access_profile_id FROM usuarios WHERE id = ?',
      [targetUserId]
    );

    if (targetUserRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuário alvo não encontrado.' });
    }
    const targetUser = targetUserRows[0];
    const accessError = validateTargetAccess(caller, targetUser);
    if (accessError) {
      return res.status(403).json({ success: false, message: accessError });
    }

    const profileManagedError = accessProfileManagedError(targetUser);
    if (profileManagedError) {
      return res.status(400).json({ success: false, message: profileManagedError });
    }

    // Hierarchy check
    if ((targetUser.desenvolvedor || targetUser.perfil === 'desenvolvedor') && !caller.desenvolvedor) {
      return res.status(403).json({ success: false, message: 'Apenas desenvolvedores podem alterar permissões de outro desenvolvedor.' });
    }

    if (caller.perfil === 'gestor' && (targetUser.desenvolvedor || targetUser.administrador || targetUser.perfil === 'administrador')) {
      return res.status(403).json({ success: false, message: 'Gestores não podem alterar permissões de administradores ou desenvolvedores.' });
    }

    await permissionsService.resetUserPermissions(targetUserId, caller.id, req.ip, req.get('user-agent'));

    return res.json({
      success: true,
      message: 'Todas as permissões personalizadas foram removidas.',
      data: null
    });
  } catch (err: any) {
    console.error('Erro ao resetar permissões do usuário:', err);
    return res.status(500).json({ success: false, message: 'Erro ao resetar permissões.' });
  }
});

// 6b. POST /api/permissions/users/:id/bulk
router.post('/users/:id/bulk', requirePermission('usuarios.gerenciar_permissoes'), async (req: AuthRequest, res) => {
  try {
    const targetUserId = parsePositiveInt(req.params.id);
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'ID de usuario invalido.' });
    }
    const { permission_keys, effect, motivo } = req.body;

    if (!permission_keys || !Array.isArray(permission_keys) || permission_keys.length === 0 || !['allow', 'deny'].includes(effect)) {
      return res.status(400).json({ success: false, message: 'Campos chaves ausentes ou inválidos.' });
    }

    const caller = req.user!;

    // Load target user's details
    const [targetUserRows]: any = await pool.query(
      'SELECT id, empresa_id, desenvolvedor, administrador, perfil, access_profile_id FROM usuarios WHERE id = ?',
      [targetUserId]
    );

    if (targetUserRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuário alvo não encontrado.' });
    }
    const targetUser = targetUserRows[0];
    const accessError = validateTargetAccess(caller, targetUser);
    if (accessError) {
      return res.status(403).json({ success: false, message: accessError });
    }

    const profileManagedError = accessProfileManagedError(targetUser);
    if (profileManagedError) {
      return res.status(400).json({ success: false, message: profileManagedError });
    }

    // Hierarchy check: Only developer can edit developer
    if ((targetUser.desenvolvedor || targetUser.perfil === 'desenvolvedor') && !caller.desenvolvedor) {
      return res.status(403).json({ success: false, message: 'Apenas desenvolvedores podem alterar permissões de outro desenvolvedor.' });
    }

    // Gestor cannot edit admin/developer
    if (caller.perfil === 'gestor' && (targetUser.desenvolvedor || targetUser.administrador || targetUser.perfil === 'administrador')) {
      return res.status(403).json({ success: false, message: 'Gestores não podem alterar permissões de administradores ou desenvolvedores.' });
    }

    // Don't let oneself lock themselves out of critical permissions
    if (targetUserId === caller.id && effect === 'deny') {
      if (permission_keys.includes('usuarios.gerenciar_permissoes')) {
        return res.status(400).json({ success: false, message: 'Você não pode revogar seu próprio acesso para gerenciar permissões.' });
      }
      if (permission_keys.includes('sistema.developer')) {
        return res.status(400).json({ success: false, message: 'Você não pode revogar seu próprio acesso de desenvolvedor.' });
      }
    }

    // Validate permission_keys exist in permissions_catalog
    const [validRows]: any = await pool.query(
      'SELECT permission_key FROM permissions_catalog WHERE permission_key IN (?) AND ativo = 1',
      [permission_keys]
    );
    const validKeys = validRows.map((r: any) => r.permission_key);
    const invalidKeys = permission_keys.filter(k => !validKeys.includes(k));
    if (invalidKeys.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Algumas permissões fornecidas não existem no catálogo ou estão inativas.', 
        data: { invalid_keys: invalidKeys } 
      });
    }

    const globalAllowError = globalPermissionAllowError(caller, permission_keys, effect);
    if (globalAllowError) {
      return res.status(403).json({ success: false, message: globalAllowError });
    }

    await permissionsService.setUserPermissionOverridesBulk({
      usuarioId: targetUserId,
      permissionKeys: permission_keys,
      effect,
      grantedBy: caller.id,
      motivo,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.json({
      success: true,
      message: 'Permissões personalizadas atualizadas com sucesso.',
      data: {
        updated: permission_keys.length,
        skipped: 0
      }
    });
  } catch (err: any) {
    console.error('Erro ao salvar permissões em massa:', err);
    return res.status(500).json({ success: false, message: 'Erro ao salvar permissões em massa.' });
  }
});

// 6c. POST /api/permissions/users/:id/bulk-reset
router.post('/users/:id/bulk-reset', requirePermission('usuarios.gerenciar_permissoes'), async (req: AuthRequest, res) => {
  try {
    const targetUserId = parsePositiveInt(req.params.id);
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'ID de usuario invalido.' });
    }
    const { permission_keys } = req.body;

    if (!permission_keys || !Array.isArray(permission_keys) || permission_keys.length === 0) {
      return res.status(400).json({ success: false, message: 'Campos chaves ausentes ou inválidos.' });
    }

    const caller = req.user!;

    // Load target user's details
    const [targetUserRows]: any = await pool.query(
      'SELECT id, empresa_id, desenvolvedor, administrador, perfil, access_profile_id FROM usuarios WHERE id = ?',
      [targetUserId]
    );

    if (targetUserRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuário alvo não encontrado.' });
    }
    const targetUser = targetUserRows[0];
    const accessError = validateTargetAccess(caller, targetUser);
    if (accessError) {
      return res.status(403).json({ success: false, message: accessError });
    }

    const profileManagedError = accessProfileManagedError(targetUser);
    if (profileManagedError) {
      return res.status(400).json({ success: false, message: profileManagedError });
    }

    // Hierarchy check
    if ((targetUser.desenvolvedor || targetUser.perfil === 'desenvolvedor') && !caller.desenvolvedor) {
      return res.status(403).json({ success: false, message: 'Apenas desenvolvedores podem alterar permissões de outro desenvolvedor.' });
    }

    if (caller.perfil === 'gestor' && (targetUser.desenvolvedor || targetUser.administrador || targetUser.perfil === 'administrador')) {
      return res.status(403).json({ success: false, message: 'Gestores não podem alterar permissões de administradores ou desenvolvedores.' });
    }

    // Validate permission_keys exist in permissions_catalog
    const [validRowsReset]: any = await pool.query(
      'SELECT permission_key FROM permissions_catalog WHERE permission_key IN (?) AND ativo = 1',
      [permission_keys]
    );
    const validKeysReset = validRowsReset.map((r: any) => r.permission_key);
    const invalidKeysReset = permission_keys.filter(k => !validKeysReset.includes(k));
    if (invalidKeysReset.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Algumas permissões fornecidas não existem no catálogo ou estão inativas para serem redefinidas.', 
        data: { invalid_keys: invalidKeysReset } 
      });
    }

    await permissionsService.removeUserPermissionOverridesBulk({
      usuarioId: targetUserId,
      permissionKeys: permission_keys,
      executorId: caller.id,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.json({
      success: true,
      message: 'Permissões restauradas para o padrão.',
      data: {
        removed: permission_keys.length
      }
    });
  } catch (err: any) {
    console.error('Erro ao restaurar permissões em massa:', err);
    return res.status(500).json({ success: false, message: 'Erro ao restaurar permissões em massa.' });
  }
});

// 7. POST /api/permissions/sync
router.post('/sync', requirePermission('sistema.developer'), async (req: AuthRequest, res) => {
  try {
    if (!req.user?.desenvolvedor) {
      return res.status(403).json({ success: false, message: 'Apenas desenvolvedores podem sincronizar o catalogo de permissoes.' });
    }

    await permissionsService.syncCatalog();
    return res.json({
      success: true,
      message: 'Catálogo de permissões e perfis sincronizados com sucesso!',
      data: null
    });
  } catch (err: any) {
    console.error('Erro ao sincronizar permissões:', err);
    return res.status(500).json({ success: false, message: 'Erro interno ao sincronizar permissões.' });
  }
});

export default router;
