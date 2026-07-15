import { promises as fs } from 'fs';
import path from 'path';
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.csv',
    '.txt',
]);
const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
]);
const GENERIC_MIME_TYPES = new Set([
    'application/octet-stream',
    'application/x-download',
    'application/download',
]);
const FORBIDDEN_EXTENSIONS = new Set([
    '.ade', '.adp', '.apk', '.app', '.appx', '.bat', '.cmd', '.com', '.cpl', '.dll',
    '.dmg', '.exe', '.gadget', '.hta', '.ins', '.iso', '.jar', '.js', '.jse', '.lib',
    '.lnk', '.mde', '.msc', '.msi', '.msp', '.mst', '.php', '.ps1', '.scr', '.sh',
    '.vb', '.vbe', '.vbs', '.ws', '.wsc', '.wsf', '.wsh',
]);
function extensionFromName(originalName) {
    return path.extname(originalName || '').toLowerCase();
}
function hasMagic(buffer, hex) {
    return buffer.subarray(0, hex.length / 2).equals(Buffer.from(hex, 'hex'));
}
function isZip(buffer) {
    return hasMagic(buffer, '504b0304') || hasMagic(buffer, '504b0506') || hasMagic(buffer, '504b0708');
}
function isOleCompound(buffer) {
    return hasMagic(buffer, 'd0cf11e0a1b11ae1');
}
function hasNullBytes(buffer) {
    return buffer.includes(0);
}
export function validateAttachmentMetadata(originalName, mimeType, size) {
    if (!originalName || originalName.includes('..') || originalName.includes('/') || originalName.includes('\\')) {
        return { ok: false, error: 'Nome de arquivo invalido.' };
    }
    const ext = extensionFromName(originalName);
    if (FORBIDDEN_EXTENSIONS.has(ext)) {
        return { ok: false, error: `Extensao ${ext} nao permitida.` };
    }
    if (!ALLOWED_EXTENSIONS.has(ext)) {
        return { ok: false, error: `Extensao ${ext || '(sem extensao)'} nao permitida.` };
    }
    if (typeof size === 'number' && size > MAX_ATTACHMENT_BYTES) {
        return { ok: false, error: 'Arquivo excede o limite de 10MB.' };
    }
    const isImageFile = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
    const isSpecificAllowed = ALLOWED_MIME_TYPES.has(mimeType);
    const isGenericMime = GENERIC_MIME_TYPES.has(mimeType);
    if (isImageFile && !isSpecificAllowed) {
        return { ok: false, error: 'Imagens devem ter um tipo MIME especifico e valido.' };
    }
    if (!isSpecificAllowed && !isGenericMime) {
        return { ok: false, error: 'Tipo de arquivo (MIME) nao permitido.' };
    }
    return { ok: true };
}
export function validateAttachmentBuffer(buffer, originalName, mimeType = 'application/octet-stream') {
    const metadata = validateAttachmentMetadata(originalName, mimeType, buffer.length);
    if (!metadata.ok)
        return metadata;
    const ext = extensionFromName(originalName);
    if (buffer.length === 0) {
        return { ok: false, error: 'Arquivo vazio nao permitido.' };
    }
    if (hasMagic(buffer, '4d5a') || buffer.subarray(0, 2).toString('utf8') === '#!') {
        return { ok: false, error: 'Conteudo de arquivo executavel nao permitido.' };
    }
    if (['.jpg', '.jpeg'].includes(ext) && !hasMagic(buffer, 'ffd8ff')) {
        return { ok: false, error: 'Conteudo JPEG invalido.' };
    }
    if (ext === '.png' && !hasMagic(buffer, '89504e470d0a1a0a')) {
        return { ok: false, error: 'Conteudo PNG invalido.' };
    }
    if (ext === '.webp' && !(buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP')) {
        return { ok: false, error: 'Conteudo WEBP invalido.' };
    }
    if (ext === '.pdf' && !buffer.subarray(0, 4).equals(Buffer.from('%PDF'))) {
        return { ok: false, error: 'Conteudo PDF invalido.' };
    }
    if (['.docx', '.xlsx'].includes(ext) && !isZip(buffer)) {
        return { ok: false, error: 'Conteudo Office Open XML invalido.' };
    }
    if (['.doc', '.xls'].includes(ext) && !isOleCompound(buffer)) {
        return { ok: false, error: 'Conteudo Office legado invalido.' };
    }
    if (['.txt', '.csv'].includes(ext) && hasNullBytes(buffer)) {
        return { ok: false, error: 'Arquivo texto contem bytes binarios invalidos.' };
    }
    return { ok: true };
}
export async function validateUploadedFile(file) {
    const metadata = validateAttachmentMetadata(file.originalname, file.mimetype, file.size);
    if (!metadata.ok)
        return metadata;
    const handle = await fs.open(file.path, 'r');
    try {
        const sampleSize = Math.min(Math.max(file.size || 512, 1), 512);
        const sample = Buffer.alloc(sampleSize);
        const { bytesRead } = await handle.read(sample, 0, sample.length, 0);
        return validateAttachmentBuffer(sample.subarray(0, bytesRead), file.originalname, file.mimetype);
    }
    finally {
        await handle.close();
    }
}
