import apiClient from './apiClient';

const normalizeOptionsData = (options = {}) => options.data ?? options.body ?? undefined;

export const request = async (path, options = {}) => {
  const response = await apiClient({
    url: path,
    method: options.method || 'GET',
    data: normalizeOptionsData(options),
    params: options.params,
    headers: options.headers,
  });
  return response.data;
};

// Also attach a convenience `request` wrapper on the default export so existing
// callers that use `api.request(...)` (axios instance) receive the normalized
// response data instead of the raw axios response object.
apiClient.request = async (path, options = {}) => request(path, options);

export default apiClient;
