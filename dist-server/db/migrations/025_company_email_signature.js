async function columnExists(connection, table, column) {
    const [rows] = await connection.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `, [table, column]);
    return rows.length > 0;
}
export async function up(connection) {
    if (!await columnExists(connection, 'empresas', 'email_assinatura')) {
        await connection.query(`
      ALTER TABLE empresas
      ADD COLUMN email_assinatura TEXT NULL AFTER logo
    `);
    }
    await connection.query(`
    UPDATE empresas
    SET email_assinatura = CONCAT('Atenciosamente,\\nEquipe de Atendimento\\n', nome)
    WHERE email_assinatura IS NULL OR TRIM(email_assinatura) = ''
  `);
}
