import { Router } from 'express';
import pool from '../db/connection.js';

const router = Router();

function isValidCsatToken(token: unknown): token is string {
  return typeof token === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token);
}

router.get('/:token', async (req, res) => {
  const { token } = req.params;
  if (!isValidCsatToken(token)) {
    return res.status(404).json({ error: 'Pesquisa nao encontrada ou invalida.' });
  }

  try {
    const [rows]: any = await pool.query(
      `SELECT s.id, s.ticket_id, s.empresa_id, s.nota, s.comentario, s.respondido_em, s.created_at,
              t.titulo
       FROM ticket_satisfacao s
       INNER JOIN tickets t ON t.id = s.ticket_id
       WHERE s.token = ? AND t.deleted_at IS NULL
       LIMIT 1`,
      [token]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Pesquisa nao encontrada ou invalida.' });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar pesquisa.' });
  }
});

router.post('/:token', async (req, res) => {
  const { token } = req.params;
  const { nota, comentario } = req.body;

  if (!isValidCsatToken(token)) {
    return res.status(404).json({ error: 'Pesquisa nao encontrada ou invalida.' });
  }

  if (typeof nota !== 'number' || nota < 1 || nota > 5) {
    return res.status(400).json({ error: 'Nota deve ser entre 1 e 5.' });
  }

  try {
    const [rows]: any = await pool.query(
      `SELECT s.*
       FROM ticket_satisfacao s
       INNER JOIN tickets t ON t.id = s.ticket_id
       WHERE s.token = ? AND t.deleted_at IS NULL
       LIMIT 1`,
      [token]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Pesquisa nao encontrada ou invalida.' });
    }

    const csat = rows[0];
    if (csat.respondido_em) {
      return res.status(400).json({ error: 'Pesquisa ja respondida.' });
    }

    await pool.query(
      'UPDATE ticket_satisfacao SET nota = ?, comentario = ?, respondido_em = NOW() WHERE token = ?',
      [nota, comentario || null, token]
    );

    try {
      const { recordTicketEvent } = await import('../services/ticket-events.service.js');
      await recordTicketEvent({
        ticket_id: csat.ticket_id,
        empresa_id: csat.empresa_id,
        tipo: 'satisfacao_respondida',
        descricao: `Cliente respondeu CSAT com nota ${nota}`
      });
    } catch (e) {
      await pool.query(
        'INSERT INTO ticket_eventos (ticket_id, empresa_id, tipo, descricao) VALUES (?, ?, ?, ?)',
        [csat.ticket_id, csat.empresa_id, 'satisfacao_respondida', `Cliente respondeu CSAT com nota ${nota}`]
      );
    }

    res.json({ success: true, message: 'Avaliacao registrada com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar avaliacao.' });
  }
});

export default router;
