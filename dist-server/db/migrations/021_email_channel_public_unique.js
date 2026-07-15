async function columnExists(connection, table, column) {
    const [rows] = await connection.query(`
      SELECT COUNT(*) AS count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `, [table, column]);
    return Number(rows[0]?.count || 0) > 0;
}
async function indexExists(connection, table, indexName) {
    const [rows] = await connection.query(`
      SELECT COUNT(*) AS count
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
    `, [table, indexName]);
    return Number(rows[0]?.count || 0) > 0;
}
async function duplicatePublicEmailCount(connection) {
    const [rows] = await connection.query(`
      SELECT COUNT(*) AS count
      FROM (
        SELECT LOWER(TRIM(email_publico)) AS email_publico_normalized
        FROM empresa_email_canais
        WHERE email_publico IS NOT NULL AND TRIM(email_publico) <> ''
        GROUP BY LOWER(TRIM(email_publico))
        HAVING COUNT(*) > 1
      ) duplicates
    `);
    return Number(rows[0]?.count || 0);
}
export async function up(connection) {
    const duplicates = await duplicatePublicEmailCount(connection);
    if (duplicates > 0) {
        throw new Error(`empresa_email_canais possui ${duplicates} email_publico duplicado(s) normalizado(s). ` +
            'Corrija os canais duplicados antes de aplicar a trava unica.');
    }
    if (!(await columnExists(connection, 'empresa_email_canais', 'email_publico_normalized'))) {
        await connection.query(`
        ALTER TABLE empresa_email_canais
        ADD COLUMN email_publico_normalized VARCHAR(255)
        GENERATED ALWAYS AS (LOWER(TRIM(email_publico))) STORED
      `);
    }
    if (!(await indexExists(connection, 'empresa_email_canais', 'uniq_email_canais_publico_normalized'))) {
        await connection.query('ALTER TABLE empresa_email_canais ADD UNIQUE INDEX uniq_email_canais_publico_normalized (email_publico_normalized)');
    }
}
export async function down(connection) {
    if (await indexExists(connection, 'empresa_email_canais', 'uniq_email_canais_publico_normalized')) {
        await connection.query('ALTER TABLE empresa_email_canais DROP INDEX uniq_email_canais_publico_normalized');
    }
    if (await columnExists(connection, 'empresa_email_canais', 'email_publico_normalized')) {
        await connection.query('ALTER TABLE empresa_email_canais DROP COLUMN email_publico_normalized');
    }
}
