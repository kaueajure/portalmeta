import pool from '../db/connection.js';
export const logSystemAction = async (req, userId, empresaId, acao, descricao) => {
    try {
        const ip = req ? (req.ip || req.headers['x-forwarded-for'] || '0.0.0.0') : 'system';
        const userAgent = req ? (req.headers['user-agent'] || 'unknown') : 'system';
        await pool.query("INSERT INTO logs_sistema (usuario_id, empresa_id, acao, descricao, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)", [userId, empresaId, acao, descricao, Array.isArray(ip) ? ip[0] : ip, userAgent]);
    }
    catch (error) {
        console.error("Log error:", error);
    }
};
