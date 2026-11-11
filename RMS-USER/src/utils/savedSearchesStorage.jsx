import * as savedSearchService from '../services/savedSearchService';

const STORAGE_KEY = 'rms_saved_searches';

const normalize = (item = {}, fallbackId = Date.now()) => ({
  id: item.id || item._id || `${fallbackId}-${Math.random().toString(16).slice(2)}`,
  name: item.name || `Saved search ${new Date().toLocaleString()}`,
  filters: item.filters || item.query || {},
  createdAt: item.createdAt || new Date().toISOString(),
  raw: item,
});

// API-backed async methods
export const fetchSavedSearches = async () => {
  try {
    const res = await savedSearchService.listSavedSearches();
    if (res && res.success && Array.isArray(res.data)) return res.data.map((d) => normalize(d));
    return [];
  } catch (e) {
    console.error('fetchSavedSearches failed', e);
    return [];
  }
};

export const saveSearch = async (payload) => {
  try {
    const res = await savedSearchService.saveSearch(payload);
    return res;
  } catch (e) {
    console.error('saveSearch failed', e);
    return { success: false };
  }
};

export const deleteSavedSearchById = async (id) => {
  try {
    const res = await savedSearchService.deleteSavedSearch(id);
    return res;
  } catch (e) {
    console.error('deleteSavedSearchById failed', e);
    return { success: false };
  }
};

export const read = async () => {
  try {
    return await fetchSavedSearches();
  } catch (e) {
    console.error('saved search read failed', e);
    return [];
  }
};

export const add = async (payload) => {
  try {
    return await saveSearch(payload);
  } catch (e) {
    console.error('saved search add failed', e);
    return { success: false };
  }
};

export const remove = async (id) => {
  try {
    return await deleteSavedSearchById(id);
  } catch (e) {
    console.error('saved search remove failed', e);
    return { success: false };
  }
};

// Deprecated localStorage helpers (kept for compatibility)
// Deprecated localStorage helpers removed. Use API-backed methods instead.
export default { fetchSavedSearches, saveSearch, deleteSavedSearchById, read, add, remove };
