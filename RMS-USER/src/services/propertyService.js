import api from './api';

const normalizeFailure = (error, defaultMessage = 'API unavailable') => {
  const status = error?.response?.status;
  const backendOffline = [502, 503, 504].includes(status) || (error?.code === 'ERR_NETWORK');

  return {
    success: false,
    message: backendOffline
      ? 'Backend unavailable. Please start the RMS backend or check the server connection.'
      : defaultMessage,
    status,
    data: [],
  };
};

export const listProperties = async (params = {}) => {
  // request a larger default limit so demo pages receive all seeded demo properties
  const q = params.q ? `&q=${encodeURIComponent(params.q)}` : '';
  const limit = params.limit || 1000;
  // Add cache-bust parameter to ensure fresh data from backend (admin changes are reflected immediately)
  const cacheBust = params.cacheBust !== false ? `&t=${Date.now()}` : '';
  const url = `/properties?limit=${limit}${q}${cacheBust}`;
  try {
    const res = await api.request(url);
    return res;
  } catch (error) {
    console.warn('Properties API unavailable. Backend may be offline or the proxy target is not reachable.', error);
    return normalizeFailure(error, 'Properties API unavailable');
  }
};

export const getPropertyById = async (id) => {
  if (!id) return { success: false, message: 'Missing id' };
  try {
    const res = await api.request(`/properties/${id}`);
    return res;
  } catch (error) {
    console.warn('Get property failed', error);
    return normalizeFailure(error, 'Property lookup unavailable');
  }
};

export const recommendProperties = async (preferences = {}) => {
  try {
    const res = await api.request('/properties/recommend', { method: 'POST', body: preferences });
    return res;
  } catch (error) {
    console.warn('Recommend properties failed', error);
    return normalizeFailure(error, 'Recommendations unavailable');
  }
};

export const createProperty = async (payload = {}) => {
  try {
    const res = await api.request('/properties', { method: 'POST', body: payload });
    return res;
  } catch (error) {
    console.warn('Create property failed', error);
    return normalizeFailure(error, 'Property creation unavailable');
  }
};

export const updateProperty = async (id, updates = {}) => {
  if (!id) return { success: false, message: 'Missing id' };
  try {
    const res = await api.request(`/properties/${id}`, { method: 'PUT', body: updates });
    return res;
  } catch (error) {
    console.warn('Update property failed', error);
    return normalizeFailure(error, 'Property update unavailable');
  }
};

export const deleteProperty = async (id) => {
  if (!id) return { success: false, message: 'Missing id' };
  try {
    const res = await api.request(`/properties/${id}`, { method: 'DELETE' });
    return res;
  } catch (error) {
    console.warn('Delete property failed', error);
    return normalizeFailure(error, 'Property deletion unavailable');
  }
};

export default { listProperties, getPropertyById, recommendProperties, createProperty, updateProperty, deleteProperty };
