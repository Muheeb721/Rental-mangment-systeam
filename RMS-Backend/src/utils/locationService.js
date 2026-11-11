/**
 * Location intelligence shared by the places / areas / travel / property endpoints:
 * point resolution, nearby landmarks, area statistics and area filters.
 */
import mongoose from 'mongoose';
import Property from '../models/Property.js';
import {
  LAHORE_LANDMARKS,
  areaFamily,
  getArea,
  parseLatLng,
  resolveAreaForProperty,
  resolvePlace,
  approximateOffset,
} from './places.js';
import { haversineKm, quickTravel } from './travel.js';

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Coordinates for a property: its own pin, else its area centre (+ offset), else null. */
export const propertyPoint = (property) => {
  if (!property) return null;
  if (Number.isFinite(property.latitude) && Number.isFinite(property.longitude)) {
    return { lat: property.latitude, lng: property.longitude, approximate: Boolean(property.locationApproximate) };
  }
  const area = resolveAreaForProperty(property);
  if (!area) return null;
  const { dLat, dLng } = approximateOffset(String(property._id || property.title || ''));
  return { lat: area.lat + dLat, lng: area.lng + dLng, approximate: true };
};

const summarizePlace = (place) => ({
  type: place.type,
  slug: place.slug,
  name: place.name,
  ...(place.category ? { category: place.category } : {}),
  ...(place.tier ? { tier: place.tier } : {}),
  lat: place.lat,
  lng: place.lng,
});

/**
 * Resolve "from"/"to"/"near" input: "lat,lng", a property ObjectId, or a place slug / fuzzy name.
 * Returns { kind, lat, lng, label, ... } or null.
 */
export const resolvePoint = async (input) => {
  const text = String(input ?? '').trim();
  if (!text) return null;
  const latLng = parseLatLng(text);
  if (latLng) return { kind: 'point', label: `${latLng.lat},${latLng.lng}`, ...latLng };
  if (mongoose.isValidObjectId(text) && /^[a-f0-9]{24}$/i.test(text)) {
    const property = await Property.findById(text).select('title phase society location address block areaSlug latitude longitude locationApproximate').lean();
    if (property) {
      const point = propertyPoint(property);
      if (!point) return null;
      return { kind: 'property', id: String(property._id), label: property.title, areaSlug: property.areaSlug || resolveAreaForProperty(property)?.slug || '', ...point };
    }
  }
  const place = resolvePlace(text);
  if (!place) return null;
  return { kind: place.type, label: place.name, ...summarizePlace(place) };
};

/** Nearest landmarks to a point, grouped by category (or a flat list for one category). */
export const nearbyLandmarks = (point, { category = '', perCategory = 3, limit = 10, maxKm = 25, excludeSlug = '' } = {}) => {
  const enriched = LAHORE_LANDMARKS
    .filter((place) => place.slug !== excludeSlug)
    .filter((place) => !category || place.category === category || place.subCategory === category)
    .map((place) => ({ place, km: haversineKm(point, place) }))
    .filter(({ km }) => km <= maxKm)
    .sort((a, b) => a.km - b.km);
  const format = ({ place }) => {
    const travel = quickTravel(point, place);
    return {
      slug: place.slug,
      name: place.name,
      category: place.category,
      ...(place.subCategory ? { subCategory: place.subCategory } : {}),
      lat: place.lat,
      lng: place.lng,
      distanceKm: travel.distanceKm,
      straightLineKm: Number(haversineKm(point, place).toFixed(2)),
      carMinutes: travel.carMinutes,
      bikeMinutes: travel.bikeMinutes,
      rickshawMinutes: travel.rickshawMinutes,
      rickshawCostPkr: travel.rickshawCostPkr,
    };
  };
  if (category) return enriched.slice(0, limit).map(format);
  const grouped = {};
  for (const item of enriched) {
    const key = item.place.category;
    grouped[key] = grouped[key] || [];
    if (grouped[key].length < perCategory) grouped[key].push(format(item));
  }
  return grouped;
};

// aliases too generic to match free text safely (they still work for search / slug lookup)
const GENERIC_ALIASES = new Set(['defence', 'defense', 'cantt', 'cantonment', 'liberty', 'orchard', 'raiwind', 'bedian', 'walton', 'saddar', 'shalimar', 'eme', 'wapda', 'askari', 'bahria', 'paragon', 'valencia', 'central park', 'the mall']);

/**
 * Mongo condition matching every listing in an area and all its phases/blocks/sectors:
 * by stored areaSlug, or by name/alias text in phase/society/location (safety net for old rows).
 */
export const areaFilter = (slugOrName) => {
  const root = getArea(slugOrName) || resolvePlace(slugOrName, { type: 'area' });
  if (!root) return null;
  const family = areaFamily(root.slug);
  const slugs = family.map((area) => area.slug);
  const terms = [...new Set(family.flatMap((area) => [area.name, ...area.aliases])
    .filter((term) => (term.length >= 4 || /\d/.test(term)) && !GENERIC_ALIASES.has(term.toLowerCase())))];
  const pattern = terms
    .map((term) => term.split(/[\s-]+/).filter(Boolean).map(escapeRegex).join('[\\s\\-]*'))
    .join('|');
  const regex = new RegExp(`(^|[^a-z0-9])(${pattern})($|[^a-z0-9])`, 'i');
  return {
    area: root,
    slugs,
    condition: { $or: [{ areaSlug: { $in: slugs } }, { phase: regex }, { location: regex }, { society: regex }] },
  };
};

// -------------------------------------------------------------------------------------------
// Area statistics
// -------------------------------------------------------------------------------------------
const emptyRange = () => ({ count: 0, min: null, avg: null, max: null, sum: 0 });
const addToRange = (range, value) => {
  if (!Number.isFinite(value) || value <= 0) return;
  range.count += 1;
  range.sum += value;
  range.min = range.min === null ? value : Math.min(range.min, value);
  range.max = range.max === null ? value : Math.max(range.max, value);
};
const finishRange = ({ count, min, max, sum }) => ({ count, min, avg: count ? Math.round(sum / count) : null, max });

const emptyStats = () => ({ listingCount: 0, rentCount: 0, saleCount: 0, rent: emptyRange(), sale: emptyRange(), byType: {} });
const addToStats = (stats, property) => {
  const isSale = String(property.purpose || property.transactionType || '').toLowerCase() === 'sale';
  const type = property.propertyType || property.type || 'Other';
  stats.listingCount += 1;
  if (isSale) stats.saleCount += 1;
  else stats.rentCount += 1;
  addToRange(isSale ? stats.sale : stats.rent, Number(property.price));
  stats.byType[type] = stats.byType[type] || { count: 0, rent: emptyRange(), sale: emptyRange() };
  stats.byType[type].count += 1;
  addToRange(isSale ? stats.byType[type].sale : stats.byType[type].rent, Number(property.price));
};
const finishStats = (stats) => ({
  listingCount: stats.listingCount,
  rentCount: stats.rentCount,
  saleCount: stats.saleCount,
  rent: finishRange(stats.rent),
  sale: finishRange(stats.sale),
  byType: Object.fromEntries(Object.entries(stats.byType).map(([type, value]) => [type, { count: value.count, rent: finishRange(value.rent), sale: finishRange(value.sale) }])),
});

/** Live stats for every area slug (parents include their phases/sectors). */
export const computeAreaStats = async () => {
  const properties = await Property.find({ status: { $ne: 'Inactive' } })
    .select('purpose transactionType propertyType type price areaSlug phase society location address')
    .lean();
  const raw = new Map();
  for (const property of properties) {
    let area = getArea(property.areaSlug) || resolveAreaForProperty(property);
    const seen = new Set();
    while (area && !seen.has(area.slug)) {
      seen.add(area.slug);
      if (!raw.has(area.slug)) raw.set(area.slug, emptyStats());
      addToStats(raw.get(area.slug), property);
      area = area.parent ? getArea(area.parent) : null;
    }
  }
  const result = new Map();
  for (const [slug, stats] of raw) result.set(slug, finishStats(stats));
  return { get: (slug) => result.get(slug) || finishStats(emptyStats()) };
};
