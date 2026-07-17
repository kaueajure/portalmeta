async function columnExists(connection, column) {
    const [rows] = await connection.query(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_preferences' AND COLUMN_NAME = ?`, [column]);
    return rows.length > 0;
}
export async function up(connection) {
    const canonicalColumns = [
        ['ticket_enabled', 'TINYINT(1) NOT NULL DEFAULT 1'],
        ['whatsapp_general_enabled', 'TINYINT(1) NOT NULL DEFAULT 1'],
        ['whatsapp_assigned_enabled', 'TINYINT(1) NOT NULL DEFAULT 1'],
        ['browser_enabled', 'TINYINT(1) NOT NULL DEFAULT 0'],
    ];
    for (const [name, definition] of canonicalColumns) {
        if (!(await columnExists(connection, name))) {
            await connection.query(`ALTER TABLE notification_preferences ADD COLUMN \`${name}\` ${definition}`);
        }
    }
    const legacyMappings = [
        ['ticket_activity_enabled', 'ticket_enabled'],
        ['whatsapp_queue_message_enabled', 'whatsapp_general_enabled'],
        ['whatsapp_assigned_message_enabled', 'whatsapp_assigned_enabled'],
        ['native_enabled', 'browser_enabled'],
    ];
    for (const [legacy, canonical] of legacyMappings) {
        if (await columnExists(connection, legacy)) {
            await connection.query(`UPDATE notification_preferences SET \`${canonical}\` = \`${legacy}\``);
            await connection.query(`ALTER TABLE notification_preferences DROP COLUMN \`${legacy}\``);
        }
    }
}
