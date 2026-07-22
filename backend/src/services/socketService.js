import { Server } from 'socket.io';
import { socketCorsOptions } from '../config/cors.js';

let io = null;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: socketCorsOptions
  });

  io.on('connection', (socket) => {
    console.log(`[SocketService] Client mới kết nối: ${socket.id}`);
    
    socket.on('disconnect', () => {
      console.log(`[SocketService] Client đã ngắt kết nối: ${socket.id}`);
    });
  });

  console.log('[SocketService] Khởi tạo Socket.io server thành công.');
  return io;
};

export const getIo = () => {
  return io;
};

// Phát tín hiệu cảnh báo tức thời
export const emitNewAlert = (alertData) => {
  if (io) {
    io.emit('NEW_ALERT', alertData);
    console.log(`[SocketService] Đã phát sự kiện NEW_ALERT:`, alertData);
  }
};

// Phát tín hiệu sự cố mới
export const emitNewIncident = (incidentData) => {
  if (io) {
    io.emit('NEW_INCIDENT', incidentData);
    console.log(`[SocketService] Đã phát sự kiện NEW_INCIDENT:`, incidentData);
  }
};

// Phát tín hiệu thay đổi trạng thái thiết bị (ví dụ: cô lập)
export const emitDeviceStatusChanged = (deviceData) => {
  if (io) {
    io.emit('DEVICE_STATUS_CHANGED', deviceData);
    console.log(`[SocketService] Đã phát sự kiện DEVICE_STATUS_CHANGED:`, deviceData);
  }
};

export default {
  initSocket,
  getIo,
  emitNewAlert,
  emitNewIncident,
  emitDeviceStatusChanged,
};
