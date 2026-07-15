import pool from '../db/connection.js';
import { recordTicketEvent } from './ticket-events.service.js';
export async function distributeTicket(ticket) {
    try {
        const { id: ticket_id, empresa_id, categoria, servico } = ticket;
        // Find matching rule
        const [regras] = await pool.query("SELECT * FROM empresa_distribuicao_regras WHERE empresa_id = ? AND ativo = 1 ORDER BY id ASC", [empresa_id]);
        let matchedRule = null;
        for (const rule of regras) {
            let matches = true;
            if (rule.categoria && rule.categoria !== categoria)
                matches = false;
            if (rule.servico && rule.servico !== servico)
                matches = false;
            if (matches) {
                matchedRule = rule;
                break;
            }
        }
        if (!matchedRule)
            return null;
        // Get eligible agents
        let agents = [];
        let config = {};
        if (typeof matchedRule.config_json === 'string') {
            try {
                config = JSON.parse(matchedRule.config_json);
            }
            catch (e) { }
        }
        else if (matchedRule.config_json) {
            config = matchedRule.config_json;
        }
        if (Array.isArray(config.agents) && config.agents.length > 0) {
            const ids = config.agents.map(Number).filter(Boolean);
            if (ids.length > 0) {
                const placeholders = ids.map(() => '?').join(',');
                const [rows] = await pool.query(`SELECT id FROM usuarios WHERE empresa_id = ? AND ativo = 1 AND id IN (${placeholders}) AND (perfil IN ('atendente', 'gestor', 'administrador', 'desenvolvedor') OR administrador = 1)`, [empresa_id, ...ids]);
                agents = rows;
            }
        }
        if (agents.length === 0) {
            const [rows] = await pool.query(`SELECT id FROM usuarios WHERE empresa_id = ? AND ativo = 1 AND (perfil IN ('atendente', 'gestor', 'administrador', 'desenvolvedor') OR administrador = 1)`, [empresa_id]);
            agents = rows;
        }
        if (agents.length === 0)
            return null;
        let assignedAgentId = null;
        if (matchedRule.metodo === 'menor_carga') {
            const agentIds = agents.map(agent => Number(agent.id)).filter(Boolean);
            const [loadRows] = await pool.query(`
           SELECT responsavel_id, COUNT(*) as cnt
           FROM tickets
           WHERE empresa_id = ?
             AND responsavel_id IN (?)
             AND status IN ('aberto', 'em_andamento')
           GROUP BY responsavel_id
         `, [empresa_id, agentIds]);
            const loads = new Map(loadRows.map((row) => [Number(row.responsavel_id), Number(row.cnt || 0)]));
            let lowestLoad = Infinity;
            for (const agent of agents) {
                const load = loads.get(Number(agent.id)) || 0;
                if (load < lowestLoad) {
                    lowestLoad = load;
                    assignedAgentId = agent.id;
                }
            }
        }
        else {
            // round_robin
            // Pick a random for now since state preserving is complex without schema change, 
            // but wait, we can store state in config_json or another table.
            // For a simple robust way, we can check who got the last ticket.
            const [lastTicketRes] = await pool.query("SELECT responsavel_id FROM tickets WHERE responsavel_id IS NOT NULL AND empresa_id = ? ORDER BY id DESC LIMIT 1", [empresa_id]);
            let lastAgentId = lastTicketRes.length > 0 ? lastTicketRes[0].responsavel_id : null;
            let nextIndex = 0;
            if (lastAgentId) {
                const idx = agents.findIndex(a => a.id === lastAgentId);
                if (idx !== -1) {
                    nextIndex = (idx + 1) % agents.length;
                }
            }
            assignedAgentId = agents[nextIndex].id;
        }
        if (assignedAgentId) {
            await pool.query('UPDATE tickets SET responsavel_id = ? WHERE id = ?', [assignedAgentId, ticket_id]);
            await recordTicketEvent({
                ticket_id,
                empresa_id,
                tipo: 'distribuicao_automatica',
                descricao: `Atribuído para usuário ID ${assignedAgentId} via regra ${matchedRule.nome}`
            });
            return assignedAgentId;
        }
        return null;
    }
    catch (err) {
        console.error('Error in distribution', err);
        return null;
    }
}
