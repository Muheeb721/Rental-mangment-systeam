import apiClient from '../services/apiClient';

const PREF_KEY = 'rms_selected_property';

const getLocalSelectedProperty = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

const setLocalSelectedProperty = (obj) => {
  if (typeof window === 'undefined') return false;
  try {
    if (obj && typeof obj === 'object') {
      window.localStorage.setItem(PREF_KEY, JSON.stringify(obj));
    } else {
      window.localStorage.removeItem(PREF_KEY);
    }
    return true;
  } catch (e) {
    console.warn('Unable to persist selected property locally', e);
    return false;
  }
};

const hasAuthenticatedSession = () => {
  if (typeof window === 'undefined') return false;
  const token = window.__RMS_AUTH_TOKEN || window.__rms_inmemory_token || window.localStorage.getItem('rms_token') || '';
  const session = window.localStorage.getItem('rms_auth_session');
  return Boolean(token || session);
};

export async function saveSelectedProperty(obj) {
  if (!setLocalSelectedProperty(obj)) return null;

  if (!hasAuthenticatedSession()) {
    return obj || null;
  }

  try {
    const res = await apiClient.put('/users/profile', { profile: { selectedProperty: obj } });
    return res?.data?.success ? res.data.data?.profile || null : obj || null;
  } catch (e) {
    if (e?.response?.status === 401) {
      return obj || null;
    }
    console.error('saveSelectedProperty failed', e);
    return obj || null;
  }
}

export async function readSelectedProperty() {
  const localValue = getLocalSelectedProperty();

  if (!hasAuthenticatedSession()) {
    return localValue;
  }

  try {
    const res = await apiClient.get('/users/profile');
    const profileValue = res?.data?.success ? res.data.data?.profile?.selectedProperty || null : null;
    if (profileValue) {
      setLocalSelectedProperty(profileValue);
      return profileValue;
    }
    return localValue;
  } catch (e) {
    if (e?.response?.status === 401) {
      return localValue;
    }
    console.error('readSelectedProperty failed', e);
    return localValue;
  }
}

export async function clearSelectedProperty() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(PREF_KEY);
  }

  if (!hasAuthenticatedSession()) {
    return true;
  }

  try {
    const res = await apiClient.put('/users/profile', { profile: {} });
    return res?.data?.success ? true : false;
  } catch (e) {
    if (e?.response?.status === 401) {
      return true;
    }
    console.error('clearSelectedProperty failed', e);
    return false;
  }
}

export default { saveSelectedProperty, readSelectedProperty, clearSelectedProperty };
