import api from './api';

export const addFavorite = async (propertyId) => {
  try {
    const res = await api.request('/favorites', { method: 'POST', body: { propertyId } });
    return res;
  } catch (error) {
    console.warn('Add favorite failed', error);
    return { success: false, message: 'API unavailable' };
  }
};

export const listFavorites = async () => {
  try {
    const res = await api.request('/favorites');
    return res;
  } catch (error) {
    console.warn('List favorites failed', error);
    return { success: false, message: 'API unavailable' };
  }
};

export const removeFavorite = async (propertyId) => {
  try {
    const res = await api.request(`/favorites/${encodeURIComponent(propertyId)}`, { method: 'DELETE' });
    return res;
  } catch (error) {
    console.warn('Remove favorite failed', error);
    return { success: false, message: 'API unavailable' };
  }
};

export default { addFavorite, listFavorites, removeFavorite };
