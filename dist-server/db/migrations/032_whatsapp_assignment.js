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
    if (!(await columnExists(connection, 'whatsapp_sessions', 'assigned_user_id'))) {
        await connection.query(`
      ALTER TABLE whatsapp_sessions
      ADD COLUMN assigned_user_id INT NULL AFTER attendance_started_at,
      ADD INDEX idx_whatsapp_sessions_assigned_user (assigned_user_id),
      ADD CONSTRAINT fk_whatsapp_sessions_assigned_user
        FOREIGN KEY (assigned_user_id) REFERENCES usuarios(id) ON DELETE SET NULL
    `);
    }
    if (!(await columnExists(connection, 'whatsapp_sessions', 'assigned_at'))) {
        await connection.query(`
      ALTER TABLE whatsapp_sessions
      ADD COLUMN assigned_at DATETIME NULL AFTER assigned_user_id
    `);
    }
    await connection.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_assignment_history (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      contact_phone VARCHAR(32) NOT NULL,
      user_id INT NULL,
      user_name VARCHAR(255) NOT NULL,
      assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_whatsapp_assignment_phone_date (contact_phone, assigned_at),
      INDEX idx_whatsapp_assignment_user (user_id),
      CONSTRAINT fk_whatsapp_assignment_history_user
        FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}
