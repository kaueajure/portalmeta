const permissions = [
    ['obrigacoes.planilha.visualizar', 'Acesso', 'Ver Planilha Principal', 'Acessar a matriz de obrigações municipais.', 'baixo', 2500],
    ['obrigacoes.planilha.editar', 'Operação', 'Editar obrigações', 'Alterar status e controles auxiliares das competências.', 'medio', 2510],
    ['obrigacoes.planilha.comentar', 'Colaboração', 'Comentar em obrigações', 'Registrar comentários nas competências municipais.', 'baixo', 2520],
    ['obrigacoes.planilha.anexar', 'Arquivos', 'Anexar arquivos', 'Enviar e baixar arquivos vinculados às competências.', 'medio', 2530],
    ['obrigacoes.planilha.editar_historico', 'Auditoria', 'Corrigir histórico', 'Corrigir registros históricos e refletir o valor na obrigação.', 'alto', 2540],
];
export async function up(connection) {
    await connection.query(`
    CREATE TABLE IF NOT EXISTS obligation_municipalities (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      state CHAR(2) NOT NULL,
      responsible_config JSON NULL,
      phone VARCHAR(100) NULL,
      email VARCHAR(255) NULL,
      observations TEXT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_obligation_municipality_name_state (name, state),
      INDEX idx_obligation_municipality_active_name (active, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    await connection.query(`
    CREATE TABLE IF NOT EXISTS obligation_tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      municipality_id INT NOT NULL,
      obligation_code VARCHAR(20) NOT NULL,
      competence VARCHAR(100) NOT NULL,
      year SMALLINT UNSIGNED NOT NULL,
      status VARCHAR(100) NOT NULL DEFAULT 'Falta XML',
      siops_membros VARCHAR(100) NULL,
      siope_folha VARCHAR(100) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_obligation_task_scope (municipality_id, obligation_code, competence, year),
      INDEX idx_obligation_task_filter (year, obligation_code, municipality_id),
      INDEX idx_obligation_task_status (status),
      CONSTRAINT fk_obligation_tasks_municipality
        FOREIGN KEY (municipality_id) REFERENCES obligation_municipalities(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    await connection.query(`
    CREATE TABLE IF NOT EXISTS obligation_task_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id INT NOT NULL,
      field_changed VARCHAR(100) NOT NULL,
      old_value TEXT NULL,
      new_value TEXT NULL,
      user_id INT NULL,
      actor_name VARCHAR(255) NOT NULL,
      observation TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_obligation_history_task_date (task_id, created_at),
      CONSTRAINT fk_obligation_history_task
        FOREIGN KEY (task_id) REFERENCES obligation_tasks(id) ON DELETE CASCADE,
      CONSTRAINT fk_obligation_history_user
        FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    await connection.query(`
    CREATE TABLE IF NOT EXISTS obligation_task_comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id INT NOT NULL,
      author_id INT NULL,
      author_name VARCHAR(255) NOT NULL,
      text TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_obligation_comments_task_date (task_id, created_at),
      CONSTRAINT fk_obligation_comments_task
        FOREIGN KEY (task_id) REFERENCES obligation_tasks(id) ON DELETE CASCADE,
      CONSTRAINT fk_obligation_comments_user
        FOREIGN KEY (author_id) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    await connection.query(`
    CREATE TABLE IF NOT EXISTS obligation_task_attachments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id INT NOT NULL,
      uploaded_by INT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_type VARCHAR(150) NOT NULL,
      file_size INT UNSIGNED NOT NULL,
      file_data LONGBLOB NOT NULL,
      uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_obligation_attachments_task_date (task_id, uploaded_at),
      CONSTRAINT fk_obligation_attachments_task
        FOREIGN KEY (task_id) REFERENCES obligation_tasks(id) ON DELETE CASCADE,
      CONSTRAINT fk_obligation_attachments_user
        FOREIGN KEY (uploaded_by) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    for (const [key, group, name, description, risk, order] of permissions) {
        await connection.query(`INSERT INTO permissions_catalog
        (permission_key, modulo, grupo, nome, descricao, nivel_risco, ativo, ordem)
       VALUES (?, 'Obrigações', ?, ?, ?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE modulo = VALUES(modulo), grupo = VALUES(grupo),
         nome = VALUES(nome), descricao = VALUES(descricao), nivel_risco = VALUES(nivel_risco),
         ativo = 1, ordem = VALUES(ordem)`, [key, group, name, description, risk, order]);
    }
    const rolePermissions = {
        gestor: permissions.map(([key]) => key),
        atendente: permissions.slice(0, 4).map(([key]) => key),
    };
    for (const [role, keys] of Object.entries(rolePermissions)) {
        for (const key of keys) {
            await connection.query('INSERT IGNORE INTO role_permissions (perfil, permission_key, allowed) VALUES (?, ?, 1)', [role, key]);
            await connection.query(`INSERT IGNORE INTO access_profile_permissions (access_profile_id, permission_key, allowed)
         SELECT id, ?, 1 FROM access_profiles WHERE base_perfil = ?`, [key, role]);
        }
    }
}
