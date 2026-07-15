import dotenv from 'dotenv';

dotenv.config();

process.env.TZ = process.env.APP_TIMEZONE || 'America/Sao_Paulo';

const DEFAULT_FORWARDING_CONFIRMATION_ALLOWED_HOSTS = [
  // Gmail / Google Workspace forwarding confirmations.
  'mail.google.com',
  'mail-settings.google.com',
  'isolated.mail.google.com',
  // Yahoo Mail and AOL Mail forwarding confirmations.
  'login.yahoo.com',
  'mail.yahoo.com',
  'account.yahoo.com',
  'api.login.yahoo.com',
  'login.aol.com',
  'mail.aol.com',
  'account.aol.com',
  'api.login.aol.com',
  // Cloudflare Email Routing destination-address verification.
  'dash.cloudflare.com',
  // Proton Mail forwarding invitations.
  'account.proton.me',
  'mail.proton.me',
  'proton.me',
  // Squarespace domain email forwarding verification.
  'account.squarespace.com',
  'domains.squarespace.com',
  'squarespace.com',
  'www.squarespace.com',
  // Zoho Mail uses verification codes and, in some regions, authenticated links.
  'accounts.zoho.com',
  'mail.zoho.com',
  'accounts.zoho.eu',
  'mail.zoho.eu',
  'accounts.zoho.in',
  'mail.zoho.in',
  'accounts.zoho.com.au',
  'mail.zoho.com.au',
  'accounts.zoho.jp',
  'mail.zoho.jp',
  'accounts.zohocloud.ca',
  'mail.zohocloud.ca',
];

const requiredEnvVars = [
  'JWT_SECRET',
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'DB_PORT',
];

requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`CRITICAL ERROR: Environment variable ${varName} is missing.`);
    process.exit(1);
  }
});

function parsePositiveIntEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeIntEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

// S6: validação de força do JWT_SECRET.
// Rejeita segredo vazio, curto (< 32) ou igual a valores de exemplo conhecidos.
// Em produção é fatal (aborta o boot); em desenvolvimento apenas avisa.
const IS_PROD_BOOT = process.env.NODE_ENV === 'production';
const WEAK_JWT_SECRETS = new Set([
  'mudar-isso-em-producao-com-chave-longa-e-segura',
  'secret',
  'changeme',
  'change-me',
  'jwt_secret',
  'your-secret-key',
  'supersecret',
]);
(() => {
  const secret = (process.env.JWT_SECRET || '').trim();
  const isWeak = secret.length < 32 || WEAK_JWT_SECRETS.has(secret.toLowerCase());
  if (!isWeak) return;

  const reason = secret.length < 32
    ? 'deve ter no mínimo 32 caracteres'
    : 'não pode ser um valor de exemplo/conhecido';

  if (IS_PROD_BOOT) {
    console.error(`CRITICAL ERROR: JWT_SECRET inseguro (${reason}). Defina um segredo forte e aleatório antes de subir em produção.`);
    process.exit(1);
  } else {
    console.warn(`[SECURITY] ⚠️ JWT_SECRET inseguro (${reason}). Tolerado apenas em desenvolvimento; NUNCA use assim em produção.`);
  }
})();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000'),
  JWT_SECRET: process.env.JWT_SECRET as string,
  DB: {
    HOST: process.env.DB_HOST as string,
    USER: process.env.DB_USER as string,
    PASSWORD: process.env.DB_PASSWORD as string,
    NAME: process.env.DB_NAME as string,
    PORT: parseInt(process.env.DB_PORT as string),
    CONNECTION_LIMIT: parsePositiveIntEnv('DB_CONNECTION_LIMIT', 10),
    QUEUE_LIMIT: parseNonNegativeIntEnv('DB_QUEUE_LIMIT', 100),
    CONNECT_TIMEOUT_MS: parsePositiveIntEnv('DB_CONNECT_TIMEOUT_MS', 10000),
  },
  IS_PROD: process.env.NODE_ENV === 'production',
  CORS_ORIGINS: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [],
  DEV_EMAIL: process.env.DEV_EMAIL,
  DEV_PASSWORD: process.env.DEV_PASSWORD,
  INBOUND_EMAIL_DOMAIN: process.env.INBOUND_EMAIL_DOMAIN || 'inbound.gestifique.com.br',
  INBOUND_EMAIL_PREFIX: process.env.INBOUND_EMAIL_PREFIX || 'canal',

  // Confirma automaticamente e-mails de validacao de encaminhamento recebidos
  // no inbound tecnico. Por seguranca, apenas links HTTPS em hosts permitidos
  // sao acessados (padrao: provedores conhecidos de confirmacao).
  AUTO_CONFIRM_EMAIL_FORWARDING: process.env.AUTO_CONFIRM_EMAIL_FORWARDING !== 'false',
  FORWARDING_CONFIRMATION_ALLOWED_HOSTS: (
    process.env.FORWARDING_CONFIRMATION_ALLOWED_HOSTS || DEFAULT_FORWARDING_CONFIRMATION_ALLOWED_HOSTS.join(',')
  )
    .split(',')
    .map(host => host.trim().toLowerCase())
    .filter(Boolean),

  IMAP: {
    HOST: process.env.IMAP_HOST as string,
    PORT: parseInt(process.env.IMAP_PORT || '993'),
    USER: process.env.IMAP_USER as string,
    PASS: process.env.IMAP_PASS as string,
  },
  SMTP: {
    HOST: process.env.SMTP_HOST as string,
    PORT: parseInt(process.env.SMTP_PORT || '587'),
    USER: process.env.SMTP_USER as string,
    PASS: process.env.SMTP_PASS as string,
    FROM: process.env.MAIL_FROM || '"Gestifique" <suporte@gestifique.com>',
  },

  // S1: TLS de e-mail. Padrão SEGURO (valida certificado).
  // Só desative (=true) em ambiente controlado com certificado inválido/self-signed.
  MAIL_TLS_INSECURE: process.env.MAIL_TLS_INSECURE === 'true',

  // Fase 2A (escalabilidade): Redis é OPCIONAL. Sem REDIS_URL o sistema roda em
  // modo single-instance (comportamento atual). Será usado em fase futura
  // (Socket.io adapter/emitter e invalidação distribuída de cache).
  REDIS_URL: process.env.REDIS_URL,

  // Envio de e-mail por canal: chave para cifrar credenciais SMTP por empresa/canal.
  // Obrigatória quando há SMTP por canal configurado (validada no momento do uso).
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,

  // Fallback de envio de resposta de ticket pelo SMTP GLOBAL do Gestifique.
  // Padrão SEGURO = false: se o canal não tiver SMTP, a resposta NÃO sai com a
  // identidade global do SaaS; vira erro controlado. Ative só conscientemente.
  ALLOW_GLOBAL_TICKET_EMAIL_FALLBACK: process.env.ALLOW_GLOBAL_TICKET_EMAIL_FALLBACK === 'true',
  INTERNAL_JOB_TOKEN: process.env.INTERNAL_JOB_TOKEN,
  ALLOW_INTERNAL_JOB_TOKEN_IN_QUERY: process.env.ALLOW_INTERNAL_JOB_TOKEN_IN_QUERY === 'true',
  APP_TIMEZONE: process.env.APP_TIMEZONE || 'America/Sao_Paulo',

  // Scaling & features
  ENABLE_WEB_SERVER: process.env.ENABLE_WEB_SERVER !== 'false',
  ENABLE_EMAIL_LISTENER: process.env.ENABLE_EMAIL_LISTENER === 'true',
  ENABLE_TICKET_JOBS: process.env.ENABLE_TICKET_JOBS !== 'false',
  // Em producao, migrations devem rodar em etapa controlada de deploy.
  AUTO_RUN_MIGRATIONS: process.env.AUTO_RUN_MIGRATIONS !== undefined
    ? process.env.AUTO_RUN_MIGRATIONS === 'true'
    : process.env.NODE_ENV !== 'production',

  // Proxy configuration for express-rate-limit compatibility.
  TRUST_PROXY: (() => {
    const val = process.env.TRUST_PROXY;
    if (val === undefined || val === '' || val === 'false' || val === '0') return false;
    if (val === 'true') return true;
    const num = parseInt(val, 10);
    return isNaN(num) ? val : num;
  })(),

  STORAGE_TYPE: (process.env.STORAGE_TYPE || 'local') as 'local' | 's3' | 'gcs',
  STORAGE_CONFIG: {
    LOCAL_PATH: !process.env.UPLOAD_DIR || process.env.UPLOAD_DIR === 'uploads/tickets'
      ? '../uploads/tickets'
      : process.env.UPLOAD_DIR,
    PROFILE_PATH: process.env.PROFILE_UPLOAD_DIR,
    // Reserved for future use
    BUCKET_NAME: process.env.STORAGE_BUCKET_NAME,
    REGION: process.env.STORAGE_REGION,
    ENDPOINT: process.env.STORAGE_ENDPOINT,
  },

  FRONTEND_URL: process.env.FRONTEND_URL || '',

  WHATSAPP: {
    ENABLED: process.env.ENABLE_WHATSAPP === 'true',
    ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || '',
    PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || '',
    APP_SECRET: process.env.META_APP_SECRET || '',
    API_VERSION: process.env.WHATSAPP_API_VERSION || 'v25.0',
    DISPLAY_PHONE_NUMBER: process.env.WHATSAPP_DISPLAY_PHONE_NUMBER || '',
    /** Auto-envia menu com botões quando o cliente mandar a palavra-gatilho. */
    AUTO_REPLY: process.env.ENABLE_WHATSAPP_AUTO_REPLY === 'true',
    /** Palavra que dispara o menu (ex.: teste). Comparação sem maiúsculas/minúsculas. */
    AUTO_REPLY_TRIGGER: (process.env.WHATSAPP_AUTO_REPLY_TRIGGER || 'teste').trim().toLowerCase(),
    WELCOME_HEADER:
      process.env.WHATSAPP_WELCOME_HEADER || 'MetaBit - Sistemas para Gestão Pública',
    WELCOME_BODY:
      process.env.WHATSAPP_WELCOME_BODY ||
      'Seja Bem-Vindo, antes de iniciarmos seu atendimento, sobre qual sistema gostaria de falar?',
    /** Formato: id:titulo|id:titulo|id:titulo  (título max 20 caracteres) */
    WELCOME_BUTTONS:
      process.env.WHATSAPP_WELCOME_BUTTONS ||
      'pgp:Gestão Pública|pci:Controle Interno|pts:Terceiro Setor',
  },
};

// S1: aviso explícito quando a validação TLS de e-mail está desativada.
if (env.MAIL_TLS_INSECURE) {
  const severity = env.IS_PROD ? 'CRITICAL' : 'WARN';
  console.warn(`[SECURITY] ${severity}: MAIL_TLS_INSECURE=true desativa validacao TLS do e-mail (SMTP/IMAP). Use apenas em ambiente controlado com certificado invalido.`);
}
