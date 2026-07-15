import pool from '../db/connection.js';
import { recordTicketEvent } from './ticket-events.service.js';
import ticketMessagesService from './ticket-messages.service.js';
import slaService from './sla.service.js';
import { recomputeTicketMessageState } from '../utils/ticket-state.js';
import {
  getClosedTicketStatusValue,
  getTicketStatusConfig,
  isCustomerWaitingTicketStatusSpecial,
  isFinalTicketStatusSpecial
} from '../utils/ticket-status-config.js';

const FINALIZED_TICKET_MUTATION_ACTIONS = new Set([
  'alterar_status',
  'alterar_prioridade',
  'atribuir_responsavel',
  'remover_responsavel',
  'adicionar_tag',
  'adicionar_comentario',
  'fechar_com_motivo'
]);

const parseJsonArray = (value: any) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

function getTicketField(ticket: any, campo: string) {
  switch (campo) {
    case 'status': return ticket.status;
    case 'prioridade': return ticket.prioridade;
    case 'categoria': return ticket.categoria;
    case 'servico': return ticket.servico;
    case 'origem': return ticket.origem;
    case 'responsavel_id': 
    case 'responsavel': return ticket.responsavel_id;
    case 'usuario_id': return ticket.usuario_id;
    case 'empresa_id': return ticket.empresa_id;
    case 'created_at': return ticket.created_at;
    case 'updated_at': return ticket.updated_at;
    case 'prazo_sla': return ticket.prazo_sla;
    case 'prazo_primeira_resposta': return ticket.prazo_primeira_resposta;
    case 'primeira_resposta_em': return ticket.primeira_resposta_em;
    case 'sla_primeira_resposta_status': return ticket.sla_primeira_resposta_status;
    case 'sla_resolucao_status': return ticket.sla_resolucao_status;
    default: return ticket[campo];
  }
}

async function evaluateCondition(ticket: any, cond: any) {
  const fieldValue = getTicketField(ticket, cond.campo);
  const expected = cond.valor;

  // Special cases for time and definitions
  if (cond.campo === 'responsavel_definido') {
    const isDefined = !!ticket.responsavel_id;
    return cond.valor === 'true' ? isDefined : !isDefined;
  }

  if (cond.campo === 'horas_desde_criacao') {
    const hours = (Date.now() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60);
    return hours > parseFloat(expected);
  }

  if (cond.campo === 'horas_desde_atualizacao') {
    const hours = (Date.now() - new Date(ticket.updated_at).getTime()) / (1000 * 60 * 60);
    return hours > parseFloat(expected);
  }

  if (cond.campo === 'sla_resolucao_vencido') {
    if (!ticket.prazo_sla) return false;
    return new Date() > new Date(ticket.prazo_sla) && ticket.sla_resolucao_status !== 'cumprido';
  }

  if (cond.campo === 'sla_primeira_resposta_vencido') {
    if (!ticket.prazo_primeira_resposta) return false;
    return new Date() > new Date(ticket.prazo_primeira_resposta) && !ticket.primeira_resposta_em;
  }

  if (cond.campo === 'tag') {
    // We need to fetch tags if not present
    let tags = ticket.tags;
    if (!tags) {
       const [rows]: any = await pool.query('SELECT tag FROM ticket_tags WHERE ticket_id = ?', [ticket.id]);
       tags = rows.map((r: any) => r.tag);
       ticket.tags = tags;
    }
    const hasTag = tags.includes(expected);
    return cond.operador === 'contem' ? hasTag : !hasTag;
  }

  switch (cond.operador) {
    case 'igual':
      return String(fieldValue ?? '') === String(expected ?? '');
    case 'diferente':
      return String(fieldValue ?? '') !== String(expected ?? '');
    case 'contem':
      return String(fieldValue ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
    case 'maior_que':
      return parseFloat(fieldValue) > parseFloat(expected);
    case 'menor_que':
      return parseFloat(fieldValue) < parseFloat(expected);
    default:
      return String(fieldValue ?? '') === String(expected ?? '');
  }
}

export async function runAutomations(evento: string, ticket: any, contexto: any) {
  if (contexto?.isInternalAutomation) return;

  // Use a simple tracking to prevent loops in same run
  const automationRunId = contexto?.automationRunId || Math.random().toString(36).substring(7);
  if (!ticket._automationsProcessed) ticket._automationsProcessed = new Set();

  try {
    const [regras]: any = await pool.query(
      'SELECT * FROM ticket_automacoes WHERE empresa_id = ? AND evento = ? AND ativo = 1 ORDER BY ordem ASC',
      [ticket.empresa_id, evento]
    );

    // Marca se alguma ação alterou o status, para recomputar o estado
    // materializado UMA única vez ao final (evita recomputes repetidos).
    let statusChanged = false;

    for (const regra of regras) {
      // Prevent executing the same rule more than once in the same transaction chain
      const ruleKey = `${regra.id}_${evento}`;
      if (ticket._automationsProcessed.has(ruleKey)) continue;

      const condicoes = parseJsonArray(regra.condicoes_json);
      const acoes = parseJsonArray(regra.acoes_json);

      if (acoes.length === 0) continue;

      let passed = true;
      for (const cond of condicoes) {
        if (!await evaluateCondition(ticket, cond)) {
          passed = false;
          break;
        }
      }

      if (passed) {
        ticket._automationsProcessed.add(ruleKey);
        let executedAcoes: string[] = [];

        for (const acao of acoes) {
          try {
            const currentStatusConfig = await getTicketStatusConfig(ticket.empresa_id, String(ticket.status || ''));
            if (isFinalTicketStatusSpecial(currentStatusConfig?.especial) && FINALIZED_TICKET_MUTATION_ACTIONS.has(acao.tipo)) {
              continue;
            }

            if (acao.tipo === 'alterar_status' && acao.valor) {
              const oldStatus = ticket.status;
              const newStatus = String(acao.valor);
              const oldStatusConfig = currentStatusConfig;
              const newStatusConfig = await getTicketStatusConfig(ticket.empresa_id, newStatus);
              if (!newStatusConfig || Number(newStatusConfig.ativo) !== 1) {
                continue;
              }
              const willBeFinalStatus = isFinalTicketStatusSpecial(newStatusConfig.especial);
              const updateFields = ['status = ?', 'updated_at = NOW()'];
              const updateParams: any[] = [newStatus];

              if (willBeFinalStatus) {
                let slaResolucaoStatus = ticket.sla_resolucao_status;
                if (ticket.prazo_sla) {
                  slaResolucaoStatus = new Date() <= new Date(ticket.prazo_sla) ? 'cumprido' : 'violado';
                }
                updateFields.push('finalizado_em = NOW()', 'sla_resolucao_status = ?');
                updateParams.push(slaResolucaoStatus);
                ticket.sla_resolucao_status = slaResolucaoStatus;
              }

              updateParams.push(ticket.id);
              await pool.query(`UPDATE tickets SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);
              ticket.status = newStatus;
              statusChanged = true;
              
              // Handle SLA for the new status
              if (isCustomerWaitingTicketStatusSpecial(newStatusConfig.especial)) {
                await slaService.pauseSla(ticket.id, contexto?.usuario_id || null);
              } else if (isCustomerWaitingTicketStatusSpecial(oldStatusConfig?.especial) && !isCustomerWaitingTicketStatusSpecial(newStatusConfig.especial)) {
                await slaService.resumeSla(ticket.id, contexto?.usuario_id || null);
              } else {
                await slaService.updateOperationalStatus(ticket.id);
              }

              executedAcoes.push(`Status alterado para: ${newStatus}`);
            }
            else if (acao.tipo === 'alterar_prioridade' && acao.valor) {
              await pool.query('UPDATE tickets SET prioridade = ?, updated_at = NOW() WHERE id = ?', [acao.valor, ticket.id]);
              ticket.prioridade = acao.valor;
              executedAcoes.push(`Prioridade alterada para: ${acao.valor}`);
            }
            else if (acao.tipo === 'atribuir_responsavel' && acao.valor) {
              await pool.query('UPDATE tickets SET responsavel_id = ?, updated_at = NOW() WHERE id = ?', [acao.valor, ticket.id]);
              ticket.responsavel_id = acao.valor;
              executedAcoes.push(`Responsável atribuído (ID: ${acao.valor})`);
            }
            else if (acao.tipo === 'remover_responsavel') {
              await pool.query('UPDATE tickets SET responsavel_id = NULL, updated_at = NOW() WHERE id = ?', [ticket.id]);
              ticket.responsavel_id = null;
              executedAcoes.push(`Responsável removido`);
            }
            else if (acao.tipo === 'adicionar_tag' && acao.valor) {
              await pool.query('INSERT IGNORE INTO ticket_tags (ticket_id, tag) VALUES (?, ?)', [ticket.id, acao.valor]);
              executedAcoes.push(`Tag adicionada: ${acao.valor}`);
            }
            else if (acao.tipo === 'adicionar_comentario' && acao.valor) {
               await ticketMessagesService.addMessage({
                 ticket_id: ticket.id,
                 usuario_id: null,
                 mensagem: acao.valor,
                 interno: true
               }, { administrador: true, desenvolvedor: true }); // System/Admin bypass
               executedAcoes.push(`Comentário interno adicionado`);
            }
            else if (acao.tipo === 'notificar_responsavel' && ticket.responsavel_id) {
               const { default: notificationsService } = await import('./notifications.service.js');
               await notificationsService.create({
                 usuario_id: ticket.responsavel_id,
                 empresa_id: ticket.empresa_id,
                 tipo: 'SYSTEM_ALERT',
                 titulo: 'Alerta de Automação',
                 mensagem: `Automação "${regra.nome}" executada para o chamado #${ticket.id}`,
                 link: `ticket:${ticket.id}`
               });
               executedAcoes.push(`Notificação enviada ao responsável`);
            }
            else if (acao.tipo === 'fechar_com_motivo' && acao.valor) {
               const oldStatus = ticket.status;
               const oldStatusConfig = await getTicketStatusConfig(ticket.empresa_id, String(oldStatus || ''));
               const closedStatus = await getClosedTicketStatusValue(ticket.empresa_id);
               if (!closedStatus) continue;
               let slaResolucaoStatus = ticket.sla_resolucao_status;
               if (ticket.prazo_sla) {
                 slaResolucaoStatus = new Date() <= new Date(ticket.prazo_sla) ? 'cumprido' : 'violado';
               }
               await pool.query(
                 'UPDATE tickets SET status = ?, resolucao_motivo = ?, finalizado_em = NOW(), sla_resolucao_status = ?, updated_at = NOW() WHERE id = ?',
                 [closedStatus, acao.valor, slaResolucaoStatus, ticket.id]
               );
               ticket.status = closedStatus;
               ticket.sla_resolucao_status = slaResolucaoStatus;
               statusChanged = true;

               if (isCustomerWaitingTicketStatusSpecial(oldStatusConfig?.especial)) {
                 await slaService.resumeSla(ticket.id, contexto?.usuario_id || null);
               } else {
                 await slaService.updateOperationalStatus(ticket.id);
               }

               executedAcoes.push(`Chamado fechado com motivo: ${acao.valor}`);
            }
          } catch (acaoErr) {
            console.error(`Erro na ação ${acao.tipo} da regra ${regra.id}:`, acaoErr);
          }
        }

        if (executedAcoes.length > 0) {
          await recordTicketEvent({
            ticket_id: ticket.id,
            empresa_id: ticket.empresa_id,
            usuario_id: contexto?.usuario_id || null,
            tipo: 'automacao_executada',
            descricao: `Regra: ${regra.nome}`,
            metadata: {
              automacao_id: regra.id,
              evento: evento,
              acoes: executedAcoes
            }
          });
        }
      }
    }

    // BUG 2 fix: se alguma ação alterou o status, recomputa o estado
    // materializado UMA vez ao final (origem da última mensagem pública não
    // muda aqui; somente a flag aguardando_resposta_atendente depende do status).
    if (statusChanged) {
      try {
        await recomputeTicketMessageState(ticket.id);
      } catch (stateErr) {
        console.error('[Automations] Falha ao recomputar estado materializado:', stateErr);
      }
    }
  } catch (err) {
    console.error('Falha ao executar automações:', err);
  }
}

