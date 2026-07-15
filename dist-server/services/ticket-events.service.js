import pool from '../db/connection.js';
export async function recordTicketEvent({ ticket_id, empresa_id, usuario_id = null, tipo, descricao, metadata = null }) {
    try {
        await pool.query('INSERT INTO ticket_eventos (ticket_id, empresa_id, usuario_id, tipo, descricao, metadata_json) VALUES (?, ?, ?, ?, ?, ?)', [ticket_id, empresa_id, usuario_id, tipo, descricao, metadata ? JSON.stringify(metadata) : null]);
    }
    catch (err) {
        console.error('Falha ao registrar evento do ticket:', err);
    }
}
