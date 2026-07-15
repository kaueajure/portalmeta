import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import pool from '../db/connection.js';
const SECRET = env.JWT_SECRET;
export const authMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
    if (!token) {
        return res.status(401).json({ success: false, message: 'Token de acesso ausente. Faça login novamente.' });
    }
    try {
        const decoded = jwt.verify(token, SECRET);
        // Payload validation
        if (!decoded || typeof decoded !== 'object' || !decoded.id || !decoded.email) {
            return res.status(401).json({ success: false, message: 'Sessão corrompida. Faça login novamente.' });
        }
        // Strict validation: check database
        const [rows] = await pool.query('SELECT id, nome, email, empresa_id, administrador, desenvolvedor, ativo, perfil, access_profile_id FROM usuarios WHERE id = ?', [decoded.id]);
        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Sua conta não foi encontrada no sistema.' });
        }
        if (Number(rows[0].ativo) !== 1) {
            return res.status(403).json({ success: false, message: 'Sua conta foi desativada pelo administrador.' });
        }
        req.user = {
            ...decoded,
            id: rows[0].id,
            nome: rows[0].nome,
            email: rows[0].email,
            empresa_id: rows[0].empresa_id,
            administrador: Boolean(rows[0].administrador),
            desenvolvedor: Boolean(rows[0].desenvolvedor),
            ativo: Boolean(rows[0].ativo),
            perfil: rows[0].perfil || decoded.perfil || null,
            access_profile_id: rows[0].access_profile_id ? Number(rows[0].access_profile_id) : null,
        };
        next();
    }
    catch (error) {
        return res.status(401).json({ success: false, message: 'Sessão inválida ou expirada' });
    }
};
export const requireDeveloper = (req, res, next) => {
    if (!req.user || !req.user.desenvolvedor) {
        return res.status(403).json({ success: false, message: 'Acesso negado. Apenas desenvolvedores podem realizar esta ação.' });
    }
    next();
};
export const requireAdmin = (req, res, next) => {
    if (!req.user || (!req.user.administrador && !req.user.desenvolvedor)) {
        return res.status(403).json({ success: false, message: 'Acesso negado. Permissões de administrador necessárias.' });
    }
    next();
};
