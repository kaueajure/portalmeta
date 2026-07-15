import crypto from 'crypto';
import { env } from '../config/env.js';
/**
 * Criptografia reversível para segredos (ex.: senha SMTP por canal).
 *
 * - AES-256-GCM (autenticado). A chave de 32 bytes é derivada de ENCRYPTION_KEY
 *   via SHA-256, então ENCRYPTION_KEY pode ser qualquer passphrase forte.
 * - Formato armazenado: "v1:<iv_b64>:<tag_b64>:<ciphertext_b64>".
 * - NÃO loga nem expõe segredos. A chave é obrigatória apenas quando há uso
 *   (cifrar/decifrar credenciais de SMTP por canal).
 */
const ALGO = 'aes-256-gcm';
export function isEncryptionConfigured() {
    return !!(env.ENCRYPTION_KEY && env.ENCRYPTION_KEY.trim().length >= 16);
}
function getKey() {
    const raw = env.ENCRYPTION_KEY;
    if (!raw || raw.trim().length < 16) {
        throw new Error('ENCRYPTION_KEY ausente ou fraca (mínimo 16 caracteres). Defina ENCRYPTION_KEY para usar credenciais SMTP por canal.');
    }
    return crypto.createHash('sha256').update(raw, 'utf8').digest(); // 32 bytes
}
export function encryptSecret(plain) {
    const key = getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}
export function decryptSecret(payload) {
    const key = getKey();
    const parts = (payload || '').split(':');
    if (parts.length !== 4 || parts[0] !== 'v1') {
        throw new Error('Formato de segredo inválido.');
    }
    const iv = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const data = Buffer.from(parts[3], 'base64');
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
