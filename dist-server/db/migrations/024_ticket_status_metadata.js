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
    if (!await columnExists(connection, 'empresa_ticket_status', 'kanban_visivel')) {
        await connection.query(`
      ALTER TABLE empresa_ticket_status
      ADD COLUMN kanban_visivel TINYINT(1) NOT NULL DEFAULT 1 AFTER ativo
    `);
    }
    if (!await columnExists(connection, 'empresa_ticket_status', 'cor')) {
        await connection.query(`
      ALTER TABLE empresa_ticket_status
      ADD COLUMN cor VARCHAR(20) NULL AFTER kanban_visivel
    `);
    }
    if (!await columnExists(connection, 'empresa_ticket_status', 'especial')) {
        await connection.query(`
      ALTER TABLE empresa_ticket_status
      ADD COLUMN especial VARCHAR(40) NOT NULL DEFAULT 'normal' AFTER cor
    `);
    }
    await connection.query(`
    UPDATE empresa_ticket_status
    SET kanban_visivel = ativo
    WHERE kanban_visivel IS NULL
  `);
    await connection.query(`
    UPDATE empresa_ticket_status
    SET especial = CASE valor
      WHEN 'aberto' THEN 'inicial'
      WHEN 'aguardando_cliente' THEN 'aguardando_cliente'
      WHEN 'resolvido' THEN 'finalizado'
      WHEN 'fechado' THEN 'encerrado'
      ELSE especial
    END
    WHERE especial = 'normal'
       OR especial IS NULL
       OR especial = ''
  `);
    await connection.query(`
    UPDATE empresa_ticket_status
    SET cor = CASE valor
      WHEN 'aberto' THEN '#2563eb'
      WHEN 'em_andamento' THEN '#4f46e5'
      WHEN 'aguardando_cliente' THEN '#d97706'
      WHEN 'resolvido' THEN '#059669'
      WHEN 'fechado' THEN '#64748b'
      ELSE COALESCE(cor, '#0891b2')
    END
    WHERE cor IS NULL OR cor = ''
  `);
}
