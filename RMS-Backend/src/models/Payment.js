import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  userName: { type: String, default: '' },
  userEmail: { type: String, default: '' },
  userPhone: { type: String, default: '' },
  bookingId: { type: String, default: '' },
  propertyId: { type: String, default: '' },
  propertyName: { type: String, default: '' },
  propertyType: { type: String, default: '' },
  amount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  amountPaid: { type: Number, default: 0 },
  advanceAmount: { type: Number, default: 0 },
  remainingAmount: { type: Number, default: 0 },
  paymentType: { type: String, default: 'Advance' },
  method: { type: String, default: 'Pending' },
  status: { type: String, default: 'Pending' },
  transactionId: { type: String, default: '' },
  reference: { type: String, default: '' },
  reason: { type: String, default: '' },
  notes: { type: String, default: '' },
  paymentDate: { type: Date, default: Date.now },
  dueDate: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

paymentSchema.pre('save', function next(next) {
  this.updatedAt = new Date();
  if (!this.amount && this.totalAmount) this.amount = this.totalAmount;
  if (!this.amountPaid && this.amount) this.amountPaid = this.amount;
  next();
});

export default mongoose.model('Payment', paymentSchema, 'payments');
