import pool from '../db/connection.js';
import notificationsService from './notifications.service.js';
import storageService from './storage.service.js';
class AttachmentsService {
    async listByTicket(ticketId, includeInternal) {
        let query = `
      SELECT a.*, COALESCE(u.nome, 'Cliente Externo') as usuario_nome
      FROM ticket_anexos a
      INNER JOIN tickets t ON t.id = a.ticket_id
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      WHERE a.ticket_id = ? AND t.deleted_at IS NULL
    `;
        if (!includeInternal) {
            query += ' AND a.interno = 0';
        }
        query += ' ORDER BY a.created_at DESC';
        const [rows] = await pool.query(query, [ticketId]);
        return rows.map(row => ({
            ...row,
            interno: !!row.interno,
            url: `/api/attachments/${row.id}/download`
        }));
    }
    async getById(id) {
        const [rows] = await pool.query('SELECT a.*, t.empresa_id as ticket_empresa_id FROM ticket_anexos a JOIN tickets t ON a.ticket_id = t.id WHERE a.id = ? AND t.deleted_at IS NULL', [id]);
        const data = rows[0];
        if (!data)
            return null;
        return {
            ...data,
            interno: !!data.interno
        };
    }
    async create(data) {
        const { ticket_id, mensagem_id, usuario_id, empresa_id, nome_original, nome_arquivo, caminho, mime_type, tamanho_bytes, interno } = data;
        const [ticketRows] = await pool.query('SELECT * FROM tickets WHERE id = ? AND deleted_at IS NULL LIMIT 1', [ticket_id]);
        const ticket = ticketRows[0];
        if (!ticket) {
            throw new Error('Chamado não encontrado');
        }
        if (empresa_id !== null && empresa_id !== undefined && Number(ticket.empresa_id) !== Number(empresa_id)) {
            throw new Error('Chamado não encontrado');
        }
        const [result] = await pool.query(`INSERT INTO ticket_anexos 
        (ticket_id, mensagem_id, usuario_id, empresa_id, nome_original, nome_arquivo, caminho, mime_type, tamanho_bytes, interno) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [ticket_id, mensagem_id || null, usuario_id, empresa_id, nome_original, nome_arquivo, caminho, mime_type, tamanho_bytes, interno ? 1 : 0]);
        const attachmentId = result.insertId;
        // Notificações
        try {
            if (ticket) {
                let authorName = 'Cliente Externo';
                if (usuario_id) {
                    const [author] = await pool.query('SELECT nome FROM usuarios WHERE id = ?', [usuario_id]);
                    authorName = author[0]?.nome || 'Alguém';
                }
                const recipients = new Set();
                // 1. Notificar solicitante se não for ele e não for interno
                if (!interno && ticket.usuario_id && ticket.usuario_id !== usuario_id) {
                    recipients.add(ticket.usuario_id);
                }
                // 2. Notificar responsável se não for ele
                if (ticket.responsavel_id && ticket.responsavel_id !== usuario_id) {
                    recipients.add(ticket.responsavel_id);
                }
                // 3. Se for interno, notificar admins/devs da empresa (que não sejam o autor)
                if (interno && ticket.empresa_id) {
                    const [admins] = await pool.query('SELECT id FROM usuarios WHERE empresa_id = ? AND administrador = 1', [ticket.empresa_id]);
                    admins.forEach((a) => {
                        if (a.id !== usuario_id)
                            recipients.add(a.id);
                    });
                }
                const recipientIds = Array.from(recipients);
                if (recipientIds.length > 0) {
                    await notificationsService.createMany(recipientIds, {
                        empresa_id: ticket.empresa_id,
                        tipo: 'TICKET_ATTACHMENT',
                        titulo: interno ? 'Anexo interno enviado' : 'Novo anexo no chamado',
                        mensagem: `${authorName} enviou o arquivo: ${nome_original}`,
                        link: `ticket:${ticket_id}`,
                        metadata: { ticketId: ticket_id, attachmentId }
                    });
                }
            }
        }
        catch (e) {
            console.error('Erro ao notificar novo anexo:', e);
        }
        return attachmentId;
    }
    async delete(id) {
        const attachment = await this.getById(id);
        if (!attachment)
            return false;
        // Remove do DB
        await pool.query('DELETE FROM ticket_anexos WHERE id = ?', [id]);
        // Remove o arquivo do storage
        try {
            await storageService.delete(attachment.caminho);
        }
        catch (err) {
            console.error(`[AttachmentsService] Falha ao deletar arquivo: ${attachment.caminho}`, err);
        }
        return true;
    }
    async getByMessage(messageId, includeInternal) {
        let query = 'SELECT * FROM ticket_anexos WHERE mensagem_id = ?';
        if (!includeInternal) {
            query += ' AND interno = 0';
        }
        const [rows] = await pool.query(query, [messageId]);
        return rows.map(row => ({
            ...row,
            interno: !!row.interno,
            url: `/api/attachments/${row.id}/download`
        }));
    }
    async getByMessages(messageIds, includeInternal, ticketId) {
        const safeIds = Array.from(new Set(messageIds.map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0)));
        if (safeIds.length === 0)
            return {};
        let query = `
      SELECT a.*, COALESCE(u.nome, 'Cliente Externo') as usuario_nome
      FROM ticket_anexos a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      WHERE a.mensagem_id IN (?)
    `;
        const params = [safeIds];
        if (ticketId) {
            query += ' AND a.ticket_id = ?';
            params.push(ticketId);
        }
        if (!includeInternal) {
            query += ' AND a.interno = 0';
        }
        query += ' ORDER BY a.created_at ASC, a.id ASC';
        const [rows] = await pool.query(query, params);
        const map = {};
        rows.forEach(row => {
            if (!row.mensagem_id)
                return;
            const normalized = {
                ...row,
                interno: !!row.interno,
                url: `/api/attachments/${row.id}/download`
            };
            if (!map[row.mensagem_id])
                map[row.mensagem_id] = [];
            map[row.mensagem_id].push(normalized);
        });
        return map;
    }
    async deleteMultiple(files) {
        await Promise.all(files.map(file => storageService.delete(file.path).catch(() => { })));
    }
}
export default new AttachmentsService();
