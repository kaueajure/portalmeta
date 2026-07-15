import { PoolConnection } from 'mysql2/promise';

async function tableExists(connection: PoolConnection, table: string): Promise<boolean> {
  const [rows]: any = await connection.query(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = ?
  `, [table]);
  return rows.length > 0;
}

export async function up(connection: PoolConnection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS empresa_ticket_status (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      nome VARCHAR(100) NOT NULL,
      valor VARCHAR(80) NOT NULL,
      ativo TINYINT(1) DEFAULT 1,
      ordem INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_empresa_ticket_status (empresa_id, valor),
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  if (await tableExists(connection, 'empresas')) {
    await connection.query(`
      INSERT IGNORE INTO empresa_ticket_status (empresa_id, nome, valor, ativo, ordem)
      SELECT id, 'Aberto', 'aberto', 1, 0 FROM empresas
    `);
    await connection.query(`
      INSERT IGNORE INTO empresa_ticket_status (empresa_id, nome, valor, ativo, ordem)
      SELECT id, 'Em Atendimento', 'em_andamento', 1, 1 FROM empresas
    `);
    await connection.query(`
      INSERT IGNORE INTO empresa_ticket_status (empresa_id, nome, valor, ativo, ordem)
      SELECT id, 'Finalizado', 'resolvido', 1, 2 FROM empresas
    `);
  }
}
