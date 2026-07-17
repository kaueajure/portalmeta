async function columnExists(connection, table, column) {
    const [rows] = await connection.query(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`, [table, column]);
    return rows.length > 0;
}
export async function up(connection) {
    if (!(await columnExists(connection, 'whatsapp_settings', 'start_message'))) {
        await connection.query(`ALTER TABLE whatsapp_settings ADD COLUMN start_message TEXT NULL AFTER closing_message`);
    }
    await connection.query(`UPDATE whatsapp_settings SET start_message = ?
     WHERE id = 1 AND (start_message IS NULL OR TRIM(start_message) = '')`, ['Olá! Sou {atendente} e vou iniciar seu atendimento sobre {servico}. Como posso ajudar?']);
    if (!(await columnExists(connection, 'whatsapp_sessions', 'registered_ticket_id'))) {
        await connection.query(`
      ALTER TABLE whatsapp_sessions
      ADD COLUMN registered_ticket_id INT NULL AFTER closed_at,
      ADD INDEX idx_whatsapp_sessions_registered_ticket (registered_ticket_id),
      ADD CONSTRAINT fk_whatsapp_sessions_registered_ticket
        FOREIGN KEY (registered_ticket_id) REFERENCES tickets(id) ON DELETE SET NULL
    `);
    }
}
