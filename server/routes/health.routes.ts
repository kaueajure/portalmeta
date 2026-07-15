import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middlewares/auth.js';
import pool from '../db/connection.js';
import { env } from '../config/env.js';

const router = Router();

const requireDev = (req: AuthRequest, res: any, next: any) => {
  if (!req.user || !req.user.desenvolvedor) {
    return res.status(403).json({ success: false, message: 'Acesso negado: Requer privilégios de desenvolvedor.' });
  }
  next();
};

router.use(authMiddleware);
router.use(requireDev);

// GET /api/health/db
router.get('/db', async (req, res) => {
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const latencyMs = Date.now() - start;

    res.json({
      success: true,
      data: {
        success: true,
        status: 'CONNECTED',
        latencyMs,
        database: env.DB.NAME,
        checkedAt: new Date().toISOString()
      }
    });
  } catch (err: any) {
    res.json({
      success: true,
      data: {
        success: false,
        status: 'ERROR',
        message: err.message || 'Falha ao conectar no banco',
        checkedAt: new Date().toISOString()
      }
    });
  }
});

// GET /api/health/system
router.get('/system', (req, res) => {
  res.json({
    success: true,
    data: {
      success: true,
      status: 'OPERATIONAL',
      environment: env.NODE_ENV,
      uptimeSeconds: process.uptime(),
      nodeVersion: process.version,
      memory: {
        rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapTotalMb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      },
      roles: {
        web: env.ENABLE_WEB_SERVER,
        emailListener: env.ENABLE_EMAIL_LISTENER,
        ticketJobs: env.ENABLE_TICKET_JOBS
      },
      checkedAt: new Date().toISOString()
    }
  });
});

// GET /api/health/security
router.get('/security', (req, res) => {
  const warnings: string[] = [];

  if (env.NODE_ENV === 'production') {
    if (env.TRUST_PROXY === false) {
      warnings.push('TRUST_PROXY não está habilitado em produção. O Rate Limit pode não funcionar corretamente se houver um proxy reverso/Nginx na frente.');
    }
    if (!env.CORS_ORIGINS || env.CORS_ORIGINS.length === 0) {
      warnings.push('CORS_ORIGINS está vazio em produção. Recomenda-se configurar as origens permitidas.');
    }
  }

  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    warnings.push('JWT_SECRET esta configurado, mas muito curto. Use pelo menos 32 caracteres complexos.');
  }

  res.json({
    success: true,
    data: {
      success: true,
      status: warnings.length > 0 ? 'WARNING' : 'ACTIVE',
      auth: true,
      helmet: true,
      rateLimit: true,
      trustProxy: env.TRUST_PROXY,
      corsOriginsCount: env.CORS_ORIGINS ? env.CORS_ORIGINS.length : 0,
      cookieSecurity: {
        httpOnly: true,
        secureInProduction: true,
        sameSite: env.IS_PROD ? 'strict' : 'lax'
      },
      warnings
    }
  });
});

// GET /api/health/overview
router.get('/overview', async (req, res) => {
  let dbResult;
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const latencyMs = Date.now() - start;
    dbResult = {
      success: true,
      status: 'CONNECTED',
      latencyMs,
      database: env.DB.NAME,
      checkedAt: new Date().toISOString()
    };
  } catch (err: any) {
    dbResult = {
      success: false,
      status: 'ERROR',
      message: err.message || 'Falha ao conectar no banco',
      checkedAt: new Date().toISOString()
    };
  }

  const systemResult = {
    success: true,
    status: 'OPERATIONAL',
    environment: env.NODE_ENV,
    uptimeSeconds: process.uptime(),
    nodeVersion: process.version,
    memory: {
      rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapTotalMb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    },
    roles: {
      web: env.ENABLE_WEB_SERVER,
      emailListener: env.ENABLE_EMAIL_LISTENER,
      ticketJobs: env.ENABLE_TICKET_JOBS
    },
    checkedAt: new Date().toISOString()
  };

  const warnings: string[] = [];

  if (env.NODE_ENV === 'production') {
    if (env.TRUST_PROXY === false) {
      warnings.push('TRUST_PROXY não está habilitado em produção. O Rate Limit pode não funcionar corretamente se houver um proxy reverso/Nginx na frente.');
    }
    if (!env.CORS_ORIGINS || env.CORS_ORIGINS.length === 0) {
      warnings.push('CORS_ORIGINS está vazio em produção. Recomenda-se configurar as origens permitidas.');
    }
  }

  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    warnings.push('JWT_SECRET esta configurado, mas muito curto. Use pelo menos 32 caracteres complexos.');
  }

  const securityResult = {
    success: true,
    status: warnings.length > 0 ? 'WARNING' : 'ACTIVE',
    auth: true,
    helmet: true,
    rateLimit: true,
    trustProxy: env.TRUST_PROXY,
    corsOriginsCount: env.CORS_ORIGINS ? env.CORS_ORIGINS.length : 0,
    cookieSecurity: {
      httpOnly: true,
      secureInProduction: true,
      sameSite: env.IS_PROD ? 'strict' : 'lax'
    },
    warnings
  };

  res.json({
    success: true,
    data: {
      database: dbResult,
      system: systemResult,
      security: securityResult
    }
  });
});

export default router;
