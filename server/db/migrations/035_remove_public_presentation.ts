import { PoolConnection } from 'mysql2/promise';

/**
 * O Portal Meta passou a ser uma aplicação de acesso restrito: a rota raiz
 * exibe o login e não existe mais vitrine comercial ou edição de páginas públicas.
 */
export async function up(connection: PoolConnection) {
  await connection.query("DELETE FROM user_permission_overrides WHERE permission_key LIKE 'telas.%'");
  await connection.query("DELETE FROM role_permissions WHERE permission_key LIKE 'telas.%'");
  await connection.query("DELETE FROM access_profile_permissions WHERE permission_key LIKE 'telas.%'");
  await connection.query("DELETE FROM permissions_catalog WHERE permission_key LIKE 'telas.%'");
  await connection.query('DROP TABLE IF EXISTS public_page_settings');
}
