import api from './api';

export const readStoredFavorites = async () => {
  try {
    const response = await api.request('/favorites');
    if (response && response.success) {
      return Array.isArray(response.data) ? response.data.map((item) => (item.propertyId ? `property:${item.propertyId}` : '')) : [];
    }
    return [];
  } catch (error) {
    console.error('Unable to read favorites from backend:', error);
    return [];
  }
};

export const saveStoredFavorites = async (favorites = []) => {
  try {
    const nextFavorites = Array.isArray(favorites) ? favorites : [];
    const propertyIds = nextFavorites
      .map((item) => String(item).replace(/^property:/, ''))
      .filter(Boolean);

    const existing = await readStoredFavorites();
    const existingIds = existing.map((item) => item.replace(/^property:/, ''));

    for (const propertyId of propertyIds) {
      if (!existingIds.includes(propertyId)) {
        await api.request('/favorites', { method: 'POST', body: { propertyId } });
      }
    }

    for (const item of existing) {
      const propertyId = String(item).replace(/^property:/, '');
      if (propertyId && !propertyIds.includes(propertyId)) {
        await api.request(`/favorites/${encodeURIComponent(propertyId)}`, { method: 'DELETE' });
      }
    }
  } catch (error) {
    console.error('Unable to sync favorites to backend:', error);
  }
};
