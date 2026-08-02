import http from '@/http/clients/api';

export const getNotifications = (params) => {
  return http.get('/notifications', { params, hideLoading: true });
};

export const getUnreadCount = () => {
  return http.get('/notifications/unread-count', { hideLoading: true });
};

export const markRead = (id) => {
  return http.patch(`/notifications/${id}/read`, {}, { hideLoading: true });
};

export const markAllRead = () => {
  return http.patch('/notifications/read-all', {}, { hideLoading: true });
};

