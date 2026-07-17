async function columnExists(connection, column) {
    const [rows] = await connection.query(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'notification_preferences'
       AND COLUMN_NAME = ?`, [column]);
    return rows.length > 0;
}
export async function up(connection) {
    if (!(await columnExists(connection, 'ticket_transfer_enabled'))) {
        await connection.query(`
      ALTER TABLE notification_preferences
      ADD COLUMN ticket_transfer_enabled TINYINT(1) NOT NULL DEFAULT 1
      AFTER ticket_enabled
    `);
    }
}
