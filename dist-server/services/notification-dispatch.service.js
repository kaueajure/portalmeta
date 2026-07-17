import pool from '../db/connection.js';
import notificationsService from './notifications.service.js';
import { permissionsService } from './permissions.service.js';
import { canAccessTicketByScope, getTicketScope } from '../utils/ticket-permissions.js';
function safePreview(value, max = 140) {
    const clean = String(value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
    if (!clean)
        return 'Mensagem sem conteúdo textual';
    return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
function preferenceColumn(category) {
    if (category === 'ticket')
        return 'ticket_enabled';
    if (category === 'whatsapp_general')
        return 'whatsapp_general_enabled';
    return 'whatsapp_assigned_enabled';
}
async function activeCandidates(category, onlyUserId) {
    const column = preferenceColumn(category);
    const [rows] = await pool.query(`SELECT u.id, u.nome, u.perfil, u.administrador, u.desenvolvedor, u.access_profile_id,
            np.${column} AS enabled
     FROM usuarios u
     LEFT JOIN notification_preferences np ON np.usuario_id = u.id
     WHERE u.ativo = 1 AND u.perfil <> 'cliente' ${onlyUserId ? 'AND u.id = ?' : ''}`, onlyUserId ? [onlyUserId] : []);
    return rows.filter((row) => row.enabled === null || Number(row.enabled) === 1);
}
async function canUseNotifications(user) {
    return permissionsService.hasPermission(user, 'notificacoes.visualizar');
}
export const notificationDispatchService = {
    safePreview,
    async ticket(input) {
        const [rows] = await pool.query(`SELECT t.id, t.titulo, t.usuario_id, t.responsavel_id, t.status, t.prioridade,
              t.prazo_sla, COALESCE(NULLIF(t.solicitante_nome, ''), c.nome, 'Cliente') AS cliente_nome
       FROM tickets t
       LEFT JOIN usuarios c ON c.id = t.usuario_id
       WHERE t.id = ? AND t.deleted_at IS NULL`, [input.ticketId]);
        const ticket = rows[0];
        if (!ticket)
            return [];
        const candidates = await activeCandidates('ticket');
        const recipientIds = [];
        for (const user of candidates) {
            if (input.actorId && Number(user.id) === Number(input.actorId))
                continue;
            if (!(await canUseNotifications(user)))
                continue;
            if (!(await permissionsService.hasPermission(user, 'tickets.visualizar')))
                continue;
            if (input.requiredPermission && !(await permissionsService.hasPermission(user, input.requiredPermission)))
                continue;
            const scope = await getTicketScope(user);
            if (canAccessTicketByScope(ticket, user, scope))
                recipientIds.push(Number(user.id));
        }
        let actor = input.actorName || '';
        if (!actor && input.actorId) {
            const [actorRows] = await pool.query('SELECT nome FROM usuarios WHERE id = ? AND ativo = 1', [input.actorId]);
            actor = actorRows[0]?.nome || '';
        }
        actor ||= input.actorId ? 'Usuário' : 'Sistema';
        const description = safePreview(input.description || `${actor} realizou: ${input.updateType}`, 180);
        await notificationsService.createMany(recipientIds, {
            tipo: 'TICKET',
            event_key: input.eventKey,
            titulo: `#${ticket.id} · ${safePreview(ticket.titulo, 120)}`,
            mensagem: `${input.updateType} · ${description}`,
            link: `ticket:${ticket.id}`,
            metadata: {
                category: 'ticket', ticketId: ticket.id, updateType: input.updateType,
                actorName: actor,
            },
        });
        return recipientIds;
    },
    async whatsapp(input) {
        const assigned = input.assignedUserId ? Number(input.assignedUserId) : null;
        const category = assigned ? 'whatsapp_assigned' : 'whatsapp_general';
        const candidates = await activeCandidates(category, assigned || undefined);
        const recipientIds = [];
        for (const user of candidates) {
            if (!(await canUseNotifications(user)))
                continue;
            const canView = await permissionsService.hasPermission(user, 'integracoes.whatsapp.visualizar');
            const canClaim = await permissionsService.hasPermission(user, 'integracoes.whatsapp.gerenciar');
            if (canView && canClaim && (!assigned || Number(user.id) === assigned)) {
                recipientIds.push(Number(user.id));
            }
        }
        const name = safePreview(input.contactName || input.phone, 80);
        const preview = safePreview(input.body, 140);
        await notificationsService.createMany(recipientIds, {
            tipo: assigned ? 'WHATSAPP_ASSIGNED' : 'WHATSAPP_GENERAL',
            event_key: input.eventKey,
            titulo: assigned ? `Mensagem de ${name}` : `Novo atendimento · ${name}`,
            mensagem: `${input.phone} · ${preview}`,
            link: `whatsapp:${input.phone}`,
            metadata: {
                category,
                phone: input.phone,
                contactName: name,
                messageId: input.messageId,
                body: input.body || null,
                direction: 'inbound',
                createdAt: new Date().toISOString(),
            },
        });
        return recipientIds;
    },
};
