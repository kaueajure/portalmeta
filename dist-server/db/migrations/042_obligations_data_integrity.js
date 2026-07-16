const obligationCodes = ['MSC', 'RREO', 'RGF', 'DCA', 'SIOPE', 'SIOPS'];
export async function up(connection) {
    await connection.query(`DELETE FROM obligation_municipalities
     WHERE observations = 'Cadastro inicial migrado do módulo de obrigações'`);
    const [userRows] = await connection.query(`SELECT nome FROM usuarios
     WHERE ativo = 1 AND COALESCE(perfil, '') <> 'cliente'`);
    const canonicalNames = new Map(userRows.map((row) => [
        String(row.nome).trim().toLocaleLowerCase('pt-BR'),
        String(row.nome).trim(),
    ]));
    const [municipalityRows] = await connection.query('SELECT id, responsible_config FROM obligation_municipalities');
    for (const municipality of municipalityRows) {
        const config = typeof municipality.responsible_config === 'object'
            ? municipality.responsible_config || {}
            : JSON.parse(String(municipality.responsible_config || '{}'));
        for (const code of obligationCodes) {
            config[code] = Array.from(new Set(String(config[code] || '')
                .split(',')
                .map((name) => canonicalNames.get(name.trim().toLocaleLowerCase('pt-BR')))
                .filter((name) => Boolean(name)))).join(', ');
        }
        await connection.query(`UPDATE obligation_municipalities
       SET state = 'SP', responsible_config = ?
       WHERE id = ?`, [JSON.stringify(config), municipality.id]);
    }
}
