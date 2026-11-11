import apiClient from '../services/apiClient';

const normalize = (item = {}, fallbackId = Date.now()) => ({
  id: item.id || item._id || `${fallbackId}-${Math.random().toString(16).slice(2)}`,
  name: item.name || item.fullName || '',
  phone: item.phone || item.contact || '',
  email: item.email || '',
  propertyId: item.propertyId || item.property?.id || null,
  propertyTitle: item.propertyTitle || (item.property && item.property.title) || '',
  preferredContactMethod: item.preferredContactMethod || 'Email',
  message: item.message || '',
  status: item.status || 'New',
  createdAt: item.createdAt || new Date().toISOString(),
  updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
});

const read = async () => {
  try {
    const res = await apiClient.get('/property-inquiries');
    const items = res?.data?.success ? res.data.data || [] : [];
    return Array.isArray(items) ? items.map((p) => normalize(p)) : [];
  } catch (e) {
    console.error('read property inquiries failed', e);
    return [];
  }
};

const save = async (records = []) => {
  try {
    const res = await apiClient.post('/property-inquiries/batch', { records });
    return res?.data?.success ? res.data.data || records : records;
  } catch (e) {
    console.error('save property inquiries failed', e);
    return records;
  }
};

const add = async (inquiry = {}) => {
  try {
    const res = await apiClient.post('/property-inquiries', inquiry);
    return res?.data?.success ? normalize(res.data.data) : null;
  } catch (e) {
    console.error('add property inquiry failed', e);
    return null;
  }
};

const update = async (id, updates = {}) => {
  try {
    const res = await apiClient.put(`/property-inquiries/${id}`, updates);
    return res?.data?.success ? normalize(res.data.data) : null;
  } catch (e) {
    console.error('update property inquiry failed', e);
    return null;
  }
};

const remove = async (id) => {
  try {
    const res = await apiClient.delete(`/property-inquiries/${id}`);
    return res?.data?.success ? true : false;
  } catch (e) {
    console.error('remove property inquiry failed', e);
    return false;
  }
};

export { read, save, add, update, remove };
export default { read, save, add, update, remove };
