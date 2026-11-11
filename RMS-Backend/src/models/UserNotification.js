import mongoose from 'mongoose';

const userNotificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    default: '',
    index: true,
  },
  recipientId: {
    type: String,
    default: '',
    index: true,
  },
  recipientRole: {
    type: String,
    default: 'user',
    index: true,
  },
  userName: {
    type: String,
    default: '',
  },
  actorType: {
    type: String,
    default: 'admin',
  },
  actorName: {
    type: String,
    default: 'Admin',
  },
  entityType: {
    type: String,
    default: 'GENERAL',
    index: true,
  },
  entityId: {
    type: String,
    default: '',
  },
  actionType: {
    type: String,
    default: 'SYSTEM',
    index: true,
  },
  title: {
    type: String,
    default: 'Admin update',
  },
  message: {
    type: String,
    required: true,
  },
  reason: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    default: 'Updated',
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  type: {
    type: String,
    default: 'system',
    index: true,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: false,
});

export default mongoose.model('UserNotification', userNotificationSchema, 'user_notifications');
