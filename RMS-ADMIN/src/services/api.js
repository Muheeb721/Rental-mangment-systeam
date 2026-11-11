import { getAdminAuthToken, clearAdminAuthToken } from './adminAuth';

export const apiConfig = {
  appName: import.meta.env.VITE_APP_NAME || 'RMS Admin',
  baseUrl: (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, ''),
  token: import.meta.env.VITE_API_TOKEN || '',
  socketUrl: import.meta.env.VITE_SOCKET_URL || '',
  endpoints: {
    properties: '/properties',
    users: '/users',
    bookings: '/bookings',
    payments: '/payments',
    dues: '/dues',
    messages: '/messages',
    analytics: '/analytics',
  },
};

export const apiService = {
  getConfig: () => ({ ...apiConfig }),
  request: async (endpoint, options = {}) => {
    const isAbsoluteUrl = /^https?:\/\//i.test(endpoint);
    const url = isAbsoluteUrl ? endpoint : `${apiConfig.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const token = getAdminAuthToken();
    const requestHeaders = new Headers(options.headers || {});

    requestHeaders.set('Accept', 'application/json');
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
    }

    if (!(options.body instanceof FormData) && !requestHeaders.has('Content-Type')) {
      requestHeaders.set('Content-Type', 'application/json');
    }

    const config = {
      ...options,
      headers: requestHeaders,
    };

    if (config.body && typeof config.body !== 'string' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(url, config);
    // if unauthorized, clear stored token so UI can re-authenticate
    if (response.status === 401) {
      try {
        clearAdminAuthToken();
      } catch {
        // ignore
      }
      throw new Error('Unauthorized');
    }

    const json = await response.json().catch(() => ({ success: false, message: 'Invalid backend response.' }));

    if (!response.ok) {
      throw new Error(json?.message || `Request failed: ${response.status}`);
    }

    return json;
  },
  download: async (endpoint, filename) => {
    const url = `${apiConfig.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const token = getAdminAuthToken();
    const headers = new Headers();
    headers.set('Accept', 'application/pdf');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Unable to download file: ${response.status}`);
    const objectUrl = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  },
};

// Convenience helpers for common admin operations
apiService.getProperties = async (query = '') => apiService.request(`${apiConfig.endpoints.properties}${query ? `?${query}` : ''}`, { method: 'GET' });
apiService.getProperty = async (id) => apiService.request(`${apiConfig.endpoints.properties}/${id}`, { method: 'GET' });
apiService.createProperty = async (data) => apiService.request(`${apiConfig.endpoints.properties}`, { method: 'POST', body: data });
apiService.updateProperty = async (id, data) => apiService.request(`${apiConfig.endpoints.properties}/${id}`, { method: 'PUT', body: data });
apiService.deleteProperty = async (id) => apiService.request(`${apiConfig.endpoints.properties}/${id}`, { method: 'DELETE' });

// Image management helpers (expects FormData for uploads)
apiService.uploadPropertyImage = async (id, formData) => apiService.request(`${apiConfig.endpoints.properties}/${id}/images`, { method: 'POST', body: formData });
apiService.replacePropertyImage = async (id, imageIndex, formData) => apiService.request(`${apiConfig.endpoints.properties}/${id}/images/${imageIndex}`, { method: 'POST', body: formData });
apiService.deletePropertyImage = async (id, imageIndex) => apiService.request(`${apiConfig.endpoints.properties}/${id}/images/${imageIndex}`, { method: 'DELETE' });

apiService.getAdminDashboard = async () => apiService.request('/admin/dashboard', { method: 'GET' });

export default apiService;
