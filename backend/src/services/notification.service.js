import notificationRepository from '../repositories/notification.repository.js';
import AuditLog from '../models/auditLog.js';

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

  async getAdminLogNotifications(query) {
    const { page = 1, limit = 999 } = query;
    const skip = (page - 1) * limit;

    const logs = await AuditLog.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AuditLog.countDocuments({});

    const formattedLogs = logs.map(log => ({
      _id: log._id,
      title: log.action,
      message: log.target_resource || log.details?.message || 'System Action',
      createdAt: log.createdAt,
      isRead: log.isRead === true, // System logs are unread by default unless explicitly marked
      severity: log.status === 'success' ? 'info' : 'warning',
      username: log.username,
      ipAddress: log.ipAddress
    }));

    return {
      notifications: formattedLogs,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    };
  }

  async getAdminLogUnreadCount() {
    return await AuditLog.countDocuments({ isRead: { $ne: true } });
  }

  async markAdminLogAsRead(id) {
    return await AuditLog.findByIdAndUpdate(id, { isRead: true }, { new: true });
  }

  async markAdminLogAllAsRead() {
    await AuditLog.updateMany({ isRead: { $ne: true } }, { $set: { isRead: true } });
    return true;
  }
}

export default new NotificationService();
