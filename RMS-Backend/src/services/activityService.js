import AdminActionLog from '../models/AdminActionLog.js';
import UserNotification from '../models/UserNotification.js';
import { buildUserNotification, normalizeAction } from '../utils/activity.js';
import User from '../models/User.js';

export const createAdminNotification = async ({
  actionType,
  entityType,
  entityId,
  title,
  message,
  actorName = 'System',
  userId = '',
  userName = '',
  metadata = {},
}) => {
  const adminUsers = await User.find({ role: 'admin' }).select('_id name').lean();
  if (!adminUsers.length) return null;

  const normalizedAction = normalizeAction(actionType);
  const normalizedEntity = String(entityType || 'GENERAL').toUpperCase();
  const dedupeFilter = {
    recipientRole: 'admin',
    actionType: normalizedAction,
    entityType: normalizedEntity,
    entityId: String(entityId || ''),
    userId: String(userId || ''),
  };
  const existing = await UserNotification.findOne(dedupeFilter).lean();
  if (existing) return existing;

  const docs = adminUsers.map((admin) => ({
    userId: admin._id.toString(),
    recipientId: admin._id.toString(),
    recipientRole: 'admin',
    userName: admin.name || 'Admin',
    actorType: 'user',
    actorName,
    entityType: normalizedEntity,
    entityId: String(entityId || ''),
    actionType: normalizedAction,
    type: normalizedEntity.toLowerCase(),
    title: title || `${normalizedEntity} notification`,
    message: message || `A new ${normalizedEntity.toLowerCase()} action requires review.`,
    metadata,
    status: 'New',
    isRead: false,
    createdAt: new Date(),
  }));

  const created = await UserNotification.insertMany(docs);
  for (const notification of created) {
    const io = globalThis.__rmsSocketServer;
    if (io) {
      io.to(`admin:${notification.recipientId}`).emit('notification:new', notification);
    }
  }
  return created[0] || null;
};

export const logAdminAction = async ({
  adminId,
  adminName,
  adminEmail,
  userId,
  userName,
  actionType,
  entityType,
  entityId,
  previousStatus,
  newStatus,
  message,
  reason,
  description,
  propertyName,
  metadata = {},
}) => {
  const normalizedActionType = normalizeAction(actionType);

  const logRecord = await AdminActionLog.create({
    adminId: adminId || 'system-admin',
    adminName: adminName || 'Admin',
    adminEmail: adminEmail || '',
    userId: userId || '',
    userName: userName || '',
    actionType: normalizedActionType,
    entityType: (entityType || 'GENERAL').toUpperCase(),
    entityId: entityId || '',
    previousStatus: previousStatus || '',
    newStatus: newStatus || '',
    message: message || '',
    reason: reason || '',
    description: description || message || '',
    propertyName: propertyName || '',
    createdAt: new Date(),
  });

  const notificationPayload = buildUserNotification({
    actionType: normalizedActionType,
    entityType: (entityType || 'GENERAL').toUpperCase(),
    entityId,
    userId,
    userName,
    adminName,
    propertyName,
    newStatus,
    reason,
    message,
  });

  let notification = null;
  if (userId) {
    notification = await UserNotification.create({
      userId,
      recipientId: userId,
      recipientRole: 'user',
      userName: userName || '',
      actorType: 'admin',
      actorName: adminName || 'Admin',
      entityType: (entityType || 'GENERAL').toUpperCase(),
      entityId: entityId || '',
      actionType: normalizedActionType,
      title: notificationPayload.title,
      message: notificationPayload.message,
      reason: reason || '',
      status: newStatus || 'Updated',
      metadata,
      isRead: false,
      createdAt: new Date(),
    });
  }

  if (userId && String(adminId || '').toLowerCase() === 'system') {
    await createAdminNotification({
      actionType: normalizedActionType,
      entityType,
      entityId,
      userId,
      userName,
      actorName: userName || 'RMS User',
      title: `${entityType || 'Activity'} submitted`,
      message: message || `${userName || 'A user'} submitted a new ${String(entityType || 'activity').toLowerCase()}.`,
      metadata,
    });
  }

  return {
    logRecord,
    notification,
  };
};

export const getUserActivity = async (userId) => {
  const logs = await AdminActionLog.find({ userId }).sort({ createdAt: -1 }).lean();
  return logs.map((item) => ({
    id: item._id,
    actionType: item.actionType,
    entityType: item.entityType,
    message: item.message || item.description || 'Admin activity recorded.',
    status: item.newStatus || item.previousStatus || 'Updated',
    createdAt: item.createdAt,
  }));
};

export const getAdminActivity = async () => {
  const logs = await AdminActionLog.find({}).sort({ createdAt: -1 }).lean();
  return logs.map((item) => ({
    id: item._id,
    adminId: item.adminId,
    adminName: item.adminName,
    adminEmail: item.adminEmail,
    userId: item.userId,
    userName: item.userName,
    actionType: item.actionType,
    entityType: item.entityType,
    entityId: item.entityId,
    previousStatus: item.previousStatus,
    newStatus: item.newStatus,
    message: item.message,
    reason: item.reason,
    description: item.description,
    propertyName: item.propertyName,
    createdAt: item.createdAt,
  }));
};
