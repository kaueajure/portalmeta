async function indexExists(connection, table, indexName) {
    const [rows] = await connection.query(`
      SELECT COUNT(*) AS count
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
    `, [table, indexName]);
    return Number(rows[0]?.count || 0) > 0;
}
async function addIndexIfMissing(connection, table, indexName, ddl) {
    if (!(await indexExists(connection, table, indexName))) {
        await connection.query(ddl);
    }
}
async function dropIndexIfExists(connection, table, indexName) {
    if (await indexExists(connection, table, indexName)) {
        await connection.query(`ALTER TABLE ${table} DROP INDEX ${indexName}`);
    }
}
export async function up(connection) {
    await addIndexIfMissing(connection, 'tickets', 'idx_tickets_empresa_updated_id', 'ALTER TABLE tickets ADD INDEX idx_tickets_empresa_updated_id (empresa_id, updated_at, id)');
    await addIndexIfMissing(connection, 'tickets', 'idx_tickets_empresa_created_id', 'ALTER TABLE tickets ADD INDEX idx_tickets_empresa_created_id (empresa_id, created_at, id)');
    await addIndexIfMissing(connection, 'tickets', 'idx_tickets_empresa_responsavel_updated', 'ALTER TABLE tickets ADD INDEX idx_tickets_empresa_responsavel_updated (empresa_id, responsavel_id, updated_at, id)');
    await addIndexIfMissing(connection, 'tickets', 'idx_tickets_empresa_prioridade_updated', 'ALTER TABLE tickets ADD INDEX idx_tickets_empresa_prioridade_updated (empresa_id, prioridade, updated_at, id)');
    await addIndexIfMissing(connection, 'tickets', 'idx_tickets_empresa_categoria_updated', 'ALTER TABLE tickets ADD INDEX idx_tickets_empresa_categoria_updated (empresa_id, categoria, updated_at, id)');
    await addIndexIfMissing(connection, 'tickets', 'idx_tickets_empresa_servico_updated', 'ALTER TABLE tickets ADD INDEX idx_tickets_empresa_servico_updated (empresa_id, servico, updated_at, id)');
    await addIndexIfMissing(connection, 'tickets', 'idx_tickets_empresa_origem_updated', 'ALTER TABLE tickets ADD INDEX idx_tickets_empresa_origem_updated (empresa_id, origem, updated_at, id)');
    await addIndexIfMissing(connection, 'tickets', 'idx_tickets_empresa_prazo_primeira', 'ALTER TABLE tickets ADD INDEX idx_tickets_empresa_prazo_primeira (empresa_id, prazo_primeira_resposta, id)');
    await addIndexIfMissing(connection, 'ticket_mensagens', 'idx_mensagens_ticket_created', 'ALTER TABLE ticket_mensagens ADD INDEX idx_mensagens_ticket_created (ticket_id, created_at, id)');
    await addIndexIfMissing(connection, 'ticket_anexos', 'idx_anexos_mensagem_interno_created', 'ALTER TABLE ticket_anexos ADD INDEX idx_anexos_mensagem_interno_created (mensagem_id, interno, created_at, id)');
    await addIndexIfMissing(connection, 'ticket_anexos', 'idx_anexos_ticket_interno_created', 'ALTER TABLE ticket_anexos ADD INDEX idx_anexos_ticket_interno_created (ticket_id, interno, created_at, id)');
    await addIndexIfMissing(connection, 'ticket_leituras', 'idx_leituras_usuario_ticket_read', 'ALTER TABLE ticket_leituras ADD INDEX idx_leituras_usuario_ticket_read (usuario_id, ticket_id, last_read_at)');
    await addIndexIfMissing(connection, 'ticket_automacoes', 'idx_automacoes_empresa_evento_ativo_ordem', 'ALTER TABLE ticket_automacoes ADD INDEX idx_automacoes_empresa_evento_ativo_ordem (empresa_id, evento, ativo, ordem, id)');
    await addIndexIfMissing(connection, 'usuarios', 'idx_usuarios_empresa_ativo', 'ALTER TABLE usuarios ADD INDEX idx_usuarios_empresa_ativo (empresa_id, ativo, id)');
}
export async function down(connection) {
    await dropIndexIfExists(connection, 'usuarios', 'idx_usuarios_empresa_ativo');
    await dropIndexIfExists(connection, 'ticket_automacoes', 'idx_automacoes_empresa_evento_ativo_ordem');
    await dropIndexIfExists(connection, 'ticket_leituras', 'idx_leituras_usuario_ticket_read');
    await dropIndexIfExists(connection, 'ticket_anexos', 'idx_anexos_ticket_interno_created');
    await dropIndexIfExists(connection, 'ticket_anexos', 'idx_anexos_mensagem_interno_created');
    await dropIndexIfExists(connection, 'ticket_mensagens', 'idx_mensagens_ticket_created');
    await dropIndexIfExists(connection, 'tickets', 'idx_tickets_empresa_prazo_primeira');
    await dropIndexIfExists(connection, 'tickets', 'idx_tickets_empresa_origem_updated');
    await dropIndexIfExists(connection, 'tickets', 'idx_tickets_empresa_servico_updated');
    await dropIndexIfExists(connection, 'tickets', 'idx_tickets_empresa_categoria_updated');
    await dropIndexIfExists(connection, 'tickets', 'idx_tickets_empresa_prioridade_updated');
    await dropIndexIfExists(connection, 'tickets', 'idx_tickets_empresa_responsavel_updated');
    await dropIndexIfExists(connection, 'tickets', 'idx_tickets_empresa_created_id');
    await dropIndexIfExists(connection, 'tickets', 'idx_tickets_empresa_updated_id');
}
