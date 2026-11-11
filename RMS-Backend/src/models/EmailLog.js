import mongoose from 'mongoose';

const emailLogSchema = new mongoose.Schema({
  userId: { type: String, default: '' },
  email: { type: String, required: true, index: true },
  type: {
    type: String,
    enum: ['PROFILE_COMPLETED', 'BOOKING_SUBMITTED', 'BOOKING_APPROVED', 'BOOKING_REJECTED', 'ADMIN_BOOKING_SUBMITTED', 'ADMIN_PASSWORD_RESET_OTP'],
    required: true,
    index: true,
  },
  subject: { type: String, required: true },
  bookingId: { type: String, default: '' },
  status: { type: String, default: 'pending', enum: ['pending', 'sent', 'failed', 'skipped'], index: true },
  sentAt: { type: Date, default: null },
  error: { type: String, default: '' },
  metadata: { type: Object, default: {} },
  dedupeKey: { type: String, default: '', unique: true, sparse: true, index: true },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: false });

export default mongoose.model('EmailLog', emailLogSchema, 'email_logs');
