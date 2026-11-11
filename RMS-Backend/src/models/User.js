import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, default: 'resident' },
  phone: { type: String, default: '' },
  profileImage: { type: String, default: '' },
  profile: { type: Object, default: {} },
  profileData: { type: Object, default: {} },
  hasRentalProfile: { type: Boolean, default: false },
  favorites: { type: [String], default: [] },
  preferences: { type: Object, default: {} },
  status: { type: String, default: 'Active' },
  archived: { type: Boolean, default: false },
  lastLoginAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

userSchema.pre('save', function preSave(next) {
  this.updatedAt = new Date();
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  if (!this.passwordHash) return false;
  try {
    return await bcrypt.compare(candidate, this.passwordHash);
  } catch (e) {
    console.warn('Password compare failed', e && e.message ? e.message : e);
    return false;
  }
};

export default mongoose.model('User', userSchema, 'users');
