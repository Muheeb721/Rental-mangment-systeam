import mongoose from 'mongoose';

const bookingRequestSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  userName: { type: String, default: '' },
  userEmail: { type: String, default: '' },
  userPhone: { type: String, default: '' },
  propertyId: { type: String, required: true, index: true },
  propertyTitle: { type: String, default: '' },
  propertyType: { type: String, default: '' },
  amount: { type: Number, default: 0 },
  status: { type: String, default: 'Pending Admin Approval' },
  paymentStatus: { type: String, default: 'Pending' },
  notes: { type: String, default: '' },
  bookingDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

export default mongoose.model('BookingRequest', bookingRequestSchema, 'bookings');
