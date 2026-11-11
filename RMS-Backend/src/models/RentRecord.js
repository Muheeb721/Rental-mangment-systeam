import mongoose from 'mongoose';

const rentRecordSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  userName: { type: String, default: '' },
  propertyId: { type: String, default: '', index: true },
  propertyName: { type: String, default: '' },
  monthlyRent: { type: Number, default: 0 },
  paid: { type: Number, default: 0 },
  remaining: { type: Number, default: 0 },
  dueDate: { type: Date, default: Date.now },
  month: { type: String, default: '' },
  status: { type: String, default: 'Pending' },
  paymentStatus: { type: String, default: 'Pending' },
  // tenant-submitted payment proof awaiting admin verification
  proofImage: { type: String, default: '' },
  submittedAmount: { type: Number, default: 0 },
  submittedMethod: { type: String, default: '' },
  transactionId: { type: String, default: '' },
  submittedAt: { type: Date, default: null },
  verification: { type: String, default: 'none' }, // none | submitted | verified | rejected
  adminNote: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: false });

export default mongoose.model('RentRecord', rentRecordSchema, 'rent_records');
