import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  userId: { type: String, default: '', index: true },
  userName: { type: String, default: '' },
  propertyId: { type: String, default: '', index: true },
  propertyName: { type: String, default: '' },
  rating: { type: Number, default: 5, min: 1, max: 5 },
  comment: { type: String, default: '' },
  // moderation: Approved reviews are public, Hidden reviews are only visible to admins
  status: { type: String, default: 'Approved' },
  adminReply: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

export default mongoose.model('Review', reviewSchema, 'reviews');
