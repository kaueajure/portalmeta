const SENSITIVE_USER_FIELDS = new Set([
  'senha',
  'senha_hash',
  'password',
  'reset_token',
  'reset_token_expires',
  'oauth_token',
  'oauth_refresh_token',
  'oauth_access_token',
  'access_token',
  'refresh_token',
  'google_access_token',
  'google_refresh_token',
  'smtp_pass',
  'smtp_pass_enc',
  'imap_pass',
  'imap_password',
  'secret',
]);

export function sanitizeUser<T extends Record<string, any> | null | undefined>(user: T) {
  if (!user) return user;

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(user)) {
    if (!SENSITIVE_USER_FIELDS.has(key.toLowerCase())) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function sanitizeUsers<T extends Record<string, any>>(users: T[]) {
  return users.map(user => sanitizeUser(user));
}

export function maskEmail(value?: string | null): string {
  const email = String(value || '').trim();
  const [local, domain] = email.split('@');
  if (!local || !domain) return '[redacted]';

  const visible = local.length <= 2 ? local[0] || '*' : `${local[0]}***${local[local.length - 1]}`;
  return `${visible}@${domain}`;
}

export function maskIdentifier(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw) return '[redacted]';
  if (raw.length <= 12) return '[redacted]';
  return `${raw.slice(0, 6)}...${raw.slice(-4)}`;
}
