import express from 'express';
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  listAdminNotifications,
  createNotification,
  broadcastNotification,
  listBroadcasts,
  deleteBroadcast,
} from '../controllers/notificationController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { objectIdParam } from '../middleware/validateId.js';

const router = express.Router();
router.param('id', objectIdParam('Notification'));

// User endpoints
router.get('/', requireAuth, listNotifications);
router.get('/count', requireAuth, getUnreadCount);
router.get('/unread-count', requireAuth, getUnreadCount);
router.post('/mark-all-read', requireAuth, markAllAsRead);
router.patch('/read-all', requireAuth, markAllAsRead);

// Admin endpoints
router.get('/admin/all', requireAuth, requireAdmin, listAdminNotifications);
router.get('/admin/broadcasts', requireAuth, requireAdmin, listBroadcasts);
router.delete('/admin/broadcasts/:broadcastId', requireAuth, requireAdmin, deleteBroadcast);
router.post('/broadcast', requireAuth, requireAdmin, broadcastNotification);
router.post('/create', requireAuth, createNotification);

router.post('/:id/read', requireAuth, markAsRead);
router.patch('/:id/read', requireAuth, markAsRead);
router.delete('/:id', requireAuth, deleteNotification);

export default router;
