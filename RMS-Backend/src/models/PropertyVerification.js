import mongoose from 'mongoose';

const propertyVerificationSchema = new mongoose.Schema({
  propertyId: { type: String, required: true, index: true },
  verified: { type: Boolean, default: false },
  verifiedAt: { type: Date },
  verifiedBy: { type: String, default: '' },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
});

export default mongoose.model('PropertyVerification', propertyVerificationSchema, 'property_verifications');
