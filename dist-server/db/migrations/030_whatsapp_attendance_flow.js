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
const DEFAULT_CLOSING = 'Como não recebemos uma resposta nos últimos 60 minutos, este atendimento será encerrado automaticamente. Quando precisar, envie uma nova mensagem para iniciar um novo atendimento.';
/**
 * Fluxo de atendimento por estado + inatividade (sem palavra-gatilho).
 * - whatsapp_settings: minutos de inatividade + mensagem de encerramento
 * - whatsapp_sessions: estado por telefone (idle | active)
 */
export async function up(connection) {
    if (!(await columnExists(connection, 'whatsapp_settings', 'inactivity_minutes'))) {
        await connection.query(`
      ALTER TABLE whatsapp_settings
      ADD COLUMN inactivity_minutes INT NOT NULL DEFAULT 60 AFTER welcome_buttons_json
    `);
    }
    if (!(await columnExists(connection, 'whatsapp_settings', 'closing_message'))) {
        await connection.query(`
      ALTER TABLE whatsapp_settings
      ADD COLUMN closing_message TEXT NULL AFTER inactivity_minutes
    `);
    }
    await connection.query(`
      UPDATE whatsapp_settings
      SET closing_message = ?
      WHERE id = 1 AND (closing_message IS NULL OR TRIM(closing_message) = '')
    `, [DEFAULT_CLOSING]);
    await connection.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_sessions (
      contact_phone VARCHAR(32) NOT NULL PRIMARY KEY,
      contact_name VARCHAR(255) NULL,
      status ENUM('idle', 'active') NOT NULL DEFAULT 'idle',
      selected_option_id VARCHAR(256) NULL,
      selected_option_title VARCHAR(40) NULL,
      last_client_message_at DATETIME NULL,
      last_company_message_at DATETIME NULL,
      attendance_started_at DATETIME NULL,
      closed_at DATETIME NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_whatsapp_sessions_status_company (status, last_company_message_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}
