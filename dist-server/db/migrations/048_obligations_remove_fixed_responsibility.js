const obligationCodes = ['MSC', 'RREO', 'RGF', 'DCA', 'SIOPE', 'SIOPS'];
async function columnExists(connection, table, column) {
    const [rows] = await connection.query(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [table, column]);
    return rows.length > 0;
}
async function constraintExists(connection, table, constraint) {
    const [rows] = await connection.query(`SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`, [table, constraint]);
    return rows.length > 0;
}
function parseConfig(value) {
    if (!value)
        return {};
    if (typeof value === 'object')
        return value;
    try {
        return JSON.parse(String(value));
    }
    catch {
        return {};
    }
}
function serviceConfigFromLegacy(value) {
    const legacy = parseConfig(value);
    return {
        activeServices: Object.fromEntries(obligationCodes.map((code) => [code, legacy._activeServices?.[code] !== false])),
    };
}
export async function up(connection) {
    await connection.query(`
    CREATE TABLE IF NOT EXISTS obligation_legacy_responsibility_archive (
      id INT AUTO_INCREMENT PRIMARY KEY,
      municipality_id INT NOT NULL,
      municipality_name VARCHAR(255) NOT NULL,
      responsible_config JSON NOT NULL,
      archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_obligation_legacy_responsibility_municipality (municipality_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    await connection.query(`
    CREATE TABLE IF NOT EXISTS obligation_municipality_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      municipality_id INT NOT NULL,
      user_id INT NULL,
      actor_name VARCHAR(255) NOT NULL,
      action ENUM('created', 'updated', 'deactivated') NOT NULL,
      changes_json JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_obligation_municipality_history_municipality (municipality_id, created_at),
      KEY idx_obligation_municipality_history_user (user_id),
      CONSTRAINT fk_obligation_municipality_history_municipality
        FOREIGN KEY (municipality_id) REFERENCES obligation_municipalities(id) ON DELETE CASCADE,
      CONSTRAINT fk_obligation_municipality_history_user
        FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    if (!(await columnExists(connection, 'obligation_municipalities', 'service_config'))) {
        await connection.query(`ALTER TABLE obligation_municipalities
       ADD COLUMN service_config JSON NULL AFTER state`);
    }
    if (!(await columnExists(connection, 'obligation_municipalities', 'created_by'))) {
        await connection.query('ALTER TABLE obligation_municipalities ADD COLUMN created_by INT NULL AFTER active');
    }
    if (!(await columnExists(connection, 'obligation_municipalities', 'updated_by'))) {
        await connection.query('ALTER TABLE obligation_municipalities ADD COLUMN updated_by INT NULL AFTER created_by');
    }
    if (!(await columnExists(connection, 'obligation_municipalities', 'version'))) {
        await connection.query('ALTER TABLE obligation_municipalities ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 1 AFTER updated_by');
    }
    if (!(await constraintExists(connection, 'obligation_municipalities', 'fk_obligation_municipalities_created_by'))) {
        await connection.query(`ALTER TABLE obligation_municipalities
       ADD CONSTRAINT fk_obligation_municipalities_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL`);
    }
    if (!(await constraintExists(connection, 'obligation_municipalities', 'fk_obligation_municipalities_updated_by'))) {
        await connection.query(`ALTER TABLE obligation_municipalities
       ADD CONSTRAINT fk_obligation_municipalities_updated_by FOREIGN KEY (updated_by) REFERENCES usuarios(id) ON DELETE SET NULL`);
    }
    if (!(await columnExists(connection, 'obligation_tasks', 'created_by'))) {
        await connection.query('ALTER TABLE obligation_tasks ADD COLUMN created_by INT NULL AFTER siope_folha');
    }
    if (!(await columnExists(connection, 'obligation_tasks', 'updated_by'))) {
        await connection.query('ALTER TABLE obligation_tasks ADD COLUMN updated_by INT NULL AFTER created_by');
    }
    if (!(await columnExists(connection, 'obligation_tasks', 'version'))) {
        await connection.query('ALTER TABLE obligation_tasks ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 1 AFTER updated_by');
    }
    if (!(await constraintExists(connection, 'obligation_tasks', 'fk_obligation_tasks_created_by'))) {
        await connection.query(`ALTER TABLE obligation_tasks
       ADD CONSTRAINT fk_obligation_tasks_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL`);
    }
    if (!(await constraintExists(connection, 'obligation_tasks', 'fk_obligation_tasks_updated_by'))) {
        await connection.query(`ALTER TABLE obligation_tasks
       ADD CONSTRAINT fk_obligation_tasks_updated_by FOREIGN KEY (updated_by) REFERENCES usuarios(id) ON DELETE SET NULL`);
    }
    if (await columnExists(connection, 'obligation_municipalities', 'responsible_config')) {
        const [municipalities] = await connection.query('SELECT id, name, responsible_config, service_config FROM obligation_municipalities');
        for (const municipality of municipalities) {
            const legacy = parseConfig(municipality.responsible_config);
            if (Object.keys(legacy).length > 0) {
                await connection.query(`INSERT IGNORE INTO obligation_legacy_responsibility_archive
            (municipality_id, municipality_name, responsible_config) VALUES (?, ?, ?)`, [municipality.id, municipality.name, JSON.stringify(legacy)]);
            }
            const serviceConfig = municipality.service_config
                ? parseConfig(municipality.service_config)
                : serviceConfigFromLegacy(legacy);
            await connection.query('UPDATE obligation_municipalities SET service_config = ? WHERE id = ?', [JSON.stringify(serviceConfig), municipality.id]);
        }
        await connection.query('ALTER TABLE obligation_municipalities DROP COLUMN responsible_config');
    }
    await connection.query(`UPDATE obligation_municipalities
     SET service_config = ? WHERE service_config IS NULL`, [JSON.stringify({ activeServices: Object.fromEntries(obligationCodes.map((code) => [code, true])) })]);
    const permissionDescriptions = [
        ['obrigacoes.municipios.visualizar', 'Acessar os cadastros municipais e serviços aplicáveis.'],
        ['obrigacoes.municipios.editar', 'Alterar contatos e serviços aplicáveis aos municípios.'],
        ['obrigacoes.municipios.excluir', 'Desativar municípios preservando obrigações e histórico vinculados.'],
        ['obrigacoes.planilha.editar', 'Alterar qualquer obrigação e seus controles auxiliares, com auditoria e controle de concorrência.'],
    ];
    for (const [key, description] of permissionDescriptions) {
        await connection.query('UPDATE permissions_catalog SET descricao = ? WHERE permission_key = ?', [description, key]);
    }
    await connection.query(`UPDATE permissions_catalog SET nome = 'Desativar municípios'
     WHERE permission_key = 'obrigacoes.municipios.excluir'`);
}
// Reversão conservadora: restaura a configuração legada sem apagar colunas de auditoria.
export async function down(connection) {
    if (!(await columnExists(connection, 'obligation_municipalities', 'responsible_config'))) {
        await connection.query('ALTER TABLE obligation_municipalities ADD COLUMN responsible_config JSON NULL AFTER state');
    }
    const [archiveRows] = await connection.query('SELECT municipality_id, responsible_config FROM obligation_legacy_responsibility_archive');
    for (const row of archiveRows) {
        await connection.query('UPDATE obligation_municipalities SET responsible_config = ? WHERE id = ?', [JSON.stringify(parseConfig(row.responsible_config)), row.municipality_id]);
    }
}
