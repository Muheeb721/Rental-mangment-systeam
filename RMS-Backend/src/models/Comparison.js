import mongoose from 'mongoose';

const comparisonSchema = new mongoose.Schema({
  userId: { type: String, default: '' },
  name: { type: String, default: '' },
  propertyIds: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: false });

export default mongoose.model('Comparison', comparisonSchema, 'comparisons');
