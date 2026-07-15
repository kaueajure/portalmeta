export async function up(connection) {
    await connection.query(`
    ALTER TABLE tickets
    MODIFY COLUMN status VARCHAR(80) NOT NULL DEFAULT 'aberto'
  `);
}
