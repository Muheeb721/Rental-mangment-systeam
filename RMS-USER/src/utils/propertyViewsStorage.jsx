import api from '../services/api';

const toMap = (arr = []) => {
  const m = {};
  (arr || []).forEach((r) => {
    const id = String(r.propertyId || r.property || r._id || r.id || '');
    if (!id) return;
    m[id] = (m[id] || 0) + (Number(r.count || 1) || 1);
  });
  return m;
};

export const read = async () => {
  try {
    const res = await api.request('/analytics/views');
    if (res && res.success && Array.isArray(res.data)) return toMap(res.data);
    if (res && res.success && res.data && typeof res.data === 'object') return res.data;
    return {};
  } catch (e) {
    console.error('read property views failed', e);
    return {};
  }
};

export const increment = async (propertyId) => {
  try {
    if (!propertyId) return {};
    const res = await api.request('/analytics/views', { method: 'POST', body: { propertyId } });
    if (res && res.success) {
      // return full map after increment
      const map = await read();
      return map;
    }
    return {};
  } catch (e) {
    console.error('increment view failed', e);
    return {};
  }
};

export const getCount = async (propertyId) => {
  try {
    const map = await read();
    return map[String(propertyId)] || 0;
  } catch (e) {
    console.error('getCount failed', e);
    return 0;
  }
};

export default { read, increment, getCount };
