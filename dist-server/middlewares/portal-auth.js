import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { sendError } from '../utils/response.js';
export const portalAuthMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : null;
    const token = bearerToken || req.cookies?.portal_token;
    if (!token) {
        return sendError(res, 'Acesso ao portal expirado. Solicite um novo codigo.', 401);
    }
    try {
        const decoded = jwt.verify(token, env.JWT_SECRET);
        if (decoded.type !== 'portal_customer') {
            return sendError(res, 'Token invalido para acesso ao portal', 401);
        }
        if (!decoded.empresa_id || !decoded.customer_email) {
            return sendError(res, 'Token de acesso incompleto', 401);
        }
        req.portalCustomer = {
            empresa_id: decoded.empresa_id,
            customer_email: decoded.customer_email,
            usuario_id: decoded.usuario_id || null,
            nome: decoded.nome || null
        };
        next();
    }
    catch (error) {
        return sendError(res, 'Acesso ao portal expirado. Solicite um novo codigo.', 401);
    }
};
