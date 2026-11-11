import mongoose from 'mongoose';

const priceHistorySchema = new mongoose.Schema({
  propertyId: { type: String, required: true },
  previousPrice: { type: Number, default: 0 },
  newPrice: { type: Number, default: 0 },
  changedAt: { type: Date, default: Date.now },
}, { timestamps: false });

export default mongoose.model('PriceHistory', priceHistorySchema, 'price_history');
