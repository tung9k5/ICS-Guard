import Notification from '../models/notification.model.js';

class NotificationRepository {
  async create(data) {
    return await Notification.create(data);
  }

  async find(query = {}, options = {}) {
    const { page = 1, limit = 999, sort = 'createdAt', order = 'desc' } = options;
    const skip = (page - 1) * limit;
    
    const sortObj = {};
    sortObj[sort] = order === 'desc' ? -1 : 1;

    const [data, total] = await Promise.all([
      Notification.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate('deviceId', 'name')
        .populate('alertId', 'name')
        .lean(),
      Notification.countDocuments(query)
    ]);

    return {
      data,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit)
    };
  }

  async updateReadStatus(id, isRead) {
    return await Notification.findByIdAndUpdate(
      id,
      { isRead },
      { new: true }
    );
  }

  async markAllAsRead(query) {
    return await Notification.updateMany(query, { isRead: true });
  }

  async countUnread(query) {
    return await Notification.countDocuments({ ...query, isRead: false });
  }

  async delete(id) {
    return await Notification.findByIdAndDelete(id);
  }
}

export default new NotificationRepository();
