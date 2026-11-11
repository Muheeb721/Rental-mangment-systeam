import mongoose from 'mongoose';

const AreaSchema = new mongoose.Schema({
  name: { type: String, required: true },
  city: { type: String, default: '' },
  phase: { type: String, default: '' },
  displayOrder: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  // location intelligence (all optional; older clients only use name/city/phase)
  slug: { type: String, index: { unique: true, sparse: true } },
  aliases: { type: [String], default: [] },
  parent: { type: String, default: null },
  subdivisions: { type: [String], default: [] },
  tier: { type: String, default: '' },
  description: { type: String, default: '' },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  center: { lat: { type: Number, default: null }, lng: { type: Number, default: null } },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model('Area', AreaSchema);
