import apiClient from '../services/apiClient';

const read = async () => {
  try {
    const res = await apiClient.get('/property-verification');
    return res?.data?.success ? res.data.data || {} : {};
  } catch (e) {
    console.error('read property verification failed', e);
    return {};
  }
};

const save = async (map = {}) => {
  try {
    const res = await apiClient.post('/property-verification', { data: map });
    return res?.data?.success ? res.data.data || map : map;
  } catch (e) {
    console.error('save property verification failed', e);
    return map;
  }
};

const setVerified = async (propertyId, verified = true) => {
  try {
    const res = await apiClient.post(`/property-verification/${propertyId}`, { verified: Boolean(verified) });
    return res?.data?.success ? res.data.data : null;
  } catch (e) {
    console.error('setVerified failed', e);
    return null;
  }
};

const isVerified = async (propertyId) => {
  try {
    const res = await apiClient.get(`/property-verification/${propertyId}`);
    return res?.data?.success ? Boolean(res.data.data?.verified) : false;
  } catch (e) {
    console.error('isVerified failed', e);
    return false;
  }
};

export { read, save, setVerified, isVerified };
export default { read, save, setVerified, isVerified };
