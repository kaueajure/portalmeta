async function columnExists(connection, table, column) {
    const [rows] = await connection.query(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`, [table, column]);
    return rows.length > 0;
}
export async function up(connection) {
    await connection.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_attendance_cycles (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      contact_phone VARCHAR(32) NOT NULL,
      contact_name VARCHAR(255) NULL,
      service_id VARCHAR(256) NULL,
      service_title VARCHAR(40) NULL,
      status ENUM('pending', 'active', 'closed') NOT NULL DEFAULT 'pending',
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME NULL,
      assigned_user_id INT NULL,
      assigned_at DATETIME NULL,
      registered_ticket_id INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_whatsapp_cycles_phone_started (contact_phone, started_at, id),
      INDEX idx_whatsapp_cycles_status (status, updated_at),
      INDEX idx_whatsapp_cycles_ticket (registered_ticket_id),
      CONSTRAINT fk_whatsapp_cycles_user
        FOREIGN KEY (assigned_user_id) REFERENCES usuarios(id) ON DELETE SET NULL,
      CONSTRAINT fk_whatsapp_cycles_ticket
        FOREIGN KEY (registered_ticket_id) REFERENCES tickets(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    if (!(await columnExists(connection, 'whatsapp_sessions', 'attendance_cycle_id'))) {
        await connection.query(`
      ALTER TABLE whatsapp_sessions
      ADD COLUMN attendance_cycle_id BIGINT NULL AFTER contact_name,
      ADD INDEX idx_whatsapp_sessions_cycle (attendance_cycle_id),
      ADD CONSTRAINT fk_whatsapp_sessions_cycle
        FOREIGN KEY (attendance_cycle_id) REFERENCES whatsapp_attendance_cycles(id) ON DELETE SET NULL
    `);
    }
    await connection.query(`
    INSERT INTO whatsapp_attendance_cycles
      (contact_phone, contact_name, service_id, service_title, status, started_at,
       closed_at, assigned_user_id, assigned_at, registered_ticket_id)
    SELECT s.contact_phone, s.contact_name, s.selected_option_id, s.selected_option_title,
           IF(s.status = 'active', 'active', 'closed'),
           COALESCE(s.attendance_started_at, s.updated_at, NOW()),
           IF(s.status = 'active', NULL, COALESCE(s.closed_at, s.updated_at, NOW())),
           IF(s.status = 'active', s.assigned_user_id, NULL),
           IF(s.status = 'active', s.assigned_at, NULL),
           s.registered_ticket_id
    FROM whatsapp_sessions s
    WHERE s.attendance_cycle_id IS NULL
      AND (s.attendance_started_at IS NOT NULL OR s.closed_at IS NOT NULL OR s.registered_ticket_id IS NOT NULL)
  `);
    await connection.query(`
    UPDATE whatsapp_sessions s
    JOIN (
      SELECT contact_phone, MAX(id) AS cycle_id
      FROM whatsapp_attendance_cycles
      GROUP BY contact_phone
    ) latest ON latest.contact_phone = s.contact_phone
    SET s.attendance_cycle_id = latest.cycle_id
    WHERE s.attendance_cycle_id IS NULL
  `);
    if (!(await columnExists(connection, 'whatsapp_assignment_history', 'attendance_cycle_id'))) {
        await connection.query(`
      ALTER TABLE whatsapp_assignment_history
      ADD COLUMN attendance_cycle_id BIGINT NULL AFTER contact_phone,
      ADD INDEX idx_whatsapp_assignment_cycle_date (attendance_cycle_id, assigned_at, id),
      ADD CONSTRAINT fk_whatsapp_assignment_cycle
        FOREIGN KEY (attendance_cycle_id) REFERENCES whatsapp_attendance_cycles(id) ON DELETE CASCADE
    `);
    }
    await connection.query(`
    UPDATE whatsapp_assignment_history h
    JOIN whatsapp_sessions s ON s.contact_phone = h.contact_phone
    SET h.attendance_cycle_id = s.attendance_cycle_id
    WHERE h.attendance_cycle_id IS NULL
  `);
    if (!(await columnExists(connection, 'whatsapp_messages', 'attendance_cycle_id'))) {
        await connection.query(`
      ALTER TABLE whatsapp_messages
      ADD COLUMN attendance_cycle_id BIGINT NULL AFTER id,
      ADD INDEX idx_whatsapp_messages_cycle_date (attendance_cycle_id, created_at, id),
      ADD CONSTRAINT fk_whatsapp_messages_cycle
        FOREIGN KEY (attendance_cycle_id) REFERENCES whatsapp_attendance_cycles(id) ON DELETE SET NULL
    `);
    }
    await connection.query(`
    UPDATE whatsapp_messages wm
    JOIN whatsapp_attendance_cycles cycle
      ON cycle.contact_phone = REPLACE(REPLACE(REPLACE(IFNULL(
        CASE WHEN wm.direction = 'inbound' THEN wm.from_phone ELSE wm.to_phone END, ''
      ), '+', ''), '-', ''), ' ', '')
      AND wm.created_at >= cycle.started_at
      AND (cycle.closed_at IS NULL OR wm.created_at <= cycle.closed_at)
    SET wm.attendance_cycle_id = cycle.id
    WHERE wm.attendance_cycle_id IS NULL AND wm.message_type <> 'status'
  `);
}
