import PropertyVerification from '../models/PropertyVerification.js';

export const listVerifications = async (req, res) => {
  try {
    const items = await PropertyVerification.find({}).lean();
    // return as map keyed by propertyId for convenience
    const map = (items || []).reduce((acc, it) => {
      acc[it.propertyId] = it;
      return acc;
    }, {});
    return res.json({ success: true, data: map });
  } catch (error) {
    console.error('List property verifications failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list property verifications.' });
  }
};

export const saveVerifications = async (req, res) => {
  try {
    const user = req.user || {};
    const { data } = req.body || {};
    if (!data || typeof data !== 'object') return res.status(400).json({ success: false, message: 'Invalid payload' });

    const keys = Object.keys(data || {});
    const results = [];
    for (const key of keys) {
      const item = data[key] || {};
      const up = {
        propertyId: key,
        verified: Boolean(item.verified),
        verifiedAt: item.verified ? item.verifiedAt || new Date() : item.verifiedAt || null,
        verifiedBy: item.verifiedBy || user.id || user._id || user.email || '',
        notes: item.notes || item.note || '',
        updatedAt: new Date(),
      };
      const saved = await PropertyVerification.findOneAndUpdate({ propertyId: key }, up, { upsert: true, new: true, setDefaultsOnInsert: true });
      results.push(saved);
    }

    return res.status(201).json({ success: true, data: results });
  } catch (error) {
    console.error('Save property verifications failed', error);
    return res.status(500).json({ success: false, message: 'Unable to save property verifications.' });
  }
};

export const setVerified = async (req, res) => {
  try {
    const user = req.user || {};
    const { propertyId } = req.params || {};
    const { verified } = req.body || {};
    if (!propertyId) return res.status(400).json({ success: false, message: 'propertyId required' });

    const update = {
      verified: Boolean(verified),
      verifiedAt: verified ? new Date() : null,
      verifiedBy: user.id || user._id || user.email || '',
      updatedAt: new Date(),
    };

    const saved = await PropertyVerification.findOneAndUpdate({ propertyId }, update, { upsert: true, new: true, setDefaultsOnInsert: true });
    return res.json({ success: true, data: saved });
  } catch (error) {
    console.error('Set verified failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update verification status.' });
  }
};

export const getVerification = async (req, res) => {
  try {
    const { propertyId } = req.params || {};
    if (!propertyId) return res.status(400).json({ success: false, message: 'propertyId required' });
    const item = await PropertyVerification.findOne({ propertyId }).lean();
    return res.json({ success: true, data: item || { propertyId, verified: false } });
  } catch (error) {
    console.error('Get verification failed', error);
    return res.status(500).json({ success: false, message: 'Unable to fetch verification.' });
  }
};
