import { io } from 'socket.io-client';

const socketUrl = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace('/api', '') 
  : 'http://localhost:8000';

console.log(`[SocketService] Connecting to Socket.io at: ${socketUrl}`);

export const socket = io(socketUrl, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
});

socket.on('connect', () => {
  console.log('[SocketService] Connected to WebSocket server successfully.');
});

socket.on('disconnect', () => {
  console.log('[SocketService] Disconnected from WebSocket server.');
});

export default socket;
