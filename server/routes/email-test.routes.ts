import { Router } from 'express';
import { verifySMTP, sendTestEmail } from '../utils/mailer.js';
import { EmailListenerService } from '../services/email-listener.service.js';
import { authMiddleware } from '../middlewares/auth.js';
import { env } from '../config/env.js';

const router = Router();

// Only developers can inspect/test the global SaaS mail configuration.
router.use(authMiddleware);

router.get('/config', (req: any, res) => {
  if (!req.user?.desenvolvedor) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  res.json({
    smtp: {
      host: env.SMTP.HOST,
      port: env.SMTP.PORT,
      user: env.SMTP.USER,
      from: env.SMTP.FROM,
      configured: !!env.SMTP.USER && !!env.SMTP.PASS
    },
    imap: {
      host: env.IMAP.HOST,
      port: env.IMAP.PORT,
      user: env.IMAP.USER,
      configured: !!env.IMAP.USER && !!env.IMAP.PASS
    },
    listenerActive: env.ENABLE_EMAIL_LISTENER
  });
});

router.post('/test-smtp', async (req: any, res) => {
  if (!req.user?.desenvolvedor) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const result = await verifySMTP();
  res.json(result);
});

router.post('/send-test', async (req: any, res) => {
  if (!req.user?.desenvolvedor) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'Destinatário é obrigatório' });

  const result = await sendTestEmail(to);
  res.json(result);
});

export default router;
