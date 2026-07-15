import pool from '../db/connection.js';

/**
 * ticket-state
 *
 * Fonte ÚNICA da regra canônica que mantém os campos materializados de
 * estado de mensagens em `tickets`:
 *   - ultima_mensagem_publica_em
 *   - ultima_mensagem_publica_origem  ('cliente' | 'atendente' | NULL)
 *   - aguardando_resposta_atendente   (0 | 1)
 *
 * Esta mesma regra é replicada (em SQL) no backfill da migration
 * 017_ticket_message_state.ts. Qualquer ajuste de regra deve ser feito
 * nos dois lugares de forma idêntica.
 *
 * REGRA CANÔNICA — origem de mensagem PÚBLICA (interno = 0):
 *   - autor NULL (e-mail externo / cliente sem cadastro) => 'cliente'
 *   - autor = solicitante do ticket (t.usuario_id)        => 'cliente'
 *   - qualquer outro autor                                => 'atendente'
 *
 * aguardando_resposta_atendente = 1 quando:
 *   - status não marcado como finalizado/encerrado E
 *   - status não marcado como aguardando cliente E
 *   - (não há mensagem pública OU a última pública é do 'cliente')
 */
export async function recomputeTicketMessageState(ticketId: number): Promise<void> {
  if (!ticketId || !Number.isInteger(Number(ticketId))) return;

  // 1. Última mensagem pública (data + origem) recalculada APENAS deste ticket.
  // Escopado por m.ticket_id = ? (sem GROUP BY global): pega a última mensagem
  // pública via ORDER BY m.id DESC LIMIT 1.
  await pool.query(
    `
    UPDATE tickets t
    LEFT JOIN (
      SELECT m.id, m.usuario_id, m.created_at
      FROM ticket_mensagens m
      WHERE m.ticket_id = ? AND m.interno = 0
      ORDER BY m.id DESC
      LIMIT 1
    ) pub ON 1 = 1
    SET
      t.ultima_mensagem_publica_em = pub.created_at,
      t.ultima_mensagem_publica_origem = CASE
        WHEN pub.id IS NULL THEN NULL
        WHEN pub.usuario_id IS NULL THEN 'cliente'
        WHEN pub.usuario_id = t.usuario_id THEN 'cliente'
        ELSE 'atendente'
      END
    WHERE t.id = ?
    `,
    [ticketId, ticketId]
  );

  // 2. Flag "precisa resposta do atendente".
  await pool.query(
    `
    UPDATE tickets t
    LEFT JOIN empresa_ticket_status status_cfg
      ON status_cfg.empresa_id = t.empresa_id
     AND status_cfg.valor = t.status
    SET t.aguardando_resposta_atendente = CASE
      WHEN status_cfg.especial IN ('finalizado', 'encerrado') THEN 0
      WHEN status_cfg.especial = 'aguardando_cliente' THEN 0
      WHEN t.ultima_mensagem_publica_em IS NULL THEN 1
      WHEN t.ultima_mensagem_publica_origem = 'cliente' THEN 1
      ELSE 0
    END
    WHERE t.id = ?
    `,
    [ticketId]
  );
}
