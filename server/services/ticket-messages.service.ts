import pool from '../db/connection.js';
import { recordTicketEvent } from './ticket-events.service.js';
import notificationsService from './notifications.service.js';
import { emailOutboxService } from './email-outbox.service.js';
import { io } from '../server.js';
import slaService from './sla.service.js';
import { recomputeTicketMessageState } from '../utils/ticket-state.js';
import { maskIdentifier } from '../utils/sanitize.js';
import { formatDateTimeForMySQL } from '../utils/date-time.js';
import {
  getInitialTicketStatusValue,
  getInProgressTicketStatusValue,
  getTicketStatusConfig,
  isCustomerWaitingTicketStatusSpecial,
  isFinalTicketStatusSpecial
} from '../utils/ticket-status-config.js';

export interface AddMessageData {
  ticket_id: number;
  usuario_id: number | null;
  mensagem: string;
  interno: boolean;
  message_id?: string | null;
  empresa_id?: number | null;
  tipo?: string;
  suppressEmailNotification?: boolean;
}

class TicketMessagesService {
  /**
   * Centralized method to add a message to a ticket.
   * Handles status updates, SLA, notifications, events and real-time updates.
   */
  async addMessage(data: AddMessageData, currentUser?: any) {
    const { ticket_id, usuario_id, mensagem, interno, message_id, empresa_id, tipo = 'texto' } = data;
    const suppressEmailNotification = !!data.suppressEmailNotification;

    if (!mensagem || mensagem.trim() === '') {
      throw new Error('A mensagem não pode estar vazia');
    }

    // 1. Validate Ticket and Access - Using direct query to avoid circular dependency with ticketsService
    const [ticketRows]: any = await pool.query(
      `SELECT t.*, 
              COALESCE(t.solicitante_nome, u.nome, 'Cliente') as cliente_nome,
              COALESCE(t.solicitante_email, u.email, 'removido@sistema.com') as cliente_email
       FROM tickets t
       LEFT JOIN usuarios u ON t.usuario_id = u.id
       WHERE t.id = ? AND t.deleted_at IS NULL`,
      [ticket_id]
    );

    const ticket = ticketRows[0];
    if (!ticket) {
      throw new Error('Chamado não encontrado');
    }

    if (empresa_id !== undefined && empresa_id !== null && Number(empresa_id) !== Number(ticket.empresa_id)) {
      throw new Error('Acesso negado: este chamado pertence a outra empresa');
    }

    const isDev = !!currentUser?.desenvolvedor;
    const isAdmin = !!currentUser?.administrador;
    const isManager = currentUser?.perfil === 'gestor';
    const isStaff = currentUser?.perfil === 'atendente';
    const isAgent = isDev || isAdmin || isManager || isStaff;

    if (currentUser) {
      // Data isolation check
      if (!isDev && Number(currentUser.empresa_id) !== Number(ticket.empresa_id)) {
        throw new Error('Acesso negado: este chamado pertence a outra empresa');
      }

      // Customer specific check
      const currentUserId = Number(currentUser?.id || 0);
      const currentUserEmail = typeof currentUser?.email === 'string'
        ? currentUser.email.trim().toLowerCase()
        : '';
      const ticketRequesterEmail = typeof ticket.solicitante_email === 'string'
        ? ticket.solicitante_email.trim().toLowerCase()
        : '';
      const isTicketOwnerUser = currentUserId > 0
        && ticket.usuario_id !== null
        && Number(ticket.usuario_id) === currentUserId;
      const isTicketOwnerEmail = currentUserEmail !== ''
        && ticketRequesterEmail !== ''
        && currentUserEmail === ticketRequesterEmail;

      if (!isAgent && !isTicketOwnerUser && !isTicketOwnerEmail) {
        throw new Error('Acesso negado: este chamado pertence a outro usuário');
      }
    }

    // Security: Only agents can create internal messages
    const finalInterno = isAgent ? interno : false;

    if (message_id) {
      const [existingMessage]: any = await pool.query(
        `SELECT m.id
         FROM ticket_mensagens m
         INNER JOIN tickets t ON t.id = m.ticket_id
         WHERE m.message_id = ? AND t.empresa_id = ? AND t.deleted_at IS NULL
         LIMIT 1`,
        [message_id, ticket.empresa_id]
      );

      if (existingMessage.length > 0) {
        console.warn(`[TicketMessagesService] Duplicate message_id ignored: ${maskIdentifier(message_id)}`);
        return existingMessage[0].id;
      }
    }

    if (!currentUser && !finalInterno) {
      const [recentSameMessage]: any = await pool.query(
        `SELECT id
         FROM ticket_mensagens
         WHERE ticket_id = ?
           AND usuario_id <=> ?
           AND interno = 0
           AND mensagem = ?
           AND created_at >= (NOW() - INTERVAL 5 MINUTE)
         ORDER BY id DESC
         LIMIT 1`,
        [ticket_id, usuario_id || null, mensagem]
      );

      if (recentSameMessage.length > 0) {
        console.warn(`[TicketMessagesService] Recent duplicate inbound message ignored for ticket #${ticket_id}.`);
        return recentSameMessage[0].id;
      }
    }

    if (currentUser) {
      const [recentSameUserMessage]: any = await pool.query(
        `SELECT id
         FROM ticket_mensagens
         WHERE ticket_id = ?
           AND usuario_id <=> ?
           AND interno = ?
           AND tipo = ?
           AND mensagem = ?
           AND created_at >= (NOW() - INTERVAL 10 SECOND)
         ORDER BY id DESC
         LIMIT 1`,
        [ticket_id, usuario_id || null, finalInterno ? 1 : 0, tipo, mensagem]
      );

      if (recentSameUserMessage.length > 0) {
        console.warn(`[TicketMessagesService] Recent duplicate user message ignored for ticket #${ticket_id}.`);
        return recentSameUserMessage[0].id;
      }
    }

    // 2. Create the message
    console.log(`[TicketMessagesService] Adding message: ticket_id=${ticket_id}, usuario_id=${usuario_id}, interno=${finalInterno}, message_id=${maskIdentifier(message_id)}, tipo=${tipo}`);
    const [result]: any = await pool.query(
      'INSERT INTO ticket_mensagens (ticket_id, usuario_id, mensagem, interno, message_id, tipo) VALUES (?, ?, ?, ?, ?, ?)',
      [ticket_id, usuario_id || null, mensagem, finalInterno ? 1 : 0, message_id || null, tipo]
    );
    const messageId = result.insertId;

    // 3. Track processed email to avoid duplicates
    if (message_id) {
      await pool.query(
        'INSERT IGNORE INTO processed_emails (message_id, empresa_id, ticket_id) VALUES (?, ?, ?)',
        [message_id, ticket.empresa_id, ticket_id]
      );
    }

    // 4. Update ticket: updated_at
    await pool.query('UPDATE tickets SET updated_at = NOW() WHERE id = ? AND deleted_at IS NULL', [ticket_id]);

    // 5. Business Logic: Status, SLA and Notifications
    try {
      const isExternalEmail = !!message_id;
      const isPortalCustomer = !!currentUser && !isAgent && currentUser?.perfil === 'cliente';
      const messageUserId = usuario_id !== null && usuario_id !== undefined ? Number(usuario_id) : null;
      const ticketRequesterId = ticket.usuario_id !== null && ticket.usuario_id !== undefined ? Number(ticket.usuario_id) : null;

      // Public messages with NULL author are client messages by the canonical ticket-state rule.
      const isClient = !finalInterno && (
        (messageUserId !== null && ticketRequesterId !== null && messageUserId === ticketRequesterId) ||
        (usuario_id === null && (isExternalEmail || isPortalCustomer || !currentUser))
      );
      
      // A response from agent is public, not from the client, and written by an agent user.
      const isAgentResponse = !finalInterno && !isClient && isAgent;
      let ticketStatusConfig = await getTicketStatusConfig(ticket.empresa_id, ticket.status);
      let ticketIsFinal = isFinalTicketStatusSpecial(ticketStatusConfig?.especial) || ['resolvido', 'fechado'].includes(ticket.status);
      let ticketIsCustomerWaiting = isCustomerWaitingTicketStatusSpecial(ticketStatusConfig?.especial) || ticket.status === 'aguardando_cliente';

      if (isClient && ticketIsFinal) {
        const reopenedByUserId = messageUserId && messageUserId > 0 ? messageUserId : null;
        const reopenedStatus = await getInitialTicketStatusValue(ticket.empresa_id);
        await pool.query(
          'UPDATE tickets SET status = ?, finalizado_em = NULL, reaberto_em = NOW(), reaberto_por = ?, updated_at = NOW() WHERE id = ?',
          [reopenedStatus, reopenedByUserId, ticket_id]
        );
        await recordTicketEvent({
          ticket_id,
          empresa_id: ticket.empresa_id,
          usuario_id: reopenedByUserId,
          tipo: 'ticket_reaberto',
          descricao: 'Chamado reaberto automaticamente por resposta do cliente'
        });
        ticket.status = reopenedStatus;
        ticket.finalizado_em = null;
        ticketStatusConfig = await getTicketStatusConfig(ticket.empresa_id, ticket.status);
        ticketIsFinal = isFinalTicketStatusSpecial(ticketStatusConfig?.especial) || ['resolvido', 'fechado'].includes(ticket.status);
        ticketIsCustomerWaiting = isCustomerWaitingTicketStatusSpecial(ticketStatusConfig?.especial) || ticket.status === 'aguardando_cliente';
      }
      
      if (!ticketIsFinal) {
        
        // A) SLA Primera Resposta (only if from agent and public)
        if (isAgentResponse && !ticket.primeira_resposta_em) {
          const agora = new Date();
          const agoraFormatado = formatDateTimeForMySQL(agora);
          let prStatus = 'cumprido';
          
          if (ticket.prazo_primeira_resposta) {
            const prazoPR = new Date(ticket.prazo_primeira_resposta);
            if (agora > prazoPR) prStatus = 'violado';
          }

          await pool.query(
            'UPDATE tickets SET primeira_resposta_em = ?, sla_primeira_resposta_status = ? WHERE id = ?',
            [agoraFormatado, prStatus, ticket_id]
          );

          await recordTicketEvent({
            ticket_id,
            empresa_id: ticket.empresa_id,
            usuario_id,
            tipo: 'primeira_resposta_registrada',
            descricao: `Primeira resposta registrada em ${agoraFormatado} (${prStatus === 'cumprido' ? 'Dentro do prazo' : 'Fora do prazo'})`
          });
        }

        // B) Status Transitions
        if (isAgentResponse) {
          if (ticketStatusConfig?.especial === 'inicial' || ticket.status === 'aberto') {
            const nextStatus = await getInProgressTicketStatusValue(ticket.empresa_id);
            await pool.query('UPDATE tickets SET status = ? WHERE id = ?', [nextStatus, ticket_id]);
            await slaService.updateOperationalStatus(ticket_id);
            await recordTicketEvent({
              ticket_id,
              empresa_id: ticket.empresa_id,
              usuario_id,
              tipo: 'status_alterado',
              descricao: 'Status alterado pela resposta pública do atendente'
            });
            ticket.status = nextStatus;
          }
        } else if (isClient) {
          if (ticketIsCustomerWaiting) {
            const nextStatus = await getInProgressTicketStatusValue(ticket.empresa_id);
            await pool.query('UPDATE tickets SET status = ? WHERE id = ?', [nextStatus, ticket_id]);
            await slaService.resumeSla(ticket_id, usuario_id);
            await recordTicketEvent({
              ticket_id,
              empresa_id: ticket.empresa_id,
              usuario_id,
              tipo: 'status_alterado',
              descricao: 'Status alterado pela resposta do cliente'
            });
            ticket.status = nextStatus;
          } else {
            await slaService.updateOperationalStatus(ticket_id);
          }
        }
      }

      // C) Notifications
      const [author]: any = await pool.query('SELECT nome FROM usuarios WHERE id = ?', [usuario_id]);
      const authorName = author[0]?.nome || (isExternalEmail ? (ticket.cliente_nome || 'Cliente Externo') : 'Sistema');

      const recipients = new Set<number>();
      
      // 1. Notify Client (if agent responds publicly)
      if (!finalInterno && isAgentResponse) {
        // If there's a registered user, add to in-app notifications
        if (ticket.usuario_id) {
          recipients.add(ticket.usuario_id);
        }

        // Send email to the external contact or registered user email
        if (!suppressEmailNotification && ticket.cliente_email && ticket.cliente_email !== 'removido@sistema.com') {
          // Get the original messageId from the ticket or the latest message for threading
          const replyToId = ticket.message_id;
          
          const outboundMessageId = `<ticket-${ticket_id}-msg-${messageId}@gestifique.com.br>`;
          console.log(`[TicketMessagesService] Generated outboundMessageId: ${maskIdentifier(outboundMessageId)}`);
          
          try {
            await emailOutboxService.enqueueTicketEmail({
              to: ticket.cliente_email,
              ticketId: ticket_id,
              empresaId: ticket.empresa_id,
              emailChannelId: ticket.email_channel_id,
              type: 'agent_reply',
              title: ticket.titulo,
              customerName: ticket.cliente_nome,
              agentName: authorName,
              message: mensagem,
              status: ticket.status || 'Aberto',
              messageId: outboundMessageId,
              inReplyTo: replyToId,
              references: replyToId ? [replyToId] : undefined,
              dedupeKey: `ticket:${ticket_id}:message:${messageId}`
            });
          } catch (err) {
            console.error('[Notification Error] Falha ao enfileirar e-mail:', err);
            await recordTicketEvent({
              ticket_id,
              empresa_id: ticket.empresa_id,
              usuario_id,
              tipo: 'email_outbox_erro',
              descricao: 'A resposta foi registrada, mas o e-mail nao pode ser enfileirado.',
              metadata: { messageId, error: String((err as any)?.message || err).slice(0, 500) }
            }).catch(() => {});
          }
        }
      }

      // 2. Notify Responsible (if client responds or if it's an internal note they didn't write)
      if (ticket.responsavel_id && Number(ticket.responsavel_id) !== Number(usuario_id)) {
         recipients.add(ticket.responsavel_id);
      }

      // 3. Notify Admins if it's an internal note or a new client message
      if (finalInterno || isClient) {
         const [admins]: any = await pool.query(
           'SELECT id FROM usuarios WHERE empresa_id = ? AND administrador = 1',
           [ticket.empresa_id]
         );
         admins.forEach((a: any) => {
           if (Number(a.id) !== Number(usuario_id)) recipients.add(Number(a.id));
         });
      }

      const recipientIds = Array.from(recipients);
      if (recipientIds.length > 0) {
        await notificationsService.createMany(recipientIds, {
          empresa_id: ticket.empresa_id,
          tipo: 'TICKET_MESSAGE',
          titulo: finalInterno ? 'Nota interna no chamado' : 'Nova resposta no chamado',
          mensagem: `${authorName}: ${mensagem.substring(0, 100)}${mensagem.length > 100 ? '...' : ''}`,
          link: `ticket:${ticket_id}`,
          metadata: { ticketId: ticket_id, messageId }
        });
      }

    } catch (error) {
      console.error('[TicketMessagesService] Error in business logic:', error);
    }

    // 5b. Sincroniza campos materializados de estado de mensagens.
    // Roda DEPOIS das transições de status acima e ANTES do emit de socket,
    // para que o ticket emitido em tempo real já carregue os valores atualizados.
    // Vale para mensagens públicas e internas (notas internas não alteram a
    // "última mensagem pública", então a recomputação as ignora corretamente).
    try {
      await recomputeTicketMessageState(ticket_id);
    } catch (stateErr) {
      console.error('[TicketMessagesService] Falha ao recomputar estado materializado:', stateErr);
    }

    // 6. WebSocket Emit
    try {
      // TODO: Consider using a singleton Realtime Service to decouple from server.js
      if (io) {
        // Fetch updated ticket using direct query to avoid circular dependency
        const [updatedRows]: any = await pool.query(
          `SELECT t.*, 
                  COALESCE(t.solicitante_nome, u.nome, 'Cliente') as cliente_nome, 
                  COALESCE(t.solicitante_email, u.email, 'Usuário Removido') as cliente_email, 
                  COALESCE(r.nome, 'Não Atribuído') as responsavel_nome, 
                  e.nome as empresa_nome
           FROM tickets t
           LEFT JOIN usuarios u ON t.usuario_id = u.id
           LEFT JOIN empresas e ON t.empresa_id = e.id
           LEFT JOIN usuarios r ON t.responsavel_id = r.id
           WHERE t.id = ? AND t.deleted_at IS NULL`,
          [ticket_id]
        );
        
        if (updatedRows[0]) {
          io.to(`empresa_${ticket.empresa_id}`).emit('ticketUpdated', updatedRows[0]);
          io.to(`empresa_${ticket.empresa_id}`).emit('ticketMessagesChanged', { 
            ticketId: ticket_id, 
            empresaId: ticket.empresa_id, 
            messageId 
          });
        }
      }
    } catch (wsError) {
      console.error('[TicketMessagesService] WebSocket emission failed:', wsError);
    }

    return messageId;
  }
}

export default new TicketMessagesService();
