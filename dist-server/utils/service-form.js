import pool from '../db/connection.js';
const FIELD_TYPES = new Set(['texto', 'texto_longo', 'numero', 'data', 'selecao']);
export function normalizeServiceForm(value) {
    let parsed = value;
    if (typeof value === 'string') {
        try {
            parsed = JSON.parse(value);
        }
        catch {
            throw new Error('Formulario do servico invalido.');
        }
    }
    if (parsed === null || parsed === undefined || parsed === '')
        return [];
    if (!Array.isArray(parsed) || parsed.length > 20)
        throw new Error('Formulario do servico invalido.');
    const usedKeys = new Set();
    return parsed.map((raw, index) => {
        const rotulo = String(raw?.rotulo || '').trim().slice(0, 120);
        const chave = String(raw?.chave || rotulo)
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
            .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
        const tipo = String(raw?.tipo || 'texto');
        if (!rotulo || !chave || !FIELD_TYPES.has(tipo) || usedKeys.has(chave)) {
            throw new Error(`Campo ${index + 1} do formulario invalido.`);
        }
        usedKeys.add(chave);
        const opcoes = tipo === 'selecao'
            ? Array.from(new Set((Array.isArray(raw?.opcoes) ? raw.opcoes : [])
                .map((item) => String(item).trim()).filter((item) => Boolean(item)))).slice(0, 30)
            : undefined;
        if (tipo === 'selecao' && !opcoes?.length)
            throw new Error(`Informe as opcoes de "${rotulo}".`);
        return { chave, rotulo, tipo: tipo, obrigatorio: Boolean(raw?.obrigatorio), opcoes };
    });
}
export async function validateServiceFormAnswers(service, answersValue) {
    let answers = {};
    if (typeof answersValue === 'string' && answersValue.trim()) {
        try {
            answers = JSON.parse(answersValue);
        }
        catch {
            throw new Error('Respostas do formulario invalidas.');
        }
    }
    else if (answersValue && typeof answersValue === 'object' && !Array.isArray(answersValue)) {
        answers = answersValue;
    }
    if (!service)
        return [];
    const [rows] = await pool.query('SELECT formulario_json FROM ticket_services WHERE valor = ? AND ativo = 1 LIMIT 1', [String(service)]);
    const schema = normalizeServiceForm(rows[0]?.formulario_json);
    return schema.map(field => {
        const raw = answers[field.chave];
        const value = raw === null || raw === undefined ? '' : String(raw).trim();
        if (field.obrigatorio && !value)
            throw new Error(`O campo "${field.rotulo}" e obrigatorio.`);
        if (field.tipo === 'selecao' && value && !field.opcoes?.includes(value)) {
            throw new Error(`Valor invalido para "${field.rotulo}".`);
        }
        if (field.tipo === 'numero' && value && !Number.isFinite(Number(value))) {
            throw new Error(`Informe um numero valido em "${field.rotulo}".`);
        }
        return { field_key: field.chave, field_label: field.rotulo, field_value: value.slice(0, 5000) };
    }).filter(field => field.field_value || schema.find(item => item.chave === field.field_key)?.obrigatorio);
}
