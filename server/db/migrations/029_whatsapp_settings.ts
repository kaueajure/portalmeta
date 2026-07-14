import { PoolConnection } from 'mysql2/promise';

/**
 * Configurações de produto do WhatsApp (auto-reply / menu de boas-vindas).
 * Singleton: uma linha (id = 1). Credenciais Meta continuam no .env.
 */
export async function up(connection: PoolConnection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_settings (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
      auto_reply_enabled TINYINT(1) NOT NULL DEFAULT 0,
      auto_reply_trigger VARCHAR(80) NOT NULL DEFAULT 'teste',
      welcome_header VARCHAR(60) NOT NULL DEFAULT 'MetaBit - Sistemas para Gestão Pública',
      welcome_body TEXT NOT NULL,
      welcome_buttons_json JSON NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const defaultButtons = JSON.stringify([
    { id: 'pgp', title: 'Gestão Pública' },
    { id: 'pci', title: 'Controle Interno' },
    { id: 'pts', title: 'Terceiro Setor' },
  ]);

  const defaultBody =
    'Seja Bem-Vindo, antes de iniciarmos seu atendimento, sobre qual sistema gostaria de falar?';

  await connection.query(
    `
      INSERT INTO whatsapp_settings (
        id, auto_reply_enabled, auto_reply_trigger,
        welcome_header, welcome_body, welcome_buttons_json
      ) VALUES (1, 1, 'teste', ?, ?, ?)
      ON DUPLICATE KEY UPDATE id = id
    `,
    ['MetaBit - Sistemas para Gestão Pública', defaultBody, defaultButtons],
  );
}
