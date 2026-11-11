import mongoose from 'mongoose';

const contactRequestSchema = new mongoose.Schema({
  fullName: { type: String, default: '' },
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  message: { type: String, default: '' },
  propertyId: { type: String, default: '' },
  propertyName: { type: String, default: '' },
  propertyTitle: { type: String, default: '' },
  inquiryType: { type: String, default: 'General' },
  preferredContactMethod: { type: String, default: 'Email' },
  status: { type: String, default: 'New' },
  userId: { type: String, default: '' },
  adminReply: { type: String, default: '' },
  repliedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

export default mongoose.model('ContactRequest', contactRequestSchema, 'contact_requests');
