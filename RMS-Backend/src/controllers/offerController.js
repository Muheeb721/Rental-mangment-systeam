import Offer from '../models/Offer.js';
import Property from '../models/Property.js';

export const listOffers = async (req, res) => {
  try {
    const items = await Offer.find({}).sort({ startDate: -1 }).populate('propertiesIncluded').lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List offers failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list offers.' });
  }
};

export const createOffer = async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.title) return res.status(400).json({ success: false, message: 'Offer title is required.' });
    const props = Array.isArray(body.propertiesIncluded) ? body.propertiesIncluded : [];
    const item = await Offer.create({
      title: String(body.title).trim(),
      description: body.description || '',
      discountPercent: Number(body.discountPercent || 0),
      active: body.active !== undefined ? Boolean(body.active) : true,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      propertiesIncluded: props,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('Create offer failed', error);
    return res.status(500).json({ success: false, message: 'Unable to create offer.' });
  }
};

export const updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    if (updates.propertiesIncluded && !Array.isArray(updates.propertiesIncluded)) updates.propertiesIncluded = [updates.propertiesIncluded];
    updates.updatedAt = new Date();
    const item = await Offer.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!item) return res.status(404).json({ success: false, message: 'Offer not found.' });
    return res.json({ success: true, data: item });
  } catch (error) {
    console.error('Update offer failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update offer.' });
  }
};

export const deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Offer.findByIdAndDelete(id).lean();
    if (!item) return res.status(404).json({ success: false, message: 'Offer not found.' });
    return res.json({ success: true, data: item });
  } catch (error) {
    console.error('Delete offer failed', error);
    return res.status(500).json({ success: false, message: 'Unable to delete offer.' });
  }
};

export const toggleOfferActive = async (req, res) => {
  try {
    const { id } = req.params;
    const rec = await Offer.findById(id);
    if (!rec) return res.status(404).json({ success: false, message: 'Offer not found.' });
    rec.active = !rec.active;
    rec.updatedAt = new Date();
    await rec.save();
    return res.json({ success: true, data: rec });
  } catch (error) {
    console.error('Toggle offer failed', error);
    return res.status(500).json({ success: false, message: 'Unable to toggle offer.' });
  }
};
