import api from '../services/api';

const CACHE_KEY = '__rms_dashboard_submissions_cache';

const sortByNewestFirst = (items = []) =>
  [...items].sort((a, b) => new Date(b.submittedAt || b.createdAt || 0).getTime() - new Date(a.submittedAt || a.createdAt || 0).getTime());

const notifyDashboardUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('rms-dashboard-update'));
  }
};

const normalizeSubmission = (item = {}, fallbackId = Date.now()) => {
  const submittedAt = item.submittedAt || item.createdAt || item.createdAt || new Date().toISOString();

  return {
    id: item._id || item.id || `${fallbackId}-${Math.random().toString(16).slice(2)}`,
    source: item.source || item.inquiryType || 'general',
    formType: item.formType || item.source || 'General Form',
    title: item.title || item.subject || 'New submission',
    category: item.category || 'General',
    status: item.status || item.state || 'New',
    userName: item.userName || item.fullName || item.name || 'RMS User',
    email: item.email || item.contactEmail || '',
    phone: item.phone || item.contact || '',
    propertyType: item.propertyType || item.type || '',
    location: item.location || item.address || item.area || '',
    price: item.price || item.budget || item.monthlyFee || item.rentPrice || item.salePrice || '',
    description: item.description || item.message || '',
    submittedAt,
    createdAt: item.createdAt || submittedAt,
    meta: item.meta || {},
  };
};

const ensureCache = () => {
  if (typeof window === 'undefined') return [];
  if (!window[CACHE_KEY]) {
    window[CACHE_KEY] = [];
    // background load from backend
    (async () => {
      try {
        const res = await api.request('/contact?type=Dashboard');
        if (res && res.success && Array.isArray(res.data)) {
          window[CACHE_KEY] = sortByNewestFirst(res.data.map(normalizeSubmission));
          notifyDashboardUpdate();
        }
      } catch (e) {
        console.warn('Failed to load dashboard submissions from backend', e);
      }
    })();
  }
  return window[CACHE_KEY];
};

export const readDashboardSubmissions = () => {
  if (typeof window === 'undefined') return [];
  return ensureCache();
};

export const saveDashboardSubmissions = async (records = []) => {
  if (typeof window === 'undefined') return [];
  // not persisting batch saves to localStorage — send individually to backend
  const normalized = sortByNewestFirst(records.map((r) => normalizeSubmission(r)));
  const results = [];
  for (const item of normalized) {
    try {
      const res = await api.request('/contact', { method: 'POST', body: { ...item, inquiryType: 'Dashboard' } });
      if (res && res.success) results.push(normalizeSubmission(res.data));
    } catch (e) {
      console.warn('Failed to save dashboard submission', e);
    }
  }
  window[CACHE_KEY] = sortByNewestFirst(results);
  notifyDashboardUpdate();
  return window[CACHE_KEY];
};

export const addDashboardSubmission = (submission = {}) => {
  if (typeof window === 'undefined') return null;
  const temp = normalizeSubmission(submission, Date.now());
  // optimistic add
  const cache = ensureCache();
  cache.unshift(temp);
  window[CACHE_KEY] = sortByNewestFirst(cache);
  notifyDashboardUpdate();

  // persist in background
  (async () => {
    try {
      const res = await api.request('/contact', { method: 'POST', body: { fullName: temp.userName, email: temp.email, phone: temp.phone, message: temp.description, propertyName: temp.propertyType, inquiryType: 'Dashboard', meta: temp.meta } });
      if (res && res.success) {
        // replace temp id with real id
        window[CACHE_KEY] = window[CACHE_KEY].map((c) => (c.id === temp.id ? normalizeSubmission(res.data) : c));
        notifyDashboardUpdate();
      }
    } catch (e) {
      console.warn('Failed to persist dashboard submission', e);
    }
  })();

  return temp;
};

export const recordDashboardSubmission = (submission = {}) => addDashboardSubmission(submission);

export const removeDashboardSubmission = async (id) => {
  if (typeof window === 'undefined') return false;
  const cache = ensureCache().filter((item) => String(item.id) !== String(id));
  window[CACHE_KEY] = sortByNewestFirst(cache);
  notifyDashboardUpdate();
  try {
    await api.request(`/contact/${id}`, { method: 'DELETE' });
    return true;
  } catch (e) {
    console.warn('Failed to delete dashboard submission on backend', e);
    return false;
  }
};

export const clearDashboardSubmissions = () => {
  if (typeof window === 'undefined') return [];
  window[CACHE_KEY] = [];
  notifyDashboardUpdate();
  return [];
};

export const updateDashboardSubmission = async (id, updates = {}) => {
  if (typeof window === 'undefined') return null;
  try {
    const res = await api.request(`/contact/${id}`, { method: 'PUT', body: updates });
    if (res && res.success) {
      window[CACHE_KEY] = window[CACHE_KEY].map((c) => (String(c.id) === String(id) ? normalizeSubmission(res.data) : c));
      notifyDashboardUpdate();
      return normalizeSubmission(res.data);
    }
  } catch (e) {
    console.warn('Failed to update dashboard submission', e);
  }
  return null;
};
