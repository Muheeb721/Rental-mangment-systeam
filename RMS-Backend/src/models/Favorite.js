import mongoose from 'mongoose';

const favoriteSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  propertyId: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: false });

export default mongoose.model('Favorite', favoriteSchema, 'favorites');
