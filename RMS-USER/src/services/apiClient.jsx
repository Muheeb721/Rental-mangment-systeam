import axios from 'axios';
import { toast } from 'react-toastify';

export const getStoredAuthToken = () => {
  if (typeof window === 'undefined') return '';

  const candidates = [
    window.__RMS_AUTH_TOKEN,
    window.__rms_inmemory_token,
    window.localStorage.getItem('rms_token'),
    window.localStorage.getItem('rms_admin_token'),
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const apiClient = axios.create({baseURL:
   import.meta.env.VITE_API_URL || '/api', 
  timeout: 30000,
  withCredentials: true, // send cookies (use secure, HttpOnly cookies on backend when possible)
});

// Request interceptor: attach auth header from any compatible token/session key that has been used across the app
apiClient.interceptors.request.use(
  (config) => {
    const token = getStoredAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    }

    // Development helper: attach local session from localStorage so backend can authenticate in dev/e2e
    try {
      const rawSession = window.localStorage.getItem('rms_auth_session');
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        const sessionPayload = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
        if (sessionPayload) {
          config.headers['x-rms-session'] = sessionPayload;
        }
      }
    } catch (e) {
      // ignore
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: centralize error handling.
// GET failures are surfaced by each page's own error/empty state, so only
// mutations raise a (de-duplicated) toast here.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const method = String(error?.config?.method || 'get').toLowerCase();
    const quiet = method === 'get' || error?.config?.skipErrorToast;
    if (error.response) {
      const { status } = error.response;
      if (status === 401) {
        window.dispatchEvent(new CustomEvent('rms:auth:unauthorized'));
      } else if (status >= 500 && !quiet) {
        try { toast.error('Something went wrong on our side. Please try again.', { toastId: 'api-5xx' }); } catch { /* noop */ }
      }
    } else if (!quiet) {
      try { toast.warn('Network error — please check your connection.', { toastId: 'api-network' }); } catch { /* noop */ }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
