import { setAuthState } from './localStorage';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
export const AUTH_TOKEN_KEY = 'rms_admin_token';

export const getAdminAuthToken = () => {
  if (typeof window === 'undefined') return '';
  const value = window.localStorage.getItem(AUTH_TOKEN_KEY) || window.localStorage.getItem('rms_token') || window.__RMS_AUTH_TOKEN || window.__rms_inmemory_token || '';
  return value || '';
};

export const setAdminAuthToken = (token) => {
  if (typeof window === 'undefined' || !token) return;
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  window.localStorage.setItem('rms_token', token);
  window.__RMS_AUTH_TOKEN = token;
  window.__rms_inmemory_token = token;
  try { setAuthState(true); } catch { /* ignore */ }
};

export const clearAdminAuthToken = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem('rms_token');
  delete window.__RMS_AUTH_TOKEN;
  delete window.__rms_inmemory_token;
  try { setAuthState(false); } catch { /* ignore */ }
};

export const login = async (email, password) => {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const json = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        message: json?.message || 'Login failed',
      };
    }

    // support backend returning either { success:true, data: { token, user } }
    // or { success:true, token, user }
    const token = json?.data?.token || json?.token || null;
    const user = (json?.data && json.data.user) || json?.user || null;
    if (token) {
      setAdminAuthToken(token);
    }

    return {
      success: Boolean(json?.success),
      message: json?.message || 'Login successful',
      data: { token, user },
    };
  } catch (error) {
    console.warn('Admin login error', error);
    return { success: false, message: 'Login error' };
  }
};

export const logout = () => {
  clearAdminAuthToken();
};

export default { login, logout, getAdminAuthToken, setAdminAuthToken, clearAdminAuthToken };
