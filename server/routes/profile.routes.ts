import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import usersService from '../services/users.service.js';
import { authMiddleware, AuthRequest } from '../middlewares/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logSystemAction } from '../utils/logger.js';
import { permissionsService } from '../services/permissions.service.js';
import { isValidPassword, PASSWORD_RULE_MESSAGE } from '../utils/validators.js';
import { env } from '../config/env.js';

const router = Router();

function resolveProfileUploadDir(): string {
  if (env.STORAGE_CONFIG.PROFILE_PATH) {
    return path.resolve(process.cwd(), env.STORAGE_CONFIG.PROFILE_PATH);
  }

  return path.resolve(process.cwd(), '..', 'uploads', 'profiles');
}

const profileUploadDir = resolveProfileUploadDir();
const legacyProfileUploadDir = path.resolve(process.cwd(), 'uploads', 'profiles');

if (!fs.existsSync(profileUploadDir)) {
  fs.mkdirSync(profileUploadDir, { recursive: true });
}

const profilePhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      return cb(new Error('Envie uma imagem JPG, PNG, WEBP ou GIF.'));
    }
    cb(null, true);
  }
});

router.use(authMiddleware);

router.get('/photo/:filename', async (req: AuthRequest, res) => {
  try {
    const filename = path.basename(req.params.filename);
    let filePath: string | null = null;

    for (const candidateDir of [profileUploadDir, legacyProfileUploadDir]) {
      const candidatePath = path.resolve(candidateDir, filename);
      const relativePath = path.relative(candidateDir, candidatePath);

      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return sendError(res, 'Arquivo invalido', 400);
      }

      if (fs.existsSync(candidatePath)) {
        filePath = candidatePath;
        break;
      }
    }

    if (!filePath) {
      return sendError(res, 'Foto nao encontrada', 404);
    }

    res.sendFile(filePath);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar foto';
    sendError(res, message);
  }
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Nao autenticado', 401);

    const profile = await usersService.getById(currentUser.id);
    let permissions: string[] = [];
    try {
      permissions = await permissionsService.getEffectivePermissions(profile);
    } catch (permError) {
      console.error('Erro ao carregar permissoes do perfil do usuario:', permError);
    }
    const isSuperUser = !!profile.desenvolvedor;

    sendSuccess(res, {
      ...profile,
      permissions,
      isSuperUser,
      isTenantAdmin: !!profile.administrador && !profile.desenvolvedor
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar perfil';
    sendError(res, message);
  }
});

router.patch('/', async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Nao autenticado', 401);

    const safeData: Partial<{ nome: string; telefone: string; foto: string }> = {};
    if (req.body.nome) safeData.nome = req.body.nome;
    if (req.body.telefone) safeData.telefone = req.body.telefone;
    if (req.body.foto) safeData.foto = req.body.foto;

    if (Object.keys(safeData).length === 0) {
      return sendError(res, 'Nenhum dado valido para atualizacao');
    }

    await usersService.update(currentUser.id, safeData);
    await logSystemAction(req, currentUser.id, currentUser.empresa_id, 'PROFILE_UPDATE', 'Usuario atualizou o proprio perfil');

    sendSuccess(res, null, 'Perfil atualizado com sucesso');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar perfil';
    sendError(res, message);
  }
});

router.post('/photo', profilePhotoUpload.single('foto'), async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Nao autenticado', 401);
    if (!req.file) return sendError(res, 'Nenhuma imagem enviada', 400);

    const extByMime: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif'
    };
    const ext = extByMime[req.file.mimetype] || '.jpg';
    const filename = `profile-${currentUser.id}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    const filePath = path.resolve(profileUploadDir, filename);
    const relativePath = path.relative(profileUploadDir, filePath);

    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return sendError(res, 'Caminho de arquivo invalido', 400);
    }

    await fs.promises.mkdir(profileUploadDir, { recursive: true });
    await fs.promises.writeFile(filePath, req.file.buffer);
    const foto = `/api/profile/photo/${filename}`;

    const profile = await usersService.getById(currentUser.id);
    const previousPhoto = profile?.foto || '';
    if (previousPhoto.startsWith('/api/profile/photo/')) {
      const previousFilename = path.basename(previousPhoto);
      for (const candidateDir of [profileUploadDir, legacyProfileUploadDir]) {
        const previousPath = path.resolve(candidateDir, previousFilename);
        const previousRelative = path.relative(candidateDir, previousPath);
        if (!previousRelative.startsWith('..') && !path.isAbsolute(previousRelative)) {
          await fs.promises.unlink(previousPath).catch(() => {});
        }
      }
    }

    await usersService.update(currentUser.id, { foto });
    await logSystemAction(req, currentUser.id, currentUser.empresa_id, 'PROFILE_UPDATE', 'Usuario atualizou a foto do perfil');

    sendSuccess(res, { foto }, 'Foto de perfil atualizada com sucesso');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar foto de perfil';
    sendError(res, message);
  }
});

router.patch('/password', async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser) return sendError(res, 'Nao autenticado', 401);

    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return sendError(res, 'Todos os campos sao obrigatorios');
    }

    if (!newPassword || !isValidPassword(newPassword)) {
      return sendError(res, PASSWORD_RULE_MESSAGE);
    }

    if (newPassword !== confirmPassword) {
      return sendError(res, 'A confirmacao de senha nao confere');
    }

    await usersService.updatePassword(currentUser.id, currentPassword, newPassword);
    await logSystemAction(req, currentUser.id, currentUser.empresa_id, 'PASSWORD_CHANGE', 'Usuario alterou a senha');

    sendSuccess(res, null, 'Senha alterada com sucesso');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao alterar senha';
    sendError(res, message);
  }
});

export default router;
