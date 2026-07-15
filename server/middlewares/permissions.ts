import { Response, NextFunction } from 'express';
import  { AuthRequest } from  './auth.js';

export const isDev = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Não autenticado' });
  }
  if (req.user.desenvolvedor) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Acesso negado: Requer privilégios de desenvolvedor' });
};

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Não autenticado' });
  }
  if (req.user.administrador || req.user.desenvolvedor) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Acesso negado: Requer privilégios de administrador' });
};
