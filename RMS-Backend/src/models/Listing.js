import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  propertyType: { type: String, default: 'House' },
  category: { type: String, default: 'House' },
  price: { type: Number, default: 0 },
  rent: { type: Number, default: 0 },
  salePrice: { type: Number, default: 0 },
  location: { type: String, default: '' },
  city: { type: String, default: '' },
  address: { type: String, default: '' },
  bedrooms: { type: Number, default: 0 },
  bathrooms: { type: Number, default: 0 },
  area: { type: Number, default: 0 },
  furnished: { type: String, default: '' },
  ownerId: { type: String, default: '' },
  images: { type: [String], default: [] },
  image: { type: String, default: '' },
  status: { type: String, default: 'Available' },
  availability: { type: String, default: 'Available' },
  source: { type: String, default: 'property' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

export default mongoose.model('Listing', listingSchema, 'properties');
