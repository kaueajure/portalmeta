import { Router } from 'express';
import pool from '../db/connection.js';
import { authMiddleware } from '../middlewares/auth.js';
import { portalAuthMiddleware } from '../middlewares/portal-auth.js';
import { sendError, sendSuccess } from '../utils/response.js';
import ticketsService from '../services/tickets.service.js';
import { normalizeMessagePagination } from '../services/tickets.service.js';

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
      empresa_id: req.portalCustomer.empresa_id,
      customer_email: req.portalCustomer.customer_email.toLowerCase(),
      usuario_id: req.portalCustomer.usuario_id || null,
      nome: req.portalCustomer.nome || req.portalCustomer.customer_email
    };
  }

  if (req.user) {
    return {
      mode: 'user',
      empresa_id: req.user.empresa_id,
      customer_email: req.user.email.toLowerCase(),
      usuario_id: req.user.id,
      nome: req.user.nome
    };
  }

  return null;
}

// Rota para pegar perfil do portal (utilizado no App.tsx checkAuth)
router.get('/me', async (req: any, res: any) => {
  const context = getPortalContext(req);
  if (!context) return sendError(res, 'Não autorizado', 401);

  try {
    const [empresaRows]: any = await pool.query('SELECT nome FROM empresas WHERE id = ?', [context.empresa_id]);
    const empresaNome = empresaRows[0]?.nome || 'Gestifique';

    sendSuccess(res, {
      email: context.customer_email,
      empresa_id: context.empresa_id,
      nome: context.nome,
      empresa_nome: empresaNome
    });
  } catch (error) {
    sendError(res, 'Erro ao carregar perfil do portal', 500);
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
      WHERE empresa_id = ?
        AND deleted_at IS NULL
        AND (
          LOWER(solicitante_email) = ?
          OR usuario_id IN (
            SELECT id FROM usuarios WHERE LOWER(email) = ? AND empresa_id = ?
          )
          OR (usuario_id = ? AND ? IS NOT NULL)
        )
      ORDER BY updated_at DESC
      LIMIT ?
    `, [
      context.empresa_id, 
      context.customer_email, 
      context.customer_email, 
      context.empresa_id, 
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
      WHERE id = ? AND empresa_id = ?
        AND deleted_at IS NULL
        AND (
          LOWER(solicitante_email) = ?
          OR usuario_id IN (
            SELECT id FROM usuarios WHERE LOWER(email) = ? AND empresa_id = ?
          )
          OR (usuario_id = ? AND ? IS NOT NULL)
        )
    `, [
      req.params.id, 
      context.empresa_id, 
      context.customer_email, 
      context.customer_email, 
      context.empresa_id, 
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
    const [ticketRows]: any = await pool.query(`
      SELECT id FROM tickets 
      WHERE id = ? AND empresa_id = ?
        AND deleted_at IS NULL
        AND (
          LOWER(solicitante_email) = ?
          OR usuario_id IN (
            SELECT id FROM usuarios WHERE LOWER(email) = ? AND empresa_id = ?
          )
          OR (usuario_id = ? AND ? IS NOT NULL)
        )
    `, [
      req.params.id, 
      context.empresa_id, 
      context.customer_email, 
      context.customer_email, 
      context.empresa_id, 
      context.usuario_id, 
      context.usuario_id
    ]);

    if (!ticketRows.length) return sendError(res, 'Chamado não encontrado', 404);

    const pagination = normalizeMessagePagination(req.query);
    const includeMeta = req.query.include_meta === 'true';
    let messagesQuery = `
      SELECT m.*, u.nome as usuario_nome 
      FROM ticket_mensagens m
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      WHERE m.ticket_id = ? AND m.interno = 0
    `;
    const messageParams: any[] = [req.params.id];
    if (pagination.beforeId) {
      messagesQuery += ' AND m.id < ?';
      messageParams.push(pagination.beforeId);
    }
    messagesQuery += ' ORDER BY m.created_at DESC, m.id DESC LIMIT ? OFFSET ?';
    messageParams.push(includeMeta ? pagination.limit + 1 : pagination.limit, pagination.offset);

    const [rowsDesc]: any = await pool.query(messagesQuery, messageParams);
    const hasMore = includeMeta && rowsDesc.length > pagination.limit;
    const rows = (hasMore ? rowsDesc.slice(0, pagination.limit) : rowsDesc).reverse();
    
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

router.post('/tickets', async (req: any, res: any) => {
  const context = getPortalContext(req);
  if (!context) return sendError(res, 'Não autorizado', 401);

  const { titulo, descricao, categoria, servico } = req.body;
  
  if (!titulo || !descricao) {
    return sendError(res, 'Título e descrição são obrigatórios', 400);
  }

  try {
    const ticketId = await ticketsService.create({
      empresa_id: context.empresa_id,
      usuario_id: context.usuario_id,
      solicitante_email: context.customer_email,
      solicitante_nome: context.nome,
      titulo,
      descricao,
      categoria: categoria || 'geral',
      servico: servico || null,
      prioridade: 'media',
      origem: 'portal'
    });

    res.status(201).json({
      success: true,
      message: 'Chamado criado com sucesso',
      data: { ticketId }
    });
  } catch (error) {
    console.error('[Portal] Erro ao criar ticket:', error);
    sendError(res, 'Erro ao criar chamado', 500);
  }
});

router.post('/tickets/:id/messages', async (req: any, res: any) => {
  const context = getPortalContext(req);
  if (!context) return sendError(res, 'Não autorizado', 401);

  const { mensagem } = req.body;
  if (!mensagem) return sendError(res, 'Mensagem vazia', 400);

  try {
    // Verifica se o ticket pertence ao cliente
    const [ticketRows]: any = await pool.query(`
      SELECT id, empresa_id FROM tickets 
      WHERE id = ? AND empresa_id = ?
        AND deleted_at IS NULL
        AND (
          LOWER(solicitante_email) = ?
          OR usuario_id IN (
            SELECT id FROM usuarios WHERE LOWER(email) = ? AND empresa_id = ?
          )
          OR (usuario_id = ? AND ? IS NOT NULL)
        )
    `, [
      req.params.id, 
      context.empresa_id, 
      context.customer_email, 
      context.customer_email, 
      context.empresa_id, 
      context.usuario_id, 
      context.usuario_id
    ]);

    if (!ticketRows.length) return sendError(res, 'Chamado não encontrado', 404);

    const messageId = await ticketsService.addMessage({
      ticket_id: Number(req.params.id),
      usuario_id: context.usuario_id,
      mensagem,
      interno: false
    }, context.mode === 'user' ? req.user : {
      id: context.usuario_id || 0,
      email: context.customer_email,
      empresa_id: context.empresa_id,
      perfil: 'cliente'
    });

    res.status(201).json({
      success: true,
      message: 'Mensagem enviada com sucesso',
      data: { messageId }
    });
  } catch (error: any) {
    console.error('[Portal] Erro ao enviar mensagem:', error);
    sendError(res, error.message || 'Erro ao enviar mensagem', 500);
  }
});

router.get('/knowledge', async (req: any, res: any) => {
  const context = getPortalContext(req);
  if (!context) return sendError(res, 'Não autorizado', 401);

  try {
    const { category } = req.query;
    let query = `
      SELECT id, titulo, conteudo, categoria, created_at
      FROM knowledge_articles
      WHERE ativo = 1 AND publico = 1 AND empresa_id = ?
    `;
    const params: any[] = [context.empresa_id];

    if (category) {
      query += ' AND categoria = ?';
      params.push(category);
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(query, params);
    sendSuccess(res, rows);
  } catch (error) {
    sendError(res, 'Erro ao buscar artigos', 500);
  }
});

router.get('/knowledge/categories', async (req: any, res: any) => {
  const context = getPortalContext(req);
  if (!context) return sendError(res, 'Não autorizado', 401);

  try {
    const [rows]: any = await pool.query(`
      SELECT DISTINCT categoria
      FROM knowledge_articles
      WHERE ativo = 1 AND publico = 1 AND empresa_id = ? AND categoria IS NOT NULL
      ORDER BY categoria ASC
    `, [context.empresa_id]);
    sendSuccess(res, rows.map((row: any) => row.categoria));
  } catch (error) {
    sendError(res, 'Erro ao buscar categorias', 500);
  }
});

router.get('/knowledge/article/:id', async (req: any, res: any) => {
  const context = getPortalContext(req);
  if (!context) return sendError(res, 'Não autorizado', 401);

  try {
    const [rows]: any = await pool.query(`
      SELECT *
      FROM knowledge_articles
      WHERE id = ? AND ativo = 1 AND publico = 1 AND empresa_id = ?
    `, [req.params.id, context.empresa_id]);

    if (!rows.length) return sendError(res, 'Artigo não encontrado', 404);
    sendSuccess(res, rows[0]);
  } catch (error) {
    sendError(res, 'Erro ao buscar artigo', 500);
  }
});

router.get('/knowledge/search', async (req: any, res: any) => {
  const context = getPortalContext(req);
  if (!context) return sendError(res, 'Não autorizado', 401);

  try {
    const { q } = req.query;
    if (!q) return sendSuccess(res, []);
    
    const searchTerms = `%${q}%`;
    const [rows] = await pool.query(`
      SELECT id, titulo, categoria, SUBSTRING(conteudo, 1, 150) as resumo
      FROM knowledge_articles
      WHERE ativo = 1 AND publico = 1 AND empresa_id = ?
        AND (titulo LIKE ? OR conteudo LIKE ? OR categoria LIKE ?)
      ORDER BY 
        CASE WHEN titulo LIKE ? THEN 1 ELSE 2 END,
        created_at DESC
      LIMIT 10
    `, [context.empresa_id, searchTerms, searchTerms, searchTerms, searchTerms]);
    
    sendSuccess(res, rows);
  } catch (error) {
    sendError(res, 'Erro ao pesquisar artigos', 500);
  }
});

export const portalRoutes = router;
