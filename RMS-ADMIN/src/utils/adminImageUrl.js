const API_ORIGIN = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000')
  .replace(/\/api\/?$/, '')
  .replace(/\/$/, '');

export const getAdminImageUrl = (value) => {
  const image = typeof value === 'string' ? value : value?.url;
  if (!image) return '';
  if (/^(https?:)?\/\//i.test(image) || /^(data|blob):/i.test(image)) return image;
  return image.startsWith('/') ? `${API_ORIGIN}${image}` : image;
};
