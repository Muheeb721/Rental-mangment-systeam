import api from '../services/api';

const normalize = (item = {}) => ({
  id: item._id || item.id || Date.now().toString(),
  name: item.name || `Comparison ${new Date().toLocaleString()}`,
  propertyIds: Array.isArray(item.propertyIds) ? item.propertyIds : [],
  createdAt: item.createdAt || new Date().toISOString(),
});

export const read = async () => {
  try {
    const res = await api.request('/analytics/comparisons');
    if (res && res.success && Array.isArray(res.data)) return res.data.map(normalize);
    return [];
  } catch (e) {
    console.error('read comparisons failed', e);
    return [];
  }
};

export const add = async (comparison = {}) => {
  try {
    const payload = { name: comparison.name, propertyIds: comparison.propertyIds || [] };
    const res = await api.request('/analytics/comparisons', { method: 'POST', body: payload });
    return res && res.success ? normalize(res.data) : null;
  } catch (e) {
    console.error('add comparison failed', e);
    return null;
  }
};

export const remove = async (id) => {
  try {
    const res = await api.request(`/analytics/comparisons/${id}`, { method: 'DELETE' });
    return res && res.success;
  } catch (e) {
    console.error('remove comparison failed', e);
    return false;
  }
};

export default { read, add, remove };
