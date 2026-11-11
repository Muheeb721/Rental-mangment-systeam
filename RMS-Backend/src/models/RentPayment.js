import mongoose from 'mongoose';

const rentPaymentSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  month: { type: String, required: true },
  amountDue: { type: Number, default: 0 },
  amountPaid: { type: Number, default: 0 },
  dueDate: { type: Date, default: null },
  paidDate: { type: Date, default: null },
  status: {
    type: String,
    enum: ['pending', 'on_time', 'late', 'overdue', 'partial'],
    default: 'pending',
    index: true,
  },
  lateDays: { type: Number, default: 0 },
  lateFee: { type: Number, default: 0 },
  method: {
    type: String,
    enum: ['cash', 'bank', 'jazzcash', 'easypaisa'],
    default: 'cash',
  },
  proofImage: { type: String, default: '' },
  verifiedByAdmin: { type: Boolean, default: false },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

rentPaymentSchema.index({ tenantId: 1, month: 1 }, { unique: true });

rentPaymentSchema.pre('save', function preSave(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('RentPayment', rentPaymentSchema, 'rent_payments');
