import { RowDataPacket } from 'mysql2';
import pool from '../db/connection.js';
import { formatDateForMySQL } from '../utils/date-time.js';

export interface ReportFilters {
  start_date?: string;
  end_date?: string;
  empresa_id?: number;
  responsavel_id?: number;
  status?: string;
  prioridade?: string;
  categoria?: string;
  servico?: string;
  origem?: string;
}

export interface SummaryData {
  totals: {
    total_tickets: number;
    open_tickets: number;
    in_progress_tickets: number;
    resolved_tickets: number;
    closed_tickets: number;
    urgent_tickets: number;
    average_resolution_hours: number;
    average_first_response_hours: number;
    sla_compliance_first_response: number;
    sla_compliance_resolution: number;
    resolution_rate: number;
    reopen_rate: number;
  };
  csat: {
    average: number;
    total_reviews: number;
    score_distribution: { name: string; value: number }[];
  };
  by_status: { name: string; value: number }[];
  by_priority: { name: string; value: number }[];
  by_category: { name: string; value: number }[];
  by_service: { name: string; value: number }[];
  by_responsible: { name: string; value: number; avg_res?: number; total?: number }[];
  by_origin: { name: string; value: number }[];
  by_day: { date: string; created: number; resolved: number }[];
  rankings: {
    top_agents: { name: string; value: number }[];
    top_categories: { name: string; value: number }[];
  };
}

class ReportsService {
  private buildWhere(filters: ReportFilters, alias: string = ''): { clauses: string[], params: (string | number)[] } {
    const clauses: string[] = [];
    const params: (string | number)[] = [];
    const prefix = alias ? `${alias}.` : '';

    clauses.push(`${prefix}deleted_at IS NULL`);

    // Default 30 days if no date filter
    const startDate = filters.start_date || formatDateForMySQL(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const endDate = filters.end_date || formatDateForMySQL();

    clauses.push(`${prefix}created_at >= ? AND ${prefix}created_at <= ?`);
    params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);

    if (filters.empresa_id) {
      clauses.push(`${prefix}empresa_id = ?`);
      params.push(filters.empresa_id);
    }
    if (filters.responsavel_id) {
      clauses.push(`${prefix}responsavel_id = ?`);
      params.push(filters.responsavel_id);
    }
    if (filters.status) {
      clauses.push(`${prefix}status = ?`);
      params.push(filters.status);
    }
    if (filters.prioridade) {
      clauses.push(`${prefix}prioridade = ?`);
      params.push(filters.prioridade);
    }
    if (filters.categoria) {
      clauses.push(`${prefix}categoria = ?`);
      params.push(filters.categoria);
    }
    if (filters.servico) {
      clauses.push(`${prefix}servico = ?`);
      params.push(filters.servico);
    }
    if (filters.origem) {
      clauses.push(`${prefix}origem = ?`);
      params.push(filters.origem);
    }

    return { clauses, params };
  }

  async getSummary(filters: ReportFilters): Promise<SummaryData> {
    const { clauses, params } = this.buildWhere(filters);
    const whereString = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

    interface TotalRow extends RowDataPacket {
      total: number;
      open: number;
      in_progress: number;
      resolved: number;
      closed: number;
      urgent: number;
      avg_res_hours: number | null;
      avg_pr_hours: number | null;
      pr_cumprido: number;
      pr_total: number;
      res_cumprido: number;
      res_total: number;
      reabertos: number;
    };

    // 1. Totals
    const [totalsRows] = await pool.query<TotalRow[]>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'aberto' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status = 'em_andamento' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'resolvido' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN status = 'fechado' THEN 1 ELSE 0 END) as closed,
        SUM(CASE WHEN prioridade = 'urgente' THEN 1 ELSE 0 END) as urgent,
        AVG(CASE WHEN status IN ('resolvido', 'fechado') AND finalizado_em IS NOT NULL 
            THEN TIMESTAMPDIFF(HOUR, created_at, finalizado_em) 
            ELSE NULL END) as avg_res_hours,
        AVG(CASE WHEN primeira_resposta_em IS NOT NULL 
            THEN TIMESTAMPDIFF(HOUR, created_at, primeira_resposta_em) 
            ELSE NULL END) as avg_pr_hours,
        SUM(CASE WHEN sla_primeira_resposta_status = 'cumprido' THEN 1 ELSE 0 END) as pr_cumprido,
        SUM(CASE WHEN sla_primeira_resposta_status IN ('cumprido', 'violado') THEN 1 ELSE 0 END) as pr_total,
        SUM(CASE WHEN sla_resolucao_status = 'cumprido' THEN 1 ELSE 0 END) as res_cumprido,
        SUM(CASE WHEN sla_resolucao_status IN ('cumprido', 'violado') THEN 1 ELSE 0 END) as res_total,
        SUM(CASE WHEN reaberto_em IS NOT NULL THEN 1 ELSE 0 END) as reaberto
      FROM tickets
      ${whereString}
    `, params);

    const totals = totalsRows[0] || { 
      total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0, urgent: 0, avg_res_hours: 0, avg_pr_hours: 0,
      pr_cumprido: 0, pr_total: 0, res_cumprido: 0, res_total: 0, reaberto: 0
    };

    // 1.1 CSAT Metrics
    const { clauses: csatClauses, params: csatParams } = this.buildWhere(filters, 't');
    const csatWhereString = csatClauses.length > 0 ? `WHERE ${csatClauses.join(' AND ')}` : '';
    const [csatRows]: any = await pool.query(`
      SELECT 
        AVG(s.nota) as avg_score,
        COUNT(s.id) as total_reviews,
        SUM(CASE WHEN s.nota = 5 THEN 1 ELSE 0 END) as score_5,
        SUM(CASE WHEN s.nota = 4 THEN 1 ELSE 0 END) as score_4,
        SUM(CASE WHEN s.nota = 3 THEN 1 ELSE 0 END) as score_3,
        SUM(CASE WHEN s.nota = 2 THEN 1 ELSE 0 END) as score_2,
        SUM(CASE WHEN s.nota = 1 THEN 1 ELSE 0 END) as score_1
      FROM ticket_satisfacao s
      JOIN tickets t ON s.ticket_id = t.id
      ${csatWhereString} AND s.respondido_em IS NOT NULL
    `, csatParams);

    const csatData = csatRows[0] || { avg_score: 0, total_reviews: 0 };
    const score_distribution = [
      { name: '5 Estrelas', value: Number(csatRows[0]?.score_5 || 0) },
      { name: '4 Estrelas', value: Number(csatRows[0]?.score_4 || 0) },
      { name: '3 Estrelas', value: Number(csatRows[0]?.score_3 || 0) },
      { name: '2 Estrelas', value: Number(csatRows[0]?.score_2 || 0) },
      { name: '1 Estrela', value: Number(csatRows[0]?.score_1 || 0) },
    ];

    interface GroupedRow extends RowDataPacket { name: string | null; value: number };

    // 2. Distributions
    const [statusRows] = await pool.query<GroupedRow[]>(`
      SELECT status as name, COUNT(*) as value FROM tickets ${whereString} GROUP BY status
    `, params);

    const [priorityRows] = await pool.query<GroupedRow[]>(`
      SELECT prioridade as name, COUNT(*) as value FROM tickets ${whereString} GROUP BY prioridade
    `, params);

    const [categoryRows] = await pool.query<GroupedRow[]>(`
      SELECT categoria as name, COUNT(*) as value FROM tickets ${whereString} GROUP BY categoria
    `, params);

    const [serviceRows] = await pool.query<GroupedRow[]>(`
      SELECT servico as name, COUNT(*) as value FROM tickets ${whereString} GROUP BY servico
    `, params);
    
    const [originRows] = await pool.query<GroupedRow[]>(`
      SELECT origem as name, COUNT(*) as value FROM tickets ${whereString} GROUP BY origem
    `, params);

    // 5. By Responsible (Detailed)
    const { clauses: resClauses, params: resParams } = this.buildWhere(filters, 't');
    const resWhereString = resClauses.length > 0 ? `WHERE ${resClauses.join(' AND ')}` : '';

    const [responsibleRows]: any = await pool.query(`
      SELECT 
        u.nome as name, 
        COUNT(t.id) as total,
        AVG(CASE WHEN t.status IN ('resolvido', 'fechado') AND t.finalizado_em IS NOT NULL 
            THEN TIMESTAMPDIFF(HOUR, t.created_at, t.finalizado_em) 
            ELSE NULL END) as avg_res
      FROM tickets t
      LEFT JOIN usuarios u ON t.responsavel_id = u.id
      ${resWhereString}
      GROUP BY u.nome
      ORDER BY total DESC
    `, resParams);

    // 6. By Day
    interface DayRow extends RowDataPacket { date: Date | string; created: number };
    const [dayRows] = await pool.query<DayRow[]>(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as created
      FROM tickets
      ${whereString}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, params);

    // Resolutions by day
    const startDate = filters.start_date || formatDateForMySQL(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const endDate = filters.end_date || formatDateForMySQL();
    
    let resClausesList = ['deleted_at IS NULL', 'finalizado_em >= ?', 'finalizado_em <= ?'];
    let resParamsList: (string | number)[] = [`${startDate} 00:00:00`, `${endDate} 23:59:59`];
    
    if (filters.empresa_id) { resClausesList.push('empresa_id = ?'); resParamsList.push(filters.empresa_id); }
    if (filters.responsavel_id) { resClausesList.push('responsavel_id = ?'); resParamsList.push(filters.responsavel_id); }
    if (filters.status) { resClausesList.push('status = ?'); resParamsList.push(filters.status); }
    if (filters.prioridade) { resClausesList.push('prioridade = ?'); resParamsList.push(filters.prioridade); }
    if (filters.categoria) { resClausesList.push('categoria = ?'); resParamsList.push(filters.categoria); }
    if (filters.servico) { resClausesList.push('servico = ?'); resParamsList.push(filters.servico); }
    if (filters.origem) { resClausesList.push('origem = ?'); resParamsList.push(filters.origem); }

    interface ResDayRow extends RowDataPacket { date: Date | string; resolved: number };
    const [resDayRows] = await pool.query<ResDayRow[]>(`
      SELECT 
        DATE(finalizado_em) as date,
        COUNT(*) as resolved
      FROM tickets
      WHERE ${resClausesList.join(' AND ')}
      AND finalizado_em IS NOT NULL
      GROUP BY DATE(finalizado_em)
      ORDER BY date ASC
    `, resParamsList);

    const dayMap = new Map<string, { date: string; created: number; resolved: number }>();
    dayRows.forEach((r) => {
      const d = r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date);
      dayMap.set(d, { date: d, created: Number(r.created), resolved: 0 });
    });
    resDayRows.forEach((r) => {
      const d = r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date);
      if (dayMap.has(d)) {
        dayMap.get(d)!.resolved = Number(r.resolved);
      } else {
        dayMap.set(d, { date: d, created: 0, resolved: Number(r.resolved) });
      }
    });

    const by_day = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return {
      totals: {
        total_tickets: Number(totals.total || 0),
        open_tickets: Number(totals.open || 0),
        in_progress_tickets: Number(totals.in_progress || 0),
        resolved_tickets: Number(totals.resolved || 0),
        closed_tickets: Number(totals.closed || 0),
        urgent_tickets: Number(totals.urgent || 0),
        average_resolution_hours: Math.round(Number(totals.avg_res_hours || 0) * 10) / 10,
        average_first_response_hours: Math.round(Number(totals.avg_pr_hours || 0) * 10) / 10,
        sla_compliance_first_response: totals.pr_total > 0 ? Math.round((totals.pr_cumprido / totals.pr_total) * 100) : 100,
        sla_compliance_resolution: totals.res_total > 0 ? Math.round((totals.res_cumprido / totals.res_total) * 100) : 100,
        resolution_rate: totals.total > 0 ? Math.round(((Number(totals.resolved) + Number(totals.closed)) / totals.total) * 100) : 0,
        reopen_rate: totals.total > 0 ? Math.round((Number(totals.reaberto) / totals.total) * 100) : 0
      },
      csat: {
        average: Math.round(Number(csatData.avg_score || 0) * 10) / 10,
        total_reviews: Number(csatData.total_reviews || 0),
        score_distribution
      },
      by_status: statusRows.map((r) => ({ name: this.translateStatus(r.name || 'Indefinido'), value: Number(r.value) })),
      by_priority: priorityRows.map((r) => ({ name: this.translatePriority(r.name || 'baixa'), value: Number(r.value) })),
      by_category: categoryRows.map((r) => ({ name: r.name || 'Sem Categoria', value: Number(r.value) })),
      by_service: serviceRows.map((r) => ({ name: r.name || 'Sem Servico', value: Number(r.value) })),
      by_origin: originRows.map((r) => ({ name: r.name || 'Chat / Interno', value: Number(r.value) })),
      by_responsible: responsibleRows.map((r: any) => ({ name: r.name || 'Sem Responsável', value: Number(r.total), avg_res: Math.round(r.avg_res * 10) / 10 })),
      by_day,
      rankings: {
        top_agents: responsibleRows.slice(0, 5).map((r: any) => ({ name: r.name || 'N/A', value: Number(r.total) })),
        top_categories: categoryRows.sort((a, b) => b.value - a.value).slice(0, 5).map(r => ({ name: r.name || 'N/A', value: Number(r.value) }))
      }
    };
  }

  private translateStatus(status: string) {
    const map: Record<string, string> = {
      'aberto': 'Aberto',
      'em_andamento': 'Em Andamento',
      'aguardando_cliente': 'Aguardando Cliente',
      'resolvido': 'Resolvido',
      'fechado': 'Fechado'
    };
    return map[status] || status;
  }

  private translatePriority(priority: string) {
    const map: Record<string, string> = {
      'baixa': 'Baixa',
      'media': 'Média',
      'alta': 'Alta',
      'urgente': 'Urgente'
    };
    return map[priority] || priority;
  }

  async getReportData(filters: ReportFilters) {
    const { clauses, params } = this.buildWhere(filters, 't');
    const whereString = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

    const [stats]: any = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN t.status = 'resolvido' OR t.status = 'fechado' THEN 1 ELSE 0 END) as resolvidos
      FROM tickets t
      ${whereString}
    `, params);

    const metrics = {
      total: stats[0].total || 0,
      resolvidos: stats[0].resolvidos || 0,
      taxaResolucao: stats[0].total > 0 ? Math.round((stats[0].resolvidos / stats[0].total) * 100) : 0
    };

    const [tickets]: any = await pool.query(`
      SELECT 
        t.id, t.titulo, t.status, t.prioridade, t.categoria, t.created_at,
        e.nome as empresa_nome, u.nome as cliente_nome, r.nome as responsavel_nome
      FROM tickets t
      LEFT JOIN empresas e ON t.empresa_id = e.id
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      LEFT JOIN usuarios r ON t.responsavel_id = r.id
      ${whereString}
      ORDER BY t.created_at DESC
    `, params);

    return { metrics, tickets };
  }

  async exportCSV(filters: ReportFilters, type: string): Promise<string> {
    const { clauses, params } = this.buildWhere(filters, 't');
    const whereString = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

    let query = '';
    
    if (type === 'tickets') {
      query = `
        SELECT t.id, t.titulo, t.status, t.prioridade, t.categoria, t.servico, t.origem,
               r.nome as responsavel, t.solicitante_nome as cliente, e.nome as empresa,
               DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') as criado_em,
               DATE_FORMAT(t.primeira_resposta_em, '%Y-%m-%d %H:%i:%s') as primeira_resposta_em,
               DATE_FORMAT(t.finalizado_em, '%Y-%m-%d %H:%i:%s') as finalizado_em,
               DATE_FORMAT(t.prazo_sla, '%Y-%m-%d %H:%i:%s') as prazo_sla,
               t.sla_resolucao_status,
               s.nota as csat_nota
        FROM tickets t
        LEFT JOIN usuarios r ON t.responsavel_id = r.id
        LEFT JOIN empresas e ON t.empresa_id = e.id
        LEFT JOIN ticket_satisfacao s ON s.ticket_id = t.id
        ${whereString}
        ORDER BY t.created_at DESC
      `;
    } else if (type === 'agents') {
      query = `
        SELECT u.nome as atendente,
               COUNT(t.id) as total_tickets,
               SUM(CASE WHEN t.status = 'aberto' THEN 1 ELSE 0 END) as abertos,
               SUM(CASE WHEN t.status IN ('resolvido', 'fechado') THEN 1 ELSE 0 END) as resolvidos,
               AVG(CASE WHEN t.status IN ('resolvido', 'fechado') THEN TIMESTAMPDIFF(HOUR, t.created_at, t.finalizado_em) ELSE NULL END) as avg_resolution_hours
        FROM tickets t
        LEFT JOIN usuarios u ON t.responsavel_id = u.id
        ${whereString}
        GROUP BY u.nome
      `;
    } else if (type === 'satisfaction') {
      query = `
        SELECT s.ticket_id, t.titulo, s.nota, s.comentario, 
               DATE_FORMAT(s.respondido_em, '%Y-%m-%d %H:%i:%s') as respondido_em
        FROM ticket_satisfacao s
        JOIN tickets t ON s.ticket_id = t.id
        ${whereString.replace(/t\./g, 't.')} AND s.respondido_em IS NOT NULL
        ORDER BY s.respondido_em DESC
      `;
    } else {
      query = `SELECT t.id, t.titulo, t.status, t.prioridade FROM tickets t ${whereString}`;
    }

    const [rows]: any = await pool.query(query, params);
    if (rows.length === 0) return 'Nenhum registro encontrado\n';

    const headers = Object.keys(rows[0]);
    let csv = headers.join(';') + '\n';

    for (const row of rows) {
      const line = headers.map(header => {
        let val = row[header];
        if (val === null || val === undefined) val = '';
        if (typeof val === 'string') {
          val = val.replace(/"/g, '""');
          if (val.includes(';') || val.includes('\n')) val = `"${val}"`;
        }
        return val;
      });
      csv += line.join(';') + '\n';
    }

    return csv;
  }

  async getDashboardStats(user: any) {
    const isDev = !!user.desenvolvedor;
    const userId = user.id;
    const empresaId = user.empresa_id;

    let whereClause = '';
    let params: any[] = [];

    if (!isDev) {
      if (user.administrador && empresaId) {
        whereClause = 'WHERE deleted_at IS NULL AND empresa_id = ?';
        params.push(empresaId);
      } else {
        whereClause = 'WHERE deleted_at IS NULL AND usuario_id = ?';
        params.push(userId);
      }
    } else {
      whereClause = 'WHERE deleted_at IS NULL';
    }

    const [countsRows]: any = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'aberto' THEN 1 ELSE 0 END) as aberto,
        SUM(CASE WHEN status = 'em_andamento' THEN 1 ELSE 0 END) as em_andamento,
        SUM(CASE WHEN status = 'aguardando_cliente' THEN 1 ELSE 0 END) as aguardando_cliente,
        SUM(CASE WHEN status = 'resolvido' THEN 1 ELSE 0 END) as resolvido,
        SUM(CASE WHEN status = 'fechado' THEN 1 ELSE 0 END) as fechado,
        SUM(CASE WHEN prioridade = 'urgente' THEN 1 ELSE 0 END) as urgente,
        AVG(CASE WHEN status IN ('resolvido', 'fechado') AND finalizado_em IS NOT NULL THEN TIMESTAMPDIFF(HOUR, created_at, finalizado_em) ELSE NULL END) as avg_res
      FROM tickets
      ${whereClause}
    `, params);

    const counts = countsRows[0] || {};
    
    const [byStatus]: any = await pool.query(`
      SELECT status, COUNT(*) as qtd
      FROM tickets
      ${whereClause}
      GROUP BY status
    `, params);

    const [byPriority]: any = await pool.query(`
      SELECT prioridade, COUNT(*) as qtd
      FROM tickets
      ${whereClause}
      GROUP BY prioridade
      ORDER BY qtd DESC
    `, params);

    const [recentTickets]: any = await pool.query(`
      SELECT t.id, t.titulo, t.status, t.prioridade, t.created_at, u.nome as cliente_nome
      FROM tickets t
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      ${whereClause.replace(/empresa_id/g, 't.empresa_id').replace(/usuario_id/g, 't.usuario_id')}
      ORDER BY t.created_at DESC
      LIMIT 5
    `, params);

    let logWhere = 'WHERE 1=1';
    let logParams = [];
    if (!isDev) {
      if (user.administrador && empresaId) {
        logWhere += ' AND l.empresa_id = ?';
        logParams.push(empresaId);
      } else {
        logWhere += ' AND l.usuario_id = ?';
        logParams.push(userId);
      }
    }

    const [recentActivities]: any = await pool.query(`
      SELECT l.id, l.acao, l.created_at, u.nome as usuario_nome
      FROM logs_sistema l
      LEFT JOIN usuarios u ON l.usuario_id = u.id
      ${logWhere}
      ORDER BY l.created_at DESC
      LIMIT 5
    `, logParams);

    return {
      counts: {
        ...counts,
        total: Number(counts.total || 0),
        aberto: Number(counts.aberto || 0),
        em_andamento: Number(counts.em_andamento || 0),
        aguardando_cliente: Number(counts.aguardando_cliente || 0),
        resolvido: Number(counts.resolvido || 0),
        fechado: Number(counts.fechado || 0),
        urgente: Number(counts.urgente || 0),
        tempo_medio_resolucao: counts.avg_res ? `${Math.round(counts.avg_res)}h` : '0h'
      },
      byStatus,
      byPriority,
      recentTickets,
      recentActivities
    };
  }
}

export default new ReportsService();
