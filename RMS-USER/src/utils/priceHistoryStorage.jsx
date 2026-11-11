import api from '../services/api';

const normalize = (item = {}) => ({
  id: item._id || item.id || Date.now().toString(),
  propertyId: item.propertyId || null,
  previousPrice: item.previousPrice || null,
  newPrice: item.newPrice || null,
  changedAt: item.changedAt || item.createdAt || new Date().toISOString(),
});

export const read = async () => {
  try {
    const res = await api.request('/analytics/price-history');
    if (res && res.success && Array.isArray(res.data)) return res.data.map(normalize);
    return [];
  } catch (e) {
    console.error('read price history failed', e);
    return [];
  }
};

export const add = async (entry = {}) => {
  try {
    const payload = { propertyId: entry.propertyId, previousPrice: entry.previousPrice, newPrice: entry.newPrice, changedAt: entry.changedAt };
    const res = await api.request('/analytics/price-history', { method: 'POST', body: payload });
    return res && res.success ? normalize(res.data) : null;
  } catch (e) {
    console.error('add price history failed', e);
    return null;
  }
};

export const listForProperty = async (propertyId) => {
  try {
    const all = await read();
    return all.filter((p) => String(p.propertyId) === String(propertyId));
  } catch (e) {
    console.error('listForProperty failed', e);
    return [];
  }
};

export default { read, add, listForProperty };
