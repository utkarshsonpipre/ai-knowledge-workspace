import { io, type Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';

let socket: Socket | null = null;

/**
 * One shared socket per tab. The access token travels in the handshake `auth`
 * payload — the same JWT the REST API uses, verified by the gateway.
 */
export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket?.disconnect();
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    withCredentials: true,
    reconnectionDelay: 1_000,
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
