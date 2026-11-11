import mongoose from 'mongoose';

const savedSearchSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  name: { type: String, default: 'Saved Search' },
  filters: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: false });

export default mongoose.model('SavedSearch', savedSearchSchema, 'saved_searches');
