async function columnExists(connection, table, column) {
    const [rows] = await connection.query(`
    SELECT COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = ? 
    AND COLUMN_NAME = ?
  `, [table, column]);
    return rows.length > 0;
}
export async function up(connection) {
    // 1. Add prazo_primeira_resposta
    if (!(await columnExists(connection, 'tickets', 'prazo_primeira_resposta'))) {
        await connection.query(`ALTER TABLE tickets ADD COLUMN prazo_primeira_resposta DATETIME NULL AFTER prazo_sla`);
    }
    // 2. Add primeira_resposta_em
    if (!(await columnExists(connection, 'tickets', 'primeira_resposta_em'))) {
        await connection.query(`ALTER TABLE tickets ADD COLUMN primeira_resposta_em DATETIME NULL AFTER prazo_primeira_resposta`);
    }
    // 3. Add sla_primeira_resposta_status
    if (!(await columnExists(connection, 'tickets', 'sla_primeira_resposta_status'))) {
        await connection.query(`ALTER TABLE tickets ADD COLUMN sla_primeira_resposta_status VARCHAR(50) NULL AFTER primeira_resposta_em`);
    }
    // 4. Add sla_resolucao_status
    if (!(await columnExists(connection, 'tickets', 'sla_resolucao_status'))) {
        await connection.query(`ALTER TABLE tickets ADD COLUMN sla_resolucao_status VARCHAR(50) NULL AFTER sla_primeira_resposta_status`);
    }
    // 5. Initialize resolution status for existing resolved tickets
    // Só executamos o update se a coluna foi garantida acima
    await connection.query(`
    UPDATE tickets 
    SET sla_resolucao_status = CASE 
      WHEN finalizado_em <= prazo_sla THEN 'cumprido'
      WHEN finalizado_em > prazo_sla THEN 'violado'
      ELSE NULL
    END
    WHERE status IN ('resolvido', 'fechado') AND finalizado_em IS NOT NULL AND prazo_sla IS NOT NULL
  `);
}
export async function down(connection) {
    // O runner não costuma usar down em produção, mas deixamos vazio ou seguro
}
