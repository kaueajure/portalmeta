import { Router } from 'express';
import authService from '../services/auth.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logSystemAction } from '../utils/logger.js';
import { env } from '../config/env.js';
import { isValidPassword, PASSWORD_RULE_MESSAGE } from '../utils/validators.js';
import { maskEmail } from '../utils/sanitize.js';
import rateLimit from 'express-rate-limit';

const router = Router();

// 1. Stricter Rate Limiting for Auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 failed login attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
  skip: (req) => !env.IS_PROD // Only apply in production or if needed
});

const passwordRecoveryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Rate limit exceeded for password recovery. Try again later.' },
  skip: (req) => !env.IS_PROD
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'E-mail e senha são obrigatórios' });
    }

    const data = await authService.login(email, password);
    
    // Set Hardened Cookie
    res.cookie('token', data.sessionToken, {
      httpOnly: true,
      secure: env.IS_PROD,
      sameSite: env.IS_PROD ? 'strict' : 'lax', // Strict in production for CSRF
      maxAge: 8 * 60 * 60 * 1000, // 8 hours (shorter, more secure)
      path: '/'
    });

    await logSystemAction(req, data.user.id, data.user.empresa_id, 'LOGIN', 'Usuário realizou login com sucesso');
    
    sendSuccess(res, { user: data.user }, 'Login realizado com sucesso');
  } catch (error: unknown) {
    // Generic error message to prevent enumeration
    const message = error instanceof Error ? error.message : 'E-mail ou senha incorretos';
    res.status(401).json({ success: false, message });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: env.IS_PROD,
    sameSite: env.IS_PROD ? 'strict' : 'lax',
    path: '/'
  });
  res.clearCookie('portal_token', {
    httpOnly: true,
    secure: env.IS_PROD,
    sameSite: 'lax',
    path: '/'
  });
  sendSuccess(res, null, 'Logout realizado com sucesso');
});

router.post('/forgot-password', passwordRecoveryLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return sendError(res, 'O e-mail é obrigatório.', 400);
    }
    
    // We always return success to prevent email enumeration
    await authService.forgotPassword(email).catch(err => {
      console.warn(`[Forgot Password] Failed for ${maskEmail(email)}:`, err.message);
    });
    
    sendSuccess(res, { sent: true }, 'Se este e-mail estiver cadastrado, você receberá instruções para redefinir sua senha.');
  } catch (error: unknown) {
    // Still return success message
    sendSuccess(res, { sent: true }, 'Se este e-mail estiver cadastrado, você receberá instruções para redefinir sua senha.');
  }
});

router.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return sendError(res, 'E-mail, token e nova senha são obrigatórios.', 400);
    }
    if (!isValidPassword(newPassword)) {
      return sendError(res, PASSWORD_RULE_MESSAGE, 400);
    }
    const data = await authService.resetPassword(email, token, newPassword);
    sendSuccess(res, data, 'Senha redefinida com sucesso.');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao redefinir a senha ou token expirado.';
    sendError(res, message, 400);
  }
});

export default router;
