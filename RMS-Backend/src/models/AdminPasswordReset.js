import mongoose from 'mongoose';

const adminPasswordResetSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  otpHash: { type: String, default: '', select: false },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  resendAfter: { type: Date, required: true },
  resetTokenHash: { type: String, default: '', select: false },
  resetTokenExpiresAt: { type: Date, default: null },
  verifiedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: false });

adminPasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('AdminPasswordReset', adminPasswordResetSchema, 'admin_password_resets');
