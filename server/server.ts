import express from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import pool from './db/connection.js';
import { initDB } from './db/init-db.js';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middlewares/error-handler.js';
import { env } from './config/env.js';
import { EmailListenerService } from './services/email-listener.service.js';
import { runTicketAutomations } from './jobs/ticketAutomationJob.js';
import { emailOutboxService } from './services/email-outbox.service.js';

export let io: SocketIOServer;

function getCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join('='));
    }
  }
  return null;
}

function getSocketToken(socket: any): string | null {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) return authToken.trim();

  const authorization = socket.handshake.headers?.authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  return getCookieValue(socket.handshake.headers?.cookie, 'token');
}

function getRequestedSocketCompanyId(socket: any): number | null {
  const rawEmpresaId = socket.handshake.auth?.empresa_id || socket.handshake.query?.empresa_id;
  const empresaId = Number(Array.isArray(rawEmpresaId) ? rawEmpresaId[0] : rawEmpresaId);
  return Number.isInteger(empresaId) && empresaId > 0 ? empresaId : null;
}

async function startServer() {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    `http://localhost:${env.PORT}`,
    `http://127.0.0.1:${env.PORT}`,
    'https://gestifique.com.br',
    'https://www.gestifique.com.br',
    'https://cornflowerblue-kingfisher-528919.hostingersite.com',
    ...env.CORS_ORIGINS
  ];

  const corsOptions = {
    origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      if (!origin) return callback(null, true);

      const isLocal = !env.IS_PROD && (
        origin.startsWith('http://localhost') || 
        origin.startsWith('http://127.0.0.1') ||
        origin.includes('.run.app') || 
        origin.includes('.studio')
      );

      if (isLocal || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['set-cookie']
  };

  const app = express();

  // Configuração de Trust Proxy para lidar com X-Forwarded-For (necessário para express-rate-limit atrás de proxy)
  if (env.TRUST_PROXY !== false) {
    app.set('trust proxy', env.TRUST_PROXY);
    console.log(`[BOOT] Trust Proxy configured as: ${env.TRUST_PROXY}`);
  }
  
  // 1. Security Headers (Helmet) - Hardened for Production
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // S2 (Fase 1): 'unsafe-eval' é necessário apenas em desenvolvimento (Vite/HMR).
        // Em produção o bundle é estático e não usa eval, então removemos.
        // Em producao tambem removemos script inline; estilos ainda usam inline por compatibilidade.
        scriptSrc: [
          "'self'",
          ...(env.IS_PROD ? [] : ["'unsafe-inline'", "'unsafe-eval'"]),
          "https://cdn.jsdelivr.net"
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        fontSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:", "https://images.unsplash.com", "https://res.cloudinary.com"],
        connectSrc: ["'self'", "ws:", "wss:", "https://*.run.app", "https://*.studio", ...env.CORS_ORIGINS],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: env.IS_PROD ? [] : null,
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false
  }));

  // 2. Global Rate Limiting
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
    skip: (req) => !env.IS_PROD || req.path.startsWith('/health')
  });
  app.use(globalLimiter);

  const httpServer = createServer(app);
  
  // WebSocket initialization if web server role is enabled
  if (env.ENABLE_WEB_SERVER) {
    io = new SocketIOServer(httpServer, {
      cors: corsOptions
    });

    app.set('io', io);

    io.use(async (socket, next) => {
      try {
        const token = getSocketToken(socket);
        const empresaId = getRequestedSocketCompanyId(socket);

        if (!token || !empresaId) {
          return next(new Error('Unauthorized socket connection'));
        }

        const decoded = jwt.verify(token, env.JWT_SECRET) as any;
        if (!decoded?.id) {
          return next(new Error('Unauthorized socket connection'));
        }

        const [rows]: any = await pool.query(
          'SELECT id, empresa_id, administrador, desenvolvedor, ativo, perfil FROM usuarios WHERE id = ?',
          [decoded.id]
        );

        const user = rows[0];
        if (!user || Number(user.ativo) !== 1) {
          return next(new Error('Unauthorized socket connection'));
        }

        const isDeveloper = Boolean(user.desenvolvedor) || user.perfil === 'desenvolvedor';
        if (!isDeveloper && Number(user.empresa_id) !== empresaId) {
          return next(new Error('Forbidden socket room'));
        }

        socket.data.user = {
          id: user.id,
          empresa_id: user.empresa_id,
          administrador: Boolean(user.administrador),
          desenvolvedor: isDeveloper,
          perfil: user.perfil
        };
        socket.data.empresaId = empresaId;
        next();
      } catch {
        next(new Error('Unauthorized socket connection'));
      }
    });

    io.on('connection', (socket) => {
      const empresaId = socket.data.empresaId;
      const room = `empresa_${empresaId}`;
      socket.join(room);
      console.log(`[Socket] User ${socket.data.user?.id} connected to room: ${room}`);

      socket.on('disconnect', () => {
        console.log(`[Socket] User disconnected`);
      });
    });
  }

  const PORT = env.PORT;

  app.use(cors(corsOptions as cors.CorsOptions));
  app.use(express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      // Usado para validar assinatura X-Hub-Signature-256 dos webhooks Meta.
      (req as any).rawBody = buf;
    },
  }));
  app.use(cookieParser());
  
  // Database Boot
  try {
     console.log('[BOOT] Initializing database...');
     await initDB();

     // Base schema is ready, synchronize catalog permissions
     if (process.env.AUTO_SYNC_PERMISSIONS !== 'false') {
       try {
         const { permissionsService } = await import('./services/permissions.service.js');
         console.log('[BOOT] Auto-synchronizing permissions catalog...');
         await permissionsService.syncCatalog();
         console.log('[BOOT] Permissions catalog synchronized.');
       } catch (err) {
         console.error('[BOOT] ⚠️ Erro ao sincronizar catálogo de permissões:', err);
       }
     }
  } catch (err) {
     console.error("❌ CRITICAL: Database initialization failed.");
     if (env.IS_PROD) {
       console.error("Stopping server due to database failure in production.");
       process.exit(1);
     }
  }

  // Health Checks
  app.get('/health', (req, res) => {
    res.json({ 
      success: true, 
      status: 'UP', 
      timestamp: new Date().toISOString(),
      services: {
        web: env.ENABLE_WEB_SERVER,
        emailListener: env.ENABLE_EMAIL_LISTENER,
        jobs: env.ENABLE_TICKET_JOBS
      }
    });
  });

  app.get('/ready', async (req, res) => {
    let databaseReady = false;

    try {
      await pool.query('SELECT 1');
      databaseReady = true;
    } catch {
      databaseReady = false;
    }

    const ready = databaseReady;
    res.status(ready ? 200 : 503).json({
      success: ready,
      status: ready ? 'READY' : 'NOT_READY',
      timestamp: new Date().toISOString(),
      checks: {
        api: 'UP',
        database: databaseReady ? 'CONNECTED' : 'ERROR',
        redis: env.REDIS_URL ? 'CONFIGURED_OPTIONAL' : 'NOT_CONFIGURED'
      },
      roles: {
        web: env.ENABLE_WEB_SERVER,
        emailListener: env.ENABLE_EMAIL_LISTENER,
        jobs: env.ENABLE_TICKET_JOBS
      }
    });
  });

  // Services & Routes according to process roles
  if (env.ENABLE_WEB_SERVER) {
    app.use('/api', apiRoutes);

    // `npm run dev` usa tsx + server.ts. Mesmo com NODE_ENV=production no .env,
    // precisamos do Vite (HMR). Build estático fica só para `npm start` (dist-server).
    const runningViaTsx = process.argv.some((arg) => arg.includes('tsx'))
      || String(process.argv[1] || '').endsWith(`${path.sep}server.ts`)
      || String(process.argv[1] || '').endsWith('/server.ts');
    const useViteDevMiddleware = !env.IS_PROD || runningViaTsx;

    if (useViteDevMiddleware) {
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: { server: httpServer },
        },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log(`[BOOT] Vite middleware ativo (HMR). source=${runningViaTsx ? 'tsx/dev' : 'development'}`);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req: express.Request, res: express.Response) => {
        if (req.path.startsWith('/api')) {
          return res.status(404).json({ success: false, message: 'Rota API não encontrada' });
        }
        res.sendFile(path.join(distPath, 'index.html'));
      });
      console.log('[BOOT] Servindo frontend estático de /dist');
    }
  } else {
    // Worker role minimal responder
    app.get('/', (req, res) => res.status(503).send('Worker Node: HTTP server role disabled.'));
  }

  app.use(errorHandler);

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Gestifique Server Instance running on port ${PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
    console.log(`Roles: [WEB: ${env.ENABLE_WEB_SERVER}] [EMAIL_LISTENER: ${env.ENABLE_EMAIL_LISTENER}] [JOBS: ${env.ENABLE_TICKET_JOBS}]`);

    // Fase 1 (escalabilidade): avisos sobre topologia web/worker.
    // Em ambiente multi-instância, jobs e e-mail listener devem rodar em um
    // WORKER único separado, não nas instâncias web. Apenas warning (não bloqueia).
    if (env.ENABLE_WEB_SERVER && env.ENABLE_TICKET_JOBS) {
      console.warn('[BOOT] ⚠️ ENABLE_WEB_SERVER=true e ENABLE_TICKET_JOBS=true na mesma instância. Em produção multi-instância, prefira rodar os jobs apenas em um worker (ENABLE_TICKET_JOBS=false na web). As automações já são protegidas por lock distribuído (GET_LOCK), mas a separação evita carga desnecessária.');
    }
    if (env.ENABLE_WEB_SERVER && env.ENABLE_EMAIL_LISTENER) {
      console.warn('[BOOT] ⚠️ ENABLE_WEB_SERVER=true e ENABLE_EMAIL_LISTENER=true na mesma instância. O e-mail listener deve rodar em um worker ÚNICO (ENABLE_EMAIL_LISTENER=false na web) para evitar processamento concorrente da mesma caixa.');
    }

    // Start Email Listener only if role is enabled
    if (env.ENABLE_EMAIL_LISTENER) {
      console.log('[BOOT] Starting Email Listener Service...');
      EmailListenerService.init();
    }

    // Start Jobs only if role is enabled
    if (env.ENABLE_TICKET_JOBS) {
      console.log('[BOOT] Starting Ticket Automation Jobs...');
      setInterval(() => {
        runTicketAutomations().catch(err => console.error('[JOB ERROR] runTicketAutomations:', err));
      }, 5 * 60 * 1000);

      setInterval(() => {
        emailOutboxService.processPending().catch(err => console.error('[JOB ERROR] processEmailOutbox:', err));
      }, 60 * 1000);
      
      setTimeout(() => {
        runTicketAutomations().catch(err => console.error('[JOB ERROR INITIAL] runTicketAutomations:', err));
        emailOutboxService.processPending().catch(err => console.error('[JOB ERROR INITIAL] processEmailOutbox:', err));
      }, 5000);
    }
  });
}

startServer().catch(err => {
  console.error('❌ FATAL ERROR during server startup:', err);
  process.exit(1);
});
