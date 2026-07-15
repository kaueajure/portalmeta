import { PoolConnection } from 'mysql2/promise';

async function columnExists(connection: PoolConnection, table: string, column: string): Promise<boolean> {
  const [rows]: any = await connection.query(`
    SELECT COUNT(*) as count 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = ? 
    AND COLUMN_NAME = ?
  `, [table, column]);
  return rows[0].count > 0;
}

export async function up(connection: PoolConnection) {
  // Empresas
  if (!await columnExists(connection, 'empresas', 'email_suporte')) {
    await connection.query('ALTER TABLE empresas ADD COLUMN email_suporte VARCHAR(255) NULL');
  }
  if (!await columnExists(connection, 'empresas', 'endereco')) {
    await connection.query('ALTER TABLE empresas ADD COLUMN endereco TEXT NULL');
  }
  if (!await columnExists(connection, 'empresas', 'horario_atendimento_json')) {
    await connection.query('ALTER TABLE empresas ADD COLUMN horario_atendimento_json JSON NULL');
  }

  // Usuarios
  if (!await columnExists(connection, 'usuarios', 'reset_token')) {
    await connection.query('ALTER TABLE usuarios ADD COLUMN reset_token VARCHAR(255) NULL');
  }
  if (!await columnExists(connection, 'usuarios', 'reset_token_expires')) {
    await connection.query('ALTER TABLE usuarios ADD COLUMN reset_token_expires DATETIME NULL');
  }

  // Tickets
  const ticketCols = [
    { name: 'sla_status', def: 'VARCHAR(50) NULL' },
    { name: 'prazo_sla', def: 'DATETIME NULL' },
    { name: 'finalizado_em', def: 'DATETIME NULL' },
    { name: 'resolucao_motivo', def: 'VARCHAR(100) NULL' },
    { name: 'resolucao_observacao', def: 'TEXT NULL' },
    { name: 'reaberto_em', def: 'DATETIME NULL' },
    { name: 'reaberto_por', def: 'INT NULL' },
    { name: 'origem', def: 'VARCHAR(50) NULL' },
    { name: 'servico', def: 'VARCHAR(100) NULL' },
    { name: 'responsavel_id', def: 'INT NULL' },
    { name: 'precisa_revisao_responsavel', def: 'TINYINT(1) DEFAULT 0' },
    { name: 'solicitante_nome', def: 'VARCHAR(255) NULL' },
    { name: 'solicitante_email', def: 'VARCHAR(255) NULL' }
  ];

  for (const col of ticketCols) {
    if (!await columnExists(connection, 'tickets', col.name)) {
      await connection.query(`ALTER TABLE tickets ADD COLUMN ${col.name} ${col.def}`);
    }
  }

  // Ticket Mensagens
  if (!await columnExists(connection, 'ticket_mensagens', 'tipo')) {
    await connection.query('ALTER TABLE ticket_mensagens ADD COLUMN tipo VARCHAR(50) DEFAULT "texto"');
  }
  if (!await columnExists(connection, 'ticket_mensagens', 'interno')) {
    await connection.query('ALTER TABLE ticket_mensagens ADD COLUMN interno TINYINT(1) DEFAULT 0');
  }
  if (!await columnExists(connection, 'ticket_mensagens', 'anexo')) {
    await connection.query('ALTER TABLE ticket_mensagens ADD COLUMN anexo VARCHAR(255) NULL');
  }

  // Logs
  if (!await columnExists(connection, 'logs_sistema', 'ip')) {
    await connection.query('ALTER TABLE logs_sistema ADD COLUMN ip VARCHAR(45) NULL');
  }
  if (!await columnExists(connection, 'logs_sistema', 'user_agent')) {
    await connection.query('ALTER TABLE logs_sistema ADD COLUMN user_agent TEXT NULL');
  }

  // Ticket Macros additions
  if (!await columnExists(connection, 'ticket_macros', 'servico')) {
    await connection.query('ALTER TABLE ticket_macros ADD COLUMN servico VARCHAR(100) NULL');
  }
  if (!await columnExists(connection, 'ticket_macros', 'tags_json')) {
    await connection.query('ALTER TABLE ticket_macros ADD COLUMN tags_json JSON NULL');
  }
  if (!await columnExists(connection, 'ticket_macros', 'uso_count')) {
    await connection.query('ALTER TABLE ticket_macros ADD COLUMN uso_count INT DEFAULT 0');
  }

  // Renomeia atalho para titulo se existir
  if (await columnExists(connection, 'ticket_macros', 'atalho') && !await columnExists(connection, 'ticket_macros', 'titulo')) {
    await connection.query('ALTER TABLE ticket_macros CHANGE COLUMN atalho titulo VARCHAR(120) NOT NULL');
  }

  // Índices
  try {
    await connection.query('CREATE INDEX idx_tickets_responsavel ON tickets(responsavel_id)');
  } catch (e) {}
  try {
    await connection.query('CREATE INDEX idx_empresas_email_suporte ON empresas(email_suporte)');
  } catch (e) {}
}
