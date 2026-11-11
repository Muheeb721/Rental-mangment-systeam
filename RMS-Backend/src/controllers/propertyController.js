import mongoose from 'mongoose';
import Property, {
  PROPERTY_TYPES,
  PROPERTY_PURPOSES,
  PROPERTY_STATUSES,
  AREA_UNITS,
  FURNISHING_OPTIONS,
  syncCoverFields,
} from '../models/Property.js';
import {
  collectUploadedFiles,
  storePropertyImages,
  removePropertyImages,
  MAX_IMAGES_PER_PROPERTY,
} from '../utils/propertyMedia.js';
import { logAdminAction } from '../services/activityService.js';
import { areaFilter, resolvePoint, propertyPoint, nearbyLandmarks } from '../utils/locationService.js';
import { quickTravel, minutesByMode, normalizeMode } from '../utils/travel.js';

export { recommendProperties } from './propertyRecommendationController.js';

// ---------------------------------------------------------------------------
// Normalisers
// ---------------------------------------------------------------------------

const lower = (value) => String(value ?? '').trim().toLowerCase();
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const normalizePropertyStatus = (value, fallback = 'Available') => {
  const key = lower(value);
  if (!key) return fallback;
  const mappings = {
    available: 'Available',
    vacant: 'Available',
    'for rent': 'Available',
    for_rent: 'Available',
    rent: 'Available',
    'for sale': 'Available',
    for_sale: 'Available',
    booked: 'Booked',
    pending: 'Booked',
    rented: 'Rented',
    occupied: 'Rented',
    leased: 'Rented',
    reserved: 'Reserved',
    'under offer': 'Reserved',
    sold: 'Sold',
    inactive: 'Inactive',
    hidden: 'Inactive',
    draft: 'Inactive',
    unavailable: 'Inactive',
  };
  return mappings[key] || fallback;
};

export const normalizePropertyType = (value) => {
  const key = lower(value);
  if (!key) return '';
  const exact = PROPERTY_TYPES.find((type) => type.toLowerCase() === key);
  if (exact) return exact;
  const aliases = {
    houses: 'House', villa: 'House', home: 'House', bungalow: 'House', 'farm house': 'House',
    flats: 'Flat', studio: 'Flat', penthouse: 'Apartment', apartments: 'Apartment', condo: 'Apartment',
    plots: 'Plot', land: 'Plot', 'residential plot': 'Plot', 'commercial plot': 'Plot',
    shop: 'Commercial', office: 'Commercial', building: 'Commercial', warehouse: 'Commercial',
    rooms: 'Room', hostels: 'Hostel',
  };
  return aliases[key] || '';
};

export const normalizePurpose = (value) => {
  const key = lower(value);
  if (!key) return '';
  if (['rent', 'for rent', 'rental', 'lease', 'to let'].includes(key)) return 'Rent';
  if (['sale', 'for sale', 'sell', 'buy', 'purchase'].includes(key)) return 'Sale';
  return '';
};

const normalizeAreaUnit = (value) => {
  const key = lower(value).replace(/[^a-z]/g, '');
  if (!key) return '';
  if (key.startsWith('marla')) return 'Marla';
  if (key.startsWith('kanal')) return 'Kanal';
  if (['sqft', 'squarefeet', 'squarefoot', 'sqfeet', 'ft'].includes(key)) return 'Sq. Ft.';
  return '';
};

const normalizeFurnished = (value) => {
  const key = lower(value).replace(/[^a-z]/g, '');
  if (!key) return '';
  if (key === 'furnished' || key === 'yes' || key === 'true' || key === 'fully' || key === 'fullyfurnished') return 'Furnished';
  if (key.startsWith('semi')) return 'Semi-Furnished';
  if (key === 'unfurnished' || key === 'no' || key === 'false' || key === 'none') return 'Unfurnished';
  return '';
};

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'on'].includes(lower(value));
};

/** Arrays may arrive as real arrays (JSON), JSON strings or comma separated strings (multipart). */
const parseList = (value) => {
  if (Array.isArray(value)) return value.flatMap((item) => parseList(item));
  if (value === undefined || value === null) return [];
  const text = String(value).trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through to comma split
    }
  }
  return text.split(',');
};

const cleanStringList = (value) => [...new Set(parseList(value).map((item) => String(item ?? '').trim()).filter(Boolean))].slice(0, 50);

const has = (input, key) => Object.prototype.hasOwnProperty.call(input, key) && input[key] !== undefined;

/**
 * Validates and normalises a create/update payload. Returns { values, errors }.
 * In partial mode only fields that are present are validated and returned.
 */
export const buildPropertyValues = (input = {}, { partial = false, existing = null } = {}) => {
  const errors = {};
  const values = {};
  const need = (key) => !partial || has(input, key);

  // title
  if (need('title')) {
    const title = String(input.title ?? '').trim();
    if (!title) errors.title = 'Title is required.';
    else if (title.length < 5) errors.title = 'Title must be at least 5 characters.';
    else if (title.length > 150) errors.title = 'Title must be 150 characters or fewer.';
    values.title = title;
  }
  if (has(input, 'description')) {
    const description = String(input.description ?? '').trim();
    if (description.length > 5000) errors.description = 'Description must be 5000 characters or fewer.';
    values.description = description;
  }

  // type
  const typeInput = input.propertyType ?? input.type ?? input.category;
  if (need('propertyType') || has(input, 'type') || has(input, 'category')) {
    const type = normalizePropertyType(typeInput);
    if (!type) errors.propertyType = `Property type must be one of: ${PROPERTY_TYPES.slice(0, 5).join(', ')}.`;
    else Object.assign(values, { propertyType: type, type, category: type });
  }

  // purpose
  const purposeInput = input.purpose ?? input.transactionType ?? input.listingType;
  if (need('purpose') || has(input, 'transactionType') || has(input, 'listingType')) {
    const purpose = normalizePurpose(purposeInput) || (partial ? '' : 'Rent');
    if (!purpose) errors.purpose = 'Purpose must be Rent or Sale.';
    else Object.assign(values, { purpose, transactionType: purpose, listingType: purpose.toLowerCase() });
  }

  // price
  const effectivePurpose = values.purpose || existing?.purpose || 'Rent';
  const priceInput = input.price ?? (effectivePurpose === 'Sale' ? input.salePrice : input.rent) ?? input.rent ?? input.salePrice;
  if (need('price') || has(input, 'rent') || has(input, 'salePrice') || values.purpose) {
    const rawPrice = priceInput ?? existing?.price;
    const price = Number(rawPrice);
    if (rawPrice === undefined || rawPrice === '' || !Number.isFinite(price) || price <= 0) {
      errors.price = effectivePurpose === 'Sale' ? 'Sale price must be greater than zero.' : 'Monthly rent must be greater than zero.';
    } else if (price > 50_000_000_000) {
      errors.price = 'Price is unrealistically large.';
    } else {
      values.price = Math.round(price);
      values.rent = effectivePurpose === 'Rent' ? values.price : 0;
      values.salePrice = effectivePurpose === 'Sale' ? values.price : 0;
    }
  }

  // location strings
  for (const key of ['city', 'society', 'phase', 'block', 'address', 'location', 'ownerName', 'ownerPhone', 'ownerEmail', 'managerName']) {
    if (has(input, key)) values[key] = String(input[key] ?? '').trim().slice(0, 300);
  }
  if (!partial) {
    if (!values.city) errors.city = 'City is required.';
    if (!values.address && !values.phase && !values.society) errors.address = 'Provide an address, society or phase.';
  } else if (has(input, 'city') && !values.city) {
    errors.city = 'City is required.';
  }
  if (values.ownerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.ownerEmail)) errors.ownerEmail = 'Owner email is not valid.';

  // coordinates
  for (const [key, min, max] of [['latitude', -90, 90], ['longitude', -180, 180]]) {
    if (!has(input, key)) continue;
    if (input[key] === '' || input[key] === null) { values[key] = null; continue; }
    const number = Number(input[key]);
    if (!Number.isFinite(number) || number < min || number > max) errors[key] = `${key[0].toUpperCase()}${key.slice(1)} must be between ${min} and ${max}.`;
    else values[key] = number;
  }

  // counts
  for (const key of ['bedrooms', 'bathrooms', 'parking', 'floor', 'totalFloors']) {
    if (!has(input, key)) continue;
    if (input[key] === '' || input[key] === null) { values[key] = 0; continue; }
    const number = Number(input[key]);
    if (!Number.isInteger(number) || number < 0 || number > 100) errors[key] = `${key} must be a whole number between 0 and 100.`;
    else values[key] = number;
  }
  for (const key of ['deposit', 'otherCharges']) {
    if (!has(input, key)) continue;
    const number = Number(input[key] || 0);
    if (!Number.isFinite(number) || number < 0) errors[key] = `${key} must be zero or more.`;
    else values[key] = number;
  }
  if (has(input, 'yearBuilt')) {
    if (input.yearBuilt === '' || input.yearBuilt === null) values.yearBuilt = null;
    else {
      const year = Number(input.yearBuilt);
      if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 5) errors.yearBuilt = 'Year built is not valid.';
      else values.yearBuilt = year;
    }
  }

  // area
  // area may arrive as a number or as text with its unit, e.g. "8 Marla" / "2,250 sq ft"
  let unitFromArea = '';
  if (need('area')) {
    const match = String(input.area ?? '').replace(/,/g, '').match(/^\s*([\d.]+)\s*(.*)$/);
    const area = match ? Number(match[1]) : NaN;
    unitFromArea = match ? normalizeAreaUnit(match[2]) : '';
    if (!Number.isFinite(area) || area <= 0) errors.area = 'Area must be greater than zero.';
    else values.area = area;
  }
  if (need('areaUnit') || unitFromArea) {
    const unit = normalizeAreaUnit(input.areaUnit) || unitFromArea || (partial ? '' : 'Marla');
    if (!unit) errors.areaUnit = `Area unit must be one of: ${AREA_UNITS.join(', ')}.`;
    else values.areaUnit = unit;
  }

  if (has(input, 'furnished')) {
    if (input.furnished === '' || input.furnished === null) values.furnished = '';
    else {
      const furnished = normalizeFurnished(input.furnished);
      if (!furnished) errors.furnished = `Furnishing must be one of: ${FURNISHING_OPTIONS.join(', ')}.`;
      else values.furnished = furnished;
    }
  }
  if (has(input, 'amenities')) values.amenities = cleanStringList(input.amenities);

  if (need('status') || has(input, 'availability')) {
    const rawStatus = input.status ?? input.availability;
    const status = normalizePropertyStatus(rawStatus, '');
    if (!rawStatus && !partial) {
      values.status = 'Available';
      values.availability = 'Available';
    } else if (!status) {
      errors.status = `Status must be one of: ${PROPERTY_STATUSES.join(', ')}.`;
    } else {
      values.status = status;
      values.availability = status;
    }
  }

  if (has(input, 'isFeatured') || has(input, 'featured')) values.isFeatured = parseBoolean(input.isFeatured ?? input.featured);
  if (has(input, 'videos')) values.videos = cleanStringList(input.videos);

  // derived human readable location
  if (!partial || ['society', 'phase', 'block', 'city', 'location'].some((key) => has(input, key))) {
    const merged = { ...(existing || {}), ...values };
    if (!String(merged.location || '').trim() || !has(input, 'location')) {
      values.location = [merged.phase, merged.society, merged.city].filter(Boolean).join(', ') || merged.address || '';
    }
  }

  return { values, errors };
};

const validationFailure = (res, errors) => {
  const messages = Object.values(errors);
  return res.status(400).json({ success: false, message: messages[0] || 'Invalid property details.', errors });
};

const findPropertyOr404 = async (id, res) => {
  if (!mongoose.isValidObjectId(id)) {
    res.status(404).json({ success: false, message: 'Property not found.' });
    return null;
  }
  const property = await Property.findById(id);
  if (!property) res.status(404).json({ success: false, message: 'Property not found.' });
  return property;
};

const logPropertyAction = async (req, actionType, property, message) => {
  try {
    await logAdminAction({
      adminId: req.user?.id || 'admin',
      adminName: req.user?.name || 'Admin',
      adminEmail: req.user?.email || '',
      actionType,
      entityType: 'PROPERTY',
      entityId: String(property._id),
      message,
      description: message,
      propertyName: property.title,
    });
  } catch (error) {
    console.warn('Property activity log failed:', error?.message || error);
  }
};

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export const createProperty = async (req, res) => {
  let storedImages = [];
  try {
    const input = req.body || {};
    const { values, errors } = buildPropertyValues(input);
    const files = collectUploadedFiles(req);
    const urlImages = parseList(input.imageUrls).map((url) => String(url).trim()).filter((url) => /^(https?:\/\/|\/images\/|\/uploads\/)/.test(url));
    if (files.length + urlImages.length > MAX_IMAGES_PER_PROPERTY) errors.images = `A property can have at most ${MAX_IMAGES_PER_PROPERTY} images.`;
    if (Object.keys(errors).length) return validationFailure(res, errors);

    storedImages = await storePropertyImages(files);
    const images = [...storedImages, ...urlImages.map((url) => ({ url, public_id: '', uploadedAt: new Date() }))];

    const property = new Property({
      ...values,
      images,
      ownerId: req.user?.id ? String(req.user.id) : '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    syncCoverFields(property, { clearWhenEmpty: true });
    await property.save();
    await logPropertyAction(req, 'PROPERTY_CREATED', property, `Property "${property.title}" was created.`);
    return res.status(201).json({ success: true, message: 'Property created successfully.', data: property.toObject() });
  } catch (error) {
    await removePropertyImages(storedImages);
    console.error('Create property failed', error);
    return res.status(500).json({ success: false, message: 'Unable to create property.' });
  }
};

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  price_asc: { price: 1, createdAt: -1 },
  price_desc: { price: -1, createdAt: -1 },
  title: { title: 1 },
  featured: { isFeatured: -1, createdAt: -1 },
};

const buildListFilter = (query = {}, { includeInactive = false } = {}) => {
  const and = [];
  const { q, search, type, propertyType, purpose, transactionType, status, city, society, phase, featured, minPrice, maxPrice, budget, bedrooms } = query;

  const term = String(q || search || '').trim();
  if (term) {
    const regex = new RegExp(escapeRegex(term), 'i');
    and.push({ $or: [{ title: regex }, { description: regex }, { location: regex }, { address: regex }, { society: regex }, { phase: regex }, { block: regex }, { city: regex }] });
  }

  const typeValue = normalizePropertyType(type || propertyType);
  if ((type || propertyType) && lower(type || propertyType) !== 'all') {
    const regex = new RegExp(`^${escapeRegex(typeValue || type || propertyType)}$`, 'i');
    and.push({ $or: [{ propertyType: regex }, { type: regex }, { category: regex }] });
  }

  const purposeValue = normalizePurpose(purpose || transactionType);
  if (purposeValue) and.push({ $or: [{ purpose: purposeValue }, { transactionType: purposeValue }] });

  if (status && lower(status) !== 'all') {
    const statusValue = normalizePropertyStatus(status, status);
    and.push({ status: new RegExp(`^${escapeRegex(statusValue)}$`, 'i') });
  } else if (!includeInactive) {
    and.push({ status: { $ne: 'Inactive' } });
  }

  if (city) and.push({ city: new RegExp(`^${escapeRegex(city)}$`, 'i') });
  if (society) and.push({ society: new RegExp(escapeRegex(society), 'i') });
  if (phase) and.push({ phase: new RegExp(escapeRegex(phase), 'i') });
  if (query.area) {
    const match = areaFilter(query.area);
    // unknown area -> match nothing rather than silently ignoring the filter
    and.push(match ? match.condition : { _id: null });
  }
  if (featured !== undefined && featured !== '') and.push({ isFeatured: parseBoolean(featured) });

  const min = Number(minPrice || 0);
  const max = Number(maxPrice || budget || 0);
  if (min > 0 || max > 0) {
    const range = {};
    if (min > 0) range.$gte = min;
    if (max > 0) range.$lte = max;
    and.push({ price: range });
  }
  const beds = Number(bedrooms || 0);
  if (beds > 0) and.push({ bedrooms: { $gte: beds } });

  return and.length ? { $and: and } : {};
};

const listWithOptions = async (req, res, options) => {
  try {
    const query = req.query || {};
    const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 1000, 1), 1000);
    const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
    const filter = buildListFilter(query, options);

    // ---- proximity search: near=<slug|lat,lng|propertyId>&radiusKm=&maxMinutes=&mode=&sort=distance
    if (query.near) {
      const origin = await resolvePoint(query.near);
      if (!origin) return res.status(400).json({ success: false, message: `Could not find a location for near="${query.near}".` });
      const radiusKm = Number(query.radiusKm || query.radius || 0);
      const maxMinutes = Number(query.maxMinutes || 0);
      const mode = normalizeMode(query.mode || 'car');
      const all = await Property.find(filter).lean();
      let items = [];
      for (const item of all) {
        const point = propertyPoint(item);
        if (!point) continue;
        const travel = quickTravel(origin, point);
        const minutes = mode === 'car' ? travel.carMinutes : mode === 'motorbike' ? travel.bikeMinutes : mode === 'rickshaw' ? travel.rickshawMinutes : minutesByMode(origin, point, mode);
        if (radiusKm > 0 && travel.distanceKm > radiusKm) continue;
        if (maxMinutes > 0 && minutes > maxMinutes) continue;
        items.push({ ...item, distanceKm: travel.distanceKm, travel: { ...travel, mode, minutes, from: origin.label } });
      }
      if (!query.sort || query.sort === 'distance') items.sort((a, b) => a.distanceKm - b.distanceKm);
      else if (SORTS[query.sort]) {
        const [[field, dir]] = Object.entries(SORTS[query.sort]);
        items.sort((a, b) => ((a[field] > b[field]) - (a[field] < b[field])) * dir);
      }
      const total = items.length;
      items = items.slice((page - 1) * limit, page * limit);
      return res.json({
        success: true,
        data: items,
        meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), near: origin, radiusKm: radiusKm || null, maxMinutes: maxMinutes || null, mode, estimate: true },
      });
    }

    if (query.sort === 'distance') return res.status(400).json({ success: false, message: 'sort=distance requires a "near" location.' });
    const sort = SORTS[query.sort] || SORTS.newest;
    const [items, total] = await Promise.all([
      Property.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      Property.countDocuments(filter),
    ]);
    return res.json({ success: true, data: items, meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    console.error('List properties failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list properties.' });
  }
};

/** Public listing - hides Inactive properties unless a status filter is given. */
export const listProperties = (req, res) => listWithOptions(req, res, { includeInactive: false });
/** Admin listing - includes Inactive properties. */
export const listPropertiesAdmin = (req, res) => listWithOptions(req, res, { includeInactive: true });

export const getProperty = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ success: false, message: 'Property not found.' });
    const property = await Property.findById(id).lean();
    if (!property) return res.status(404).json({ success: false, message: 'Property not found.' });
    return res.json({ success: true, data: property });
  } catch (error) {
    console.error('Get property failed', error);
    return res.status(500).json({ success: false, message: 'Unable to get property.' });
  }
};

/** GET /api/properties/:id/nearby?category=&limit= - nearest landmarks with distance and travel minutes. */
export const getPropertyNearby = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ success: false, message: 'Property not found.' });
    const property = await Property.findById(id).select('title phase society location address block areaSlug latitude longitude locationApproximate').lean();
    if (!property) return res.status(404).json({ success: false, message: 'Property not found.' });
    const point = propertyPoint(property);
    if (!point) return res.status(422).json({ success: false, message: 'This property has no location yet.' });
    const category = String(req.query?.category || '').trim().toLowerCase();
    const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || (category ? 5 : 3), 1), 20);
    const nearby = category
      ? { [category]: nearbyLandmarks(point, { category, limit, maxKm: 40 }) }
      : nearbyLandmarks(point, { perCategory: limit, maxKm: 40 });
    return res.json({
      success: true,
      data: {
        property: { id: String(property._id), title: property.title, areaSlug: property.areaSlug || '', lat: point.lat, lng: point.lng, locationApproximate: point.approximate },
        nearby,
        estimate: true,
      },
    });
  } catch (error) {
    console.error('Property nearby failed', error);
    return res.status(500).json({ success: false, message: 'Unable to load nearby places.' });
  }
};

/**
 * PUT /api/properties/:id - partial update (JSON or multipart).
 * Optional `images`: ordered list of existing image ids/urls to keep (others are deleted).
 * Optional uploaded files (`images`/`image` fields) are appended after the kept images.
 */
export const updateProperty = async (req, res) => {
  let storedImages = [];
  try {
    const property = await findPropertyOr404(req.params.id, res);
    if (!property) return undefined;

    const input = { ...(req.body || {}) };
    const imageOrderInput = input.images;
    delete input.images;
    delete input.image;
    delete input.featuredImage;

    const { values, errors } = buildPropertyValues(input, { partial: true, existing: property.toObject() });
    const files = collectUploadedFiles(req);

    let keptImages = property.images.map((image) => image.toObject());
    let removedImages = [];
    if (imageOrderInput !== undefined) {
      const refs = parseList(imageOrderInput).map((ref) => (typeof ref === 'object' && ref ? String(ref._id || ref.id || ref.url || '') : String(ref)));
      const byRef = new Map();
      keptImages.forEach((image) => {
        byRef.set(String(image._id), image);
        byRef.set(image.url, image);
      });
      const ordered = [];
      for (const ref of refs) {
        const image = byRef.get(ref);
        if (image && !ordered.includes(image)) ordered.push(image);
      }
      removedImages = keptImages.filter((image) => !ordered.includes(image));
      keptImages = ordered;
    }
    if (keptImages.length + files.length > MAX_IMAGES_PER_PROPERTY) errors.images = `A property can have at most ${MAX_IMAGES_PER_PROPERTY} images.`;
    if (Object.keys(errors).length) return validationFailure(res, errors);

    const previousPrice = property.price;
    storedImages = await storePropertyImages(files);
    property.set({ ...values, updatedAt: new Date() });
    if (imageOrderInput !== undefined || storedImages.length) {
      property.images = [...keptImages, ...storedImages];
      syncCoverFields(property, { clearWhenEmpty: true });
    }
    if (values.price !== undefined && previousPrice && values.price !== previousPrice) {
      property.priceHistory = [...(property.priceHistory || []), { previousPrice, newPrice: values.price, changedAt: new Date() }].slice(-20);
    }
    await property.save();
    await removePropertyImages(removedImages);
    await logPropertyAction(req, 'PROPERTY_INFORMATION_UPDATED', property, `Property "${property.title}" was updated.`);
    return res.json({ success: true, message: 'Property updated successfully.', data: property.toObject() });
  } catch (error) {
    await removePropertyImages(storedImages);
    console.error('Update property failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update property.' });
  }
};

export const deleteProperty = async (req, res) => {
  try {
    const property = await findPropertyOr404(req.params.id, res);
    if (!property) return undefined;
    const snapshot = property.toObject();
    await Property.deleteOne({ _id: property._id });
    await removePropertyImages(snapshot.images || []);
    await logPropertyAction(req, 'PROPERTY_DELETED', property, `Property "${property.title}" was deleted.`);
    return res.json({ success: true, message: 'Property deleted successfully.', data: { _id: snapshot._id, id: String(snapshot._id) } });
  } catch (error) {
    console.error('Delete property failed', error);
    return res.status(500).json({ success: false, message: 'Unable to delete property.' });
  }
};

export const updatePropertyStatus = async (req, res) => {
  try {
    const status = normalizePropertyStatus(req.body?.status, '');
    if (!status) return res.status(400).json({ success: false, message: `Status must be one of: ${PROPERTY_STATUSES.join(', ')}.` });
    const property = await findPropertyOr404(req.params.id, res);
    if (!property) return undefined;
    property.set({ status, availability: status, updatedAt: new Date() });
    await property.save();
    await logPropertyAction(req, 'PROPERTY_STATUS_CHANGED', property, `Property "${property.title}" status changed to ${status}.`);
    return res.json({ success: true, message: `Status changed to ${status}.`, data: property.toObject() });
  } catch (error) {
    console.error('Update property status failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update property status.' });
  }
};

export const updatePropertyPrice = async (req, res) => {
  req.body = { price: req.body?.price ?? req.body?.salePrice ?? req.body?.rent };
  return updateProperty(req, res);
};

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

const findImageIndex = (property, ref) => {
  const value = String(ref ?? '');
  const byId = property.images.findIndex((image) => String(image._id) === value);
  if (byId !== -1) return byId;
  if (/^\d+$/.test(value)) {
    const index = Number(value);
    return index < property.images.length ? index : -1;
  }
  return -1;
};

/** POST /api/properties/:id/images - append one or more uploaded images. */
export const addPropertyImages = async (req, res) => {
  let storedImages = [];
  try {
    const property = await findPropertyOr404(req.params.id, res);
    if (!property) return undefined;
    const files = collectUploadedFiles(req);
    if (!files.length) return res.status(400).json({ success: false, message: 'Choose at least one image to upload.' });
    if (property.images.length + files.length > MAX_IMAGES_PER_PROPERTY) {
      return res.status(400).json({ success: false, message: `A property can have at most ${MAX_IMAGES_PER_PROPERTY} images.` });
    }
    storedImages = await storePropertyImages(files);
    property.images.push(...storedImages);
    syncCoverFields(property);
    property.updatedAt = new Date();
    await property.save();
    return res.status(201).json({ success: true, message: `${files.length} image${files.length > 1 ? 's' : ''} uploaded.`, data: property.toObject() });
  } catch (error) {
    await removePropertyImages(storedImages);
    console.error('Upload property images failed', error);
    return res.status(500).json({ success: false, message: 'Unable to upload images.' });
  }
};

/** DELETE /api/properties/:id/images/:imageId - imageId may be the image _id or its index. */
export const deletePropertyImage = async (req, res) => {
  try {
    const property = await findPropertyOr404(req.params.id, res);
    if (!property) return undefined;
    const index = findImageIndex(property, req.params.imageId ?? req.params.imageIndex);
    if (index === -1) return res.status(404).json({ success: false, message: 'Image not found.' });
    const [removed] = property.images.splice(index, 1);
    syncCoverFields(property, { clearWhenEmpty: true });
    property.updatedAt = new Date();
    await property.save();
    await removePropertyImages([removed]);
    return res.json({ success: true, message: 'Image removed.', data: property.toObject() });
  } catch (error) {
    console.error('Delete property image failed', error);
    return res.status(500).json({ success: false, message: 'Unable to remove image.' });
  }
};

/** PUT /api/properties/:id/images/order - body { order: [imageId, ...] } (must list every image). */
export const reorderPropertyImages = async (req, res) => {
  try {
    const property = await findPropertyOr404(req.params.id, res);
    if (!property) return undefined;
    const order = parseList(req.body?.order ?? req.body?.images).map(String);
    const current = property.images.map((image) => String(image._id));
    if (order.length !== current.length || !order.every((id) => current.includes(id)) || new Set(order).size !== order.length) {
      return res.status(400).json({ success: false, message: 'order must list every image id exactly once.' });
    }
    const byId = new Map(property.images.map((image) => [String(image._id), image.toObject()]));
    property.images = order.map((id) => byId.get(id));
    syncCoverFields(property);
    property.updatedAt = new Date();
    await property.save();
    return res.json({ success: true, message: 'Image order saved.', data: property.toObject() });
  } catch (error) {
    console.error('Reorder property images failed', error);
    return res.status(500).json({ success: false, message: 'Unable to reorder images.' });
  }
};

/** PUT /api/properties/:id/images/:imageId/cover - make an image the cover (moves it first). */
export const setPropertyCoverImage = async (req, res) => {
  try {
    const property = await findPropertyOr404(req.params.id, res);
    if (!property) return undefined;
    const index = findImageIndex(property, req.params.imageId);
    if (index === -1) return res.status(404).json({ success: false, message: 'Image not found.' });
    const images = property.images.map((image) => image.toObject());
    const [cover] = images.splice(index, 1);
    property.images = [cover, ...images];
    syncCoverFields(property);
    property.updatedAt = new Date();
    await property.save();
    return res.json({ success: true, message: 'Cover image updated.', data: property.toObject() });
  } catch (error) {
    console.error('Set cover image failed', error);
    return res.status(500).json({ success: false, message: 'Unable to set the cover image.' });
  }
};

/** POST /api/properties/:id/images/:imageId - replace one image file in place (legacy endpoint). */
export const replacePropertyImage = async (req, res) => {
  let storedImages = [];
  try {
    const property = await findPropertyOr404(req.params.id, res);
    if (!property) return undefined;
    const index = findImageIndex(property, req.params.imageId ?? req.params.imageIndex);
    if (index === -1) return res.status(404).json({ success: false, message: 'Image not found.' });
    const [file] = collectUploadedFiles(req);
    if (!file) return res.status(400).json({ success: false, message: 'Choose an image to upload.' });
    storedImages = await storePropertyImages([file]);
    const previous = property.images[index].toObject();
    property.images.set(index, storedImages[0]);
    syncCoverFields(property);
    property.updatedAt = new Date();
    await property.save();
    await removePropertyImages([previous]);
    return res.json({ success: true, message: 'Image replaced.', data: property.toObject() });
  } catch (error) {
    await removePropertyImages(storedImages);
    console.error('Replace property image failed', error);
    return res.status(500).json({ success: false, message: 'Unable to replace image.' });
  }
};
