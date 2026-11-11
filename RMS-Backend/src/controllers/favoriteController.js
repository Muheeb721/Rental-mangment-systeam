import mongoose from 'mongoose';
import Favorite from '../models/Favorite.js';
import Property from '../models/Property.js';

/** POST /api/favorites { propertyId } - idempotent. */
export const addFavorite = async (req, res) => {
  try {
    const userId = String(req.user.id);
    const propertyId = String(req.body?.propertyId || '').trim();
    if (!mongoose.isValidObjectId(propertyId)) return res.status(400).json({ success: false, message: 'A valid propertyId is required.' });
    const exists = await Property.exists({ _id: propertyId });
    if (!exists) return res.status(404).json({ success: false, message: 'Property not found.' });

    const existing = await Favorite.findOne({ userId, propertyId }).lean();
    if (existing) return res.json({ success: true, message: 'Already in favourites.', data: existing });

    const favorite = await Favorite.create({ userId, propertyId, createdAt: new Date() });
    return res.status(201).json({ success: true, message: 'Added to favourites.', data: favorite });
  } catch (error) {
    console.error('Add favorite failed', error);
    return res.status(500).json({ success: false, message: 'Unable to add favourite.' });
  }
};

/** DELETE /api/favorites/:propertyId */
export const removeFavorite = async (req, res) => {
  try {
    const removed = await Favorite.findOneAndDelete({ userId: String(req.user.id), propertyId: String(req.params.propertyId) }).lean();
    return res.json({ success: true, message: removed ? 'Removed from favourites.' : 'Not in favourites.', data: removed });
  } catch (error) {
    console.error('Remove favorite failed', error);
    return res.status(500).json({ success: false, message: 'Unable to remove favourite.' });
  }
};

/** GET /api/favorites - each item: { _id, userId, propertyId, createdAt, property } (property is null if it was deleted). */
export const listFavorites = async (req, res) => {
  try {
    const items = await Favorite.find({ userId: String(req.user.id) }).sort({ createdAt: -1 }).lean();
    const ids = items.map((item) => item.propertyId).filter((id) => mongoose.isValidObjectId(id));
    const properties = await Property.find({ _id: { $in: ids } }).lean();
    const byId = new Map(properties.map((property) => [String(property._id), property]));
    return res.json({ success: true, data: items.map((item) => ({ ...item, property: byId.get(String(item.propertyId)) || null })) });
  } catch (error) {
    console.error('List favorites failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list favourites.' });
  }
};

export const aggregateFavorites = async (_req, res) => {
  try {
    const agg = await Favorite.aggregate([
      { $group: { _id: '$propertyId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const total = agg.reduce((sum, row) => sum + (row.count || 0), 0);
    return res.json({ success: true, data: { totalFavorites: total, byProperty: agg } });
  } catch (error) {
    console.error('Aggregate favorites failed', error);
    return res.status(500).json({ success: false, message: 'Unable to aggregate favourites.' });
  }
};
