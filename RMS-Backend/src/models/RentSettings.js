import mongoose from 'mongoose';

const rentSettingsSchema = new mongoose.Schema({
  defaultDueDay: { type: Number, default: 10 },
  gracePeriodDays: { type: Number, default: 0 },
  gracePeriod: { type: Number, default: 0 },
  lateFeePerDay: { type: Number, default: 0 },
  lateFeeFixed: { type: Number, default: 0 },
  lateFeePercent: { type: Number, default: 0 },
  reminderDaysBefore: { type: Number, default: 3 },
  reminderDays: { type: [Number], default: [7, 3, 1] },
  autoGenerate: { type: Boolean, default: false },
  currency: { type: String, default: 'PKR' },
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: false });

rentSettingsSchema.pre('save', function preSave(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('RentSettings', rentSettingsSchema, 'rent_settings');
