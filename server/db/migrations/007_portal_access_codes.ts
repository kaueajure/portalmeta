
import { Connection } from 'mysql2/promise';

export async function up(connection: Connection) {
  // Create portal_access_codes table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS portal_access_codes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      organization_email VARCHAR(255) NOT NULL,
      customer_email VARCHAR(255) NOT NULL,
      codigo_hash VARCHAR(255) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      attempts INT NOT NULL DEFAULT 0,
      ip VARCHAR(100) NULL,
      user_agent TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

      INDEX idx_portal_access_lookup (empresa_id, customer_email),
      INDEX idx_portal_access_expires (expires_at),
      INDEX idx_portal_access_org_email (organization_email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}
