import mongoose from 'mongoose';
import { resolveAreaForProperty, approximateOffset } from '../utils/places.js';

export const PROPERTY_TYPES = ['House', 'Flat', 'Apartment', 'Plot', 'Commercial', 'Room', 'Hostel'];
export const PROPERTY_PURPOSES = ['Rent', 'Sale'];
export const PROPERTY_STATUSES = ['Available', 'Booked', 'Rented', 'Reserved', 'Sold', 'Inactive'];
export const AREA_UNITS = ['Marla', 'Kanal', 'Sq. Ft.'];
export const FURNISHING_OPTIONS = ['Furnished', 'Semi-Furnished', 'Unfurnished'];

/**
 * Normalises an images array (legacy strings or objects) into [{ url, public_id, uploadedAt, _id }]
 * and derives the cover image from the first entry.
 */
export const normalizePropertyImages = (imagesInput = [], fallbackFeaturedUrl = '') => {
  const values = Array.isArray(imagesInput) ? imagesInput : [];
  const normalized = values
    .map((it) => {
      if (!it) return null;
      if (typeof it === 'string') return { url: it, public_id: '' };
      if (typeof it === 'object' && typeof it.url === 'string' && it.url) {
        const image = { url: it.url, public_id: it.public_id || '', uploadedAt: it.uploadedAt || new Date() };
        if (it._id) image._id = it._id;
        return image;
      }
      return null;
    })
    .filter(Boolean);

  if (normalized.length > 0) {
    const featured = normalized[0];
    return {
      images: normalized,
      featuredImage: { url: featured.url, public_id: featured.public_id || '' },
      image: featured.url,
    };
  }

  const fallbackUrl = typeof fallbackFeaturedUrl === 'string' ? fallbackFeaturedUrl : '';
  return {
    images: [],
    featuredImage: { url: fallbackUrl, public_id: '' },
    image: fallbackUrl,
  };
};

const imageSchema = new mongoose.Schema({
  url: { type: String, default: '' },
  public_id: { type: String, default: '' },
  uploadedAt: { type: Date, default: Date.now },
});

const propertySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  // propertyType is canonical; type/category are kept in sync for older clients
  propertyType: { type: String, default: 'House' },
  type: { type: String, default: 'House' },
  category: { type: String, default: 'House' },
  // purpose is canonical ('Rent' | 'Sale'); transactionType/listingType mirror it
  purpose: { type: String, default: 'Rent' },
  transactionType: { type: String, default: 'Rent' },
  listingType: { type: String, default: 'rent' },
  // price is canonical: monthly rent for Rent listings, total demand for Sale listings
  price: { type: Number, default: 0 },
  rent: { type: Number, default: 0 },
  salePrice: { type: Number, default: 0 },
  location: { type: String, default: '' },
  city: { type: String, default: 'Lahore' },
  society: { type: String, default: '' },
  phase: { type: String, default: '' },
  block: { type: String, default: '' },
  address: { type: String, default: '' },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  // true when latitude/longitude were derived from the area centre (not an exact pin)
  locationApproximate: { type: Boolean, default: false },
  // slug of the matching Lahore area (see src/data/lahorePlaces.js); derived on save
  areaSlug: { type: String, default: '', index: true },
  // optional finer type, e.g. 'Upper Portion', 'Lower Portion', 'Shop', 'Office', 'Penthouse'
  subType: { type: String, default: '' },
  bedrooms: { type: Number, default: 0 },
  bathrooms: { type: Number, default: 0 },
  parking: { type: Number, default: 0 },
  area: { type: Number, default: 0 },
  areaUnit: { type: String, default: 'Marla' },
  furnished: { type: String, default: '' },
  amenities: { type: [String], default: [] },
  ownerId: { type: String, default: '' },
  ownerName: { type: String, default: '' },
  ownerPhone: { type: String, default: '' },
  ownerEmail: { type: String, default: '' },
  managerName: { type: String, default: '' },
  deposit: { type: Number, default: 0 },
  otherCharges: { type: Number, default: 0 },
  floor: { type: Number, default: 0 },
  totalFloors: { type: Number, default: 0 },
  yearBuilt: { type: Number, default: null },
  priceHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },
  images: { type: [imageSchema], default: [] },
  // cover image (always images[0]); kept as a string for older clients
  image: { type: String, default: '' },
  featuredImage: {
    url: { type: String, default: '' },
    public_id: { type: String, default: '' },
  },
  videos: { type: [String], default: [] },
  media3d: { type: [String], default: [] },
  status: { type: String, default: 'Available' },
  availability: { type: String, default: 'Available' },
  offer: { type: mongoose.Schema.Types.Mixed, default: null },
  offerEnabled: { type: Boolean, default: false },
  discountPercent: { type: Number, default: 0 },
  isFeatured: { type: Boolean, default: false },
  views: { type: Number, default: 0 },
  // stable key used by the demo seeder to make seeding idempotent
  seedKey: { type: String, default: undefined, index: true, sparse: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

/** Keep the legacy cover fields (image / featuredImage) in sync with images[0]. */
export const syncCoverFields = (doc, { clearWhenEmpty = false } = {}) => {
  const first = Array.isArray(doc.images) && doc.images.length ? doc.images[0] : null;
  if (first?.url) {
    doc.image = first.url;
    doc.featuredImage = { url: first.url, public_id: first.public_id || '' };
  } else if (clearWhenEmpty) {
    doc.image = '';
    doc.featuredImage = { url: '', public_id: '' };
  }
  return doc;
};

/**
 * Derive areaSlug from phase/society/location and make sure every listing has coordinates:
 * when lat/lng are missing, use the area centre plus a small deterministic offset and flag
 * locationApproximate. Exact admin-entered coordinates are never changed.
 */
export const applyLocationDefaults = (doc) => {
  const locationChanged = !doc.areaSlug || ['phase', 'society', 'location', 'address', 'block'].some((key) => typeof doc.isModified !== 'function' || doc.isModified(key));
  if (locationChanged) {
    const area = resolveAreaForProperty({ phase: doc.phase, society: doc.society, location: doc.location, address: doc.address });
    if (area) doc.areaSlug = area.slug;
  }
  const hasCoords = Number.isFinite(doc.latitude) && Number.isFinite(doc.longitude) && doc.latitude !== null && doc.longitude !== null;
  const coordsTouched = typeof doc.isModified === 'function' && (doc.isModified('latitude') || doc.isModified('longitude'));
  if (hasCoords && coordsTouched && !doc.isNew) doc.locationApproximate = false;
  if (!hasCoords || (doc.locationApproximate && locationChanged && !coordsTouched)) {
    const area = resolveAreaForProperty({ areaSlug: doc.areaSlug });
    if (area) {
      const { dLat, dLng } = approximateOffset(String(doc._id || doc.title || ''));
      doc.latitude = Number((area.lat + dLat).toFixed(6));
      doc.longitude = Number((area.lng + dLng).toFixed(6));
      doc.locationApproximate = true;
    }
  }
  return doc;
};

propertySchema.pre('save', function preSave(next) {
  try {
    syncCoverFields(this);
  } catch (e) {
    console.warn('Property image normalization failed', e?.message || e);
  }
  try {
    applyLocationDefaults(this);
  } catch (e) {
    console.warn('Property location defaults failed', e?.message || e);
  }
  next();
});

export default mongoose.model('Property', propertySchema, 'properties');
