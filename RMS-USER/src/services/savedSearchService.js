import api from './api';

export const saveSearch = async (payload) => {
  try {
    const res = await api.request('/saved-searches', { method: 'POST', body: payload });
    return res;
  } catch (error) {
    console.warn('Save search failed', error);
    return { success: false, message: 'API unavailable' };
  }
};

export const listSavedSearches = async () => {
  try {
    const res = await api.request('/saved-searches');
    return res;
  } catch (error) {
    console.warn('List saved searches failed', error);
    return { success: false, message: 'API unavailable' };
  }
};

export const deleteSavedSearch = async (id) => {
  try {
    const res = await api.request(`/saved-searches/${id}`, { method: 'DELETE' });
    return res;
  } catch (error) {
    console.warn('Delete saved search failed', error);
    return { success: false, message: 'API unavailable' };
  }
};

export default { saveSearch, listSavedSearches, deleteSavedSearch };
