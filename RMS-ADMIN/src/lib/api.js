/**
 * Thin fetch wrapper for the RMS backend.
 * - JSON bodies are serialised automatically; FormData is sent as multipart.
 * - Throws ApiError (with .status and field .errors) for non-2xx responses.
 * - A 401 clears the session and emits `rms-admin:unauthorized` so the app returns to login.
 */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
// Base URL for files served by the backend (/uploads, /images). Empty = same origin (Vite proxy).
export const ASSET_BASE = (import.meta.env.VITE_ASSET_BASE_URL || (API_BASE.startsWith('http') ? API_BASE.replace(/\/api$/, '') : '')).replace(/\/$/, '');
export const USER_SITE_URL = (import.meta.env.VITE_USER_SITE_URL || 'http://localhost:5175').replace(/\/$/, '');
const TOKEN_KEY = 'rms_admin_token';

export class ApiError extends Error {
  constructor(message, status = 0, errors = null) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export const getToken = () => {
  try { return window.localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
};
export const setToken = (token) => {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable */ }
};

const buildQuery = (query) => {
  if (!query) return '';
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') params.set(key, value);
  });
  const text = params.toString();
  return text ? `?${text}` : '';
};

export async function request(path, { method = 'GET', body, query, signal } = {}) {
  const headers = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}${buildQuery(query)}`, { method, headers, body: payload, signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError('Cannot reach the server. Check that the RMS backend is running.', 0);
  }

  const json = await response.json().catch(() => null);
  if (response.status === 401 && token) {
    setToken('');
    window.dispatchEvent(new CustomEvent('rms-admin:unauthorized'));
  }
  if (!response.ok || json?.success === false) {
    throw new ApiError(json?.message || `Request failed (${response.status})`, response.status, json?.errors || null);
  }
  return json ?? { success: true };
}

export const api = {
  get: (path, query, options) => request(path, { ...options, query }),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
};

/** Downloads a protected file (e.g. rental agreement PDF) using the admin token. */
export async function downloadFile(path, filename) {
  const response = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new ApiError(json?.message || 'Unable to download file.', response.status);
  }
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Resolves an image URL stored by the backend (/uploads/..., /images/..., http..., data:...). */
export const assetUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${ASSET_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
};
