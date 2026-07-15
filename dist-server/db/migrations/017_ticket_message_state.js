/**
 * 017_ticket_message_state
 *
 * ETAPA 2 (Performance): materializa o estado de mensagens no próprio ticket
 * para eliminar as subqueries correlacionadas de list(), getKanban(),
 * getQueuesCounts() e enrichTicketsWithProductivity().
 *
 * Campos adicionados em `tickets`:
 *   - aguardando_resposta_atendente TINYINT(1)  -> "precisa resposta do atendente"
 *   - ultima_mensagem_publica_em    DATETIME    -> data da última msg pública
 *   - ultima_mensagem_publica_origem VARCHAR(20) -> 'cliente' | 'atendente' | NULL
 *
 * Índice:
 *   - idx_tickets_empresa_aguardando (empresa_id, aguardando_resposta_atendente)
 *
 * REGRA CANÔNICA (mesma usada em runtime por utils/ticket-state.ts):
 *   Origem de mensagem pública (interno = 0):
 *     - autor NULL (e-mail externo)        => 'cliente'
 *     - autor = solicitante (t.usuario_id) => 'cliente'
 *     - qualquer outro autor               => 'atendente'
 *   aguardando_resposta_atendente = 1 quando:
 *     - status NÃO em (resolvido, fechado) E
 *     - status != 'aguardando_cliente' E
 *     - (sem mensagem pública OU última pública é do 'cliente')
 *
 * - Idempotente: usa columnExists/indexExists.
 * - O backfill é seguro e REEXECUTÁVEL (recalcula a partir de ticket_mensagens).
 * - NÃO usa DROP/DELETE/TRUNCATE em dados.
 */
async function columnExists(connection, table, column) {
    const [rows] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `, [table, column]);
    return Number(rows[0]?.count || 0) > 0;
}
async function indexExists(connection, table, indexName) {
    const [rows] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
    `, [table, indexName]);
    return Number(rows[0]?.count || 0) > 0;
}
export async function up(connection) {
    // 1. Colunas materializadas
    if (!(await columnExists(connection, 'tickets', 'aguardando_resposta_atendente'))) {
        await connection.query('ALTER TABLE tickets ADD COLUMN aguardando_resposta_atendente TINYINT(1) NOT NULL DEFAULT 0');
    }
    if (!(await columnExists(connection, 'tickets', 'ultima_mensagem_publica_em'))) {
        await connection.query('ALTER TABLE tickets ADD COLUMN ultima_mensagem_publica_em DATETIME NULL');
    }
    if (!(await columnExists(connection, 'tickets', 'ultima_mensagem_publica_origem'))) {
        await connection.query("ALTER TABLE tickets ADD COLUMN ultima_mensagem_publica_origem VARCHAR(20) NULL");
    }
    // 2. Índice de leitura para filas/contagens
    if (!(await indexExists(connection, 'tickets', 'idx_tickets_empresa_aguardando'))) {
        await connection.query('ALTER TABLE tickets ADD INDEX idx_tickets_empresa_aguardando (empresa_id, aguardando_resposta_atendente)');
    }
    // 3. Backfill — passo A: última mensagem pública (em + origem)
    // Reexecutável: recalcula 100% a partir de ticket_mensagens.
    await connection.query(`
    UPDATE tickets t
    LEFT JOIN (
      SELECT m.ticket_id, m.id, m.usuario_id, m.created_at
      FROM ticket_mensagens m
      INNER JOIN (
        SELECT ticket_id, MAX(id) AS max_id
        FROM ticket_mensagens
        WHERE interno = 0
        GROUP BY ticket_id
      ) lm ON lm.ticket_id = m.ticket_id AND lm.max_id = m.id
    ) pub ON pub.ticket_id = t.id
    SET
      t.ultima_mensagem_publica_em = pub.created_at,
      t.ultima_mensagem_publica_origem = CASE
        WHEN pub.id IS NULL THEN NULL
        WHEN pub.usuario_id IS NULL THEN 'cliente'
        WHEN pub.usuario_id = t.usuario_id THEN 'cliente'
        ELSE 'atendente'
      END
  `);
    // 4. Backfill — passo B: flag aguardando_resposta_atendente
    await connection.query(`
    UPDATE tickets t
    SET t.aguardando_resposta_atendente = CASE
      WHEN t.status IN ('resolvido', 'fechado') THEN 0
      WHEN t.status = 'aguardando_cliente' THEN 0
      WHEN t.ultima_mensagem_publica_em IS NULL THEN 1
      WHEN t.ultima_mensagem_publica_origem = 'cliente' THEN 1
      ELSE 0
    END
  `);
}
export async function down(connection) {
    // Rollback seguro: remove índice e colunas materializadas.
    // Não toca em ticket_mensagens nem em dados de negócio.
    if (await indexExists(connection, 'tickets', 'idx_tickets_empresa_aguardando')) {
        await connection.query('ALTER TABLE tickets DROP INDEX idx_tickets_empresa_aguardando');
    }
    if (await columnExists(connection, 'tickets', 'ultima_mensagem_publica_origem')) {
        await connection.query('ALTER TABLE tickets DROP COLUMN ultima_mensagem_publica_origem');
    }
    if (await columnExists(connection, 'tickets', 'ultima_mensagem_publica_em')) {
        await connection.query('ALTER TABLE tickets DROP COLUMN ultima_mensagem_publica_em');
    }
    if (await columnExists(connection, 'tickets', 'aguardando_resposta_atendente')) {
        await connection.query('ALTER TABLE tickets DROP COLUMN aguardando_resposta_atendente');
    }
}
