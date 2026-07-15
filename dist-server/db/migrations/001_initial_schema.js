export async function up(connection) {
    // 1. Empresas
    await connection.query(`
    CREATE TABLE IF NOT EXISTS empresas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      cnpj VARCHAR(20) UNIQUE,
      email VARCHAR(255),
      telefone VARCHAR(20),
      logo VARCHAR(255),
      cor_principal VARCHAR(7) DEFAULT '#2563eb',
      ativo TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    // 2. Canais de e-mail
    await connection.query(`
    CREATE TABLE IF NOT EXISTS empresa_email_canais (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      nome VARCHAR(120) NULL,
      email_publico VARCHAR(255) NOT NULL,
      inbound_address VARCHAR(255) NOT NULL UNIQUE,
      verification_token VARCHAR(100) NOT NULL,
      status ENUM('pendente','verificado','ativo','erro') DEFAULT 'pendente',
      ultimo_erro TEXT NULL,
      last_received_at DATETIME NULL,
      verified_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_canais_empresa (empresa_id),
      KEY idx_canais_email (email_publico),
      KEY idx_canais_inbound (inbound_address),
      KEY idx_canais_status (status),
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    // 3. Usuarios
    await connection.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT,
      nome VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      senha_hash VARCHAR(255) NOT NULL,
      telefone VARCHAR(20),
      foto VARCHAR(255),
      cargo VARCHAR(100),
      perfil VARCHAR(50) DEFAULT 'atendente',
      administrador TINYINT(1) DEFAULT 0,
      desenvolvedor TINYINT(1) DEFAULT 0,
      ativo TINYINT(1) DEFAULT 1,
      ultimo_login DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_email (email),
      KEY idx_emp_id (empresa_id),
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    // 4. Tickets
    await connection.query(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      usuario_id INT NULL,
      responsavel_id INT NULL,
      titulo VARCHAR(255) NOT NULL,
      descricao TEXT,
      status VARCHAR(80) NOT NULL DEFAULT 'aberto',
      prioridade ENUM('baixa', 'media', 'alta', 'urgente') DEFAULT 'media',
      categoria VARCHAR(100),
      origem VARCHAR(50),
      prazo_sla DATETIME,
      finalizado_em DATETIME,
      resolucao_motivo VARCHAR(100) NULL,
      resolucao_observacao TEXT NULL,
      reaberto_em DATETIME NULL,
      reaberto_por INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_tickets_empresa (empresa_id),
      KEY idx_tickets_usuario (usuario_id),
      KEY idx_tickets_responsavel (responsavel_id),
      KEY idx_tickets_status (status),
      KEY idx_tickets_prioridade (prioridade),
      FOREIGN KEY (empresa_id) REFERENCES empresas(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
      FOREIGN KEY (responsavel_id) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    // 5. Ticket Mensagens
    await connection.query(`
    CREATE TABLE IF NOT EXISTS ticket_mensagens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticket_id INT NOT NULL,
      usuario_id INT NULL,
      mensagem TEXT NOT NULL,
      interno TINYINT(1) DEFAULT 0,
      tipo VARCHAR(50) DEFAULT 'texto',
      anexo VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_mensagens_ticket (ticket_id),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    // 6. Ticket Anexos
    await connection.query(`
    CREATE TABLE IF NOT EXISTS ticket_anexos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticket_id INT NOT NULL,
      mensagem_id INT NULL,
      usuario_id INT NOT NULL,
      empresa_id INT NULL,
      nome_original VARCHAR(255) NOT NULL,
      nome_arquivo VARCHAR(255) NOT NULL,
      caminho TEXT NOT NULL,
      mime_type VARCHAR(150) NOT NULL,
      tamanho_bytes INT NOT NULL,
      tipo VARCHAR(50) DEFAULT 'arquivo',
      interno TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_ticket_anexos_ticket_id (ticket_id),
      KEY idx_ticket_anexos_mensagem_id (mensagem_id),
      KEY idx_ticket_anexos_usuario_id (usuario_id),
      KEY idx_ticket_anexos_empresa_id (empresa_id),
      KEY idx_ticket_anexos_created_at (created_at),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (mensagem_id) REFERENCES ticket_mensagens(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    // 7. Logs Sistema
    await connection.query(`
    CREATE TABLE IF NOT EXISTS logs_sistema (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT,
      empresa_id INT,
      acao VARCHAR(255) NOT NULL,
      descricao TEXT,
      ip VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_logs_usuario (usuario_id),
      KEY idx_logs_empresa (empresa_id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    // 8. Notificacoes
    await connection.query(`
    CREATE TABLE IF NOT EXISTS notificacoes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      empresa_id INT NULL,
      tipo VARCHAR(80) NOT NULL,
      titulo VARCHAR(180) NOT NULL,
      mensagem TEXT NULL,
      link VARCHAR(255) NULL,
      lida TINYINT(1) DEFAULT 0,
      metadata JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      read_at TIMESTAMP NULL,
      KEY idx_notificacoes_usuario (usuario_id),
      KEY idx_notificacoes_empresa (empresa_id),
      KEY idx_notificacoes_lida (lida),
      KEY idx_notificacoes_created_at (created_at),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    // 9. Ticket Tags
    await connection.query(`
    CREATE TABLE IF NOT EXISTS ticket_tags (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticket_id INT NOT NULL,
      tag VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_ticket_tags_ticket_id (ticket_id),
      KEY idx_ticket_tags_tag (tag),
      UNIQUE KEY unique_ticket_tag (ticket_id, tag),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    // 10. Ticket Custom Fields
    await connection.query(`
    CREATE TABLE IF NOT EXISTS ticket_custom_fields (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticket_id INT NOT NULL,
      field_key VARCHAR(80) NOT NULL,
      field_label VARCHAR(120) NOT NULL,
      field_value TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_ticket_custom_fields_ticket_id (ticket_id),
      UNIQUE KEY unique_ticket_field (ticket_id, field_key),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    // 11. Ticket Views
    await connection.query(`
    CREATE TABLE IF NOT EXISTS ticket_views (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      usuario_id INT NOT NULL,
      nome VARCHAR(100) NOT NULL,
      filtros_json JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_ticket_views_empresa_usuario (empresa_id, usuario_id),
      UNIQUE KEY unique_user_view_name (usuario_id, nome),
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    // 12. Ticket Macros
    await connection.query(`
    CREATE TABLE IF NOT EXISTS ticket_macros (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      titulo VARCHAR(120) NOT NULL,
      conteudo TEXT NOT NULL,
      categoria VARCHAR(80) NULL,
      ativo TINYINT(1) DEFAULT 1,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_ticket_macros_empresa (empresa_id),
      KEY idx_ticket_macros_ativo (ativo),
      KEY idx_ticket_macros_categoria (categoria),
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    // 13. Ticket Leituras
    await connection.query(`
    CREATE TABLE IF NOT EXISTS ticket_leituras (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticket_id INT NOT NULL,
      usuario_id INT NOT NULL,
      last_read_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_ticket_usuario (ticket_id, usuario_id),
      KEY idx_ticket_leituras_ticket (ticket_id),
      KEY idx_ticket_leituras_usuario (usuario_id),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    // 14. Empresa Categorias & Serviços
    await connection.query(`
    CREATE TABLE IF NOT EXISTS empresa_ticket_categorias (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      nome VARCHAR(100) NOT NULL,
      sigla VARCHAR(6) NULL,
      valor VARCHAR(100) NOT NULL,
      ativo TINYINT(1) DEFAULT 1,
      ordem INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_empresa_categoria (empresa_id, valor),
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    await connection.query(`
    CREATE TABLE IF NOT EXISTS empresa_ticket_servicos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      nome VARCHAR(100) NOT NULL,
      valor VARCHAR(100) NOT NULL,
      ativo TINYINT(1) DEFAULT 1,
      ordem INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_empresa_servico (empresa_id, valor),
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    // 15. Automacoes & SLA
    await connection.query(`
    CREATE TABLE IF NOT EXISTS ticket_automacoes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      nome VARCHAR(100) NOT NULL,
      descricao TEXT NULL,
      evento VARCHAR(100) NOT NULL,
      condicoes_json JSON,
      acoes_json JSON,
      ativo TINYINT(1) DEFAULT 1,
      ordem INT DEFAULT 0,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    await connection.query(`
    CREATE TABLE IF NOT EXISTS empresa_sla_politicas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      nome VARCHAR(100) NOT NULL,
      prioridade VARCHAR(50) NULL,
      categoria VARCHAR(100) NULL,
      servico VARCHAR(100) NULL,
      tempo_primeira_resposta_minutos INT NULL,
      tempo_resolucao_minutos INT NOT NULL,
      ativo TINYINT(1) DEFAULT 1,
      ordem INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    // 16. CSAT, Knowledge, Distribuição, Eventos
    await connection.query(`
    CREATE TABLE IF NOT EXISTS ticket_satisfacao (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticket_id INT NOT NULL,
      empresa_id INT NOT NULL,
      nota INT NULL,
      comentario TEXT NULL,
      token VARCHAR(255) NULL,
      respondido_em DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_ticket_satisfacao (ticket_id),
      UNIQUE KEY unique_token_satisfacao (token),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    await connection.query(`
    CREATE TABLE IF NOT EXISTS knowledge_articles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      titulo VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NULL,
      conteudo TEXT NOT NULL,
      categoria VARCHAR(100) NULL,
      tags_json JSON NULL,
      publico TINYINT(1) DEFAULT 0,
      ativo TINYINT(1) DEFAULT 1,
      created_by INT NULL,
      updated_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    await connection.query(`
    CREATE TABLE IF NOT EXISTS empresa_distribuicao_regras (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL,
      nome VARCHAR(100) NOT NULL,
      metodo VARCHAR(50) NOT NULL,
      categoria VARCHAR(100) NULL,
      servico VARCHAR(100) NULL,
      ativo TINYINT(1) DEFAULT 1,
      config_json JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    await connection.query(`
    CREATE TABLE IF NOT EXISTS ticket_eventos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticket_id INT NOT NULL,
      empresa_id INT NOT NULL,
      usuario_id INT NULL,
      tipo VARCHAR(100) NOT NULL,
      descricao TEXT,
      metadata_json JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}
