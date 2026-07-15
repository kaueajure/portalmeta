import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { permissionsService } from '../services/permissions.service.js';

export const requirePermission = (permissionKey: string, options?: {
  allowDeveloper?: boolean;
  allowAdmin?: boolean;
}) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    try {
      // Fallback/Overrides
      if (options?.allowDeveloper && req.user.desenvolvedor) {
        return next();
      }
      if (options?.allowAdmin && req.user.administrador) {
        return next();
      }

      const hasPerm = await permissionsService.hasPermission(req.user, permissionKey);
      if (hasPerm) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: `Você não tem permissão para executar esta ação (${permissionKey}).`
      });
    } catch (err) {
      console.error(`Erro ao validar permissão ${permissionKey}:`, err);
      return res.status(500).json({ success: false, message: 'Erro interno ao validar permissão.' });
    }
  };
};

export const requireAnyPermission = (permissionKeys: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    try {
      if (req.user.desenvolvedor) {
        return next();
      }

      for (const key of permissionKeys) {
        const hasPerm = await permissionsService.hasPermission(req.user, key);
        if (hasPerm) {
          return next();
        }
      }

      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para executar esta ação.'
      });
    } catch (err) {
      console.error(`Erro ao validar requireAnyPermission ${permissionKeys.join(', ')}:`, err);
      return res.status(500).json({ success: false, message: 'Erro interno ao validar permissão.' });
    }
  };
};

export const requireAllPermissions = (permissionKeys: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    try {
      if (req.user.desenvolvedor) {
        return next();
      }

      for (const key of permissionKeys) {
        const hasPerm = await permissionsService.hasPermission(req.user, key);
        if (!hasPerm) {
          return res.status(403).json({
            success: false,
            message: `Você não possui todas as permissões exigidas (${key}).`
          });
        }
      }

      return next();
    } catch (err) {
      console.error(`Erro ao validar requireAllPermissions ${permissionKeys.join(', ')}:`, err);
      return res.status(500).json({ success: false, message: 'Erro interno ao validar permissão.' });
    }
  };
};

export const attachEffectivePermissions = () => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user) {
      try {
        const effective = await permissionsService.getEffectivePermissions(req.user);
        (req.user as any).permissions = effective;
      } catch (err) {
        console.error('Erro ao anexar permissões efetivas:', err);
      }
    }
    next();
  };
};
