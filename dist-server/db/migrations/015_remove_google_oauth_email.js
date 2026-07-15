async function columnExists(connection, table, column) {
    const [rows] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `, [table, column]);
    return Number(rows[0]?.count || 0) > 0;
}
export async function up(connection) {
    const table = 'empresa_email_canais';
    const columns = [
        'send_provider',
        'send_status',
        'oauth_provider',
        'oauth_email',
        'oauth_scopes',
        'oauth_access_token_enc',
        'oauth_refresh_token_enc',
        'oauth_token_expires_at',
        'oauth_connected_at',
        'oauth_connected_by_user_id',
        'oauth_last_refresh_at',
        'oauth_last_error',
        'send_last_at',
        'send_last_test_at',
        'send_last_test_result',
    ];
    for (const column of columns) {
        if (await columnExists(connection, table, column)) {
            await connection.query(`ALTER TABLE ${table} DROP COLUMN ${column}`);
        }
    }
}
