import express from 'express';
import * as notificationController from '../controllers/notification.controller.js';
import { validateNotificationId } from '../validators/notification.validator.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware); // Apply authentication to all notification routes

router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', validateNotificationId, notificationController.markAsRead);
router.delete('/:id', validateNotificationId, notificationController.deleteNotification);

export default router;
