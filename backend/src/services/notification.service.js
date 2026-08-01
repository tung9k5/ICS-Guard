import notificationRepository from '../repositories/notification.repository.js';

class NotificationService {
  async createNotification(data) {
    return await notificationRepository.create(data);
  }

  async getNotifications(userId, query) {
    const { page, limit, sort, order, isRead, severity, type } = query;
    
    const filter = {
      $or: [{ userId }, { userId: null }]
    };

    if (isRead !== undefined) filter.isRead = isRead === 'true';
    if (severity) filter.severity = severity;
    if (type) filter.type = type;

    return await notificationRepository.find(filter, { page, limit, sort, order });
  }

  async markAsRead(id) {
    return await notificationRepository.updateReadStatus(id, true);
  }

  async markAllAsRead(userId) {
    const query = { $or: [{ userId }, { userId: null }] };
    await notificationRepository.markAllAsRead(query);
    return true;
  }

  async getUnreadCount(userId) {
    const query = { $or: [{ userId }, { userId: null }] };
    return await notificationRepository.countUnread(query);
  }

  async deleteNotification(id) {
    return await notificationRepository.delete(id);
  }
}

export default new NotificationService();
