const getBackendOrigin = () => {
  const configuredUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';

  if (/^https?:\/\//i.test(configuredUrl)) {
    return configuredUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
  }

  // The user app normally runs on a separate Vite port during development.
  // In production a relative `/api` uses the same origin, so relative image
  // URLs should remain relative there.
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return '';
  }

  return 'http://localhost:5000';
};

export const resolveImageUrl = (value) => {
  if (!value || typeof value !== 'string') return '';
  if (/^(data:|blob:|https?:\/\/)/i.test(value)) return value;
  if (!value.startsWith('/')) return value;

  const backendOrigin = getBackendOrigin();
  return backendOrigin ? `${backendOrigin}${value}` : value;
};

export default resolveImageUrl;
