import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, default: '' , index: true },
  userId: { type: String, default: 'guest-user', index: true },
  userName: { type: String, default: '' },
  userEmail: { type: String, default: '' },
  userPhone: { type: String, default: '' },
  customerName: { type: String, default: '' },
  customerPhone: { type: String, default: '' },
  propertyId: { type: String, default: '', index: true },
  propertyName: { type: String, default: '' },
  propertyTitle: { type: String, default: '' },
  propertyType: { type: String, default: '' },
  propertyImage: { type: String, default: '' },
  tenantProfileId: { type: String, default: '' },
  amount: { type: Number, default: 0 },
  rent: { type: Number, default: 0 },
  rentFrequency: { type: String, default: 'Monthly' },
  moveInDate: { type: Date, default: null },
  rentalDuration: { type: String, default: '1 month' },
  occupants: { type: Number, default: 1 },
  message: { type: String, default: '' },
  notes: { type: String, default: '' },
  paymentStatus: { type: String, default: 'Pending' },
  bookingStatus: { type: String, default: 'Pending' },
  adminStatus: { type: String, default: 'Pending' },
  status: { type: String, default: 'Pending' },
  rejectionReason: { type: String, default: '' },
  bookingDate: { type: Date, default: Date.now },
  visitDate: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  // Applicant / personal information
  cnic: { type: String, default: '' },
  // uploaded images (profile / CNIC) - Flow B
  profileImage: { type: String, default: '' },
  cnicImage: { type: String, default: '' },
  dateOfBirth: { type: Date, default: null },
  nationality: { type: String, default: '' },
  // Current address
  addressLine1: { type: String, default: '' },
  addressLine2: { type: String, default: '' },
  city: { type: String, default: '' },
  province: { type: String, default: '' },
  country: { type: String, default: '' },
  // Employment
  employmentStatus: { type: String, default: '' },
  companyName: { type: String, default: '' },
  jobTitle: { type: String, default: '' },
  monthlyIncome: { type: Number, default: 0 },
  workAddress: { type: String, default: '' },
  yearsExperience: { type: Number, default: 0 },
  // Rental specific
  reasonForRent: { type: String, default: '' },
  preferredMoveInDate: { type: Date, default: null },
  // References
  previousLandlordName: { type: String, default: '' },
  previousLandlordPhone: { type: String, default: '' },
  previousLandlordRelationship: { type: String, default: '' },
  // Terms
  termsAccepted: { type: Boolean, default: false },
  // flow type: contact for Houses/Apartments, rent_application for Flats
  flowType: { type: String, default: 'contact' },
}, { timestamps: false });

bookingSchema.pre('save', function next(next) {
  this.updatedAt = new Date();
  if (!this.bookingId) this.bookingId = `BK-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  if (!this.status) this.status = this.bookingStatus || 'Pending';
  if (!this.bookingStatus) this.bookingStatus = this.status || 'Pending';
  if (!this.paymentStatus) this.paymentStatus = 'Pending';
  next();
});

export default mongoose.model('Booking', bookingSchema, 'bookings');
