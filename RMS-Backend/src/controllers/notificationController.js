import UserNotification from '../models/UserNotification.js';

const getUserIdValue = (user = {}) => String(user.id || user.userId || user._id || user.email || '');

const normalizeNotification = (entry) => {
  const item = entry && typeof entry.toObject === 'function' ? entry.toObject() : { ...(entry || {}) };
  const recipientId = item.recipientId || item.userId || '';
  const ownerId = item.userId || item.recipientId || '';

  return {
    ...item,
    _id: item._id ? String(item._id) : item.id || '',
    id: item._id ? String(item._id) : item.id || '',
    userId: ownerId,
    recipientId,
    recipientRole: String(item.recipientRole || item.recipient || item.role || 'user').toLowerCase(),
    type: String(item.type || item.entityType || item.actionType || 'system').toLowerCase(),
  };
};

const emitNotification = (notification) => {
  try {
    const io = globalThis.__rmsSocketServer;
    if (!io || !notification) return;
    const normalized = normalizeNotification(notification);
    const targetIds = new Set();

    if (normalized.recipientId) targetIds.add(String(normalized.recipientId));
    if (normalized.userId) targetIds.add(String(normalized.userId));

    for (const targetId of targetIds) {
      io.to(`user:${targetId}`).emit('notification:new', normalized);
    }

    if (normalized.recipientRole === 'admin' && normalized.recipientId) {
      io.to(`admin:${String(normalized.recipientId)}`).emit('notification:new', normalized);
    }
  } catch (error) {
    console.warn('Notification socket emit failed:', error.message || error);
  }
};

export const listNotifications = async (req, res) => {
  try {
    const user = req.user || {};
    if (!user || !getUserIdValue(user)) return res.status(401).json({ success: false, message: 'Authentication required.' });

    const isAdmin = String(user.role || '').toLowerCase() === 'admin';
    const userId = getUserIdValue(user);
    const filter = isAdmin
      ? {
          $or: [
            { recipientId: userId, recipientRole: 'admin' },
            { userId, recipientRole: { $exists: false } },
          ],
        }
      : {
          $or: [
            { userId },
            { recipientId: userId },
          ],
          recipientRole: { $ne: 'admin' },
        };

    const items = await UserNotification.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: items.map(normalizeNotification) });
  } catch (error) {
    console.error('List notifications failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list notifications.' });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const user = req.user || {};
    const userId = getUserIdValue(user);
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const isAdmin = String(user.role || '').toLowerCase() === 'admin';
    const filter = isAdmin
      ? {
          $or: [
            { recipientId: userId, recipientRole: 'admin' },
            { userId, recipientRole: { $exists: false } },
          ],
          isRead: { $ne: true },
        }
      : {
          $or: [
            { userId: userId },
            { recipientId: userId },
          ],
          recipientRole: { $ne: 'admin' },
          isRead: { $ne: true },
        };
    const count = await UserNotification.countDocuments(filter);
    return res.json({ success: true, data: { count } });
  } catch (error) {
    console.error('Unread count failed', error);
    return res.status(500).json({ success: false, message: 'Unable to get unread count.' });
  }
};

export const listAdminNotifications = async (req, res) => {
  try {
    const adminId = getUserIdValue(req.user || {});
    const items = await UserNotification.find({
      $or: [
        { recipientId: adminId, recipientRole: 'admin' },
        { userId: adminId, recipientRole: { $exists: false } },
      ],
    }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: items.map(normalizeNotification) });
  } catch (error) {
    console.error('List admin notifications failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list admin notifications.' });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const user = req.user || {};
    const userId = getUserIdValue(user);
    const { id } = req.params || {};
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required.' });

    const note = await UserNotification.findOneAndUpdate(
      {
        _id: id,
        ...(String(user.role || '').toLowerCase() === 'admin' ? {} : { recipientRole: { $ne: 'admin' } }),
        $or: [
          { userId: userId },
          { recipientId: userId },
        ],
      },
      { isRead: true },
      { new: true },
    ).lean();

    return res.json({ success: true, data: note ? normalizeNotification(note) : null });
  } catch (error) {
    console.error('Mark notification failed', error);
    return res.status(500).json({ success: false, message: 'Unable to mark notification.' });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    const user = req.user || {};
    const userId = getUserIdValue(user);
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required.' });
    await UserNotification.updateMany(
      {
        $or: [
          { userId: userId },
          { recipientId: userId },
        ],
        ...(String(user.role || '').toLowerCase() === 'admin' ? {} : { recipientRole: { $ne: 'admin' } }),
        isRead: { $ne: true },
      },
      { isRead: true },
    );
    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    console.error('Mark all notifications failed', error);
    return res.status(500).json({ success: false, message: 'Unable to mark all notifications.' });
  }
};

export const createNotification = async (req, res) => {
  try {
    const payload = req.body || {};
    const user = req.user || {};
    const actorId = getUserIdValue(user);
    const requestedRecipientId = String(payload.recipientId || payload.userId || payload.targetUserId || actorId).trim();
    const isAdmin = String(user.role || '').toLowerCase() === 'admin';
    if (!isAdmin && requestedRecipientId !== actorId) {
      return res.status(403).json({ success: false, message: 'You can only create notifications for your own account.' });
    }

    const recipientId = requestedRecipientId;
    const recipientRole = String(payload.recipientRole || payload.role || (isAdmin ? 'user' : user.role) || 'user').toLowerCase();
    const userName = String(payload.userName || user.name || user.email || 'RMS User').trim();

    if (!recipientId) {
      return res.status(400).json({ success: false, message: 'userId is required.' });
    }

    const note = await UserNotification.create({
      userId: recipientId,
      recipientId,
      recipientRole,
      userName,
      actorType: payload.actorType || user.role || 'system',
      actorName: payload.actorName || user.name || 'System',
      entityType: String(payload.entityType || 'GENERAL').toUpperCase(),
      entityId: payload.entityId || '',
      actionType: String(payload.actionType || 'SYSTEM').toUpperCase(),
      title: payload.title || payload.actionType || 'Notification',
      type: String(payload.type || payload.entityType || payload.actionType || 'system').toLowerCase(),
      message: payload.message || '',
      reason: payload.reason || '',
      status: payload.status || 'Notice',
      isRead: payload.isRead === true,
      createdAt: new Date(),
    });

    emitNotification(note);
    return res.status(201).json({ success: true, data: normalizeNotification(note) });
  } catch (error) {
    console.error('Create notification failed', error);
    return res.status(500).json({ success: false, message: 'Unable to create notification.' });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const user = req.user || {};
    const userId = getUserIdValue(user);
    const { id } = req.params || {};
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required.' });

    const note = await UserNotification.findOneAndDelete({
      _id: id,
      $or: [
        { userId: userId },
        { recipientId: userId },
      ],
    }).lean();

    return res.json({ success: true, data: note ? normalizeNotification(note) : null });
  } catch (error) {
    console.error('Delete notification failed', error);
    return res.status(500).json({ success: false, message: 'Unable to delete notification.' });
  }
};

/**
 * POST /api/notifications/broadcast (admin)
 * body: { title, message, audience: 'all' | 'resident' | 'owner' | 'user', userId? }
 * Creates one notification per recipient and pushes it over the socket.
 */
export const broadcastNotification = async (req, res) => {
  try {
    const { default: User } = await import('../models/User.js');
    const body = req.body || {};
    const title = String(body.title || '').trim();
    const message = String(body.message || '').trim();
    const audience = String(body.audience || 'all').toLowerCase();
    if (title.length < 3) return res.status(400).json({ success: false, message: 'Title must be at least 3 characters.' });
    if (message.length < 5) return res.status(400).json({ success: false, message: 'Message must be at least 5 characters.' });

    const filter = { archived: { $ne: true }, status: { $ne: 'Blocked' }, role: { $ne: 'admin' } };
    if (audience === 'user') {
      if (!body.userId) return res.status(400).json({ success: false, message: 'Choose a user to notify.' });
      filter._id = body.userId;
      delete filter.role;
    } else if (audience !== 'all') {
      filter.role = audience;
    }
    const recipients = await User.find(filter).select('_id name').lean();
    if (!recipients.length) return res.status(400).json({ success: false, message: 'No users match that audience.' });

    const broadcastId = `bc-${Date.now()}`;
    const docs = recipients.map((recipient) => ({
      userId: String(recipient._id),
      recipientId: String(recipient._id),
      recipientRole: 'user',
      userName: recipient.name || '',
      actorType: 'admin',
      actorName: req.user?.name || 'Admin',
      entityType: 'ANNOUNCEMENT',
      actionType: 'ANNOUNCEMENT',
      type: 'announcement',
      title: title.slice(0, 150),
      message: message.slice(0, 2000),
      status: 'Notice',
      metadata: { broadcastId, audience, sentBy: req.user?.email || '' },
      isRead: false,
      createdAt: new Date(),
    }));
    const created = await UserNotification.insertMany(docs);
    created.forEach((note) => emitNotification(note));
    return res.status(201).json({ success: true, message: `Notification sent to ${created.length} user${created.length === 1 ? '' : 's'}.`, data: { broadcastId, recipients: created.length } });
  } catch (error) {
    console.error('Broadcast notification failed', error);
    return res.status(500).json({ success: false, message: 'Unable to send notification.' });
  }
};

/** GET /api/notifications/admin/broadcasts - announcements sent by admins, grouped. */
export const listBroadcasts = async (_req, res) => {
  try {
    const rows = await UserNotification.aggregate([
      { $match: { actionType: 'ANNOUNCEMENT', 'metadata.broadcastId': { $exists: true } } },
      { $group: {
        _id: '$metadata.broadcastId',
        title: { $first: '$title' },
        message: { $first: '$message' },
        audience: { $first: '$metadata.audience' },
        sentBy: { $first: '$actorName' },
        createdAt: { $first: '$createdAt' },
        recipients: { $sum: 1 },
        read: { $sum: { $cond: ['$isRead', 1, 0] } },
      } },
      { $sort: { createdAt: -1 } },
      { $limit: 100 },
    ]);
    return res.json({ success: true, data: rows.map((row) => ({ ...row, id: row._id })) });
  } catch (error) {
    console.error('List broadcasts failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list announcements.' });
  }
};

/** DELETE /api/notifications/admin/broadcasts/:broadcastId - withdraw an announcement from every inbox. */
export const deleteBroadcast = async (req, res) => {
  try {
    const result = await UserNotification.deleteMany({ actionType: 'ANNOUNCEMENT', 'metadata.broadcastId': String(req.params.broadcastId) });
    if (!result.deletedCount) return res.status(404).json({ success: false, message: 'Announcement not found.' });
    return res.json({ success: true, message: 'Announcement withdrawn.', data: { deleted: result.deletedCount } });
  } catch (error) {
    console.error('Delete broadcast failed', error);
    return res.status(500).json({ success: false, message: 'Unable to withdraw announcement.' });
  }
};
