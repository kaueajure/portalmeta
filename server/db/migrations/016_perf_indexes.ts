import { PoolConnection } from 'mysql2/promise';

/**
 * 016_perf_indexes
 *
 * ETAPA 1 (Performance): adiciona apenas índices para acelerar as
 * listagens, kanban e contagens de filas de tickets.
 *
 * - NÃO altera regra de negócio.
 * - NÃO cria/remove colunas nem dados.
 * - NÃO refatora serviços.
 * - Idempotente: pode rodar várias vezes sem erro (verifica indexExists).
 *
 * Índices criados:
 *   - ticket_mensagens (ticket_id, interno, id)
 *   - tickets (empresa_id, status)
 *   - tickets (empresa_id, prazo_sla)
 */

async function indexExists(connection: PoolConnection, table: string, indexName: string): Promise<boolean> {
  const [rows]: any = await connection.query(
    `
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
    `,
    [table, indexName]
  );

  return Number(rows[0]?.count || 0) > 0;
}

export async function up(connection: PoolConnection) {
  // 1. ticket_mensagens (ticket_id, interno, id)
  // Acelera os subqueries "SELECT MAX(id) ... WHERE ticket_id = ? AND interno = 0"
  // usados em list(), getKanban(), getQueuesCounts() e enrichTicketsWithProductivity().
  if (!(await indexExists(connection, 'ticket_mensagens', 'idx_mensagens_ticket_interno_id'))) {
    await connection.query(
      'ALTER TABLE ticket_mensagens ADD INDEX idx_mensagens_ticket_interno_id (ticket_id, interno, id)'
    );
  }

  // 2. tickets (empresa_id, status)
  // Filtro dominante de toda a aplicação (isolamento por empresa + status).
  if (!(await indexExists(connection, 'tickets', 'idx_tickets_empresa_status'))) {
    await connection.query(
      'ALTER TABLE tickets ADD INDEX idx_tickets_empresa_status (empresa_id, status)'
    );
  }

  // 3. tickets (empresa_id, prazo_sla)
  // Filas de SLA (sla_vencido / vence_em_breve) que sempre filtram por
  // empresa_id antes de aplicar o range em prazo_sla. O prefixo empresa_id
  // torna o seek muito mais seletivo em um sistema multiempresa.
  if (!(await indexExists(connection, 'tickets', 'idx_tickets_prazo_sla'))) {
    await connection.query(
      'ALTER TABLE tickets ADD INDEX idx_tickets_prazo_sla (empresa_id, prazo_sla)'
    );
  }
}

export async function down(connection: PoolConnection) {
  // Rollback seguro: remove apenas os índices criados por esta migration.
  // Não toca em dados nem em estrutura de colunas.
  if (await indexExists(connection, 'tickets', 'idx_tickets_prazo_sla')) {
    await connection.query('ALTER TABLE tickets DROP INDEX idx_tickets_prazo_sla');
  }
  if (await indexExists(connection, 'tickets', 'idx_tickets_empresa_status')) {
    await connection.query('ALTER TABLE tickets DROP INDEX idx_tickets_empresa_status');
  }
  if (await indexExists(connection, 'ticket_mensagens', 'idx_mensagens_ticket_interno_id')) {
    await connection.query('ALTER TABLE ticket_mensagens DROP INDEX idx_mensagens_ticket_interno_id');
  }
}
