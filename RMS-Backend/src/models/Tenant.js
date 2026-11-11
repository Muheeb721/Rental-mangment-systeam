import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name: { type: String, required: true, trim: true },
  phone: { type: String, default: '' },
  email: { type: String, default: '', lowercase: true, trim: true },
  cnic: { type: String, default: '' },
  cnicImage: { type: String, default: '' },
  profileImage: { type: String, default: '' },
  propertyId: { type: String, default: '' },
  hostelId: { type: String, default: '' },
  roomNo: { type: String, default: '' },
  monthlyRent: { type: Number, default: 0 },
  securityDeposit: { type: Number, default: 0 },
  dueDay: { type: Number, min: 1, max: 28, default: 5 },
  moveInDate: { type: Date, default: null },
  moveOutDate: { type: Date, default: null },
  status: { type: String, enum: ['active', 'left'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

tenantSchema.pre('save', function preSave(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Tenant', tenantSchema, 'tenants');
