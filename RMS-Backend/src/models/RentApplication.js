import mongoose from 'mongoose';

const rentApplicationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  userName: { type: String, default: '' },
  userEmail: { type: String, default: '' },
  userPhone: { type: String, default: '' },
  cnic: { type: String, default: '' },
  profileImage: { type: String, default: '' },
  cnicImage: { type: String, default: '' },
  propertyId: { type: String, required: true, index: true },
  propertyTitle: { type: String, default: '' },
  propertyType: { type: String, default: '' },
  rent: { type: Number, default: 0 },
  moveInDate: { type: Date, default: null },
  rentalEndDate: { type: Date, default: null },
  rentalDuration: { type: String, default: '' },
  occupants: { type: Number, default: 1 },
  applicationStatus: { type: String, default: 'pending', index: true }, // pending/accepted/rejected
  submittedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  notes: { type: String, default: '' },
  rejectionReason: { type: String, default: '' },
  agreementPath: { type: String, default: '' },
}, { timestamps: false });

rentApplicationSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  if (!this.submittedAt) this.submittedAt = new Date();
  next();
});

export default mongoose.model('RentApplication', rentApplicationSchema, 'rent_applications');
