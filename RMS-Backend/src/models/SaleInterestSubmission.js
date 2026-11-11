import mongoose from 'mongoose';

const saleInterestSubmissionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  propertyId: { type: String, required: true, index: true },
  propertyType: { type: String, required: true },
  propertyTitle: { type: String, required: true },
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  idCardNumber: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  preferredMoveInDate: { type: Date, required: true },
  status: { type: String, default: 'New', index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

export default mongoose.model('SaleInterestSubmission', saleInterestSubmissionSchema, 'sale_interest_submissions');
