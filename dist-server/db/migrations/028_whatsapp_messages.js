export async function up(connection) {
    await connection.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      wa_message_id VARCHAR(128) NULL,
      direction ENUM('inbound', 'outbound') NOT NULL,
      from_phone VARCHAR(32) NULL,
      to_phone VARCHAR(32) NULL,
      contact_name VARCHAR(255) NULL,
      message_type VARCHAR(32) NOT NULL DEFAULT 'text',
      body TEXT NULL,
      status VARCHAR(32) NULL,
      raw_payload JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_whatsapp_messages_wa_id (wa_message_id),
      INDEX idx_whatsapp_messages_created (created_at),
      INDEX idx_whatsapp_messages_from (from_phone),
      INDEX idx_whatsapp_messages_direction (direction)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}
