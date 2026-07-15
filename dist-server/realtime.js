let socketServer = null;
export function setRealtimeServer(io) {
    socketServer = io;
}
/**
 * Avisa clientes autenticados que a inbox do WhatsApp mudou.
 * O evento não carrega dados da conversa; a API protegida continua sendo
 * a fonte dos dados e das permissões.
 */
export function emitWhatsAppChanged() {
    socketServer?.emit('whatsappChanged');
}
