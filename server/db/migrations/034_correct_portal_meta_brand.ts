import { PoolConnection } from 'mysql2/promise';

/** Corrige textos persistidos durante a transicao de marca. */
export async function up(connection: PoolConnection) {
  await connection.query(`
    UPDATE public_page_settings
    SET settings_json = REPLACE(
      REPLACE(CAST(settings_json AS CHAR), 'MetaBit', 'Portal Meta'),
      'metabit',
      'portalmeta'
    )
    WHERE CAST(settings_json AS CHAR) LIKE '%MetaBit%'
       OR CAST(settings_json AS CHAR) LIKE '%metabit%'
  `);

  await connection.query(`
    UPDATE access_profiles
    SET descricao = REPLACE(descricao, 'instancia MetaBit', 'instancia Portal Meta')
    WHERE descricao LIKE '%instancia MetaBit%'
  `);

  await connection.query(`
    UPDATE permissions_catalog
    SET descricao = REPLACE(descricao, 'MetaBit', 'Portal Meta')
    WHERE descricao LIKE '%MetaBit%'
  `);
}
