import pool from '../db/connection.js';
import { permissionsService } from './permissions.service.js';
import notificationsService from './notifications.service.js';
import { emailOutboxService } from './email-outbox.service.js';
import { recordTicketEvent } from './ticket-events.service.js';
import ticketMessagesService from './ticket-messages.service.js';
import slaService from './sla.service.js';
import { AIService } from './ai.service.js';
import { getTicketScope } from '../utils/ticket-permissions.js';
import { isDeveloperUser } from '../utils/user-scope.js';
import { recomputeTicketMessageState } from '../utils/ticket-state.js';
import { maskEmail, maskIdentifier } from '../utils/sanitize.js';
import { addMinutesForMySQL, formatDateTimeForMySQL } from '../utils/date-time.js';
import { toPositiveInt } from '../utils/pagination.js';
import {
  getClosedTicketStatusValue,
  getTicketStatusConfigs,
  getInitialTicketStatusValue,
  getReopenTicketStatusValue,
  getTicketStatusConfig,
  isCustomerWaitingTicketStatusSpecial,
  isFinalTicketStatusSpecial,
  isValidTicketStatusValue
} from '../utils/ticket-status-config.js';
export { toPositiveInt, normalizeMessagePagination } from '../utils/pagination.js';

export function isValidTicketStatus(value: unknown): value is string {
  return isValidTicketStatusValue(value);
}

function labelFromStatus(status: string): string {
  const labels: Record<string, string> = {
    aberto: 'Aberto',
    em_andamento: 'Em andamento',
    aguardando_cliente: 'Aguardando resposta',
    resolvido: 'Finalizado',
    fechado: 'Fechado'
  };

  return labels[status] || status.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

const MAX_TICKET_LIST_LIMIT = 100;
const DEFAULT_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LIMIT = 101;

const TICKET_LIST_SORT_COLUMNS: Record<string, string> = {
  id: 't.id',
  updated_at: 't.updated_at',
  titulo: 't.titulo',
  status: 't.status',
  prioridade: `
      CASE t.prioridade
        WHEN 'urgente' THEN 4
        WHEN 'alta' THEN 3
        WHEN 'media' THEN 2
        WHEN 'baixa' THEN 1
        ELSE 0
      END
    `
};

function buildTicketListOrderBy(sortBy?: unknown, sortOrder?: unknown): string {
  const column = typeof sortBy === 'string' ? TICKET_LIST_SORT_COLUMNS[sortBy] : undefined;
  if (!column) return buildDefaultTicketListOrderBy();

  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  return `
      ${column} ${direction},
      t.updated_at DESC,
      t.id DESC
    `;
}

function buildDefaultTicketListOrderBy(): string {
  return `
      t.aguardando_resposta_atendente DESC,
      (CASE WHEN t.prazo_sla < NOW() AND ${buildStatusSpecialCondition('t', ['finalizado', 'encerrado'], true)} THEN 1 ELSE 0 END) DESC,
      (CASE WHEN t.prazo_sla BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 HOUR) AND ${buildStatusSpecialCondition('t', ['finalizado', 'encerrado'], true)} THEN 1 ELSE 0 END) DESC,
      (CASE WHEN t.prioridade = 'urgente' THEN 1 ELSE 0 END) DESC,
      (CASE WHEN t.prioridade = 'alta' THEN 1 ELSE 0 END) DESC,
      (CASE WHEN t.responsavel_id IS NULL THEN 1 ELSE 0 END) DESC,
      t.updated_at DESC,
      t.id DESC
    `;
}

function buildStatusSpecialCondition(ticketAlias: string, specials: string[], negate = false): string {
  const safeSpecials = specials
    .filter((special) => /^[a-z_]+$/.test(special))
    .map((special) => `'${special}'`)
    .join(', ');

  return `${negate ? 'NOT ' : ''}EXISTS (
    SELECT 1
    FROM empresa_ticket_status status_cfg
    WHERE status_cfg.empresa_id = ${ticketAlias}.empresa_id
      AND status_cfg.valor = ${ticketAlias}.status
      AND status_cfg.especial IN (${safeSpecials})
  )`;
}

class TicketsService {
  private isValidDateOnly(value: unknown): value is string {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  private applyAdvancedFilters(
    baseWhere: string,
    summaryWhere: string,
    params: (string | number)[],
    filters: any
  ): { baseWhere: string; summaryWhere: string; params: (string | number)[] } {
    const { 
      tag, origem, email_channel_id, created_from, created_to, 
      updated_from, updated_to, sla_status, custom_field_search
    } = filters;

    if (tag) {
      const normalizedTag = this.normalizeTag(tag);
      if (normalizedTag) {
        const tagParts = ' AND EXISTS (SELECT 1 FROM ticket_tags tt WHERE tt.ticket_id = t.id AND tt.tag = ?)';
        baseWhere += tagParts;
        summaryWhere += tagParts;
        params.push(normalizedTag);
      }
    }

    if (origem) {
      baseWhere += ' AND t.origem = ?';
      summaryWhere += ' AND t.origem = ?';
      params.push(origem);
    }

    if (email_channel_id) {
      baseWhere += ' AND t.email_channel_id = ?';
      summaryWhere += ' AND t.email_channel_id = ?';
      params.push(email_channel_id);
    }

    if (this.isValidDateOnly(created_from)) {
      baseWhere += ' AND t.created_at >= ?';
      summaryWhere += ' AND t.created_at >= ?';
      params.push(`${created_from} 00:00:00`);
    }

    if (this.isValidDateOnly(created_to)) {
      baseWhere += ' AND t.created_at <= ?';
      summaryWhere += ' AND t.created_at <= ?';
      params.push(`${created_to} 23:59:59`);
    }

    if (this.isValidDateOnly(updated_from)) {
      baseWhere += ' AND t.updated_at >= ?';
      summaryWhere += ' AND t.updated_at >= ?';
      params.push(`${updated_from} 00:00:00`);
    }

    if (this.isValidDateOnly(updated_to)) {
      baseWhere += ' AND t.updated_at <= ?';
      summaryWhere += ' AND t.updated_at <= ?';
      params.push(`${updated_to} 23:59:59`);
    }

    if (sla_status && sla_status !== 'todos') {
      let slaPart = '';
      switch (sla_status) {
        case 'dentro_sla':
          slaPart = ` AND t.prazo_sla > DATE_ADD(NOW(), INTERVAL 2 HOUR) AND ${buildStatusSpecialCondition('t', ['finalizado', 'encerrado'], true)}`;
          break;
        case 'vencendo':
          slaPart = ` AND t.prazo_sla BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 HOUR) AND ${buildStatusSpecialCondition('t', ['finalizado', 'encerrado'], true)}`;
          break;
        case 'vencido':
          slaPart = ` AND t.prazo_sla < NOW() AND ${buildStatusSpecialCondition('t', ['finalizado', 'encerrado'], true)}`;
          break;
        case 'sem_sla':
          slaPart = " AND t.prazo_sla IS NULL";
          break;
      }
      if (slaPart) {
        baseWhere += slaPart;
        summaryWhere += slaPart;
      }
    }

    if (custom_field_search) {
      const cfSearchPattern = `%${custom_field_search}%`;
      const cfPart = ' AND EXISTS (SELECT 1 FROM ticket_custom_fields tcf WHERE tcf.ticket_id = t.id AND (tcf.field_value LIKE ? OR tcf.field_label LIKE ?))';
      baseWhere += cfPart;
      summaryWhere += cfPart;
      params.push(cfSearchPattern, cfSearchPattern);
    }

    return { baseWhere, summaryWhere, params };
  }

  async cleanupSpam(empresaId: number) {
    // Quarantine tickets created in the last 12 hours that might be spam (too many from same user/subject).
    const [spamUsers]: any = await pool.query(`
      SELECT usuario_id, titulo, COUNT(*) as cnt 
      FROM tickets 
      WHERE empresa_id = ? AND deleted_at IS NULL AND created_at > (NOW() - INTERVAL 12 HOUR)
      GROUP BY usuario_id, titulo
      HAVING cnt > 5 
    `, [empresaId]);

    let quarantinedCount = 0;
    for (const spam of spamUsers) {
      const [result]: any = await pool.query(
        `UPDATE tickets
         SET deleted_at = NOW(),
             deleted_by = NULL,
             delete_reason = 'Quarentena automatica por suspeita de spam',
             updated_at = NOW()
         WHERE empresa_id = ?
           AND ((usuario_id = ?) OR (usuario_id IS NULL AND ? IS NULL))
           AND titulo = ?
           AND deleted_at IS NULL
           AND created_at > (NOW() - INTERVAL 12 HOUR)`,
        [empresaId, spam.usuario_id, spam.usuario_id, spam.titulo]
      );
      quarantinedCount += result.affectedRows;
    }

    return { empresaId, deletedCount: quarantinedCount, quarantinedCount };
  }

  async list(filters: any) {
    const { 
      empresa_id, usuario_id, is_dev, is_admin, 
      status, prioridade, categoria, servico, search, 
      responsavel_id, fila, page = 1, limit = 20,
      // Advanced Filters
      tag, origem, created_from, created_to, 
      updated_from, updated_to, sla_status, custom_field_search,
      sort_by, sort_order
    } = filters;
    const searchTerm = search;
    
    let baseWhere = filters.include_deleted ? 'WHERE 1=1' : 'WHERE t.deleted_at IS NULL';
    let summaryWhere = filters.include_deleted ? 'WHERE 1=1' : 'WHERE t.deleted_at IS NULL';
    const params: (string | number)[] = [];

    // Regra de Negócio: Se não for desenvolvedor, só vê chamados da própria empresa
    if (!is_dev) {
      baseWhere += ' AND t.empresa_id = ?';
      summaryWhere += ' AND t.empresa_id = ?';
      params.push(empresa_id);

      // Enforce ticket view scopes
      const [userRows]: any = await pool.query('SELECT * FROM usuarios WHERE id = ?', [usuario_id]);
      const userObj = userRows[0];
      const scope = userObj ? await getTicketScope(userObj) : { canViewAll: false, canViewOwn: false, canViewUnassigned: false };
      
      if (!scope.canViewAll) {
        const scopeConditions: string[] = [];
        const scopeParams: any[] = [];

        if (scope.canViewOwn) {
          scopeConditions.push('(t.responsavel_id = ? OR t.usuario_id = ?)');
          scopeParams.push(usuario_id, usuario_id);
        }

        if (scope.canViewUnassigned) {
          scopeConditions.push('t.responsavel_id IS NULL');
        }

        if (scopeConditions.length > 0) {
          const conditionSQL = ` AND (${scopeConditions.join(' OR ')})`;
          baseWhere += conditionSQL;
          summaryWhere += conditionSQL;
          params.push(...scopeParams);
        } else {
          baseWhere += ' AND 1=0';
          summaryWhere += ' AND 1=0';
        }
      }
    } else {
      const empresaIdFilter = toPositiveInt(filters.empresa_id_filter);
      if (empresaIdFilter) {
        baseWhere += ' AND t.empresa_id = ?';
        summaryWhere += ' AND t.empresa_id = ?';
        params.push(empresaIdFilter);
      }
    }

    // Smart Queues (Filas Inteligentes)
    if (fila && fila !== 'todos') {
      switch (fila) {
        case 'meus':
          baseWhere += ' AND t.responsavel_id = ?';
          summaryWhere += ' AND t.responsavel_id = ?';
          params.push(usuario_id);
          break;
        case 'sem_responsavel':
          baseWhere += ' AND t.responsavel_id IS NULL';
          summaryWhere += ' AND t.responsavel_id IS NULL';
          break;
        case 'urgentes':
          baseWhere += " AND t.prioridade IN ('alta', 'urgente')";
          summaryWhere += " AND t.prioridade IN ('alta', 'urgente')";
          break;
        case 'sla_vencido':
          baseWhere += ` AND t.prazo_sla < NOW() AND ${buildStatusSpecialCondition('t', ['finalizado', 'encerrado'], true)}`;
          summaryWhere += ` AND t.prazo_sla < NOW() AND ${buildStatusSpecialCondition('t', ['finalizado', 'encerrado'], true)}`;
          break;
        case 'vence_em_breve':
          baseWhere += ` AND t.prazo_sla BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 HOUR) AND ${buildStatusSpecialCondition('t', ['finalizado', 'encerrado'], true)}`;
          summaryWhere += ` AND t.prazo_sla BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 HOUR) AND ${buildStatusSpecialCondition('t', ['finalizado', 'encerrado'], true)}`;
          break;
        case 'aguardando_cliente':
          baseWhere += ` AND ${buildStatusSpecialCondition('t', ['aguardando_cliente'])}`;
          summaryWhere += ` AND ${buildStatusSpecialCondition('t', ['aguardando_cliente'])}`;
          break;
        case 'precisa_resposta':
          // Usa campo materializado (mantido por utils/ticket-state.ts).
          baseWhere += ' AND t.aguardando_resposta_atendente = 1';
          summaryWhere += ' AND t.aguardando_resposta_atendente = 1';
          break;
      }
    }

    if (prioridade && prioridade !== 'todas') {
      baseWhere += ' AND t.prioridade = ?';
      summaryWhere += ' AND t.prioridade = ?';
      params.push(prioridade);
    }
    if (categoria && categoria !== 'todas') {
      baseWhere += ' AND t.categoria = ?';
      summaryWhere += ' AND t.categoria = ?';
      params.push(categoria);
    }
    if (servico && servico !== 'todos') {
      baseWhere += ' AND t.servico = ?';
      summaryWhere += ' AND t.servico = ?';
      params.push(servico);
    }
    const safeResponsavelId = toPositiveInt(responsavel_id);
    if (safeResponsavelId) {
      baseWhere += ' AND t.responsavel_id = ?';
      summaryWhere += ' AND t.responsavel_id = ?';
      params.push(safeResponsavelId);
    }
    if (searchTerm) {
      const searchPattern = `%${searchTerm}%`;
      const searchParts = ' AND (t.titulo LIKE ? OR t.descricao LIKE ? OR CAST(t.id AS CHAR) = ? OR u.nome LIKE ?)';
      baseWhere += searchParts;
      summaryWhere += searchParts;
      params.push(searchPattern, searchPattern, searchTerm, searchPattern);
    }

    // Apply Advanced Filters
    const advanced = this.applyAdvancedFilters(baseWhere, summaryWhere, params, filters);
    baseWhere = advanced.baseWhere;
    summaryWhere = advanced.summaryWhere;
    const finalParams = advanced.params;
    // Status is only for items in list view
    const summaryParams = [...finalParams]; // copy params for summary
    
    if (status && status !== 'todos') {
      baseWhere += ' AND t.status = ?';
      finalParams.push(status);
    }

    const requesterJoinForSummary = searchTerm ? 'LEFT JOIN usuarios u ON t.usuario_id = u.id' : '';

    // Summary calculation
    const [summaryRows]: any = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN t.status = 'aberto' THEN 1 ELSE 0 END) as aberto,
        SUM(CASE WHEN t.status = 'em_andamento' THEN 1 ELSE 0 END) as em_andamento,
        SUM(CASE WHEN t.status = 'aguardando_cliente' THEN 1 ELSE 0 END) as aguardando_cliente,
        SUM(CASE WHEN t.status = 'resolvido' THEN 1 ELSE 0 END) as resolvido,
        SUM(CASE WHEN t.status = 'fechado' THEN 1 ELSE 0 END) as fechado
      FROM tickets t
      ${requesterJoinForSummary}
      ${summaryWhere}
    `, summaryParams);

    const summary = summaryRows[0] || { total: 0, aberto: 0, em_andamento: 0, aguardando_cliente: 0, resolvido: 0, fechado: 0 };
    const total = Number(summary.total || 0);

    // Fetch items
    const safePage = toPositiveInt(page) ?? 1;
    const safeLimit = Math.min(toPositiveInt(limit) ?? 20, MAX_TICKET_LIST_LIMIT);
    const offset = (safePage - 1) * safeLimit;

    // Default keeps the operational queue order; explicit UI sorting uses a safe whitelist.
    const orderBy = buildTicketListOrderBy(sort_by, sort_order);

    const [items]: any = await pool.query(`
      SELECT t.*, 
             COALESCE(t.solicitante_nome, u.nome, 'Usuário Removido') as cliente_nome, 
             COALESCE(t.solicitante_email, u.email, 'Usuário Removido') as cliente_email, 
             COALESCE(r.nome, 'Não Atribuído') as responsavel_nome, 
             e.nome as empresa_nome
      FROM tickets t
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      LEFT JOIN empresas e ON t.empresa_id = e.id
      LEFT JOIN usuarios r ON t.responsavel_id = r.id
      ${baseWhere}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `, [...finalParams, safeLimit, offset]);

    // Enriquecer com tags
    if (items.length > 0) {
      const ticketIds = items.map((t: any) => t.id);
      const tagsMap = await this.getTagsForTickets(ticketIds);
      items.forEach((t: any) => {
        t.tags = tagsMap[t.id] || [];
      });
    }

    // Enriquecer com produtividade
    await this.enrichTicketsWithProductivity(items, filters.usuario_id);

    return {
      data: items,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit)
      },
      summary: {
        total: Number(summary.total || 0),
        aberto: Number(summary.aberto || 0),
        em_andamento: Number(summary.em_andamento || 0),
        aguardando_cliente: Number(summary.aguardando_cliente || 0),
        resolvido: Number(summary.resolvido || 0),
        fechado: Number(summary.fechado || 0)
      },
      queues: await this.getQueuesCounts(filters)
    };
  }

  async getQueuesCounts(filters: any) {
    const { empresa_id, usuario_id, is_dev } = filters;
    
    let baseWhere = filters.include_deleted ? 'WHERE 1=1' : 'WHERE deleted_at IS NULL';
    const params: (string | number)[] = [];

    if (!is_dev) {
      baseWhere += ' AND empresa_id = ?';
      params.push(empresa_id);
    } else {
      const empresaIdFilter = toPositiveInt(filters.empresa_id_filter);
      if (empresaIdFilter) {
        baseWhere += ' AND empresa_id = ?';
        params.push(empresaIdFilter);
      } else {
        // If dev hasn't selected a company, we might want to return 0s or total across all companies
        // But usually dev selects a company. If not, this might be called without empresa_id.
        // Let's assume dev needs a company filter for these queues to be meaningful.
        return {
          todos: 0, meus: 0, sem_responsavel: 0, urgentes: 0, sla_vencido: 0, vence_em_breve: 0, aguardando_cliente: 0
        };
      }
    }

    const [rows]: any = await pool.query(`
      SELECT 
        COUNT(*) as todos,
        SUM(CASE WHEN responsavel_id = ? THEN 1 ELSE 0 END) as meus,
        SUM(CASE WHEN responsavel_id IS NULL THEN 1 ELSE 0 END) as sem_responsavel,
        SUM(CASE WHEN prioridade IN ('alta', 'urgente') THEN 1 ELSE 0 END) as urgentes,
        SUM(CASE WHEN prazo_sla < NOW() AND ${buildStatusSpecialCondition('tickets', ['finalizado', 'encerrado'], true)} THEN 1 ELSE 0 END) as sla_vencido,
        SUM(CASE WHEN prazo_sla BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 HOUR) AND ${buildStatusSpecialCondition('tickets', ['finalizado', 'encerrado'], true)} THEN 1 ELSE 0 END) as vence_em_breve,
        SUM(CASE WHEN ${buildStatusSpecialCondition('tickets', ['aguardando_cliente'])} THEN 1 ELSE 0 END) as aguardando_cliente,
        SUM(aguardando_resposta_atendente) as precisa_resposta
      FROM tickets
      ${baseWhere}
    `, [usuario_id, ...params]);

    const res = rows[0] || {};
    return {
      todos: Number(res.todos || 0),
      meus: Number(res.meus || 0),
      sem_responsavel: Number(res.sem_responsavel || 0),
      urgentes: Number(res.urgentes || 0),
      sla_vencido: Number(res.sla_vencido || 0),
      vence_em_breve: Number(res.vence_em_breve || 0),
      aguardando_cliente: Number(res.aguardando_cliente || 0),
      precisa_resposta: Number(res.precisa_resposta || 0)
    };
  }

  async getKanban(filters: any) {
    const { 
      empresa_id, usuario_id, is_dev, is_admin, 
      responsavel_id, search, prioridade, categoria, servico, status, fila,
      // Advanced Filters
      tag, origem, created_from, created_to, 
      updated_from, updated_to, sla_status, custom_field_search
    } = filters;
    const searchTerm = search;
    const statusConfigEmpresaId = !is_dev ? toPositiveInt(empresa_id) : toPositiveInt(filters.empresa_id_filter);
    
    let baseWhere = filters.include_deleted ? 'WHERE 1=1' : 'WHERE t.deleted_at IS NULL';
    let summaryWhere = filters.include_deleted ? 'WHERE 1=1' : 'WHERE t.deleted_at IS NULL';
    const params: (string | number)[] = [];

    // Regra de Negócio: Se não for desenvolvedor, só vê chamados da própria empresa
    if (!is_dev) {
      baseWhere += ' AND t.empresa_id = ?';
      summaryWhere += ' AND t.empresa_id = ?';
      params.push(empresa_id);

      // Enforce ticket view scopes
      const [userRows]: any = await pool.query('SELECT * FROM usuarios WHERE id = ?', [usuario_id]);
      const userObj = userRows[0];
      const scope = userObj ? await getTicketScope(userObj) : { canViewAll: false, canViewOwn: false, canViewUnassigned: false };
      
      if (!scope.canViewAll) {
        const scopeConditions: string[] = [];
        const scopeParams: any[] = [];

        if (scope.canViewOwn) {
          scopeConditions.push('(t.responsavel_id = ? OR t.usuario_id = ?)');
          scopeParams.push(usuario_id, usuario_id);
        }

        if (scope.canViewUnassigned) {
          scopeConditions.push('t.responsavel_id IS NULL');
        }

        if (scopeConditions.length > 0) {
          const conditionSQL = ` AND (${scopeConditions.join(' OR ')})`;
          baseWhere += conditionSQL;
          summaryWhere += conditionSQL;
          params.push(...scopeParams);
        } else {
          baseWhere += ' AND 1=0';
          summaryWhere += ' AND 1=0';
        }
      }
    } else {
      const empresaIdFilter = toPositiveInt(filters.empresa_id_filter);
      if (empresaIdFilter) {
        baseWhere += ' AND t.empresa_id = ?';
        summaryWhere += ' AND t.empresa_id = ?';
        params.push(empresaIdFilter);
      }
    }

    // Smart Queues (Filas Inteligentes)
    if (fila && fila !== 'todos') {
      switch (fila) {
        case 'meus':
          baseWhere += ' AND t.responsavel_id = ?';
          summaryWhere += ' AND t.responsavel_id = ?';
          params.push(usuario_id);
          break;
        case 'sem_responsavel':
          baseWhere += ' AND t.responsavel_id IS NULL';
          summaryWhere += ' AND t.responsavel_id IS NULL';
          break;
        case 'urgentes':
          baseWhere += " AND t.prioridade IN ('alta', 'urgente')";
          summaryWhere += " AND t.prioridade IN ('alta', 'urgente')";
          break;
        case 'sla_vencido':
          baseWhere += ` AND t.prazo_sla < NOW() AND ${buildStatusSpecialCondition('t', ['finalizado', 'encerrado'], true)}`;
          summaryWhere += ` AND t.prazo_sla < NOW() AND ${buildStatusSpecialCondition('t', ['finalizado', 'encerrado'], true)}`;
          break;
        case 'vence_em_breve':
          baseWhere += ` AND t.prazo_sla BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 HOUR) AND ${buildStatusSpecialCondition('t', ['finalizado', 'encerrado'], true)}`;
          summaryWhere += ` AND t.prazo_sla BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 HOUR) AND ${buildStatusSpecialCondition('t', ['finalizado', 'encerrado'], true)}`;
          break;
        case 'aguardando_cliente':
          baseWhere += ` AND ${buildStatusSpecialCondition('t', ['aguardando_cliente'])}`;
          summaryWhere += ` AND ${buildStatusSpecialCondition('t', ['aguardando_cliente'])}`;
          break;
        case 'precisa_resposta':
           // Usa campo materializado (mantido por utils/ticket-state.ts).
           baseWhere += ' AND t.aguardando_resposta_atendente = 1';
           summaryWhere += ' AND t.aguardando_resposta_atendente = 1';
           break;
      }
    }
    
    // Common Filters
    const safeResponsavelId = toPositiveInt(responsavel_id);
    if (safeResponsavelId) {
       baseWhere += ' AND t.responsavel_id = ?';
       summaryWhere += ' AND t.responsavel_id = ?';
       params.push(safeResponsavelId);
    }
    if (prioridade && prioridade !== 'todas') {
       baseWhere += ' AND t.prioridade = ?';
       summaryWhere += ' AND t.prioridade = ?';
       params.push(prioridade);
    }
    if (categoria && categoria !== 'todas') {
       baseWhere += ' AND t.categoria = ?';
       summaryWhere += ' AND t.categoria = ?';
       params.push(categoria);
    }
    if (servico && servico !== 'todos') {
       baseWhere += ' AND t.servico = ?';
       summaryWhere += ' AND t.servico = ?';
       params.push(servico);
    }
    if (searchTerm) {
       const searchPattern = `%${searchTerm}%`;
       baseWhere += ' AND (t.titulo LIKE ? OR t.descricao LIKE ? OR CAST(t.id AS CHAR) = ? OR u.nome LIKE ?)';
       summaryWhere += ' AND (t.titulo LIKE ? OR t.descricao LIKE ? OR CAST(t.id AS CHAR) = ? OR u.nome LIKE ?)';
       params.push(searchPattern, searchPattern, searchTerm, searchPattern);
    }

    // Apply Advanced Filters
    const advanced = this.applyAdvancedFilters(baseWhere, summaryWhere, params, filters);
    baseWhere = advanced.baseWhere;
    summaryWhere = advanced.summaryWhere;
    const finalParams = advanced.params;

    if (status && status !== 'todos') {
       baseWhere += ' AND t.status = ?';
       summaryWhere += ' AND t.status = ?';
       finalParams.push(status);
    }

    const summaryParams = [...finalParams];
    const requesterJoinForSummary = searchTerm ? 'LEFT JOIN usuarios u ON t.usuario_id = u.id' : '';
    
    // Prioridade operacional
    const orderBy_K = `
      t.aguardando_resposta_atendente DESC,
      (CASE WHEN t.prazo_sla < NOW() AND ${buildStatusSpecialCondition('t', ['finalizado', 'encerrado'], true)} THEN 1 ELSE 0 END) DESC,
      (CASE WHEN t.prazo_sla BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 HOUR) AND ${buildStatusSpecialCondition('t', ['finalizado', 'encerrado'], true)} THEN 1 ELSE 0 END) DESC,
      (CASE WHEN t.prioridade = 'urgente' THEN 1 ELSE 0 END) DESC,
      (CASE WHEN t.prioridade = 'alta' THEN 1 ELSE 0 END) DESC,
      (CASE WHEN t.responsavel_id IS NULL THEN 1 ELSE 0 END) DESC,
      t.updated_at DESC,
      t.id DESC
    `;

    // C2 fix: NÃO buscamos todos os tickets de uma vez.
    // 1) Primeiro calculamos summary e contagens REAIS por status (precisamos
    //    saber quais colunas existem e seus totais antes de buscar os cards).
    const [summaryRows]: any = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN t.status = 'aberto' THEN 1 ELSE 0 END) as aberto,
        SUM(CASE WHEN t.status = 'em_andamento' THEN 1 ELSE 0 END) as em_andamento,
        SUM(CASE WHEN t.status = 'aguardando_cliente' THEN 1 ELSE 0 END) as aguardando_cliente,
        SUM(CASE WHEN t.status = 'resolvido' THEN 1 ELSE 0 END) as resolvido,
        SUM(CASE WHEN t.status = 'fechado' THEN 1 ELSE 0 END) as fechado
      FROM tickets t
      ${requesterJoinForSummary}
      ${summaryWhere}
    `, summaryParams);
    const summary = summaryRows[0] || { total: 0, aberto: 0, em_andamento: 0, aguardando_cliente: 0, resolvido: 0, fechado: 0 };

    const [statusCountRows]: any = await pool.query(`
      SELECT t.status, COUNT(*) as count
      FROM tickets t
      ${requesterJoinForSummary}
      ${summaryWhere}
      GROUP BY t.status
    `, summaryParams);

    const statusCounts = new Map<string, number>(
      statusCountRows.map((row: any) => [row.status, Number(row.count || 0)])
    );

    // 2) Limite por coluna (generoso). Aceita kanban_limit com teto seguro.
    const perColumnLimit = Math.min(Math.max(toPositiveInt(filters.kanban_limit) ?? 150, 20), 300);

    // 3) Busca os cards por status (uma query por coluna existente), com a MESMA
    //    ordenação operacional e LIMIT por coluna. Reusa baseWhere/params atuais
    //    e apenas adiciona o recorte por status + LIMIT.
    const statusesToFetch = Array.from(statusCounts.keys());
    let tickets: any[] = [];
    for (const st of statusesToFetch) {
      const [colRows]: any = await pool.query(`
        SELECT t.id, t.titulo, t.status, t.prioridade, t.categoria, t.servico, t.created_at, t.updated_at, t.prazo_sla, t.responsavel_id, t.empresa_id,
               t.sla_status_operacional, t.sla_pausado_em,
               t.aguardando_resposta_atendente, t.ultima_mensagem_publica_em, t.ultima_mensagem_publica_origem,
               COALESCE(t.solicitante_nome, u.nome, 'Usuário Removido') as cliente_nome, 
               COALESCE(t.solicitante_email, u.email, 'Usuário Removido') as cliente_email, 
               COALESCE(r.nome, 'Não Atribuído') as responsavel_nome, 
               e.nome as empresa_nome
        FROM tickets t
        LEFT JOIN usuarios u ON t.usuario_id = u.id
        LEFT JOIN empresas e ON t.empresa_id = e.id
        LEFT JOIN usuarios r ON t.responsavel_id = r.id
        ${baseWhere} AND t.status = ?
        ORDER BY ${orderBy_K}
        LIMIT ?
      `, [...params, st, perColumnLimit]);
      tickets = tickets.concat(colRows);
    }

    // Enriquecer com tags
    if (tickets.length > 0) {
      const ticketIds = tickets.map((t: any) => t.id);
      const tagsMap = await this.getTagsForTickets(ticketIds);
      tickets.forEach((t: any) => {
        t.tags = tagsMap[t.id] || [];
      });
    }

    // Enriquecer com produtividade
    await this.enrichTicketsWithProductivity(tickets, filters.usuario_id);

    const configuredStatusRows = statusConfigEmpresaId
      ? await getTicketStatusConfigs(statusConfigEmpresaId)
      : [];
    const configuredStatusMap = new Map(configuredStatusRows.map((row) => [row.valor, row]));
    const configuredStatusOrder = configuredStatusRows
      .filter((row) => row.ativo === 1 && row.kanban_visivel === 1)
      .map((row) => row.valor);
    const ticketStatuses = tickets.map((ticket: any) => ticket.status).filter(Boolean);
    const discoveredStatuses = [
      ...configuredStatusOrder,
      ...Array.from(statusCounts.keys()),
      ...ticketStatuses
    ].filter((status, index, all) => all.indexOf(status) === index);

    const columnsConfig = discoveredStatuses.map(status => ({
      id: status,
      title: configuredStatusMap.get(status)?.nome || labelFromStatus(status)
    }));

    let totalLoaded = 0;
    let truncated = false;
    const columns = columnsConfig.map(c => {
      const colTickets = tickets.filter((t: any) => t.status === c.id);
      const realCount = Number(statusCounts.get(c.id) ?? summary[c.id] ?? colTickets.length);
      const loadedCount = colTickets.length;
      totalLoaded += loadedCount;
      const hasMore = realCount > loadedCount;
      if (hasMore) truncated = true;
      return {
        id: c.id,
        title: c.title,
        count: realCount,
        loadedCount,
        hasMore,
        tickets: colTickets
      };
    });

    const totals = {
      total: Number(summary.total || 0),
      aberto: Number(summary.aberto || 0),
      em_andamento: Number(summary.em_andamento || 0),
      aguardando_cliente: Number(summary.aguardando_cliente || 0),
      resolvido: Number(summary.resolvido || 0),
      fechado: Number(summary.fechado || 0)
    };

    return {
      columns,
      totals,
      queues: await this.getQueuesCounts(filters),
      meta: {
        perColumnLimit,
        truncated,
        totalLoaded,
        totalAvailable: Number(summary.total || 0)
      }
    };
  }

  async create(data: any) {
    const { 
      empresa_id, usuario_id, solicitante_nome, solicitante_email, 
      titulo, descricao, categoria, servico,
      origem, email_channel_id, message_id
    } = data;
    
    let prioridade = data.prioridade || 'media';
    const initialStatus = await getInitialTicketStatusValue(empresa_id);

    if (message_id) {
      const [existingTicket]: any = await pool.query(
        'SELECT id FROM tickets WHERE message_id = ? AND empresa_id = ? AND deleted_at IS NULL ORDER BY id ASC LIMIT 1',
        [message_id, empresa_id]
      );

      if (existingTicket.length > 0) {
        console.warn(`[TicketsService] Duplicate ticket message_id ignored: ${maskIdentifier(message_id)}`);
        return existingTicket[0].id;
      }
    }

    // Check SLA policy
    let minutosSla = 24 * 60; // media padrão
    let minutosPrimeiraResposta = 60; // 1 hora padrão
    try {
      const [politicas]: any = await pool.query(
        'SELECT * FROM empresa_sla_politicas WHERE empresa_id = ? AND ativo = 1 ORDER BY ordem ASC',
        [empresa_id]
      );
      
      let politicaEncontrada = null;
      for (const pol of politicas) {
        let matches = true;
        if (pol.prioridade && pol.prioridade !== prioridade) matches = false;
        if (pol.categoria && pol.categoria !== categoria) matches = false;
        if (pol.servico && pol.servico !== servico) matches = false;
        if (matches) {
          politicaEncontrada = pol;
          break;
        }
      }

      if (politicaEncontrada) {
        minutosSla = politicaEncontrada.tempo_resolucao_minutos;
        minutosPrimeiraResposta = politicaEncontrada.tempo_primeira_resposta_minutos || 60;
      } else {
        if (prioridade === 'urgente') {
          minutosSla = 4 * 60;
          minutosPrimeiraResposta = 30;
        } else if (prioridade === 'alta') {
          minutosSla = 12 * 60;
          minutosPrimeiraResposta = 60;
        } else if (prioridade === 'baixa') {
          minutosSla = 48 * 60;
          minutosPrimeiraResposta = 4 * 60;
        }
      }
    } catch (err) {
      console.warn('Erro ao buscar SLA', err);
    }

    const agora = new Date();
    const prazoSlaFormatado = addMinutesForMySQL(minutosSla, agora);
    const prazoPRFormatado = addMinutesForMySQL(minutosPrimeiraResposta, agora);

    let responsavel_id = data.responsavel_id || null;

    const [result]: any = await pool.query(
      `INSERT INTO tickets (
        empresa_id, usuario_id, solicitante_nome, solicitante_email, 
        titulo, descricao, prioridade, categoria, servico, 
        origem, email_channel_id, message_id, status,
        prazo_sla, prazo_primeira_resposta, sla_primeira_resposta_status, responsavel_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresa_id, usuario_id || null, solicitante_nome || null, solicitante_email || null, 
        titulo, descricao, prioridade || 'media', categoria || 'suporte', servico || null, 
        origem || 'sistema', email_channel_id || null, message_id || null, initialStatus,
        prazoSlaFormatado, prazoPRFormatado, 'aguardando', responsavel_id
      ]
    );
    const ticketId = result.insertId;

    // Initialize SLA Status Operacional
    await slaService.updateOperationalStatus(ticketId);

    // Track processed email to avoid duplicates
    if (message_id) {
      await pool.query(
        'INSERT IGNORE INTO processed_emails (message_id, empresa_id, ticket_id) VALUES (?, ?, ?)',
        [message_id, empresa_id, ticketId]
      );
    }

    try {
       if (!responsavel_id) {
          const { distributeTicket } = await import('./distribution.service.js');
          const distributedAgentId = await distributeTicket({ id: ticketId, empresa_id, categoria, servico });
          if (distributedAgentId) responsavel_id = distributedAgentId;
       }
    } catch(e) {}

    try {
      const { runAutomations } = await import('./automations.service.js');
      // Pass the fully assembled ticket object
      await runAutomations('ticket_criado', { id: ticketId, empresa_id, status: initialStatus, prioridade: prioridade || 'media', categoria, servico, responsavel_id }, { usuario_id });
    } catch(err) {
      console.warn('Erro ao rodar automações', err);
    }

    // BUG 3 fix: recompute APÓS as automações de criação, pois uma automação
    // 'ticket_criado' pode ter alterado o status (ex.: fechar/aguardando_cliente).
    try {
      await recomputeTicketMessageState(ticketId);
    } catch (stateErr) {
      console.error('[TicketsService] Falha ao recomputar estado materializado (create):', stateErr);
    }

    try {
      await recordTicketEvent({
        ticket_id: ticketId,
        empresa_id,
        usuario_id,
        tipo: 'ticket_criado',
        descricao: 'Abertura do chamado'
      });
    } catch (e) {}

    // Notificações: Admins
    try {
      const [admins]: any = await pool.query(
        'SELECT id FROM usuarios WHERE empresa_id = ? AND administrador = 1',
        [empresa_id]
      );
      
      const adminIds = admins
        .filter((a: any) => a.id !== usuario_id)
        .map((a: any) => a.id);

      let authorName = solicitante_nome || 'Cliente Externo';
      let authorEmail = solicitante_email || '';
      if (usuario_id) {
         const [author]: any = await pool.query('SELECT nome, email FROM usuarios WHERE id = ?', [usuario_id]);
         if (author[0]) {
            authorName = author[0].nome;
            authorEmail = author[0].email;
         }
      }

      if (adminIds.length > 0) {
        await notificationsService.createMany(adminIds, {
          empresa_id,
          tipo: 'TICKET_CREATED',
          titulo: 'Novo atendimento criado',
          mensagem: `${authorName} abriu o chamado #${ticketId}: ${titulo}`,
          link: `ticket:${ticketId}`,
          metadata: { ticketId }
        });
      }

      if (authorEmail) {
        const outboundMessageId = `<ticket-${ticketId}-created@gestifique.com.br>`;
        await emailOutboxService.enqueueTicketEmail({
          to: authorEmail,
          ticketId,
          empresaId: empresa_id,
          emailChannelId: email_channel_id,
          type: 'ticket_created',
          title: titulo,
          customerName: authorName,
          message: descricao,
          status: 'Aberto',
          priority: prioridade,
          category: categoria,
          messageId: outboundMessageId,
          inReplyTo: message_id,
          references: message_id ? [message_id] : undefined,
          dedupeKey: `ticket:${ticketId}:created`
        });
        console.log(`[TicketsService] E-mail de criacao enfileirado para ${maskEmail(authorEmail)} no chamado #${ticketId}.`);
      }
    } catch (e) {
      console.error('Erro ao notificar criação de ticket:', e);
      await recordTicketEvent({
        ticket_id: ticketId,
        empresa_id,
        usuario_id,
        tipo: 'email_outbox_erro',
        descricao: 'O chamado foi criado, mas o e-mail nao pode ser enfileirado.',
        metadata: { error: String((e as any)?.message || e).slice(0, 500) }
      }).catch(() => {});
    }

    return ticketId;
  }

  async getByIdForUser(id: number, currentUser: any) {
    const ticket = await this.getById(id);
    if (!ticket) return null;
    if (!currentUser) return { error: 'forbidden' };

    if (!isDeveloperUser(currentUser)) {
      if (Number(ticket.empresa_id) !== Number(currentUser.empresa_id)) return { error: 'forbidden' };

      // Enforce ticket view scopes
      const scope = await getTicketScope(currentUser);
      if (!scope.canViewAll) {
        let isAllowedAndOwned = false;
        if (scope.canViewOwn) {
          const isAuthor = Number(ticket.usuario_id) === Number(currentUser.id);
          const isAssignee = Number(ticket.responsavel_id) === Number(currentUser.id);
          if (isAuthor || isAssignee) {
            isAllowedAndOwned = true;
          }
        }
        let isAllowedAndUnassigned = false;
        if (scope.canViewUnassigned) {
          if (ticket.responsavel_id === null || ticket.responsavel_id === undefined) {
             isAllowedAndUnassigned = true;
          }
        }

        if (!isAllowedAndOwned && !isAllowedAndUnassigned) {
          return { error: 'forbidden' };
        }
      }
    }
    return ticket;
  }

  async delete(id: number, deletedBy?: number | null, reason = 'Exclusao manual'): Promise<boolean> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [result]: any = await connection.query(
        `
          UPDATE tickets
          SET deleted_at = COALESCE(deleted_at, NOW()),
              deleted_by = COALESCE(deleted_by, ?),
              delete_reason = COALESCE(delete_reason, ?),
              updated_at = NOW()
          WHERE id = ?
            AND deleted_at IS NULL
        `,
        [deletedBy || null, String(reason || 'Exclusao manual').slice(0, 255), id]
      );

      if (result.affectedRows > 0) {
        const [ticketRows]: any = await connection.query(
          'SELECT empresa_id FROM tickets WHERE id = ?',
          [id]
        );
        const empresaId = ticketRows[0]?.empresa_id || null;
        await connection.query(
          `
            INSERT INTO ticket_eventos (ticket_id, empresa_id, usuario_id, tipo, descricao)
            VALUES (?, ?, ?, 'ticket_excluido', ?)
          `,
          [id, empresaId, deletedBy || null, String(reason || 'Chamado removido').slice(0, 255)]
        );
      }

      await connection.commit();

      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getById(id: number, currentUserId?: number) {
    const [rows]: any = await pool.query(
      `SELECT 
        t.id, t.empresa_id, t.usuario_id, t.responsavel_id, t.titulo, t.descricao, 
        t.status, t.prioridade, t.categoria, t.servico, t.origem, t.email_channel_id, t.message_id, 
        t.prazo_sla, t.finalizado_em,
        t.prazo_primeira_resposta, t.primeira_resposta_em, t.sla_primeira_resposta_status, t.sla_resolucao_status,
        t.sla_pausado_em, t.sla_pausado_total_minutos, t.sla_status_operacional,
        t.resolucao_motivo, t.resolucao_observacao, t.reaberto_em, t.reaberto_por,
        t.aguardando_resposta_atendente, t.ultima_mensagem_publica_em, t.ultima_mensagem_publica_origem,
        t.created_at, t.updated_at,
        COALESCE(t.solicitante_nome, u.nome, 'Usuário Removido') as cliente_nome, 
        COALESCE(t.solicitante_email, u.email, 'removido@sistema.com') as cliente_email, 
        COALESCE(r.nome, 'Não Atribuído') as responsavel_nome, 
        e.nome as empresa_nome
       FROM tickets t 
       LEFT JOIN usuarios u ON t.usuario_id = u.id 
       JOIN empresas e ON t.empresa_id = e.id
       LEFT JOIN usuarios r ON t.responsavel_id = r.id 
       WHERE t.id = ? AND t.deleted_at IS NULL`,
      [id]
    );
    
    if (!rows[0]) return null;
    
    const ticket = rows[0];
    ticket.tags = await this.getTags(id);
    ticket.custom_fields = await this.getCustomFields(id);
    
    // Buscar satisfação se houver
    const [csatRows]: any = await pool.query(
      'SELECT id, nota, comentario, respondido_em FROM ticket_satisfacao WHERE ticket_id = ? ORDER BY created_at DESC LIMIT 1',
      [id]
    );
    if (!csatRows[0]) {
      ticket.satisfacao = { status: 'nao_enviada' };
    } else if (!csatRows[0].respondido_em) {
      ticket.satisfacao = {
        id: csatRows[0].id,
        status: 'aguardando_resposta'
      };
    } else {
      ticket.satisfacao = {
        id: csatRows[0].id,
        nota: csatRows[0].nota,
        comentario: csatRows[0].comentario,
        respondido_em: csatRows[0].respondido_em,
        status: 'respondida'
      };
    }
    
    // Enriquecer com produtividade
    const enriched = await this.enrichTicketsWithProductivity([ticket], currentUserId);
    return enriched[0];
  }

  async updateStatus(id: number, status: string, changedByUserId: number, req?: any) {
    if (!isValidTicketStatus(status)) {
      throw new Error(`Status inválido: ${status}`);
    }

    const oldTicket = await this.getById(id, changedByUserId);
    if (!oldTicket) {
      throw new Error('Chamado não encontrado');
    }

    if (oldTicket.status === status) return;

    const oldStatusConfig = await getTicketStatusConfig(oldTicket.empresa_id, oldTicket.status);
    const newStatusConfig = await getTicketStatusConfig(oldTicket.empresa_id, status);
    if (!newStatusConfig || newStatusConfig.ativo !== 1) {
      throw new Error('Status não existe no fluxo de atendimento desta empresa');
    }

    const wasFinalStatus = isFinalTicketStatusSpecial(oldStatusConfig?.especial);
    const willBeFinalStatus = isFinalTicketStatusSpecial(newStatusConfig.especial);
    const isReopening = wasFinalStatus && !willBeFinalStatus;

    let finalizado_em = null;
    let sla_resolucao_status = oldTicket.sla_resolucao_status;

    if (willBeFinalStatus) {
       finalizado_em = formatDateTimeForMySQL();
       if (oldTicket.prazo_sla) {
         const finalData = new Date();
         const prazoData = new Date(oldTicket.prazo_sla);
         sla_resolucao_status = finalData <= prazoData ? 'cumprido' : 'violado';
       }
    }

    const updateFields = ['status = ?'];
    const updateParams: any[] = [status];

    if (finalizado_em) {
      updateFields.push('finalizado_em = ?');
      updateParams.push(finalizado_em);
    } else {
      updateFields.push('finalizado_em = NULL');
    }

    updateFields.push('sla_resolucao_status = ?');
    updateParams.push(sla_resolucao_status);

    if (isReopening) {
      updateFields.push('reaberto_em = NOW()', 'reaberto_por = ?');
      updateParams.push(changedByUserId || null);
    }

    updateFields.push('updated_at = NOW()');
    updateParams.push(id);

    await pool.query(
      `UPDATE tickets SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams
    );

    const oldWasCustomerWaiting = isCustomerWaitingTicketStatusSpecial(oldStatusConfig?.especial);
    const newIsCustomerWaiting = isCustomerWaitingTicketStatusSpecial(newStatusConfig.especial);

    // Sprint 2: SLA Pause/Resume logic
    if (newIsCustomerWaiting) {
      await slaService.pauseSla(id, changedByUserId);
    } else if (oldWasCustomerWaiting && !newIsCustomerWaiting) {
      await slaService.resumeSla(id, changedByUserId);
    } else {
      await slaService.updateOperationalStatus(id);
    }

    if (willBeFinalStatus && !wasFinalStatus) {
      await this.ensureSatisfactionSurvey(id, oldTicket.empresa_id, changedByUserId);
      await this.enqueueFinalStatusEmail({
        ticket: oldTicket,
        ticketId: id,
        status,
        statusName: newStatusConfig.nome || labelFromStatus(status),
        statusSpecial: newStatusConfig.especial
      });

      try {
        await recordTicketEvent({
          ticket_id: id,
          empresa_id: oldTicket.empresa_id,
          usuario_id: changedByUserId,
          tipo: 'ticket_finalizado',
          descricao: `Chamado ${status}`
        });
      } catch (err) {}
    }

    if (isReopening) {
      try {
        await recordTicketEvent({
          ticket_id: id,
          empresa_id: oldTicket.empresa_id,
          usuario_id: changedByUserId,
          tipo: 'ticket_reaberto',
          descricao: `Chamado reaberto com status "${status}"`
        });
      } catch (err) {}
    }

    // Notificações de Status
// ... (rest of the code seems fine)
    try {
      const newStatusText = newStatusConfig.nome || labelFromStatus(status);

      // Notificar cliente
      if (oldTicket.usuario_id && oldTicket.usuario_id !== changedByUserId) {
        await notificationsService.create({
          usuario_id: oldTicket.usuario_id,
          empresa_id: oldTicket.empresa_id,
          tipo: 'TICKET_STATUS_CHANGED',
          titulo: 'Status atualizado',
          mensagem: `O status do seu chamado #${id} mudou para: ${newStatusText}`,
          link: `ticket:${id}`
        });
      }

      // Notificar responsável (se existir e for diferente do cliente e de quem mudou)
      const currentRespId = oldTicket.responsavel_id;
      if (currentRespId && currentRespId !== oldTicket.usuario_id && currentRespId !== changedByUserId) {
        await notificationsService.create({
          usuario_id: Number(currentRespId),
          empresa_id: oldTicket.empresa_id,
          tipo: 'TICKET_STATUS_CHANGED',
          titulo: 'Status atualizado',
          mensagem: `O chamado #${id} sob sua responsabilidade mudou para: ${newStatusText}`,
          link: `ticket:${id}`
        });
      }
    } catch (e) {
      console.error('Erro ao notificar atualização de status do ticket:', e);
    }

    try {
       await recordTicketEvent({
         ticket_id: id,
         empresa_id: oldTicket.empresa_id,
         usuario_id: changedByUserId,
         tipo: 'status_alterado',
         descricao: `Status alterado de "${oldTicket.status}" para "${status}"`
       });
    } catch (e) {}

    try {
       const { runAutomations } = await import('./automations.service.js');
       await runAutomations('status_alterado', { ...oldTicket, status }, {});
    } catch(err) {}

    // Mudança de status afeta "aguardando_resposta_atendente" -> recomputa.
    try {
      await recomputeTicketMessageState(id);
    } catch (stateErr) {
      console.error('[TicketsService] Falha ao recomputar estado materializado (updateStatus):', stateErr);
    }

    return { oldStatus: oldTicket.status, newStatus: status, empresa_id: oldTicket.empresa_id };
  }

  async update(id: number, data: any, currentUser?: any) {
    const oldTicket = await this.getById(id);
    if (!oldTicket) return;

    let oldStatusConfig = null;
    let newStatusConfig = null;
    if (data.status && data.status !== oldTicket.status) {
      if (!isValidTicketStatus(data.status)) {
        throw new Error(`Status inválido: ${data.status}`);
      }

      oldStatusConfig = await getTicketStatusConfig(oldTicket.empresa_id, oldTicket.status);
      newStatusConfig = await getTicketStatusConfig(oldTicket.empresa_id, data.status);
      if (!newStatusConfig || newStatusConfig.ativo !== 1) {
        throw new Error('Status não existe no fluxo de atendimento desta empresa');
      }
    }

    const fields: string[] = [];
    const paramsList: any[] = [];

    // Finalizado_em logic
    if (data.status) {
      if (isFinalTicketStatusSpecial(newStatusConfig?.especial)) {
        fields.push('finalizado_em = ?');
        paramsList.push(formatDateTimeForMySQL());
      } else {
        fields.push('finalizado_em = NULL');
      }
    }

    Object.keys(data).forEach(key => {
      if (['titulo', 'descricao', 'status', 'prioridade', 'responsavel_id', 'categoria', 'servico', 'origem', 'prazo_sla'].includes(key)) {
        fields.push(`${key} = ?`);
        paramsList.push(data[key]);
      }
    });

    if (fields.length === 0) return;

    paramsList.push(id);
    await pool.query(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`, paramsList);

    // Sprint 2: Handle SLA status Operational and Pause/Resume if status changed
    if (data.status && data.status !== oldTicket.status) {
      const oldWasCustomerWaiting = isCustomerWaitingTicketStatusSpecial(oldStatusConfig?.especial);
      const newIsCustomerWaiting = isCustomerWaitingTicketStatusSpecial(newStatusConfig?.especial);

      if (newIsCustomerWaiting) {
        await slaService.pauseSla(id, currentUser?.id || null);
      } else if (oldWasCustomerWaiting && !newIsCustomerWaiting) {
        await slaService.resumeSla(id, currentUser?.id || null);
      } else {
        await slaService.updateOperationalStatus(id);
      }
    } else {
      // For any other update, ensure status is still correct
      await slaService.updateOperationalStatus(id);
    }

    // Notificações de Status ou Responsável
    try {
      if (data.responsavel_id && data.responsavel_id !== oldTicket.responsavel_id) {
        await notificationsService.create({
          usuario_id: Number(data.responsavel_id),
          empresa_id: oldTicket.empresa_id,
          tipo: 'TICKET_ASSIGNED',
          titulo: 'Chamado atribuído a você',
          mensagem: `Você é o novo responsável pelo chamado #${id}: ${oldTicket.titulo}`,
          link: `ticket:${id}`
        });
      }

      if (data.status && data.status !== oldTicket.status) {
        const newStatusText = newStatusConfig?.nome || labelFromStatus(data.status);

        // Notificar cliente
        if (oldTicket.usuario_id) {
          await notificationsService.create({
            usuario_id: oldTicket.usuario_id,
            empresa_id: oldTicket.empresa_id,
            tipo: 'TICKET_STATUS_CHANGED',
            titulo: 'Status atualizado',
            mensagem: `O status do seu chamado #${id} mudou para: ${newStatusText}`,
            link: `ticket:${id}`
          });
        }

        // Notificar responsável (se existir e for diferente do cliente)
        const currentRespId = data.responsavel_id || oldTicket.responsavel_id;
        if (currentRespId && currentRespId !== oldTicket.usuario_id) {
          await notificationsService.create({
            usuario_id: Number(currentRespId),
            empresa_id: oldTicket.empresa_id,
            tipo: 'TICKET_STATUS_CHANGED',
            titulo: 'Status atualizado',
            mensagem: `O chamado #${id} sob sua responsabilidade mudou para: ${newStatusText}`,
            link: `ticket:${id}`
          });
        }
      }
    } catch (e) {
      console.error('Erro ao notificar atualização de ticket:', e);
    }
    
    // Automations & CSAT
    try {
      if (data.status && isFinalTicketStatusSpecial(newStatusConfig?.especial) && !isFinalTicketStatusSpecial(oldStatusConfig?.especial)) {
        await this.ensureSatisfactionSurvey(id, oldTicket.empresa_id, currentUser?.id || null);
        await this.enqueueFinalStatusEmail({
          ticket: oldTicket,
          ticketId: id,
          status: data.status,
          statusName: newStatusConfig?.nome || labelFromStatus(data.status),
          statusSpecial: newStatusConfig?.especial,
          resolutionReason: data.resolucao_motivo || oldTicket.resolucao_motivo,
          resolutionObservation: data.resolucao_observacao || oldTicket.resolucao_observacao
        });

        await recordTicketEvent({
          ticket_id: id,
          empresa_id: oldTicket.empresa_id,
          usuario_id: currentUser?.id || null,
          tipo: 'ticket_finalizado',
          descricao: `Chamado ${data.status}`
        });
      }
      if (data.status && data.status !== oldTicket.status) {
        const { runAutomations } = await import('./automations.service.js');
        await runAutomations('status_alterado', { ...oldTicket, ...data }, {});
      }
      
      if (data.categoria && data.categoria !== oldTicket.categoria) {
        try {
          await recordTicketEvent({
            ticket_id: id,
            empresa_id: oldTicket.empresa_id,
            usuario_id: currentUser ? currentUser.id : null,
            tipo: 'categoria_alterada',
            descricao: `Categoria alterada de "${oldTicket.categoria || 'Nenhuma'}" para "${data.categoria || 'Nenhuma'}"`
          });
        } catch(err) {}
      }
      
      if (data.servico && data.servico !== oldTicket.servico) {
        try {
          await recordTicketEvent({
            ticket_id: id,
            empresa_id: oldTicket.empresa_id,
            usuario_id: currentUser ? currentUser.id : null,
            tipo: 'servico_alterado',
            descricao: `Serviço alterado de "${oldTicket.servico || 'Nenhum'}" para "${data.servico || 'Nenhum'}"`
          });
        } catch(err) {}
      }
      
      if (data.origem && data.origem !== oldTicket.origem) {
        try {
          await recordTicketEvent({
            ticket_id: id,
            empresa_id: oldTicket.empresa_id,
            usuario_id: currentUser ? currentUser.id : null,
            tipo: 'origem_alterada',
            descricao: `Origem alterada de "${oldTicket.origem || 'Não informada'}" para "${data.origem || 'Não informada'}"`
          });
        } catch(err) {}
      }
      
      if (data.prazo_sla && String(data.prazo_sla) !== String(oldTicket.prazo_sla)) {
        try {
          await recordTicketEvent({
            ticket_id: id,
            empresa_id: oldTicket.empresa_id,
            usuario_id: currentUser ? currentUser.id : null,
            tipo: 'sla_recalculado',
            descricao: `Prazo SLA alterado`
          });
        } catch (err) {}
      }

      if (data.prioridade && data.prioridade !== oldTicket.prioridade) {
        try {
          await recordTicketEvent({
            ticket_id: id,
            empresa_id: oldTicket.empresa_id,
            usuario_id: currentUser ? currentUser.id : null,
            tipo: 'prioridade_alterada',
            descricao: `Prioridade alterada de "${oldTicket.prioridade}" para "${data.prioridade}"`
          });
        } catch(err) {}

        const { runAutomations } = await import('./automations.service.js');
        await runAutomations('prioridade_alterada', { ...oldTicket, ...data }, {});
      }
      if (data.responsavel_id !== undefined && data.responsavel_id !== oldTicket.responsavel_id) {
        try {
          let oldName = 'Nenhum';
          let newName = 'Nenhum';
          if (oldTicket.responsavel_id) {
            const [o]: any = await pool.query('SELECT nome FROM usuarios WHERE id = ?', [oldTicket.responsavel_id]);
            if (o[0]) oldName = o[0].nome;
          }
          if (data.responsavel_id) {
            const [n]: any = await pool.query('SELECT nome FROM usuarios WHERE id = ?', [data.responsavel_id]);
            if (n[0]) newName = n[0].nome;
          }
          await recordTicketEvent({
            ticket_id: id,
            empresa_id: oldTicket.empresa_id,
            usuario_id: currentUser ? currentUser.id : null,
            tipo: 'responsavel_alterado',
            descricao: `Responsável alterado de "${oldName}" para "${newName}"`
          });
        } catch(err) {}

        const { runAutomations } = await import('./automations.service.js');
        await runAutomations('responsavel_alterado', { ...oldTicket, ...data }, {});
      }
    } catch(err) {
      console.warn('Erro rodar automacoes update', err);
    }

    // Defensivo: update() suporta data.status (pausa/retoma SLA, notifica, e-mail).
    // Se o status mudou por aqui, recomputa o estado materializado para manter
    // aguardando_resposta_atendente correto. Guardado: não roda em updates de
    // prioridade/responsável (caminho comum do bulk), evitando overhead.
    if (data.status && data.status !== oldTicket.status) {
      try {
        await recomputeTicketMessageState(id);
      } catch (stateErr) {
        console.error('[TicketsService] Falha ao recomputar estado materializado (update):', stateErr);
      }
    }
  }

  async getMessages(ticketId: number, includeInternal: boolean, pagination: { limit?: number; beforeId?: number; offset?: number } = {}) {
    const limit = Math.min(Math.max(Number(pagination.limit) || DEFAULT_MESSAGE_LIMIT, 1), MAX_MESSAGE_LIMIT);
    const offset = Math.max(Number(pagination.offset) || 0, 0);
    let query = `
      SELECT m.id, m.ticket_id, m.usuario_id, m.mensagem, m.interno, m.anexo, m.message_id, m.created_at,
             COALESCE(u.nome, t.solicitante_nome, 'Cliente') as usuario_nome 
      FROM ticket_mensagens m
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      LEFT JOIN tickets t ON m.ticket_id = t.id
      WHERE m.ticket_id = ? AND t.deleted_at IS NULL
    `;
    const params: any[] = [ticketId];
    if (!includeInternal) query += ' AND m.interno = 0';
    if (pagination.beforeId) {
      query += ' AND m.id < ?';
      params.push(pagination.beforeId);
    }
    query += ' ORDER BY m.created_at DESC, m.id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const [rows]: any = await pool.query(query, params);
    return rows.reverse();
  }

  async addMessage(data: any, currentUser?: any) {
    return ticketMessagesService.addMessage(data, currentUser);
  }

  private async enqueueFinalStatusEmail(params: {
    ticket: any;
    ticketId: number;
    status: string;
    statusName?: string;
    statusSpecial?: string | null;
    resolutionReason?: string | null;
    resolutionObservation?: string | null;
  }) {
    const { ticket, ticketId, status, statusName, statusSpecial, resolutionReason, resolutionObservation } = params;
    const to = ticket.cliente_email;
    if (!to || to === 'removido@sistema.com') return;

    const emailType = statusSpecial === 'encerrado' ? 'ticket_closed' : 'ticket_resolved';
    const outboundMessageId = `<ticket-${ticketId}-${emailType}@gestifique.com.br>`;

    try {
      await emailOutboxService.enqueueTicketEmail({
        to,
        ticketId,
        empresaId: ticket.empresa_id,
        emailChannelId: ticket.email_channel_id,
        type: emailType,
        title: ticket.titulo,
        customerName: ticket.cliente_nome,
        status: statusName || labelFromStatus(status),
        resolutionReason: resolutionReason || ticket.resolucao_motivo,
        resolutionObservation: resolutionObservation || ticket.resolucao_observacao,
        messageId: outboundMessageId,
        inReplyTo: ticket.message_id,
        references: ticket.message_id ? [ticket.message_id] : undefined,
        dedupeKey: `ticket:${ticketId}:${emailType}`
      });
    } catch (error: any) {
      console.error(`[TicketsService] Falha ao enfileirar e-mail final do chamado #${ticketId}:`, error?.message || error);
      await recordTicketEvent({
        ticket_id: ticketId,
        empresa_id: ticket.empresa_id,
        usuario_id: null,
        tipo: 'email_outbox_erro',
        descricao: 'A acao foi registrada, mas o e-mail nao pode ser enfileirado.',
        metadata: { emailType, error: String(error?.message || error).slice(0, 500) }
      }).catch(() => {});
      throw error;
    }
  }

  private async ensureSatisfactionSurvey(ticketId: number, empresaId: number, usuarioId: number | null) {
    try {
      const [existingCsat]: any = await pool.query(
        'SELECT id FROM ticket_satisfacao WHERE ticket_id = ? LIMIT 1',
        [ticketId]
      );

      if (existingCsat.length === 0) {
        const { randomUUID } = await import('crypto');
        const token = randomUUID();

        await pool.query(
          'INSERT INTO ticket_satisfacao (ticket_id, empresa_id, token) VALUES (?, ?, ?)',
          [ticketId, empresaId, token]
        );

        await recordTicketEvent({
          ticket_id: ticketId,
          empresa_id: empresaId,
          usuario_id: usuarioId,
          tipo: 'satisfacao_enviada',
          descricao: 'Pesquisa de satisfação gerada para o atendimento'
        });
      }
    } catch (error) {
      console.warn('Erro ao gerar pesquisa de satisfação:', error);
    }
  }

  async resolveTicket(id: number, data: any, currentUser: any) {
    const { status, resolucao_motivo, resolucao_observacao } = data;
    if (!isValidTicketStatus(status)) throw new Error('Status inválido para resolução');
    if (!resolucao_motivo) throw new Error('Motivo de resolução é obrigatório');

    const validMotivos = [
      'duvida_sanada', 'problema_corrigido', 'solicitacao_atendida', 
      'cancelamento_realizado', 'duplicado', 'sem_retorno_cliente', 
      'improcedente', 'encaminhado', 'outros',
      'resolvido', 'cancelado', 'outro' // Compatibilidade
    ];

    if (!validMotivos.includes(resolucao_motivo)) {
      throw new Error('Motivo de resolução inválido');
    }

    const oldTicket = await this.getById(id);
    if (!oldTicket) throw new Error('Ticket não encontrado');

    const oldStatusConfig = await getTicketStatusConfig(oldTicket.empresa_id, oldTicket.status);
    const newStatusConfig = await getTicketStatusConfig(oldTicket.empresa_id, status);
    if (!newStatusConfig || newStatusConfig.ativo !== 1 || !isFinalTicketStatusSpecial(newStatusConfig.especial)) {
      throw new Error('Status inválido para resolução');
    }

    const observacao = resolucao_observacao ? String(resolucao_observacao).substring(0, 2000) : null;
    let sla_resolucao_status = oldTicket.sla_resolucao_status;
    if (oldTicket.prazo_sla) {
      const finalData = new Date();
      const prazoData = new Date(oldTicket.prazo_sla);
      sla_resolucao_status = finalData <= prazoData ? 'cumprido' : 'violado';
    }

    await pool.query(
      'UPDATE tickets SET status = ?, resolucao_motivo = ?, resolucao_observacao = ?, finalizado_em = ?, sla_resolucao_status = ?, updated_at = NOW() WHERE id = ?',
      [status, resolucao_motivo, observacao, formatDateTimeForMySQL(), sla_resolucao_status, id]
    );

    // Sprint 2: Sync SLA Status
    if (isCustomerWaitingTicketStatusSpecial(oldStatusConfig?.especial)) {
      await slaService.resumeSla(id, currentUser?.id || null);
    } else {
      await slaService.updateOperationalStatus(id);
    }

    if (!isFinalTicketStatusSpecial(oldStatusConfig?.especial)) {
      await this.ensureSatisfactionSurvey(id, oldTicket.empresa_id, currentUser?.id || null);
      await this.enqueueFinalStatusEmail({
        ticket: oldTicket,
        ticketId: id,
        status,
        statusName: newStatusConfig.nome || labelFromStatus(status),
        statusSpecial: newStatusConfig.especial,
        resolutionReason: resolucao_motivo,
        resolutionObservation: observacao
      });

      await recordTicketEvent({
        ticket_id: id,
        empresa_id: oldTicket.empresa_id,
        usuario_id: currentUser?.id || null,
        tipo: 'ticket_finalizado',
        descricao: `Chamado ${status}`
      });
    }

    // Ticket finalizado nunca fica em fila de resposta -> recomputa.
    try {
      await recomputeTicketMessageState(id);
    } catch (stateErr) {
      console.error('[TicketsService] Falha ao recomputar estado materializado (resolveTicket):', stateErr);
    }

    return { success: true };
  }

  async reopenTicket(id: number, currentUser: any) {
    const ticket = await this.getById(id);
    if (!ticket) throw new Error('Ticket não encontrado');
    const currentStatusConfig = await getTicketStatusConfig(ticket.empresa_id, ticket.status);
    if (!isFinalTicketStatusSpecial(currentStatusConfig?.especial)) {
      throw new Error('Apenas tickets resolvidos ou fechados podem ser reabertos');
    }

    const reopenStatus = await getReopenTicketStatusValue(ticket.empresa_id);

    await pool.query(
      'UPDATE tickets SET status = ?, finalizado_em = NULL, reaberto_em = NOW(), reaberto_por = ?, updated_at = NOW() WHERE id = ?',
      [reopenStatus, currentUser.id, id]
    );

    // Sprint 2: Sync SLA Status
    if (isCustomerWaitingTicketStatusSpecial(currentStatusConfig?.especial)) {
      await slaService.resumeSla(id, currentUser.id);
    } else {
      await slaService.updateOperationalStatus(id);
    }

    try {
      await recordTicketEvent({
        ticket_id: id,
        empresa_id: ticket.empresa_id,
        usuario_id: currentUser?.id || null,
        tipo: 'ticket_reaberto',
        descricao: 'Chamado reaberto para atendimento'
      });
    } catch (err) {}

    // Reabertura volta o ticket para fila de resposta conforme a regra -> recomputa.
    try {
      await recomputeTicketMessageState(id);
    } catch (stateErr) {
      console.error('[TicketsService] Falha ao recomputar estado materializado (reopenTicket):', stateErr);
    }

    return { success: true };
  }

  // VIEWS
  async getViews(usuarioId: number, empresaId: number) {
    const [rows]: any = await pool.query(
      'SELECT * FROM ticket_views WHERE usuario_id = ? AND empresa_id = ? ORDER BY nome ASC',
      [usuarioId, empresaId]
    );
    return rows.map((r: any) => ({
      ...r,
      filtros_json: typeof r.filtros_json === 'string' ? JSON.parse(r.filtros_json) : r.filtros_json
    }));
  }

  async createView(data: any) {
    const { empresa_id, usuario_id, nome, filtros_json } = data;
    const [result]: any = await pool.query(
      'INSERT INTO ticket_views (empresa_id, usuario_id, nome, filtros_json) VALUES (?, ?, ?, ?)',
      [empresa_id, usuario_id, nome, JSON.stringify(filtros_json)]
    );
    return result.insertId;
  }

  async updateView(id: number, data: any, usuarioId: number) {
    const { nome, filtros_json } = data;
    await pool.query(
      'UPDATE ticket_views SET nome = ?, filtros_json = ? WHERE id = ? AND usuario_id = ?',
      [nome, JSON.stringify(filtros_json), id, usuarioId]
    );
  }

  async deleteView(id: number, usuarioId: number) {
    await pool.query('DELETE FROM ticket_views WHERE id = ? AND usuario_id = ?', [id, usuarioId]);
  }

  async getTimeline(ticketId: number, includeInternal: boolean, pagination: { limit?: number; beforeId?: number; offset?: number } = {}) {
    const ticket = await this.getById(ticketId);
    if (!ticket) return null;
    const limit = Math.min(Math.max(Number(pagination.limit) || DEFAULT_MESSAGE_LIMIT, 1), MAX_MESSAGE_LIMIT);
    const offset = Math.max(Number(pagination.offset) || 0, 0);

    const timeline: any[] = [];
    
    // 1. Initial Creation
    timeline.push({
      type: 'creation',
      date: ticket.created_at,
      author: ticket.cliente_nome || 'Cliente',
      description: 'Chamado aberto no sistema',
      icon: 'plus-circle'
    });

    // 2. Messages
    let msgQuery = `
      SELECT m.*, u.nome as usuario_nome 
      FROM ticket_mensagens m
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      WHERE m.ticket_id = ?
    `;
    const msgParams: any[] = [ticketId];
    if (!includeInternal) msgQuery += ' AND m.interno = 0';
    if (pagination.beforeId) {
      msgQuery += ' AND m.id < ?';
      msgParams.push(pagination.beforeId);
    }
    msgQuery += ' ORDER BY m.created_at DESC, m.id DESC LIMIT ? OFFSET ?';
    msgParams.push(limit, offset);
    
    const [messagesDesc]: any = await pool.query(msgQuery, msgParams);
    const messages = messagesDesc.reverse();

    messages.forEach((m: any) => {
      timeline.push({
        type: m.interno ? 'internal_note' : 'response',
        date: m.created_at,
        author: m.usuario_nome || 'Usuário',
        description: m.mensagem.length > 200 ? m.mensagem.substring(0, 197) + '...' : m.mensagem,
        id: m.id,
        is_internal: !!m.interno,
        icon: m.interno ? 'lock' : 'message-circle'
      });
    });

    // 3. System Logs (Tracking status, assignment, etc)
    const [logs]: any = await pool.query(`
      SELECT l.*, u.nome as usuario_nome 
      FROM logs_sistema l
      LEFT JOIN usuarios u ON l.usuario_id = u.id
      WHERE (l.descricao LIKE ? OR l.descricao LIKE ?)
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT ?
    `, [`%#${ticketId} %`, `%#${ticketId}`, limit]);

    logs.forEach((l: any) => {
      // Basic filtering: common users don't see internal logs (if we had a way to tag them)
      if (!includeInternal && (l.acao === 'INTERNAL_NOTE' || l.descricao.toLowerCase().includes('interno') || l.acao === 'TICKET_BULK_ACTION')) {
        return;
      }

      let type: any = 'system';
      let icon = 'activity';

      if (l.acao === 'TICKET_STATUS_CHANGE' || l.acao === 'TICKET_STATUS_CHANGED') icon = 'refresh-cw';
      if (l.acao === 'TICKET_UPDATE' && l.descricao.includes('responsável')) icon = 'user-check';
      if (l.acao === 'ATTACHMENT_UPLOAD') icon = 'paperclip';

      if (l.acao.includes('TAG')) {
        icon = 'tag';
        type = 'tag_change';
      }
      if (l.acao.includes('CUSTOM_FIELD')) {
        icon = 'edit-3';
        type = 'custom_field';
      }

      timeline.push({
        type,
        date: l.created_at,
        author: l.usuario_nome || 'Sistema',
        action: l.acao,
        description: l.descricao,
        icon
      });
    });

    // 4. Finalization (if any)
    if (ticket.finalizado_em) {
       timeline.push({
         type: 'completion',
         date: ticket.finalizado_em,
         author: 'Sistema',
         description: `Chamado ${ticket.status === 'resolvido' ? 'Resolvido' : 'Fechado'}${ticket.resolucao_motivo ? ` (Motivo: ${ticket.resolucao_motivo})` : ''}`,
         icon: 'check-circle'
       });
    }

    // 5. Reopening (if any)
    if (ticket.reaberto_em) {
       timeline.push({
         type: 'reopen',
         date: ticket.reaberto_em,
         author: 'Sistema',
         description: 'Chamado reaberto para atendimento',
         icon: 'rotate-ccw'
       });
    }

    // 6. Ticket Eventos
    const [eventos]: any = await pool.query(`
      SELECT te.*, u.nome as usuario_nome
      FROM ticket_eventos te
      LEFT JOIN usuarios u ON te.usuario_id = u.id
      WHERE te.ticket_id = ?
      ORDER BY te.created_at DESC, te.id DESC
      LIMIT ?
    `, [ticketId, limit]);

    const mapEventIcon = (tipo: string) => {
      switch (tipo) {
        case 'automacao_executada': return 'zap';
        case 'distribuicao_automatica': return 'user-check';
        case 'sla_recalculado': return 'clock';
        case 'satisfacao_enviada': return 'star';
        case 'satisfacao_respondida': return 'star';
        case 'macro_usada': return 'message-square';
        case 'status_alterado': return 'refresh-cw';
        case 'prioridade_alterada': return 'alert-circle';
        case 'responsavel_alterado': return 'user-check';
        case 'categoria_alterada': return 'tag';
        case 'servico_alterado': return 'briefcase';
        default: return 'activity';
      }
    };

    eventos.forEach((e: any) => {
      let parsedMetadata = {};
      if (typeof e.metadata_json === 'string') {
        try { parsedMetadata = JSON.parse(e.metadata_json); } catch (_) {}
      } else if (e.metadata_json) {
        parsedMetadata = e.metadata_json;
      }
      
      timeline.push({
        type: 'event',
        date: e.created_at,
        author: e.usuario_nome || 'Sistema',
        action: e.tipo,
        description: e.descricao,
        metadata: parsedMetadata,
        icon: mapEventIcon(e.tipo)
      });
    });

    // Sort by date ascending (oldest first)
    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return timeline;
  }

  // TAGS
  async getTags(ticketId: number) {
    const [rows]: any = await pool.query(
      'SELECT tag FROM ticket_tags WHERE ticket_id = ? ORDER BY tag ASC',
      [ticketId]
    );
    return rows.map((r: any) => r.tag);
  }

  async getTagsForTickets(ticketIds: number[]): Promise<Record<number, string[]>> {
    if (!ticketIds || ticketIds.length === 0) return {};
    
    const placeholders = ticketIds.map(() => '?').join(',');
    const [rows]: any = await pool.query(
      `SELECT ticket_id, tag FROM ticket_tags WHERE ticket_id IN (${placeholders}) ORDER BY tag ASC`,
      ticketIds
    );

    const map: Record<number, string[]> = {};
    rows.forEach((r: any) => {
      if (!map[r.ticket_id]) map[r.ticket_id] = [];
      map[r.ticket_id].push(r.tag);
    });
    return map;
  }

  normalizeTag(tag: string): string {
    return String(tag || '')
      .trim()
      .toLowerCase()
      .replace(/^#+/, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '')
      .slice(0, 50);
  }

  async addTag(ticketId: number, tag: string) {
    const normalized = this.normalizeTag(tag);
    if (!normalized) return;

    try {
      await pool.query(
        'INSERT IGNORE INTO ticket_tags (ticket_id, tag) VALUES (?, ?)',
        [ticketId, normalized]
      );
    } catch (e) {
      console.error('Error adding tag:', e);
    }
  }

  async removeTag(ticketId: number, tag: string) {
    await pool.query(
      'DELETE FROM ticket_tags WHERE ticket_id = ? AND tag = ?',
      [ticketId, tag]
    );
  }

  async setTags(ticketId: number, tags: string[]) {
    await pool.query('DELETE FROM ticket_tags WHERE ticket_id = ?', [ticketId]);
    const normalizedTags = Array.from(new Set((tags || []).map(tag => this.normalizeTag(tag)).filter(Boolean)));
    if (normalizedTags.length > 0) {
      const placeholders = normalizedTags.map(() => '(?, ?)').join(', ');
      const params = normalizedTags.flatMap(tag => [ticketId, tag]);
      await pool.query(
        `INSERT IGNORE INTO ticket_tags (ticket_id, tag) VALUES ${placeholders}`,
        params
      );
    }
  }

  // CUSTOM FIELDS
  async getCustomFields(ticketId: number) {
    const [rows]: any = await pool.query(
      'SELECT * FROM ticket_custom_fields WHERE ticket_id = ? ORDER BY field_label ASC',
      [ticketId]
    );
    return rows;
  }

  normalizeFieldKey(labelOrKey: string): string {
    return String(labelOrKey || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .substring(0, 80);
  }

  async updateCustomField(ticketId: number, field: any) {
    const key = this.normalizeFieldKey(field.field_key || field.field_label);
    if (!key) return;

    const label = String(field.field_label || key).substring(0, 120);
    const value = String(field.field_value || '').substring(0, 1000);

    await pool.query(
      `INSERT INTO ticket_custom_fields (ticket_id, field_key, field_label, field_value) 
       VALUES (?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE field_label = VALUES(field_label), field_value = VALUES(field_value)`,
      [ticketId, key, label, value]
    );
  }

  async setCustomFields(ticketId: number, fields: any[]) {
    if (!Array.isArray(fields)) return;
    
    // Se fields vier vazio, limpa tudo (ou podemos manter e só atualizar os que vierem)
    // O requisito diz: se fields vier vazio, remover todos campos do ticket.
    if (fields.length === 0) {
      await pool.query('DELETE FROM ticket_custom_fields WHERE ticket_id = ?', [ticketId]);
      return;
    }

    // Para um 'set' completo, poderíamos deletar e inserir, mas ON DUPLICATE KEY funciona se quisermos apenas sincronizar.
    // Mas para remover quem não está no array, precisamos de uma lógica extra ou deletar antes.
    await pool.query('DELETE FROM ticket_custom_fields WHERE ticket_id = ?', [ticketId]);

    const processedKeys = new Set<string>();
    const values: any[] = [];
    for (const field of fields) {
      const key = this.normalizeFieldKey(field.field_key || field.field_label);
      if (key && !processedKeys.has(key)) {
        const label = String(field.field_label || key).substring(0, 120);
        const value = String(field.field_value || '').substring(0, 1000);
        values.push(ticketId, key, label, value);
        processedKeys.add(key);
      }
    }

    if (values.length > 0) {
      const placeholders = Array.from({ length: values.length / 4 }, () => '(?, ?, ?, ?)').join(', ');
      await pool.query(
        `INSERT INTO ticket_custom_fields (ticket_id, field_key, field_label, field_value) VALUES ${placeholders}`,
        values
      );
    }
  }

  async removeCustomField(ticketId: number, fieldKey: string) {
    await pool.query(
      'DELETE FROM ticket_custom_fields WHERE ticket_id = ? AND field_key = ?',
      [ticketId, fieldKey]
    );
  }

  private async getStatusTransitionPermissionError(currentUser: any, empresaId: number, oldStatus: unknown, newStatus: unknown): Promise<string | null> {
    const oldValue = String(oldStatus || '');
    const newValue = String(newStatus || '');
    if (!newValue || oldValue === newValue) return null;

    const oldStatusConfig = await getTicketStatusConfig(empresaId, oldValue);
    const newStatusConfig = await getTicketStatusConfig(empresaId, newValue);
    const oldIsFinal = isFinalTicketStatusSpecial(oldStatusConfig?.especial);
    const newIsFinal = isFinalTicketStatusSpecial(newStatusConfig?.especial);

    if (oldIsFinal && !newIsFinal) {
      const hasReopenPerm = await permissionsService.hasPermission(currentUser, 'tickets.reabrir');
      if (!hasReopenPerm) return 'Sem permissao para reabrir chamados (tickets.reabrir).';
    }

    if (newStatusConfig?.especial === 'finalizado') {
      const hasFinalizePerm = await permissionsService.hasPermission(currentUser, 'tickets.finalizar');
      if (!hasFinalizePerm) return 'Sem permissao para finalizar chamados (tickets.finalizar).';
    }

    if (newStatusConfig?.especial === 'encerrado') {
      const hasClosePerm = await permissionsService.hasPermission(currentUser, 'tickets.fechar');
      if (!hasClosePerm) return 'Sem permissao para fechar chamados (tickets.fechar).';
    }

    return null;
  }

  private async getBulkActionPermissionError(action: string, value: any, currentUser: any, ticket: any): Promise<string | null> {
    const hasBulkPerm = await permissionsService.hasPermission(currentUser, 'tickets.acoes_em_massa');
    if (!hasBulkPerm) return 'Sem permissao para realizar acoes em massa (tickets.acoes_em_massa).';

    switch (action) {
      case 'status': {
        if (!isValidTicketStatus(value)) return 'Status invalido.';
        const hasStatusPerm = await permissionsService.hasPermission(currentUser, 'tickets.editar_status');
        if (!hasStatusPerm) return 'Sem permissao para alterar status (tickets.editar_status).';
        return this.getStatusTransitionPermissionError(currentUser, ticket.empresa_id, ticket.status, value);
      }
      case 'fechar':
        return await permissionsService.hasPermission(currentUser, 'tickets.fechar')
          ? null
          : 'Sem permissao para fechar chamados (tickets.fechar).';
      case 'prioridade': {
        const hasPriorityPerm = await permissionsService.hasPermission(currentUser, 'tickets.editar_prioridade');
        return hasPriorityPerm ? null : 'Sem permissao para alterar prioridade (tickets.editar_prioridade).';
      }
      case 'responsavel': {
        const wantsRemove = value === null || value === undefined || value === '';
        if (wantsRemove) {
          const hasRemovePerm = await permissionsService.hasPermission(currentUser, 'tickets.remover_responsavel');
          return hasRemovePerm ? null : 'Sem permissao para remover responsavel (tickets.remover_responsavel).';
        }

        const newResponsavelId = toPositiveInt(value);
        if (!newResponsavelId) return 'Responsavel invalido.';

        const isTakingUnassigned = !ticket.responsavel_id && Number(newResponsavelId) === Number(currentUser.id);
        const requiredPerm = isTakingUnassigned
          ? 'tickets.assumir'
          : ticket.responsavel_id
            ? 'tickets.transferir'
            : 'tickets.atribuir';
        const allowed = await permissionsService.hasPermission(currentUser, requiredPerm);
        return allowed ? null : `Sem permissao para alterar responsavel (${requiredPerm}).`;
      }
      case 'add_tag': {
        const hasTagPerm = await permissionsService.hasPermission(currentUser, 'tickets.gerenciar_tags');
        return hasTagPerm ? null : 'Sem permissao para gerenciar tags (tickets.gerenciar_tags).';
      }
      default:
        return 'Acao invalida.';
    }
  }

  // BULK ACTIONS
  async bulkUpdate(params: {
    ticketIds: number[];
    action: string;
    value?: any;
    currentUser: any;
  }) {
    const { ticketIds, action, value, currentUser } = params;
    
    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      return { updated: 0, skipped: 0, errors: ['Nenhum ticket informado'] };
    }

    // Limitar a 100 e remover duplicados
    const uniqueIds = Array.from(new Set(ticketIds.slice(0, 100))).map(id => Number(id)).filter(id => id > 0);
    
    if (uniqueIds.length === 0) {
      return { updated: 0, skipped: 0, errors: ['IDs inválidos'] };
    }

    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const id of uniqueIds) {
      try {
        const ticket = await this.getByIdForUser(id, currentUser);
        if (!ticket || ticket.error) {
          skipped++;
          errors.push(`Ticket #${id}: Acesso negado ou não encontrado.`);
          continue;
        }

        const permissionError = await this.getBulkActionPermissionError(action, value, currentUser, ticket);
        if (permissionError) {
          skipped++;
          errors.push(`Ticket #${id}: ${permissionError}`);
          continue;
        }

        switch (action) {
          case 'status':
            if (isValidTicketStatus(value)) {
              await this.updateStatus(id, value, currentUser.id);
              updated++;
            } else {
              skipped++;
            }
            break;
          case 'prioridade':
            const validPriorities = ['baixa', 'media', 'alta', 'urgente'];
            if (validPriorities.includes(value)) {
              await this.update(id, { prioridade: value });
              updated++;
            } else {
              skipped++;
            }
            break;
          case 'responsavel':
            const responsavelValue = value === undefined || value === '' ? null : value;
            // Se value for informado, verificar se o usuário existe e pertence à mesma empresa
            if (responsavelValue !== null) {
              const [agent]: any = await pool.query('SELECT id, empresa_id FROM usuarios WHERE id = ? AND ativo = 1', [responsavelValue]);
              if (!agent[0] || (!currentUser.desenvolvedor && agent[0].empresa_id !== ticket.empresa_id)) {
                skipped++;
                errors.push(`Ticket #${id}: Responsável inválido para esta empresa.`);
                continue;
              }
              // Verificar se o ticket pertence à empresa do agente (no caso de dev alterando múltiplos)
              if (agent[0].empresa_id !== ticket.empresa_id) {
                skipped++;
                errors.push(`Ticket #${id}: Responsável não pertence à empresa do ticket.`);
                continue;
              }
            }
            await this.update(id, { responsavel_id: responsavelValue });
            updated++;
            break;
          case 'add_tag':
            if (value) {
              await this.addTag(id, String(value));
              updated++;
            } else {
              skipped++;
            }
            break;
          case 'fechar':
            const closedStatus = await getClosedTicketStatusValue(ticket.empresa_id);
            if (!closedStatus) {
              skipped++;
              errors.push(`Ticket #${id}: Nenhum status especial "Encerrado" configurado para esta empresa.`);
              continue;
            }
            await this.updateStatus(id, closedStatus, currentUser.id);
            updated++;
            break;
          default:
            skipped++;
        }
      } catch (err: any) {
        skipped++;
        errors.push(`Erro no ticket #${id}: ${err.message || 'Erro desconhecido'}`);
      }
    }

    return { updated, skipped, errors };
  }

  async markAsRead(ticketId: number, usuarioId: number) {
    await pool.query(
      `INSERT INTO ticket_leituras (ticket_id, usuario_id, last_read_at) 
       VALUES (?, ?, NOW()) 
       ON DUPLICATE KEY UPDATE last_read_at = NOW()`,
      [ticketId, usuarioId]
    );
    return true;
  }

  async enrichTicketsWithProductivity(tickets: any[], currentUserId?: number) {
    if (tickets.length === 0) return tickets;

    const ticketIds = tickets.map(t => t.id);

    // (1) A "última mensagem pública" agora é MATERIALIZADA em tickets
    //     (ultima_mensagem_publica_em / ultima_mensagem_publica_origem +
    //     aguardando_resposta_atendente), mantida por utils/ticket-state.ts.
    //     A antiga subquery correlacionada foi removida daqui.

    // 2. Fetch last overall message for each ticket (for "last message in list")
    const [lastMessages]: any = await pool.query(`
      SELECT m.ticket_id, m.id as mensagem_id, m.usuario_id as mensagem_usuario_id, m.created_at as ultima_mensagem_em, 
             COALESCE(u.nome, t.solicitante_nome, 'Cliente') as ultima_mensagem_por_nome, m.interno as ultima_mensagem_interna
      FROM ticket_mensagens m
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      LEFT JOIN tickets t ON m.ticket_id = t.id
      WHERE m.id IN (
        SELECT MAX(id) FROM ticket_mensagens WHERE ticket_id IN (?) GROUP BY ticket_id
      )
    `, [ticketIds]);

    // 3. Fetch read receipts if currentUserId is provided
    let readReceiptsMap: Record<number, string> = {};
    if (currentUserId) {
      const [readRows]: any = await pool.query(
        'SELECT ticket_id, last_read_at FROM ticket_leituras WHERE usuario_id = ? AND ticket_id IN (?)',
        [currentUserId, ticketIds]
      );
      readReceiptsMap = readRows.reduce((acc: any, r: any) => {
        acc[r.ticket_id] = r.last_read_at;
        return acc;
      }, {});
    }

    const lastMsgMap = lastMessages.reduce((acc: any, m: any) => {
      acc[m.ticket_id] = m;
      return acc;
    }, {});

    const statusEmpresaIds = Array.from(new Set(
      tickets
        .map((ticket) => Number(ticket.empresa_id))
        .filter((empresaId) => Number.isFinite(empresaId) && empresaId > 0)
    ));
    const statusValues = Array.from(new Set(
      tickets
        .map((ticket) => String(ticket.status || '').trim())
        .filter(Boolean)
    ));
    const statusSpecialMap = new Map<string, string>();

    if (statusEmpresaIds.length > 0 && statusValues.length > 0) {
      const [statusRows]: any = await pool.query(
        `SELECT empresa_id, valor, especial
         FROM empresa_ticket_status
         WHERE empresa_id IN (?) AND valor IN (?)`,
        [statusEmpresaIds, statusValues]
      );

      for (const row of statusRows) {
        statusSpecialMap.set(`${Number(row.empresa_id)}:${row.valor}`, String(row.especial || 'normal'));
      }
    }

    tickets.forEach(t => {
      const lmAll = lastMsgMap[t.id];
      const lastRead = readReceiptsMap[t.id];
      const statusSpecial = statusSpecialMap.get(`${Number(t.empresa_id)}:${t.status}`) || 'normal';

      // Calculate estado_atendimento
      let estado: 'cliente_respondeu' | 'aguardando_cliente' | 'atendente_respondeu' | 'sem_resposta' | 'finalizado' = 'sem_resposta';
      
      if (isFinalTicketStatusSpecial(statusSpecial) || ['resolvido', 'fechado'].includes(t.status)) {
        estado = 'finalizado';
      } else if (isCustomerWaitingTicketStatusSpecial(statusSpecial) || t.status === 'aguardando_cliente') {
        estado = 'aguardando_cliente';
      } else if (!t.ultima_mensagem_publica_em) {
        estado = 'sem_resposta';
      } else if (t.ultima_mensagem_publica_origem === 'cliente') {
        estado = 'cliente_respondeu';
      } else {
        estado = 'atendente_respondeu';
      }

      t.estado_atendimento = estado;
      // precisa_resposta vem do campo materializado (fonte única: utils/ticket-state.ts)
      t.precisa_resposta = Number(t.aguardando_resposta_atendente) === 1;
      
      if (lmAll) {
        t.ultima_mensagem_em = lmAll.ultima_mensagem_em;
        t.ultima_mensagem_por_nome = lmAll.ultima_mensagem_por_nome;
        t.ultima_mensagem_interna = Number(lmAll.ultima_mensagem_interna) === 1;

        // "Unread" Logic
        if (currentUserId) {
          const isOwnMessage = Number(lmAll.mensagem_usuario_id) === Number(currentUserId);
          if (isOwnMessage) {
            t.nao_lido = false;
          } else {
            const lastMsgDate = new Date(lmAll.ultima_mensagem_em).getTime();
            const lastReadDate = lastRead ? new Date(lastRead).getTime() : 0;
            t.nao_lido = lastMsgDate > lastReadDate;
          }
        }
      } else {
        // Se sem mensagens, a última movimentação foi a criação
        t.ultima_mensagem_em = t.created_at;
        t.ultima_mensagem_por_nome = t.cliente_nome || 'Solicitante';
        t.ultima_mensagem_interna = false;
        
        if (currentUserId) {
          const isOwnTicket = Number(t.usuario_id) === Number(currentUserId);
          if (isOwnTicket) {
             t.nao_lido = false;
          } else {
             const creationDate = new Date(t.created_at).getTime();
             const lastReadDate = lastRead ? new Date(lastRead).getTime() : 0;
             t.nao_lido = creationDate > lastReadDate;
          }
        }
      }
    });

    return tickets;
  }
}

export default new TicketsService();
