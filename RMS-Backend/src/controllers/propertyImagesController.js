import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import Property from '../models/Property.js';
import { logAdminAction } from '../services/activityService.js';
import cloudinaryService from '../services/cloudinaryService.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const imagesDir = path.join(backendRoot, 'public', 'uploads', 'properties');
const localImagePath = (url) => {
  const cleanUrl = stripCacheBust(url || '');
  const relativePath = cleanUrl.startsWith('/uploads/')
    ? cleanUrl.slice(1)
    : cleanUrl.startsWith('/images/')
      ? cleanUrl.slice(1)
      : '';
  if (!relativePath) return null;
  const publicDir = path.join(backendRoot, 'public');
  const resolved = path.resolve(publicDir, relativePath);
  return resolved.startsWith(`${path.resolve(publicDir)}${path.sep}`) ? resolved : null;
};

const ensureImagesDir = () => {
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
};

const getUploadedImage = (req) => {
  if (req.file) return req.file;
  if (!req.files) return null;
  if (Array.isArray(req.files)) return req.files[0] || null;
  if (req.files.image) return req.files.image;
  if (req.files.file) return req.files.file;
  const firstEntry = Object.values(req.files)[0];
  if (Array.isArray(firstEntry)) return firstEntry[0] || null;
  return firstEntry || null;
};

const addCacheBust = (url) => {
  if (!url || typeof url !== 'string') return url;
  const clean = url.split('?')[0];
  return `${clean}?v=${Date.now()}`;
};

const stripCacheBust = (url) => {
  if (!url || typeof url !== 'string') return url;
  return url.split('?')[0];
};

const saveUploadedFile = async (file) => {
  // If Cloudinary configured, upload buffer to Cloudinary and return cloud metadata
  if (cloudinaryService && cloudinaryService.isConfigured && cloudinaryService.isConfigured()) {
    if (file.buffer && file.buffer.length > 0) {
      const uploaded = await cloudinaryService.uploadBuffer(file.buffer, { folder: 'properties' });
      return { filename: uploaded.public_id, url: uploaded.url, public_id: uploaded.public_id, cloudinary: true };
    }
  }

  ensureImagesDir();
  const originalName = file.originalname || file.name || 'upload';
  const extension = path.extname(originalName).toLowerCase();
  const filename = `${randomUUID()}${extension}`;
  const dest = path.join(imagesDir, filename);

  if (file.buffer && file.buffer.length > 0) {
    await fs.promises.writeFile(dest, file.buffer);
  } else if (file.path && fs.existsSync(file.path)) {
    await fs.promises.copyFile(file.path, dest);
  } else {
    const empty = Buffer.from('');
    await fs.promises.writeFile(dest, empty);
  }

  return {
    filename,
    url: `/uploads/properties/${filename}`,
    dest,
    public_id: '',
    cloudinary: false,
  };
};

const normalizeExistingImages = (prop) => {
  const arr = Array.isArray(prop.images) ? prop.images : [];
  return arr.map((it) => {
    if (!it) return null;
    if (typeof it === 'string') return { url: it, public_id: '' };
    if (typeof it === 'object' && it.url) return { url: it.url, public_id: it.public_id || '' };
    return null;
  }).filter(Boolean);
};

export const uploadPropertyImage = async (req, res) => {
  try {
    ensureImagesDir();
    const propertyId = req.params.id;
    const file = getUploadedImage(req);
    if (!file) return res.status(400).json({ success: false, message: 'No image file provided.' });
    
    const MAX_BYTES = Number(process.env.UPLOAD_MAX_SIZE) || 5 * 1024 * 1024; // 5MB default
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!file.mimetype || !allowed.includes(String(file.mimetype).toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Invalid file type. Only JPEG, PNG and WEBP are allowed.' });
    }

    if (file.size && Number(file.size) > MAX_BYTES) {
      return res.status(400).json({ success: false, message: `File too large. Maximum allowed size is ${Math.round(MAX_BYTES / 1024 / 1024)}MB.` });
    }
    
    const prop = await Property.findById(propertyId);
    if (!prop) return res.status(404).json({ success: false, message: 'Property not found.' });
    const saved = await saveUploadedFile(file);
    const relativeUrl = saved.url;
    const cleanUrl = stripCacheBust(relativeUrl);
    const existingImages = normalizeExistingImages(prop);
    const currentPrimaryUrl = stripCacheBust(prop.image || prop.featuredImage?.url || '');
    if (currentPrimaryUrl && !existingImages.some((image) => stripCacheBust(image.url) === currentPrimaryUrl)) {
      existingImages.unshift({
        url: currentPrimaryUrl,
        public_id: prop.featuredImage?.public_id || '',
      });
    }

    const imageObj = { url: cleanUrl, public_id: saved.public_id || '' };
    prop.images = [...existingImages, imageObj].filter(Boolean);

    // Adding a gallery image must not change the property's existing cover image.
    const primaryImage = prop.images[0] || imageObj;
    prop.image = primaryImage.url;
    prop.featuredImage = { url: primaryImage.url, public_id: primaryImage.public_id || '' };
    prop.updatedAt = new Date();
    await prop.save();

    await logAdminAction({
      adminId: req.user?.id || req.user?._id || 'admin',
      adminName: req.user?.name || 'Admin',
      adminEmail: req.user?.email || '',
      actionType: 'PROPERTY_IMAGE_UPLOAD',
      entityType: 'PROPERTY',
      entityId: String(propertyId),
      message: `Uploaded image for property ${propertyId}`,
      propertyName: prop.title || '',
    });

    // Return response with cache-bust URLs for display
    const responseImages = prop.images.map((img) => (typeof img === 'string' ? addCacheBust(img) : addCacheBust(img.url || '')));
    return res.status(201).json({ 
      success: true, 
      data: { 
        url: addCacheBust(cleanUrl), 
        images: responseImages,
        property: prop
      } 
    });
  } catch (error) {
    console.error('Image upload failed:', error);
    return res.status(500).json({ success: false, message: 'Image upload failed.' });
  }
};

export const replacePropertyImage = async (req, res) => {
  try {
    ensureImagesDir();
    const { id } = req.params;
    const file = getUploadedImage(req);
    if (!file) return res.status(400).json({ success: false, message: 'No image file provided.' });
    
    const MAX_BYTES = Number(process.env.UPLOAD_MAX_SIZE) || 5 * 1024 * 1024; // 5MB default
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!file.mimetype || !allowed.includes(String(file.mimetype).toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Invalid file type. Only JPEG, PNG and WEBP are allowed.' });
    }

    if (file.size && Number(file.size) > MAX_BYTES) {
      return res.status(400).json({ success: false, message: `File too large. Maximum allowed size is ${Math.round(MAX_BYTES / 1024 / 1024)}MB.` });
    }

    const prop = await Property.findById(id);
    if (!prop) return res.status(404).json({ success: false, message: 'Property not found.' });
    // support both numeric index and imageId replacement
    const { imageIndex, imageId } = req.params;
    const saved = await saveUploadedFile(file);
    const relativeUrl = saved.url;

    let normalized = Array.isArray(prop.images) ? prop.images.map((it) => (typeof it === 'string' ? { url: stripCacheBust(it), public_id: '' } : { url: stripCacheBust(it.url), public_id: it.public_id || '', uploadedAt: it.uploadedAt || new Date(), _id: it._id })) : [];

    let replacedIndex = -1;
    let oldImageObj = null;
    if (typeof imageId === 'string' && imageId) {
      const idxById = normalized.findIndex((it) => String(it._id) === String(imageId));
      if (idxById === -1) {
        return res.status(400).json({ success: false, message: `Image with id ${imageId} not found on property.` });
      }
      replacedIndex = idxById;
    } else if (typeof imageIndex !== 'undefined') {
      const idx = Number(imageIndex || 0);
      if (idx < 0 || idx > normalized.length) {
        return res.status(400).json({ success: false, message: `Invalid image index ${idx}. Property has ${normalized.length} images.` });
      }
      replacedIndex = idx;
    } else {
      // default to replace first
      replacedIndex = 0;
    }

    oldImageObj = normalized[replacedIndex] || null;

    const newImageObj = { url: stripCacheBust(relativeUrl), public_id: saved.public_id || '', uploadedAt: new Date() };

    if (replacedIndex < normalized.length) {
      newImageObj._id = normalized[replacedIndex]._id || undefined;
      normalized[replacedIndex] = newImageObj;
    } else {
      normalized.push(newImageObj);
    }

    // Save objects back to property
    prop.images = normalized;

    // The first persisted image is the primary image for every client.
    const primaryImage = prop.images[0] || {};
    prop.image = primaryImage.url || '';
    prop.featuredImage = { url: primaryImage.url || '', public_id: primaryImage.public_id || '' };

    prop.updatedAt = new Date();
    await prop.save();

    // Attempt to delete old file (best-effort)
    try {
      if (oldImageObj) {
        if (oldImageObj.public_id) {
          try { await cloudinaryService.deleteByPublicId(oldImageObj.public_id); } catch (e) { console.warn('Cloudinary delete failed', e?.message || e); }
        } else {
          const oldPath = localImagePath(oldImageObj.url);
          if (oldPath && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
      }
    } catch (e) {
      console.warn('Failed to delete old image file:', e?.message || e);
    }
    await logAdminAction({
      adminId: req.user?.id || req.user?._id || 'admin',
      adminName: req.user?.name || 'Admin',
      adminEmail: req.user?.email || '',
      actionType: 'PROPERTY_IMAGE_REPLACE',
      entityType: 'PROPERTY',
      entityId: String(id),
        message: `Replaced image at index ${replacedIndex} for property ${id}`,
      propertyName: prop.title || '',
    });

    // Return fresh data with cache-bust URLs for client display
    const responseImages = prop.images.map((img) => (typeof img === 'string' ? addCacheBust(img) : addCacheBust(img.url || '')));
    return res.json({ 
      success: true, 
      data: { 
        url: addCacheBust(newImageObj.url || ''), 
        images: responseImages,
        property: prop
      } 
    });
  } catch (error) {
    console.error('Image replace failed:', error);
    return res.status(500).json({ success: false, message: 'Image replace failed.' });
  }
};

export const deletePropertyImage = async (req, res) => {
  try {
    ensureImagesDir();
    const { id } = req.params;

    const prop = await Property.findById(id);
    if (!prop) return res.status(404).json({ success: false, message: 'Property not found.' });
    const { imageIndex, imageId } = req.params;
    const existingImages = Array.isArray(prop.images) ? prop.images.map((it) => (typeof it === 'string' ? { url: stripCacheBust(it), public_id: '' } : { url: stripCacheBust(it.url), public_id: it.public_id || '', uploadedAt: it.uploadedAt || new Date(), _id: it._id })) : [];

    let removed = null;
    let removedIndex = -1;
    if (typeof imageId === 'string' && imageId) {
      const idxById = existingImages.findIndex((it) => String(it._id) === String(imageId));
      if (idxById === -1) return res.status(400).json({ success: false, message: `Image with id ${imageId} not found.` });
      removed = existingImages.splice(idxById, 1)[0];
      removedIndex = idxById;
    } else if (typeof imageIndex !== 'undefined') {
      const idx = Number(imageIndex || 0);
      if (!Number.isInteger(idx) || idx < 0 || idx >= existingImages.length) {
        return res.status(400).json({
          success: false,
          message: `Invalid image index ${imageIndex}. Property has ${existingImages.length} images.`,
        });
      }
      removed = existingImages.splice(idx, 1)[0];
      removedIndex = idx;
    } else {
      return res.status(400).json({ success: false, message: 'Either imageId or imageIndex parameter is required.' });
    }

    prop.images = existingImages.filter(Boolean);
    
    // Update main image
    if (!prop.images.length) {
      prop.image = '';
      prop.featuredImage = { url: '', public_id: '' };
    } else {
      const currentUrls = prop.images.map((it) => (typeof it === 'string' ? stripCacheBust(it) : stripCacheBust(it.url || '')));
      const mainUrl = stripCacheBust(prop.image || '');
      if (removedIndex === 0 || !prop.image || !currentUrls.includes(mainUrl)) {
        prop.image = (typeof prop.images[0] === 'string' ? prop.images[0] : prop.images[0].url) || '';
        prop.featuredImage = {
          url: prop.image,
          public_id: prop.images[0]?.public_id || '',
        };
      }
    }
    
    prop.updatedAt = new Date();
    await prop.save();

    // Delete file best-effort
    try {
      const removedObj = typeof removed === 'string' ? { url: stripCacheBust(removed), public_id: '' } : removed;
      if (removedObj && removedObj.public_id) {
        try { await cloudinaryService.deleteByPublicId(removedObj.public_id); } catch (e) { console.warn('Cloudinary delete failed', e?.message || e); }
      } else if (removedObj) {
        const oldPath = localImagePath(removedObj.url);
        if (oldPath && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    } catch (e) {
      console.warn('Failed to delete image file:', e?.message || e);
    }

    await logAdminAction({
      adminId: req.user?.id || req.user?._id || 'admin',
      adminName: req.user?.name || 'Admin',
      adminEmail: req.user?.email || '',
      actionType: 'PROPERTY_IMAGE_DELETE',
      entityType: 'PROPERTY',
      entityId: String(id),
      message: `Deleted image at index ${removedIndex} for property ${id}`,
      propertyName: prop.title || '',
    });

    // Return response with cache-bust URLs for display
    const responseImages = prop.images.map((img) => (typeof img === 'string' ? addCacheBust(img) : addCacheBust(img.url || '')));
    return res.json({ 
      success: true, 
      data: { 
        images: responseImages,
        property: prop
      } 
    });
  } catch (error) {
    console.error('Image delete failed:', error);
    return res.status(500).json({ success: false, message: 'Image delete failed.' });
  }
};

export const updateMainPropertyImage = async (req, res) => {
  try {
    ensureImagesDir();
    const propertyId = req.params.id;
    const file = getUploadedImage(req);
    if (!file) return res.status(400).json({ success: false, message: 'No image file provided.' });

    const MAX_BYTES = Number(process.env.UPLOAD_MAX_SIZE) || 5 * 1024 * 1024; // 5MB default
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!file.mimetype || !allowed.includes(String(file.mimetype).toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Invalid file type. Only JPEG, PNG and WEBP are allowed.' });
    }

    if (file.size && Number(file.size) > MAX_BYTES) {
      return res.status(400).json({ success: false, message: `File too large. Maximum allowed size is ${Math.round(MAX_BYTES / 1024 / 1024)}MB.` });
    }

    const prop = await Property.findById(propertyId);
    if (!prop) return res.status(404).json({ success: false, message: 'Property not found.' });

    const saved = await saveUploadedFile(file);
    const cleanUrl = stripCacheBust(saved.url);

    const existing = normalizeExistingImages(prop);
    const oldMain = prop.image || (prop.featuredImage && prop.featuredImage.url) || (existing[0] && existing[0].url) || null;

    const newImageObj = { url: cleanUrl, public_id: saved.public_id || '' };

    if (existing.length) {
      existing[0] = newImageObj;
    } else {
      existing.unshift(newImageObj);
    }

    prop.images = existing;
    prop.image = cleanUrl;
    prop.featuredImage = { url: cleanUrl, public_id: saved.public_id || '' };
    prop.updatedAt = new Date();
    await prop.save();

    // Attempt to delete old main image (best-effort)
    try {
      if (oldMain) {
        if (typeof oldMain === 'object' && oldMain.public_id) {
          try { await cloudinaryService.deleteByPublicId(oldMain.public_id); } catch (e) { console.warn('Cloudinary delete failed', e?.message || e); }
        } else if (typeof oldMain === 'string') {
          const oldUrl = stripCacheBust(oldMain);
          const oldPath = localImagePath(oldUrl);
          if (oldPath && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
      }
    } catch (e) {
      console.warn('Failed to delete old main image file:', e?.message || e);
    }

    await logAdminAction({
      adminId: req.user?.id || req.user?._id || 'admin',
      adminName: req.user?.name || 'Admin',
      adminEmail: req.user?.email || '',
      actionType: 'PROPERTY_MAIN_IMAGE_UPDATE',
      entityType: 'PROPERTY',
      entityId: String(propertyId),
      message: `Updated main image for property ${propertyId}`,
      propertyName: prop.title || '',
    });

    const responseImages = prop.images.map((img) => (typeof img === 'string' ? addCacheBust(img) : addCacheBust(img.url || '')));
    const property = typeof prop.toObject === 'function' ? prop.toObject() : prop;
    console.info('Main property image updated:', {
      propertyId: String(propertyId),
      propertyType: property.propertyType,
      category: property.category,
      image: property.image,
      imageCount: Array.isArray(property.images) ? property.images.length : 0,
    });
    return res.json({ success: true, data: { url: addCacheBust(cleanUrl), images: responseImages, property } });
  } catch (error) {
    console.error('Update main property image failed:', error);
    return res.status(500).json({ success: false, message: 'Update main property image failed.' });
  }
};
