import Area from '../models/Area.js';

import mongoose from 'mongoose';
import Property from '../models/Property.js';
import { getArea, childAreas, resolvePlace } from '../utils/places.js';
import { computeAreaStats, nearbyLandmarks, areaFilter, propertyPoint } from '../utils/locationService.js';

const areaView = (doc, stats) => {
  const info = getArea(doc.slug);
  const lat = doc.latitude ?? doc.center?.lat ?? info?.lat ?? null;
  const lng = doc.longitude ?? doc.center?.lng ?? info?.lng ?? null;
  return {
    ...doc,
    slug: doc.slug || null,
    aliases: doc.aliases?.length ? doc.aliases : info?.aliases || [],
    parent: doc.parent ?? info?.parent ?? null,
    tier: doc.tier || info?.tier || '',
    description: doc.description || info?.description || '',
    latitude: lat,
    longitude: lng,
    center: lat !== null && lng !== null ? { lat, lng } : null,
    stats: doc.slug ? stats.get(doc.slug) : null,
  };
};

/** GET /api/areas - every area (admin-managed collection) with live listing stats. */
export const listAreas = async (req, res) => {
  try {
    const [items, stats] = await Promise.all([
      Area.find({}).sort({ displayOrder: 1, name: 1 }).lean(),
      computeAreaStats(),
    ]);
    return res.json({ success: true, data: items.map((item) => areaView(item, stats)) });
  } catch (error) {
    console.error('List areas failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list areas.' });
  }
};

/** GET /api/areas/:slug - area guide: description, centre, stats, nearby landmarks and listings. */
export const getAreaGuide = async (req, res) => {
  try {
    const key = String(req.params.slug || '').trim();
    let doc = null;
    if (mongoose.isValidObjectId(key) && /^[a-f0-9]{24}$/i.test(key)) doc = await Area.findById(key).lean();
    const info = getArea(doc?.slug || key) || (doc ? null : resolvePlace(key, { type: 'area' }));
    if (!doc && info) doc = await Area.findOne({ slug: info.slug }).lean();
    if (!doc && !info) return res.status(404).json({ success: false, message: 'Area not found.' });

    const base = doc || { name: info.name, slug: info.slug, city: 'Lahore', active: true };
    const stats = await computeAreaStats();
    const area = areaView({ ...base, slug: base.slug || info?.slug }, stats);
    const center = area.center;

    const filter = area.slug ? areaFilter(area.slug) : null;
    const listings = filter
      ? await Property.find({ $and: [filter.condition, { status: { $ne: 'Inactive' } }] })
        .sort({ isFeatured: -1, createdAt: -1 })
        .limit(Math.min(Math.max(Number.parseInt(req.query?.listings, 10) || 6, 0), 24))
        .select('title price purpose propertyType subType area areaUnit bedrooms bathrooms phase block society image images latitude longitude locationApproximate isFeatured status areaSlug')
        .lean()
      : [];

    return res.json({
      success: true,
      data: {
        ...area,
        subdivisions: info?.subdivisions || [],
        children: area.slug ? childAreas(area.slug).map((child) => ({ slug: child.slug, name: child.name, tier: child.tier, stats: stats.get(child.slug) })) : [],
        nearbyLandmarks: center ? nearbyLandmarks(center, { perCategory: 3, maxKm: 12 }) : {},
        listings: listings.map((listing) => ({ ...listing, images: (listing.images || []).slice(0, 1), point: propertyPoint(listing) })),
        estimate: true,
      },
    });
  } catch (error) {
    console.error('Area guide failed', error);
    return res.status(500).json({ success: false, message: 'Unable to load area guide.' });
  }
};

export const createArea = async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ success: false, message: 'Area name is required.' });
    const item = await Area.create({
      name: String(body.name).trim(),
      city: body.city || '',
      phase: body.phase || '',
      displayOrder: Number(body.displayOrder || 0),
      active: body.active !== undefined ? Boolean(body.active) : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('Create area failed', error);
    return res.status(500).json({ success: false, message: 'Unable to create area.' });
  }
};

export const updateArea = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    updates.updatedAt = new Date();
    const item = await Area.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!item) return res.status(404).json({ success: false, message: 'Area not found.' });
    return res.json({ success: true, data: item });
  } catch (error) {
    console.error('Update area failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update area.' });
  }
};

export const deleteArea = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Area.findByIdAndDelete(id).lean();
    if (!item) return res.status(404).json({ success: false, message: 'Area not found.' });
    return res.json({ success: true, data: item });
  } catch (error) {
    console.error('Delete area failed', error);
    return res.status(500).json({ success: false, message: 'Unable to delete area.' });
  }
};

export const toggleAreaActive = async (req, res) => {
  try {
    const { id } = req.params;
    const area = await Area.findById(id);
    if (!area) return res.status(404).json({ success: false, message: 'Area not found.' });
    area.active = !area.active;
    area.updatedAt = new Date();
    await area.save();
    return res.json({ success: true, data: area });
  } catch (error) {
    console.error('Toggle area failed', error);
    return res.status(500).json({ success: false, message: 'Unable to toggle area.' });
  }
};
