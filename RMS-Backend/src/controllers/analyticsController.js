import View from '../models/View.js';
import Comparison from '../models/Comparison.js';
import PriceHistory from '../models/PriceHistory.js';

export const getViews = async (req, res) => {
  try {
    // return aggregated counts per property
    const agg = await View.aggregate([
      { $group: { _id: '$propertyId', count: { $sum: 1 }, propertyName: { $first: '$propertyName' } } },
      { $sort: { count: -1 } },
    ]).allowDiskUse(true);

    const data = agg.map((a) => ({ propertyId: a._id, propertyName: a.propertyName || '', count: a.count }));
    return res.json({ success: true, data });
  } catch (error) {
    console.error('getViews failed', error);
    return res.status(500).json({ success: false, message: 'Unable to fetch views.' });
  }
};

export const createView = async (req, res) => {
  try {
    const { propertyId, propertyName, userId, sessionId, viewedAt } = req.body || {};
    if (!propertyId) return res.status(400).json({ success: false, message: 'propertyId required.' });
    const created = await View.create({ propertyId, propertyName, userId: userId || (req.user && req.user.id) || '', sessionId: sessionId || '', viewedAt: viewedAt || new Date() });
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('createView failed', error);
    return res.status(500).json({ success: false, message: 'Unable to record view.' });
  }
};

export const listComparisons = async (req, res) => {
  try {
    const items = await Comparison.find({}).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('listComparisons failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list comparisons.' });
  }
};

export const createComparison = async (req, res) => {
  try {
    const { name, propertyIds } = req.body || {};
    const userId = req.user?.id || '';
    const created = await Comparison.create({ name: name || `Comparison ${new Date().toISOString()}`, propertyIds: Array.isArray(propertyIds) ? propertyIds : [], userId });
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('createComparison failed', error);
    return res.status(500).json({ success: false, message: 'Unable to create comparison.' });
  }
};

export const deleteComparison = async (req, res) => {
  try {
    const { id } = req.params || {};
    if (!id) return res.status(400).json({ success: false, message: 'Id required.' });
    await Comparison.findByIdAndDelete(id);
    return res.json({ success: true, data: null });
  } catch (error) {
    console.error('deleteComparison failed', error);
    return res.status(500).json({ success: false, message: 'Unable to delete comparison.' });
  }
};

export const listPriceHistory = async (req, res) => {
  try {
    const items = await PriceHistory.find({}).sort({ changedAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('listPriceHistory failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list price history.' });
  }
};

export const createPriceHistory = async (req, res) => {
  try {
    const { propertyId, previousPrice, newPrice, changedAt } = req.body || {};
    if (!propertyId) return res.status(400).json({ success: false, message: 'propertyId required.' });
    const created = await PriceHistory.create({ propertyId, previousPrice: Number(previousPrice || 0), newPrice: Number(newPrice || 0), changedAt: changedAt || new Date() });
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('createPriceHistory failed', error);
    return res.status(500).json({ success: false, message: 'Unable to record price change.' });
  }
};

export const submitSummary = async (req, res) => {
  try {
    const payload = req.body || {};
    console.info('Received analytics summary payload', { size: Object.keys(payload).length });
    // TODO: persist summary to a collection if desired. For now, log and return success.
    return res.json({ success: true, message: 'Summary received' });
  } catch (error) {
    console.error('submitSummary failed', error);
    return res.status(500).json({ success: false, message: 'Unable to submit summary.' });
  }
};
