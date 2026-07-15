export async function up(connection) {
    const tables = [
        ['role_permissions', 'role'],
        ['access_profile_permissions', 'access_profile_id'],
        ['user_permission_overrides', 'usuario_id'],
    ];
    for (const [table] of tables) {
        await connection.query(`UPDATE IGNORE ${table}
       SET permission_key = 'configuracoes.identidade'
       WHERE permission_key = 'configuracoes.empresa'`);
    }
    await connection.query(`DELETE FROM role_permissions
     WHERE permission_key LIKE 'empresas.%'
        OR permission_key = 'usuarios.alterar_empresa'
        OR permission_key = 'configuracoes.empresa'`);
    await connection.query(`DELETE FROM access_profile_permissions
     WHERE permission_key LIKE 'empresas.%'
        OR permission_key = 'usuarios.alterar_empresa'
        OR permission_key = 'configuracoes.empresa'`);
    await connection.query(`DELETE FROM user_permission_overrides
     WHERE permission_key LIKE 'empresas.%'
        OR permission_key = 'usuarios.alterar_empresa'
        OR permission_key = 'configuracoes.empresa'`);
    await connection.query(`DELETE FROM permissions_catalog
     WHERE permission_key LIKE 'empresas.%'
        OR permission_key = 'usuarios.alterar_empresa'
        OR permission_key = 'configuracoes.empresa'`);
}
