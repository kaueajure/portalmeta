import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { MAX_ATTACHMENT_BYTES, validateAttachmentMetadata } from '../utils/file-security.js';

const uploadDir = path.resolve(process.cwd(), env.STORAGE_CONFIG.LOCAL_PATH);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomName = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    cb(null, `tk-${timestamp}-${randomName}${ext}`);
  },
});

const fileFilter = (req: any, file: any, cb: any) => {
  const validation = validateAttachmentMetadata(file.originalname, file.mimetype);
  if (!validation.ok) {
    return cb(new Error(validation.error), false);
  }

  cb(null, true);
};

export const ticketUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_ATTACHMENT_BYTES,
    files: 5,
  },
});
