import pool from '../db/connection.js';
import { recordTicketEvent } from './ticket-events.service.js';
import {
  isCustomerWaitingTicketStatusSpecial,
  isFinalTicketStatusSpecial,
  normalizeTicketStatusSpecial
} from '../utils/ticket-status-config.js';
import { formatDateTimeForMySQL } from '../utils/date-time.js';

export type SlaStatusOperacional = 'dentro_sla' | 'vencendo' | 'vencido' | 'pausado' | 'cumprido' | 'violado' | 'sem_sla';

class SlaService {
  /**
   * Calculates the operational status based on ticket data
   */
  calculateOperationalStatus(ticket: any): SlaStatusOperacional {
    const statusSpecial = normalizeTicketStatusSpecial(ticket.status_especial || ticket.especial);

    if (isFinalTicketStatusSpecial(statusSpecial) || ['resolvido', 'fechado'].includes(ticket.status)) {
      return ticket.sla_resolucao_status === 'cumprido' ? 'cumprido' : 'violado';
    }

    if (
      ticket.sla_pausado_em
      || isCustomerWaitingTicketStatusSpecial(statusSpecial)
      || ticket.status === 'aguardando_cliente'
      || ticket.sla_status_operacional === 'pausado'
    ) {
      return 'pausado';
    }

    if (!ticket.prazo_sla) {
      return 'sem_sla';
    }

    const agora = new Date();
    const prazo = new Date(ticket.prazo_sla);

    if (agora > prazo) {
      return 'vencido';
    }

    // Threshold for "vencendo" (e.g., 2 hours before deadline)
    const threshold = new Date(agora);
    threshold.setHours(threshold.getHours() + 2);

    if (prazo <= threshold) {
      return 'vencendo';
    }

    return 'dentro_sla';
  }

  /**
   * Pauses SLA for a ticket
   */
  async pauseSla(ticketId: number, usuarioId: number | null = null) {
    const [rows]: any = await pool.query('SELECT * FROM tickets WHERE id = ? AND deleted_at IS NULL', [ticketId]);
    const ticket = rows[0];

    if (!ticket || ticket.sla_pausado_em) return;

    await pool.query(
      'UPDATE tickets SET sla_pausado_em = NOW(), sla_status_operacional = "pausado", updated_at = NOW() WHERE id = ? AND deleted_at IS NULL',
      [ticketId]
    );

    await recordTicketEvent({
      ticket_id: ticketId,
      empresa_id: ticket.empresa_id,
      usuario_id: usuarioId,
      tipo: 'sla_pausado',
      descricao: 'SLA pausado enquanto aguarda resposta do cliente'
    });
  }

  /**
   * Resumes SLA for a ticket and adjusts the deadline
   */
  async resumeSla(ticketId: number, usuarioId: number | null = null) {
    const [rows]: any = await pool.query(
      `SELECT t.*, status_cfg.especial as status_especial
       FROM tickets t
       LEFT JOIN empresa_ticket_status status_cfg
         ON status_cfg.empresa_id = t.empresa_id
        AND status_cfg.valor = t.status
       WHERE t.id = ? AND t.deleted_at IS NULL`,
      [ticketId]
    );
    const ticket = rows[0];

    if (!ticket || !ticket.sla_pausado_em) return;

    const agora = new Date();
    const pausadoEm = new Date(ticket.sla_pausado_em);
    const diffMs = agora.getTime() - pausadoEm.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    let novoPrazoSla: string | null = null;
    if (ticket.prazo_sla) {
      const prazoOriginal = new Date(ticket.prazo_sla);
      novoPrazoSla = formatDateTimeForMySQL(new Date(prazoOriginal.getTime() + diffMs));
    }

    const totalPausado = (ticket.sla_pausado_total_minutos || 0) + diffMins;

    const updatedTicket = { ...ticket, sla_pausado_em: null, sla_pausado_total_minutos: totalPausado, prazo_sla: novoPrazoSla };
    const novoStatusOperacional = this.calculateOperationalStatus(updatedTicket);

    await pool.query(
      `UPDATE tickets 
       SET sla_pausado_em = NULL, 
           sla_pausado_total_minutos = ?, 
           prazo_sla = ?, 
           sla_status_operacional = ?, 
           updated_at = NOW() 
       WHERE id = ? AND deleted_at IS NULL`,
      [totalPausado, novoPrazoSla, novoStatusOperacional, ticketId]
    );

    await recordTicketEvent({
      ticket_id: ticketId,
      empresa_id: ticket.empresa_id,
      usuario_id: usuarioId,
      tipo: 'sla_retomado',
      descricao: `SLA retomado após resposta do cliente (${diffMins} minutos pausados nesta etapa)`
    });
  }

  /**
   * Updates only the operational status field based on current data
   */
  async updateOperationalStatus(ticketId: number) {
    const [rows]: any = await pool.query(
      `SELECT t.*, status_cfg.especial as status_especial
       FROM tickets t
       LEFT JOIN empresa_ticket_status status_cfg
         ON status_cfg.empresa_id = t.empresa_id
        AND status_cfg.valor = t.status
       WHERE t.id = ? AND t.deleted_at IS NULL`,
      [ticketId]
    );
    const ticket = rows[0];
    if (!ticket) return;

    const status = this.calculateOperationalStatus(ticket);
    await pool.query('UPDATE tickets SET sla_status_operacional = ? WHERE id = ? AND deleted_at IS NULL', [status, ticketId]);
  }
}

export default new SlaService();
