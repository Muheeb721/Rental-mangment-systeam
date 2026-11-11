import mongoose from 'mongoose';

const OfferSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  discountPercent: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  propertiesIncluded: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model('Offer', OfferSchema);
import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema({
  propertyId: { type: String, required: true, index: true },
  title: { type: String, default: 'Special Offer' },
  discountPercent: { type: Number, default: 0 },
  enabled: { type: Boolean, default: true },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

export default mongoose.model('Offer', offerSchema, 'offers');
