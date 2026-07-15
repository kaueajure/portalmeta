import { Router } from 'express';
import pool from '../db/connection.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { sendPortalAccessCodeEmail } from '../utils/mailer.js';
import rateLimit from 'express-rate-limit';
const router = Router();
// Rate limit: 5 requests per 15 minutes per IP
const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        message: 'Muitas solicitações. Tente novamente em 15 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
router.post('/request-code', authRateLimit, async (req, res) => {
    const { customer_email } = req.body;
    if (!customer_email) {
        return sendError(res, 'E-mail é obrigatório', 400);
    }
    const custEmail = customer_email.trim().toLowerCase();
    if (!isValidEmail(custEmail)) {
        return sendError(res, 'E-mail inválido', 400);
    }
    // Response is ALWAYS generic to avoid user enumeration
    const genericResponse = () => sendSuccess(res, { sent: true }, 'Se os dados estiverem corretos, enviaremos um código de acesso.');
    try {
        const [settingsRows] = await pool.query('SELECT nome FROM application_settings WHERE id = 1 LIMIT 1');
        if (settingsRows.length === 0)
            return genericResponse();
        const settings = settingsRows[0];
        // 2. Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(code, salt);
        // 3. Invalidate previous codes
        await pool.query('UPDATE portal_access_codes SET used_at = NOW() WHERE customer_email = ? AND used_at IS NULL', [custEmail]);
        // 4. Save new code
        await pool.query(`
      INSERT INTO portal_access_codes (
        customer_email, codigo_hash, expires_at, ip, user_agent
      ) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), ?, ?)
    `, [custEmail, hash, req.ip, req.headers['user-agent']]);
        // 5. Send email
        await sendPortalAccessCodeEmail({
            to: custEmail,
            code,
            instanceName: settings.nome
        });
        return genericResponse();
    }
    catch (error) {
        console.error('[PortalAuth] Error requesting code:', error);
        return genericResponse();
    }
});
router.post('/verify-code', authRateLimit, async (req, res) => {
    const { customer_email, code } = req.body;
    if (!customer_email || !code) {
        return sendError(res, 'Dados incompletos', 400);
    }
    const custEmail = customer_email.trim().toLowerCase();
    const rawCode = code.trim();
    try {
        // Busca o código mais recente da instância única.
        const [codeRows] = await pool.query(`
      SELECT id, codigo_hash, attempts
      FROM portal_access_codes
      WHERE customer_email = ? AND used_at IS NULL AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `, [custEmail]);
        if (codeRows.length === 0) {
            return sendError(res, 'Código inválido ou expirado.', 400);
        }
        const accessCode = codeRows[0];
        if (accessCode.attempts >= 5) {
            return sendError(res, 'Muitas tentativas. Solicite um novo código.', 429);
        }
        // 3. Verify code
        const isValid = await bcrypt.compare(rawCode, accessCode.codigo_hash);
        if (!isValid) {
            await pool.query('UPDATE portal_access_codes SET attempts = attempts + 1 WHERE id = ?', [accessCode.id]);
            return sendError(res, 'Código inválido ou expirado.', 400);
        }
        // 4. Mark as used
        await pool.query('UPDATE portal_access_codes SET used_at = NOW() WHERE id = ?', [accessCode.id]);
        // 5. Look for optional user
        const [userRows] = await pool.query('SELECT id, nome, email FROM usuarios WHERE LOWER(email) = ? AND ativo = 1 LIMIT 1', [custEmail]);
        const user = userRows.length > 0 ? userRows[0] : null;
        // 6. Generate Portal Token
        const token = jwt.sign({
            type: 'portal_customer',
            customer_email: custEmail,
            usuario_id: user?.id || null,
            nome: user?.nome || null
        }, env.JWT_SECRET, { expiresIn: '2h' });
        res.cookie('portal_token', token, {
            httpOnly: true,
            secure: env.IS_PROD,
            sameSite: 'lax',
            maxAge: 2 * 60 * 60 * 1000,
            path: '/'
        });
        return sendSuccess(res, {
            customer: {
                email: custEmail,
                nome: user?.nome || custEmail,
            }
        }, 'Acesso autorizado.');
    }
    catch (error) {
        console.error('[PortalAuth] Error verifying code:', error);
        return sendError(res, 'Erro ao validar código. Tente novamente.', 500);
    }
});
export default router;
