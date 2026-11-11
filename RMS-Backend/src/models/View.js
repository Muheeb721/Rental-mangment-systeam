import mongoose from 'mongoose';

const viewSchema = new mongoose.Schema({
  propertyId: { type: String, required: true },
  propertyName: { type: String, default: '' },
  userId: { type: String, default: '' },
  sessionId: { type: String, default: '' },
  viewedAt: { type: Date, default: Date.now },
}, { timestamps: false });

export default mongoose.model('View', viewSchema, 'views');
