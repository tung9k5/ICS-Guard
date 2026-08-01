import notificationService from '../services/notification.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id; // Assume auth middleware sets req.user
    const result = await notificationService.getNotifications(userId, req.query);
    return successResponse(res, result, 'Fetched notifications successfully');
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const count = await notificationService.getUnreadCount(userId);
    return successResponse(res, { count }, 'Fetched unread count successfully');
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await notificationService.markAsRead(id);
    if (!notification) {
      return errorResponse(res, 'Notification not found', null, 404);
    }
    return successResponse(res, notification, 'Notification marked as read');
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await notificationService.markAllAsRead(userId);
    return successResponse(res, null, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await notificationService.deleteNotification(id);
    if (!deleted) {
      return errorResponse(res, 'Notification not found', null, 404);
    }
    return successResponse(res, deleted, 'Notification deleted successfully');
  } catch (error) {
    next(error);
  }
};
