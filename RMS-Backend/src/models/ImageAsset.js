import mongoose from 'mongoose';

const imageAssetSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  imageUrl: { type: String, required: true, trim: true },
  category: {
    type: String,
    enum: ['HOME', 'HOUSE', 'FLAT', 'APARTMENT', 'PROPERTY', 'DEMO', 'OTHER'],
    default: 'OTHER',
    index: true,
  },
  page: { type: String, default: 'General', trim: true },
  section: { type: String, default: '', trim: true },
  propertyId: { type: String, default: '', trim: true },
  propertyType: { type: String, default: '', trim: true },
  displayOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

imageAssetSchema.pre('save', function next(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('ImageAsset', imageAssetSchema, 'image_assets');
