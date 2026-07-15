import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let socketCompanyId: number | null = null;

export const getSocket = (empresaId: number): Socket => {
  if (!socket || socketCompanyId !== empresaId) {
    if (socket) socket.disconnect();
    socketCompanyId = empresaId;
    socket = io({
      auth: { empresa_id: empresaId },
      query: { empresa_id: empresaId },
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketCompanyId = null;
  }
};
