import { PoolConnection } from 'mysql2/promise';

const permission = [
  'obrigacoes.dashboard.visualizar',
  'Acesso',
  'Ver Dashboard',
  'Acompanhar indicadores, vencimentos e desempenho das obrigações.',
  'baixo',
  2590,
] as const;

export async function up(connection: PoolConnection) {
  const [key, group, name, description, risk, order] = permission;
  await connection.query(
    `INSERT INTO permissions_catalog
      (permission_key, modulo, grupo, nome, descricao, nivel_risco, ativo, ordem)
     VALUES (?, 'Obrigações', ?, ?, ?, ?, 1, ?)
     ON DUPLICATE KEY UPDATE modulo = VALUES(modulo), grupo = VALUES(grupo),
       nome = VALUES(nome), descricao = VALUES(descricao), nivel_risco = VALUES(nivel_risco),
       ativo = 1, ordem = VALUES(ordem)`,
    [key, group, name, description, risk, order],
  );

  for (const role of ['gestor', 'atendente']) {
    await connection.query(
      'INSERT IGNORE INTO role_permissions (perfil, permission_key, allowed) VALUES (?, ?, 1)',
      [role, key],
    );
    await connection.query(
      `INSERT IGNORE INTO access_profile_permissions (access_profile_id, permission_key, allowed)
       SELECT id, ?, 1 FROM access_profiles WHERE base_perfil = ?`,
      [key, role],
    );
  }
}
