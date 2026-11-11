import { apiService } from './api';

export const createAdminProperty = async (property, images = []) => {
  if (images.length) {
    const body = new FormData();
    Object.entries(property).forEach(([key, value]) => {
      if (value === undefined || value === null || ['images', 'image', 'featuredImage'].includes(key)) return;
      if (typeof value !== 'object') body.append(key, String(value));
    });
    images.forEach((image) => body.append('images', image, image.name));
    const response = await apiService.request('/admin/properties', {
      method: 'POST',
      body,
    });
    if (!response?.success) throw new Error(response?.message || 'Property creation failed.');
    return response.data || null;
  }

  const response = await apiService.request('/admin/properties', {
    method: 'POST',
    body: property,
  });
  if (!response?.success) throw new Error(response?.message || 'Property creation failed.');
  return response?.data || null;
};

export const updateAdminProperty = async (id, property) => {
  if (!id) throw new Error('Property ID is required.');
  if (!property || typeof property !== 'object') {
    throw new Error('Property update data is required.');
  }

  const response = await apiService.request(`/admin/properties/${id}`, {
    method: 'PUT',
    body: property,
  });

  if (!response?.success) {
    throw new Error(response?.message || 'Property update failed.');
  }

  return response.data || null;
};

export const deleteAdminProperty = async (id) => {
  if (!id) throw new Error('Property ID is required.');
  const response = await apiService.request(`/admin/properties/${id}`, {
    method: 'DELETE',
  });
  if (!response?.success) {
    throw new Error(response?.message || 'Property deletion failed.');
  }
  return response.data || null;
};

export const uploadPropertyImage = async (id, file) => {
  if (!file) throw new Error('File is required for upload');
  if (!id) throw new Error('Property ID is required for upload');
  
  const fd = new FormData();
  fd.append('image', file, file.name);

  const response = await apiService.request(`/properties/${id}/images`, {
    method: 'POST',
    body: fd,
  });

  console.log('Property image upload response:', response);
  if (!response?.success) {
    throw new Error(response?.message || 'Image upload failed');
  }
  
  return response?.data || null;
};

export const replacePropertyImage = async (id, index, file) => {
  if (!file) throw new Error('File is required for replacement');
  if (!id) throw new Error('Property ID is required for replacement');
  if (index === undefined || index === null) throw new Error('Image index is required for replacement');
  
  const fd = new FormData();
  fd.append('image', file, file.name);

  const response = await apiService.request(`/properties/${id}/images/${index}`, {
    method: 'POST',
    body: fd,
  });

  console.log('Property image replace response:', response);
  if (!response?.success) {
    throw new Error(response?.message || 'Image replacement failed');
  }
  
  return response?.data || null;
};

export const replaceMainPropertyImage = async (id, file) => {
  if (!file) throw new Error('File is required for replacement');
  if (!id) throw new Error('Property ID is required for replacement');

  const formData = new FormData();
  formData.append('image', file, file.name);

  const response = await apiService.request(`/properties/${id}/image`, {
    method: 'PUT',
    body: formData,
  });

  if (!response?.success) {
    throw new Error(response?.message || 'Image replacement failed');
  }

  return response?.data || null;
};

export const replacePropertyImageById = async (id, imageId, file) => {
  if (!file) throw new Error('File is required for replacement');
  if (!id) throw new Error('Property ID is required for replacement');
  if (!imageId) throw new Error('Image id is required for replacement');
  const fd = new FormData();
  fd.append('image', file, file.name);
  const response = await apiService.request(`/properties/${id}/images/id/${imageId}`, {
    method: 'POST',
    body: fd,
  });
  if (!response?.success) throw new Error(response?.message || 'Image replacement failed');
  return response?.data || null;
};

export const replaceProfileImageById = async (profileId, imageId, file) => {
  if (!file) throw new Error('File is required for replacement');
  if (!profileId) throw new Error('Profile ID is required for replacement');
  if (!imageId) throw new Error('Image id is required for replacement');
  const fd = new FormData();
  fd.append('image', file, file.name);
  const response = await apiService.request(`/admin/profile/images/id/${imageId}`, {
    method: 'POST',
    body: fd,
  });
  if (!response?.success) throw new Error(response?.message || 'Profile image replacement failed');
  return response?.data || null;
};

export const deletePropertyImage = async (id, index) => {
  if (!id) throw new Error('Property ID is required for deletion');
  if (
    index === undefined ||
    index === null ||
    !Number.isInteger(Number(index)) ||
    Number(index) < 0
  ) {
    throw new Error('A valid non-negative image index is required for deletion');
  }
  
  const response = await apiService.request(`/properties/${id}/images/${index}`, {
    method: 'DELETE',
  });

  console.log('Property image delete response:', response);
  if (!response?.success) {
    throw new Error(response?.message || 'Image deletion failed');
  }
  
  return response?.data || null;
};

export const deletePropertyImageById = async (id, imageId) => {
  if (!id) throw new Error('Property ID is required for deletion');
  if (!imageId) throw new Error('Image id is required for deletion');
  const response = await apiService.request(`/properties/${id}/images/id/${imageId}`, {
    method: 'DELETE',
  });
  if (!response?.success) throw new Error(response?.message || 'Image deletion failed');
  return response?.data || null;
};

export default {
  createAdminProperty,
  updateAdminProperty,
  deleteAdminProperty,
  uploadPropertyImage,
  replacePropertyImage,
  replaceMainPropertyImage,
  replacePropertyImageById,
  deletePropertyImage,
  deletePropertyImageById,
};
