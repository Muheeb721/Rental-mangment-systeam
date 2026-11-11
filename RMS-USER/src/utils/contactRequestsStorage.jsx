import apiClient from '../services/apiClient';

const contactRoute = (suffix = '') => `/contact${suffix}`;

const normalize = (item = {}, fallbackId = Date.now()) => ({
  id: item.id || item._id || `CONTACT-${fallbackId}-${Math.random().toString(16).slice(2)}`,
  fullName: item.fullName || item.name || item.userName || '',
  email: item.email || '',
  phone: item.phone || item.contact || '',
  propertyName: item.propertyName || item.property || '',
  propertyType: item.propertyType || '',
  purpose: item.inquiryType || item.purpose || '',
  message: item.message || item.description || '',
  paymentInfo: item.paymentInfo || null,
  status: item.status || 'New',
  createdAt: item.createdAt || new Date().toISOString(),
  updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
});

const read = async () => {
  try {
    const res = await apiClient.get(contactRoute());
    const items = res?.data?.success ? res.data.data || [] : [];
    return Array.isArray(items) ? items.map((p) => normalize(p)) : [];
  } catch (e) {
    console.error('read contact requests failed', e);
    return [];
  }
};

const save = async (records = []) => {
  try {
    if (!Array.isArray(records) || records.length === 0) {
      return [];
    }

    const payload = records.map((record) => ({
      ...record,
      fullName: record.fullName || record.userName || record.name || '',
      email: record.email || '',
      phone: record.phone || record.contact || '',
      propertyName: record.propertyName || record.property || '',
      propertyId: record.propertyId || '',
      inquiryType: record.inquiryType || record.purpose || 'General',
      message: record.message || record.description || '',
      createdAt: record.createdAt || new Date().toISOString(),
    }));

    const results = await Promise.all(payload.map((record) => apiClient.post(contactRoute(), record)));
    return results
      .map((res) => (res?.data?.success ? normalize(res.data.data) : null))
      .filter(Boolean);
  } catch (e) {
    console.error('save contact requests failed', e);
    return records;
  }
};

const add = async (req = {}) => {
  try {
    const payload = {
      ...req,
      fullName: req.fullName || req.userName || req.name || '',
      email: req.email || '',
      phone: req.phone || req.contact || '',
      propertyName: req.propertyName || req.property || '',
      propertyId: req.propertyId || '',
      inquiryType: req.inquiryType || req.purpose || 'General',
      message: req.message || req.description || '',
      createdAt: req.createdAt || new Date().toISOString(),
    };

    const res = await apiClient.post(contactRoute(), payload);
    return res?.data?.success ? normalize(res.data.data) : null;
  } catch (e) {
    console.error('add contact request failed', e);
    return null;
  }
};

const update = async (id, updates = {}) => {
  try {
    const res = await apiClient.put(contactRoute(`/${id}`), updates);
    return res?.data?.success ? normalize(res.data.data) : null;
  } catch (e) {
    console.error('update contact request failed', e);
    return null;
  }
};

const remove = async (id) => {
  try {
    const res = await apiClient.delete(contactRoute(`/${id}`));
    return res?.data?.success ? true : false;
  } catch (e) {
    console.error('remove contact request failed', e);
    return false;
  }
};

export { read, save, add, update, remove };
export default { read, save, add, update, remove };
