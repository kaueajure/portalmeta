const SOURCE_COMPANY_ID = 1;
/**
 * Expansao nao destrutiva da migracao para instancia single-company.
 * A remocao dos tenants antigos acontece apenas na migration de contrato,
 * depois do backup e da validacao das contagens.
 */
export async function up(connection) {
    // Banco novo: cria somente a identidade legada minima necessaria durante a
    // fase de compatibilidade. Ela sera removida na migration de contrato.
    await connection.query(`INSERT INTO empresas (id, nome, ativo)
     VALUES (?, 'MetaBit', 1)
     ON DUPLICATE KEY UPDATE nome = 'MetaBit', ativo = 1`, [SOURCE_COMPANY_ID]);
    const [companies] = await connection.query('SELECT id, nome FROM empresas WHERE id = ? LIMIT 1', [SOURCE_COMPANY_ID]);
    if (companies.length !== 1)
        throw new Error('Falha ao preparar a identidade MetaBit.');
    await connection.query(`
    CREATE TABLE IF NOT EXISTS application_settings (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      cnpj VARCHAR(20) NULL,
      email VARCHAR(255) NULL,
      email_suporte VARCHAR(255) NULL,
      telefone VARCHAR(20) NULL,
      logo VARCHAR(255) NULL,
      cor_principal VARCHAR(7) NOT NULL DEFAULT '#2563eb',
      endereco TEXT NULL,
      email_assinatura TEXT NULL,
      horario_atendimento_json JSON NULL,
      site_url VARCHAR(255) NOT NULL DEFAULT 'https://portalmeta.com.br/',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT chk_application_settings_singleton CHECK (id = 1)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    await connection.query(`
      INSERT INTO application_settings (
        id, nome, cnpj, email, email_suporte, telefone, logo, cor_principal,
        endereco, email_assinatura, horario_atendimento_json, site_url
      )
      SELECT 1, 'MetaBit', cnpj, email, email_suporte, telefone, logo,
             COALESCE(cor_principal, '#2563eb'), endereco, email_assinatura,
             horario_atendimento_json, 'https://portalmeta.com.br/'
      FROM empresas
      WHERE id = ?
      ON DUPLICATE KEY UPDATE
        nome = VALUES(nome),
        cnpj = VALUES(cnpj),
        email = VALUES(email),
        email_suporte = VALUES(email_suporte),
        telefone = VALUES(telefone),
        logo = VALUES(logo),
        cor_principal = VALUES(cor_principal),
        endereco = VALUES(endereco),
        email_assinatura = VALUES(email_assinatura),
        horario_atendimento_json = VALUES(horario_atendimento_json),
        site_url = VALUES(site_url)
    `, [SOURCE_COMPANY_ID]);
    await connection.query(`
    CREATE TABLE IF NOT EXISTS single_company_migration_audit (
      id INT AUTO_INCREMENT PRIMARY KEY,
      source_company_id INT NOT NULL,
      entity_name VARCHAR(100) NOT NULL,
      row_count BIGINT NOT NULL,
      captured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_single_company_audit_entity (source_company_id, entity_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    const scopedTables = [
        'usuarios', 'tickets', 'ticket_anexos', 'ticket_eventos', 'ticket_satisfacao',
        'ticket_views', 'ticket_macros', 'ticket_automacoes', 'knowledge_articles',
        'notificacoes', 'logs_sistema', 'processed_emails', 'email_outbox',
        'empresa_email_canais', 'empresa_ticket_categorias', 'empresa_ticket_servicos',
        'empresa_ticket_status', 'empresa_sla_politicas', 'empresa_distribuicao_regras',
        'portal_access_codes', 'access_profiles'
    ];
    for (const table of scopedTables) {
        const [rows] = await connection.query(`SELECT COUNT(*) AS total FROM \`${table}\` WHERE empresa_id = ?`, [SOURCE_COMPANY_ID]);
        await connection.query(`INSERT INTO single_company_migration_audit
         (source_company_id, entity_name, row_count)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE row_count = VALUES(row_count), captured_at = CURRENT_TIMESTAMP`, [SOURCE_COMPANY_ID, table, Number(rows[0]?.total || 0)]);
    }
}
