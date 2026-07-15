const SCOPED_COLUMNS = ['empresa_id', 'company_id', 'tenant_id'];
async function dropForeignKeys(connection) {
    const [rows] = await connection.query(`SELECT DISTINCT TABLE_NAME, CONSTRAINT_NAME
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND CONSTRAINT_NAME <> 'PRIMARY'
       AND REFERENCED_TABLE_NAME IS NOT NULL
       AND (COLUMN_NAME IN (?) OR REFERENCED_TABLE_NAME = 'empresas')`, [SCOPED_COLUMNS]);
    for (const row of rows) {
        await connection.query(`ALTER TABLE \`${row.TABLE_NAME}\` DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``);
    }
}
async function dropScopedIndexes(connection) {
    const [rows] = await connection.query(`SELECT DISTINCT s.TABLE_NAME, s.INDEX_NAME
     FROM information_schema.STATISTICS s
     JOIN information_schema.COLUMNS c
       ON c.TABLE_SCHEMA = s.TABLE_SCHEMA
      AND c.TABLE_NAME = s.TABLE_NAME
      AND c.COLUMN_NAME = s.COLUMN_NAME
     WHERE s.TABLE_SCHEMA = DATABASE()
       AND s.INDEX_NAME <> 'PRIMARY'
       AND c.COLUMN_NAME IN (?)`, [SCOPED_COLUMNS]);
    for (const row of rows) {
        await connection.query(`ALTER TABLE \`${row.TABLE_NAME}\` DROP INDEX \`${row.INDEX_NAME}\``);
    }
}
async function dropScopedColumns(connection) {
    const [rows] = await connection.query(`SELECT TABLE_NAME, COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND COLUMN_NAME IN (?)
     ORDER BY TABLE_NAME`, [SCOPED_COLUMNS]);
    for (const row of rows) {
        await connection.query(`ALTER TABLE \`${row.TABLE_NAME}\` DROP COLUMN \`${row.COLUMN_NAME}\``);
    }
}
async function renameTable(connection, from, to) {
    const [rows] = await connection.query(`SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`, [from]);
    if (rows.length === 0)
        return;
    const [targetRows] = await connection.query(`SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`, [to]);
    if (targetRows.length > 0)
        throw new Error(`Contrato single-company abortado: as tabelas ${from} e ${to} coexistem.`);
    await connection.query(`RENAME TABLE \`${from}\` TO \`${to}\``);
}
async function dropIndexIfExists(connection, table, index) {
    const [rows] = await connection.query(`SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`, [table, index]);
    if (rows.length > 0)
        await connection.query(`ALTER TABLE \`${table}\` DROP INDEX \`${index}\``);
}
async function addUniqueIndex(connection, table, index, columns) {
    const [rows] = await connection.query(`SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`, [table, index]);
    if (rows.length === 0) {
        await connection.query(`ALTER TABLE \`${table}\` ADD UNIQUE KEY \`${index}\` (${columns})`);
    }
}
export async function up(connection) {
    const [companies] = await connection.query('SELECT id, nome FROM empresas ORDER BY id');
    if (companies.length !== 1 || Number(companies[0].id) !== 1) {
        throw new Error('Contrato single-company abortado: o banco deve conter somente a MetaBit (ID 1).');
    }
    const [scopedTables] = await connection.query(`SELECT TABLE_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'empresa_id'
     ORDER BY TABLE_NAME`);
    for (const { TABLE_NAME } of scopedTables) {
        const [conflicts] = await connection.query(`SELECT COUNT(*) AS total FROM \`${TABLE_NAME}\`
       WHERE empresa_id IS NOT NULL AND empresa_id <> 1`);
        if (Number(conflicts[0]?.total || 0) > 0) {
            throw new Error(`Contrato single-company abortado: ${TABLE_NAME} possui registros fora da MetaBit.`);
        }
    }
    await dropForeignKeys(connection);
    await dropScopedIndexes(connection);
    await dropScopedColumns(connection);
    await renameTable(connection, 'empresa_email_canais', 'email_channels');
    await renameTable(connection, 'empresa_ticket_categorias', 'ticket_categories');
    await renameTable(connection, 'empresa_ticket_servicos', 'ticket_services');
    await renameTable(connection, 'empresa_ticket_status', 'ticket_statuses');
    await renameTable(connection, 'empresa_sla_politicas', 'sla_policies');
    await renameTable(connection, 'empresa_distribuicao_regras', 'distribution_rules');
    await addUniqueIndex(connection, 'access_profiles', 'uq_access_profiles_nome', '`nome`');
    await addUniqueIndex(connection, 'ticket_categories', 'uq_ticket_categories_valor', '`valor`');
    await addUniqueIndex(connection, 'ticket_services', 'uq_ticket_services_valor', '`valor`');
    await addUniqueIndex(connection, 'ticket_statuses', 'uq_ticket_statuses_valor', '`valor`');
    await addUniqueIndex(connection, 'processed_emails', 'uq_processed_emails_message_id', '`message_id`');
    const [portalColumn] = await connection.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'portal_access_codes'
       AND COLUMN_NAME = 'organization_email'`);
    if (portalColumn.length > 0) {
        await dropIndexIfExists(connection, 'portal_access_codes', 'idx_portal_access_org_email');
        await connection.query('ALTER TABLE portal_access_codes DROP COLUMN organization_email');
    }
    await connection.query('DROP TABLE empresas');
    await connection.query('DROP TABLE IF EXISTS single_company_migration_audit');
}
