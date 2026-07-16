import { Router } from 'express';
import pool from '../db/connection.js';
import { authMiddleware } from '../middlewares/auth.js';
import { portalAuthMiddleware } from '../middlewares/portal-auth.js';
import { sendError, sendSuccess } from '../utils/response.js';
import ticketsService from '../services/tickets.service.js';
import { normalizeMessagePagination } from '../services/tickets.service.js';
import attachmentsService from '../services/attachments.service.js';
import storageService from '../services/storage.service.js';
import { ticketUpload } from '../middlewares/upload.js';
import { validateUploadedFile } from '../utils/file-security.js';
import { validateServiceFormAnswers } from '../utils/service-form.js';

const router = Router();

// Middleware híbrido para aceitar autenticação normal ou por token do portal
const portalIdentityMiddleware = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;

  if ((authHeader && authHeader.startsWith('Bearer ')) || req.cookies?.portal_token) {
    // Tenta autenticar pelo token do portal
    return portalAuthMiddleware(req, res, next);
  } else {
    // Tenta autenticação padrão (cookie/admin/atendente/cliente logado)
    return authMiddleware(req, res, next);
  }
};

router.use(portalIdentityMiddleware);

function getPortalContext(req: any) {
  if (req.portalCustomer) {
    return {
      mode: 'external',
      customer_email: req.portalCustomer.customer_email.toLowerCase(),
      usuario_id: req.portalCustomer.usuario_id || null,
      nome: req.portalCustomer.nome || req.portalCustomer.customer_email
    };
  }

  if (req.user) {
    return {
      mode: 'user',
      customer_email: req.user.email.toLowerCase(),
      usuario_id: req.user.id,
      nome: req.user.nome
    };
  }

  return null;
}

async function portalOwnsTicket(ticketId: number, context: ReturnType<typeof getPortalContext>) {
  if (!context) return null;
  const [rows]: any = await pool.query(`
    SELECT id FROM tickets
    WHERE id = ? AND deleted_at IS NULL
      AND (LOWER(solicitante_email) = ?
        OR usuario_id IN (SELECT id FROM usuarios WHERE LOWER(email) = ?)
        OR (usuario_id = ? AND ? IS NOT NULL))
    LIMIT 1
  `, [ticketId, context.customer_email, context.customer_email, context.usuario_id, context.usuario_id]);
  return rows[0] || null;
}

async function validatePortalFiles(files: Express.Multer.File[]) {
  for (const file of files) {
    const validation = await validateUploadedFile(file);
    if (!validation.ok) throw new Error(validation.error);
  }
}

async function savePortalFiles(files: Express.Multer.File[], ticketId: number, messageId: number | null, userId: number | null) {
  return Promise.all(files.map(async file => {
    const id = await attachmentsService.create({
      ticket_id: ticketId,
      mensagem_id: messageId,
      usuario_id: userId,
      nome_original: file.originalname,
      nome_arquivo: file.filename,
      caminho: file.path,
      mime_type: file.mimetype,
      tamanho_bytes: file.size,
      interno: false,
    });
    return { id, nome_original: file.originalname, mime_type: file.mimetype, tamanho_bytes: file.size, url: `/api/portal/attachments/${id}/download` };
  }));
}

// Rota para pegar perfil do portal (utilizado no App.tsx checkAuth)
router.get('/me', async (req: any, res: any) => {
  const context = getPortalContext(req);
  if (!context) return sendError(res, 'Não autorizado', 401);

  try {
    const [settingsRows]: any = await pool.query('SELECT nome FROM application_settings WHERE id = 1');
    const organizationName = settingsRows[0]?.nome || 'MetaBit';

    sendSuccess(res, {
      email: context.customer_email,
      nome: context.nome,
      organizacao_nome: organizationName
    });
  } catch (error) {
    sendError(res, 'Erro ao carregar perfil do portal', 500);
  }
});

router.get('/options', async (_req: any, res: any) => {
  try {
    const [categories]: any = await pool.query(
      'SELECT id, nome, sigla, valor, ativo, ordem FROM ticket_categories WHERE ativo = 1 ORDER BY ordem, id'
    );
    const [services]: any = await pool.query(
      'SELECT id, nome, valor, ativo, ordem, formulario_json FROM ticket_services WHERE ativo = 1 ORDER BY ordem, id'
    );
    sendSuccess(res, { categories, services });
  } catch {
    sendError(res, 'Erro ao carregar categorias e serviços', 500);
  }
});

router.get('/tickets', async (req: any, res: any) => {
  const context = getPortalContext(req);
  if (!context) return sendError(res, 'Não autorizado', 401);

  try {
    const limitNum = parseInt(req.query.limit as string) || 50;
    const safeLimit = Math.min(limitNum, 100);

    // Clientes só veem os próprios tickets (solicitante_email ou usuario_id vinculado)
    const [rows] = await pool.query(`
      SELECT id, titulo, status, categoria, servico, prioridade, created_at, updated_at
      FROM tickets
      WHERE deleted_at IS NULL
        AND (
          LOWER(solicitante_email) = ?
          OR usuario_id IN (
            SELECT id FROM usuarios WHERE LOWER(email) = ?
          )
          OR (usuario_id = ? AND ? IS NOT NULL)
        )
      ORDER BY updated_at DESC
      LIMIT ?
    `, [
      context.customer_email,
      context.customer_email,
      context.usuario_id,
      context.usuario_id,
      safeLimit
    ]);
    sendSuccess(res, rows);
  } catch (error) {
    console.error('[Portal] Erro ao buscar chamados:', error);
    sendError(res, 'Erro ao buscar chamados', 500);
  }
});

router.get('/tickets/:id', async (req: any, res: any) => {
  const context = getPortalContext(req);
  if (!context) return sendError(res, 'Não autorizado', 401);

  try {
    const [rows]: any = await pool.query(`
      SELECT id, titulo, descricao, status, categoria, servico, prioridade, created_at, updated_at
      FROM tickets
      WHERE id = ? AND deleted_at IS NULL
        AND (
          LOWER(solicitante_email) = ?
          OR usuario_id IN (
            SELECT id FROM usuarios WHERE LOWER(email) = ?
          )
          OR (usuario_id = ? AND ? IS NOT NULL)
        )
    `, [
      req.params.id,
      context.customer_email,
      context.customer_email,
      context.usuario_id,
      context.usuario_id
    ]);

    if (!rows.length) return sendError(res, 'Chamado não encontrado', 404);
    sendSuccess(res, rows[0]);
  } catch (error) {
    sendError(res, 'Erro ao buscar chamado', 500);
  }
});

router.get('/tickets/:id/messages', async (req: any, res: any) => {
  const context = getPortalContext(req);
  if (!context) return sendError(res, 'Não autorizado', 401);

  try {
    // Verifica se o ticket pertence ao cliente
    if (!await portalOwnsTicket(Number(req.params.id), context)) return sendError(res, 'Chamado não encontrado', 404);

    const pagination = normalizeMessagePagination(req.query);
    const includeMeta = req.query.include_meta === 'true';
    let messagesQuery = `
      SELECT m.*, u.nome as usuario_nome,
             CASE
               WHEN (? IS NOT NULL AND m.usuario_id = ?) OR (? = 'external' AND m.usuario_id IS NULL) THEN 1
               ELSE 0
             END AS is_requester
      FROM ticket_mensagens m
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      WHERE m.ticket_id = ? AND m.interno = 0
    `;
    const messageParams: any[] = [context.usuario_id, context.usuario_id, context.mode, req.params.id];
    if (pagination.beforeId) {
      messagesQuery += ' AND m.id < ?';
      messageParams.push(pagination.beforeId);
    }
    messagesQuery += ' ORDER BY m.created_at DESC, m.id DESC LIMIT ? OFFSET ?';
    messageParams.push(includeMeta ? pagination.limit + 1 : pagination.limit, pagination.offset);

    const [rowsDesc]: any = await pool.query(messagesQuery, messageParams);
    const hasMore = includeMeta && rowsDesc.length > pagination.limit;
    const rows = (hasMore ? rowsDesc.slice(0, pagination.limit) : rowsDesc).reverse();
    const attachmentsByMessage = await attachmentsService.getByMessages(rows.map((row: any) => Number(row.id)), false, Number(req.params.id));
    rows.forEach((row: any) => {
      row.attachments = (attachmentsByMessage[row.id] || []).map(item => ({ ...item, url: `/api/portal/attachments/${item.id}/download` }));
    });

    if (includeMeta) {
      return sendSuccess(res, {
        data: rows,
        meta: {
          limit: pagination.limit,
          page: pagination.page,
          before_id: pagination.beforeId || null,
          has_more: hasMore,
          next_before_id: rows[0]?.id || null
        }
      });
    }

    sendSuccess(res, rows);
  } catch (error) {
    sendError(res, 'Erro ao buscar mensagens', 500);
  }
});

router.post('/tickets', ticketUpload.array('files', 5), async (req: any, res: any) => {
  const files = (req.files || []) as Express.Multer.File[];
  const context = getPortalContext(req);
  if (!context) return sendError(res, 'Não autorizado', 401);

  const { titulo, descricao, categoria, servico, campos_personalizados } = req.body;

  if (!titulo || !descricao) {
    return sendError(res, 'Título e descrição são obrigatórios', 400);
  }

  try {
    await validatePortalFiles(files);
    const customFields = await validateServiceFormAnswers(servico, campos_personalizados);
    const ticketId = await ticketsService.create({
      usuario_id: context.usuario_id,
      solicitante_email: context.customer_email,
      solicitante_nome: context.nome,
      titulo,
      descricao,
      categoria: categoria || 'geral',
      servico: servico || null,
      prioridade: 'media',
      origem: 'portal',
      created_by_id: context.usuario_id,
    });

    if (customFields.length) await ticketsService.setCustomFields(ticketId, customFields);
    const attachments = await savePortalFiles(files, ticketId, null, context.usuario_id);

    res.status(201).json({
      success: true,
      message: 'Chamado criado com sucesso',
      data: { ticketId, attachments }
    });
  } catch (error) {
    if (files.length) await attachmentsService.deleteMultiple(files);
    console.error('[Portal] Erro ao criar ticket:', error);
    sendError(res, error instanceof Error ? error.message : 'Erro ao criar chamado', 400);
  }
});

router.post('/tickets/:id/messages', ticketUpload.array('files', 5), async (req: any, res: any) => {
  const files = (req.files || []) as Express.Multer.File[];
  const context = getPortalContext(req);
  if (!context) return sendError(res, 'Não autorizado', 401);

  const { mensagem } = req.body;
  if (!String(mensagem || '').trim() && files.length === 0) return sendError(res, 'Mensagem vazia', 400);

  try {
    // Verifica se o ticket pertence ao cliente
    if (!await portalOwnsTicket(Number(req.params.id), context)) return sendError(res, 'Chamado não encontrado', 404);
    await validatePortalFiles(files);

    const messageId = await ticketsService.addMessage({
      ticket_id: Number(req.params.id),
      usuario_id: context.usuario_id,
      mensagem: String(mensagem || '').trim() || 'Anexo enviado.',
      interno: false
    }, context.mode === 'user' ? req.user : {
      id: context.usuario_id || 0,
      email: context.customer_email,
      perfil: 'cliente'
    });

    const attachments = await savePortalFiles(files, Number(req.params.id), messageId, context.usuario_id);
    res.status(201).json({
      success: true,
      message: 'Mensagem enviada com sucesso',
      data: { messageId, attachments }
    });
  } catch (error: any) {
    if (files.length) await attachmentsService.deleteMultiple(files);
    console.error('[Portal] Erro ao enviar mensagem:', error);
    sendError(res, error.message || 'Erro ao enviar mensagem', 500);
  }
});

router.get('/tickets/:id/attachments', async (req: any, res: any) => {
  const context = getPortalContext(req);
  if (!context) return sendError(res, 'Não autorizado', 401);
  if (!await portalOwnsTicket(Number(req.params.id), context)) return sendError(res, 'Chamado não encontrado', 404);
  const attachments = await attachmentsService.listByTicket(Number(req.params.id), false);
  sendSuccess(res, attachments.map(item => ({ ...item, url: `/api/portal/attachments/${item.id}/download` })));
});

router.get('/attachments/:id/download', async (req: any, res: any) => {
  const context = getPortalContext(req);
  if (!context) return sendError(res, 'Não autorizado', 401);
  const attachment = await attachmentsService.getById(Number(req.params.id));
  if (!attachment || attachment.interno || !await portalOwnsTicket(attachment.ticket_id, context)) {
    return sendError(res, 'Anexo não encontrado', 404);
  }
  try {
    const buffer = await storageService.get(attachment.caminho);
    const safeName = String(attachment.nome_original || 'anexo').replace(/[\r\n"]/g, '_').slice(0, 180);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
    const inline = req.query.inline === '1' && /^image\//i.test(attachment.mime_type || '');
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`);
    res.send(buffer);
  } catch {
    sendError(res, 'Arquivo não encontrado', 404);
  }
});

export const portalRoutes = router;
