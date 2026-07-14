import { PoolConnection } from 'mysql2/promise';

async function columnExists(connection: PoolConnection, table: string, column: string): Promise<boolean> {
  const [rows]: any = await connection.query(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [table, column],
  );
  return rows.length > 0;
}

/**
 * Tipo do menu inicial WhatsApp:
 * - buttons: até 3 reply buttons (limite Meta)
 * - list: lista com até 10 itens (limite Meta)
 */
export async function up(connection: PoolConnection) {
  if (!(await columnExists(connection, 'whatsapp_settings', 'menu_type'))) {
    await connection.query(`
      ALTER TABLE whatsapp_settings
      ADD COLUMN menu_type VARCHAR(20) NOT NULL DEFAULT 'buttons' AFTER welcome_body
    `);
  }

  if (!(await columnExists(connection, 'whatsapp_settings', 'list_button_text'))) {
    await connection.query(`
      ALTER TABLE whatsapp_settings
      ADD COLUMN list_button_text VARCHAR(20) NOT NULL DEFAULT 'Ver opções' AFTER welcome_buttons_json
    `);
  }

  if (!(await columnExists(connection, 'whatsapp_settings', 'list_section_title'))) {
    await connection.query(`
      ALTER TABLE whatsapp_settings
      ADD COLUMN list_section_title VARCHAR(24) NOT NULL DEFAULT 'Atendimento' AFTER list_button_text
    `);
  }
}
