import mongoose from 'mongoose';
import SavedSearch from '../models/SavedSearch.js';

/** POST /api/saved-searches { name, filters } */
export const saveSearch = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim() || 'Saved Search';
    const filters = req.body?.filters && typeof req.body.filters === 'object' && !Array.isArray(req.body.filters) ? req.body.filters : {};
    const count = await SavedSearch.countDocuments({ userId: String(req.user.id) });
    if (count >= 50) return res.status(400).json({ success: false, message: 'You can keep at most 50 saved searches. Delete some first.' });
    const record = await SavedSearch.create({ userId: String(req.user.id), name: name.slice(0, 100), filters, createdAt: new Date() });
    return res.status(201).json({ success: true, message: 'Search saved.', data: record });
  } catch (error) {
    console.error('Save search failed', error);
    return res.status(500).json({ success: false, message: 'Unable to save search.' });
  }
};

export const listSavedSearches = async (req, res) => {
  try {
    const items = await SavedSearch.find({ userId: String(req.user.id) }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List saved searches failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list saved searches.' });
  }
};

export const deleteSavedSearch = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ success: false, message: 'Saved search not found.' });
    const removed = await SavedSearch.findOneAndDelete({ _id: id, userId: String(req.user.id) }).lean();
    if (!removed) return res.status(404).json({ success: false, message: 'Saved search not found.' });
    return res.json({ success: true, message: 'Saved search deleted.', data: removed });
  } catch (error) {
    console.error('Delete saved search failed', error);
    return res.status(500).json({ success: false, message: 'Unable to delete saved search.' });
  }
};
