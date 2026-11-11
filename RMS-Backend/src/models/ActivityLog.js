import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
  userId: { type: String, default: '' },
  userName: { type: String, default: '' },
  email: { type: String, default: '' },
  action: { type: String, required: true },
  entityType: { type: String, default: 'USER' },
  entityId: { type: String, default: '' },
  details: { type: String, default: '' },
  meta: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: false });

export default mongoose.model('ActivityLog', activityLogSchema, 'activity_logs');
