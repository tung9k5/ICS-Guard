import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { User } from '../models/index.js';
import { normalizeRole } from '../utils/roles.js';

let io = null;

const SENSITIVE_KEYS = new Set([
  'password',
  'api_key',
  'refresh_token',
  'access_token',
  'token',
  'secret',
]);

const sanitizeDto = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeDto);
  if (!value || typeof value !== 'object') return value;
  const clean = {};
  for (const [key, child] of Object.entries(value.toObject ? value.toObject() : value)) {
    if (!SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = sanitizeDto(child);
    }
  }
  return clean;
};

export const initSocket = (server) => {
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
  ].filter(Boolean);
  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const bearer = socket.handshake.headers.authorization;
      const token = socket.handshake.auth?.token
        || (bearer?.startsWith('Bearer ') ? bearer.slice(7) : null);
      if (!token) return next(new Error('UNAUTHORIZED'));

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const user = await User.findById(decoded.id).lean();
      if (
        !user
        || user.status === 'locked'
        || user.is_active === false
        || user.deletion_pending === true
      ) {
        return next(new Error('ACCOUNT_DEACTIVATED'));
      }

      socket.user = {
        id: String(user._id),
        username: user.username,
        role: normalizeRole(user.role),
      };
      return next();
    } catch {
      return next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);
    socket.join(`role:${socket.user.role}`);
  });

  return io;
};

export const getIo = () => io;

export const disconnectUserSockets = (userId) => {
  if (io) {
    io.in(`user:${userId}`).disconnectSockets(true);
  }
};

export const emitNewAlert = (alertData) => {
  io?.to('role:admin').to('role:analyst').emit('NEW_ALERT', sanitizeDto(alertData));
};

export const emitNewIncident = (incidentData) => {
  io?.to('role:admin').to('role:analyst').emit('NEW_INCIDENT', sanitizeDto(incidentData));
};

export const emitDeviceStatusChanged = (deviceData) => {
  io?.emit('DEVICE_STATUS_CHANGED', sanitizeDto(deviceData));
};

export default {
  initSocket,
  getIo,
  disconnectUserSockets,
  emitNewAlert,
  emitNewIncident,
  emitDeviceStatusChanged,
};
