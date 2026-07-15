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
    // 1. Add sla_pausado_em
    if (!(await columnExists(connection, 'tickets', 'sla_pausado_em'))) {
        await connection.query(`ALTER TABLE tickets ADD COLUMN sla_pausado_em DATETIME NULL AFTER sla_resolucao_status`);
    }
    // 2. Add sla_pausado_total_minutos
    if (!(await columnExists(connection, 'tickets', 'sla_pausado_total_minutos'))) {
        await connection.query(`ALTER TABLE tickets ADD COLUMN sla_pausado_total_minutos INT NOT NULL DEFAULT 0 AFTER sla_pausado_em`);
    }
    // 3. Add sla_status_operacional
    if (!(await columnExists(connection, 'tickets', 'sla_status_operacional'))) {
        await connection.query(`ALTER TABLE tickets ADD COLUMN sla_status_operacional VARCHAR(30) NULL AFTER sla_pausado_total_minutos`);
    }
    // 4. Initialize sla_status_operacional for existing tickets
    // And populate sla_pausado_em for those in waiting client status
    await connection.query(`
    UPDATE tickets 
    SET 
      sla_pausado_em = CASE 
        WHEN status = 'aguardando_cliente' AND sla_pausado_em IS NULL THEN COALESCE(updated_at, NOW())
        ELSE sla_pausado_em
      END,
      sla_status_operacional = CASE 
        WHEN status IN ('resolvido', 'fechado') AND sla_resolucao_status = 'cumprido' THEN 'cumprido'
        WHEN status IN ('resolvido', 'fechado') AND sla_resolucao_status = 'violado' THEN 'violado'
        WHEN status = 'aguardando_cliente' THEN 'pausado'
        WHEN status NOT IN ('resolvido', 'fechado') AND prazo_sla < NOW() THEN 'vencido'
        WHEN status NOT IN ('resolvido', 'fechado') AND prazo_sla BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 HOUR) THEN 'vencendo'
        WHEN status NOT IN ('resolvido', 'fechado') AND prazo_sla > DATE_ADD(NOW(), INTERVAL 2 HOUR) THEN 'dentro_sla'
        ELSE 'sem_sla'
      END
    WHERE sla_status_operacional IS NULL
  `);
}
export async function down(connection) {
    // Safe down (optional)
}
