import api from '../services/api';

const normalize = (item = {}) => ({
  id: item._id || item.id || Date.now().toString(),
  name: item.fullName || item.name || '',
  phone: item.phone || '',
  email: item.email || '',
  propertyId: item.propertyId || null,
  propertyTitle: item.propertyName || item.propertyTitle || '',
  date: item.date || null,
  time: item.time || null,
  message: item.message || '',
  status: item.status || 'Pending',
  createdAt: item.createdAt || new Date().toISOString(),
  updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
});

export const read = async () => {
  try {
    const res = await api.request('/contact?type=Visit');
    if (res && res.success && Array.isArray(res.data)) return res.data.map(normalize);
    return [];
  } catch (e) {
    console.error('read property visits failed', e);
    return [];
  }
};

export const add = async (visit = {}) => {
  try {
    const payload = {
      fullName: visit.name || visit.fullName,
      email: visit.email,
      phone: visit.phone,
      message: visit.message || '',
      propertyId: visit.propertyId,
      propertyName: visit.propertyTitle || visit.propertyName,
      inquiryType: 'Visit',
      date: visit.date || null,
      time: visit.time || null,
    };
    const res = await api.request('/contact', { method: 'POST', body: payload });
    return res && res.success ? normalize(res.data) : null;
  } catch (e) {
    console.error('add visit failed', e);
    return null;
  }
};

export const update = async (id, updates = {}) => {
  try {
    const res = await api.request(`/contact/${id}`, { method: 'PUT', body: updates });
    return res && res.success ? normalize(res.data) : null;
  } catch (e) {
    console.error('update visit failed', e);
    return null;
  }
};

export const remove = async (id) => {
  try {
    const res = await api.request(`/contact/${id}`, { method: 'DELETE' });
    return res && res.success;
  } catch (e) {
    console.error('remove visit failed', e);
    return false;
  }
};

export default { read, add, update, remove };
