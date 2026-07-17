import type { Server as SocketIOServer } from 'socket.io';

let socketServer: SocketIOServer | null = null;

export function setRealtimeServer(io: SocketIOServer): void {
  socketServer = io;
}

/**
 * Avisa clientes autenticados que a inbox do WhatsApp mudou.
 * O evento não carrega dados da conversa; a API protegida continua sendo
 * a fonte dos dados e das permissões.
 */
export function emitWhatsAppChanged(): void {
  socketServer?.emit('whatsappChanged');
}

export function emitNotificationCreated(userId: number, notification: unknown): void {
  socketServer?.to(`user:${userId}`).emit('notificationCreated', notification);
}

export function emitNotificationsRead(userId: number, payload: { id?: number; all?: boolean }): void {
  socketServer?.to(`user:${userId}`).emit('notificationsRead', payload);
}
