const permissions = [
    ['obrigacoes.municipios.visualizar', 'Acesso', 'Ver municípios', 'Acessar os cadastros municipais e seus responsáveis.', 'baixo', 2550],
    ['obrigacoes.municipios.criar', 'Cadastro', 'Cadastrar municípios', 'Criar e clonar cadastros municipais.', 'medio', 2560],
    ['obrigacoes.municipios.editar', 'Cadastro', 'Editar municípios', 'Alterar contatos, serviços e responsáveis municipais.', 'medio', 2570],
    ['obrigacoes.municipios.excluir', 'Cadastro', 'Excluir municípios', 'Excluir municípios e todos os registros de obrigações vinculados.', 'critico', 2580],
];
export async function up(connection) {
    for (const [key, group, name, description, risk, order] of permissions) {
        await connection.query(`INSERT INTO permissions_catalog
        (permission_key, modulo, grupo, nome, descricao, nivel_risco, ativo, ordem)
       VALUES (?, 'Obrigações', ?, ?, ?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE modulo = VALUES(modulo), grupo = VALUES(grupo),
         nome = VALUES(nome), descricao = VALUES(descricao), nivel_risco = VALUES(nivel_risco),
         ativo = 1, ordem = VALUES(ordem)`, [key, group, name, description, risk, order]);
    }
    const rolePermissions = {
        gestor: permissions.map(([key]) => key),
        atendente: [permissions[0][0]],
    };
    for (const [role, keys] of Object.entries(rolePermissions)) {
        for (const key of keys) {
            await connection.query('INSERT IGNORE INTO role_permissions (perfil, permission_key, allowed) VALUES (?, ?, 1)', [role, key]);
            await connection.query(`INSERT IGNORE INTO access_profile_permissions (access_profile_id, permission_key, allowed)
         SELECT id, ?, 1 FROM access_profiles WHERE base_perfil = ?`, [key, role]);
        }
    }
}
