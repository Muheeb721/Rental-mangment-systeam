import api from './api';

const normalizeError = (err) => {
  const resp = err?.response;
  const message = resp?.data?.message || err?.message || 'Request failed';
  return { success: false, message, status: resp?.status || null };
};

export const login = async (email, password) => {
  try {
    const res = await api.request('/auth/login', { method: 'POST', data: { email, password } });
    return res;
  } catch (err) {
    return normalizeError(err);
  }
};

export const signup = async (payload) => {
  try {
    const res = await api.request('/auth/signup', { method: 'POST', data: payload });
    return res;
  } catch (err) {
    return normalizeError(err);
  }
};

export const me = async () => {
  try {
    const res = await api.request('/auth/me', { method: 'GET' });
    return res;
  } catch (err) {
    return normalizeError(err);
  }
};

export default { login, signup, me };
