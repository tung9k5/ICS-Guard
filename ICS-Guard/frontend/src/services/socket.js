import { io } from 'socket.io-client';

const configuredApiUrl = import.meta.env.VITE_API_URL || '';
const socketUrl = configuredApiUrl
  ? configuredApiUrl.replace(/\/api\/?$/, '')
  : 'http://localhost:8000';

const getAccessToken = () => (
  typeof window === 'undefined' ? null : localStorage.getItem('access_token')
);

export const socket = io(socketUrl, {
  autoConnect: false,
  auth: {},
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
});

export const disconnectSocket = () => {
  socket.auth = {};
  if (socket.connected || socket.active) {
    socket.disconnect();
  }
};

export const connectAuthenticatedSocket = () => {
  const token = getAccessToken();
  if (!token) {
    disconnectSocket();
    return false;
  }

  const tokenChanged = socket.auth?.token !== token;
  socket.auth = { token };
  if (socket.connected && tokenChanged) {
    socket.disconnect();
  }
  if (!socket.connected) {
    socket.connect();
  }
  return true;
};

export const refreshSocketAuthentication = connectAuthenticatedSocket;

socket.io.on('reconnect_attempt', () => {
  const token = getAccessToken();
  if (!token) {
    disconnectSocket();
    return;
  }
  socket.auth = { token };
});

socket.on('connect', () => {
  console.info('[SocketService] Authenticated socket connected.');
});

socket.on('disconnect', () => {
  console.info('[SocketService] Socket disconnected.');
});

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== 'access_token') return;
    if (event.newValue) connectAuthenticatedSocket();
    else disconnectSocket();
  });
}

export default socket;
