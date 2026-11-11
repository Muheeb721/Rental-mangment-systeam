import mongoose from 'mongoose';

const adminActionLogSchema = new mongoose.Schema({
  adminId: {
    type: String,
    required: true,
    index: true,
  },
  adminName: {
    type: String,
    default: 'Admin',
  },
  adminEmail: {
    type: String,
    default: '',
  },
  userId: {
    type: String,
    default: '',
    index: true,
  },
  userName: {
    type: String,
    default: '',
  },
  actionType: {
    type: String,
    required: true,
    index: true,
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
  previousStatus: {
    type: String,
    default: '',
  },
  newStatus: {
    type: String,
    default: '',
  },
  message: {
    type: String,
    default: '',
  },
  reason: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  propertyName: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: false,
});

export default mongoose.model('AdminActionLog', adminActionLogSchema, 'admin_action_logs');
