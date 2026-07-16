import { PoolConnection } from 'mysql2/promise';

const permission = {
  key: 'tickets.unir',
  modulo: 'Chamados',
  grupo: 'Ações',
  nome: 'Unir chamados duplicados',
  descricao: 'Consolidar conversa, anexos, tags e histórico de um chamado duplicado.',
  risco: 'alto',
  ordem: 175,
};

export async function up(connection: PoolConnection) {
  await connection.query(
    `INSERT INTO permissions_catalog
      (permission_key, modulo, grupo, nome, descricao, nivel_risco, ativo, ordem)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)
     ON DUPLICATE KEY UPDATE
       modulo = VALUES(modulo), grupo = VALUES(grupo), nome = VALUES(nome),
       descricao = VALUES(descricao), nivel_risco = VALUES(nivel_risco), ativo = 1, ordem = VALUES(ordem)`,
    [permission.key, permission.modulo, permission.grupo, permission.nome, permission.descricao, permission.risco, permission.ordem],
  );
  await connection.query(
    `INSERT IGNORE INTO role_permissions (perfil, permission_key, allowed)
     VALUES ('gestor', ?, 1)`,
    [permission.key],
  );
  await connection.query(
    `INSERT IGNORE INTO access_profile_permissions (access_profile_id, permission_key, allowed)
     SELECT id, ?, 1 FROM access_profiles WHERE base_perfil = 'gestor'`,
    [permission.key],
  );
}
