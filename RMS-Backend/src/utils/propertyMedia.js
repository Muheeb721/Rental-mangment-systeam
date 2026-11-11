import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import multer from 'multer';
import cloudinaryService from '../services/cloudinaryService.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const publicRoot = path.join(backendRoot, 'public');
export const propertyUploadsDir = path.join(publicRoot, 'uploads', 'properties');

export const MAX_IMAGE_BYTES = Number(process.env.UPLOAD_MAX_SIZE) || 5 * 1024 * 1024;
export const MAX_IMAGES_PER_PROPERTY = 20;
const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/** Multer instance for property images: memory storage, images only, 5MB each, 10 files per request. */
export const propertyImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (MIME_EXTENSIONS[String(file.mimetype || '').toLowerCase()]) return cb(null, true);
    const error = new Error(`"${file.originalname}" is not a supported image. Use JPG, PNG or WEBP.`);
    error.status = 400;
    return cb(error);
  },
});

/** Accepts files sent as `images` (multiple) or `image` (single). */
export const acceptPropertyImages = propertyImageUpload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'image', maxCount: 10 },
]);

export const collectUploadedFiles = (req) => {
  if (Array.isArray(req.files)) return req.files;
  const files = req.files || {};
  return [...(files.images || []), ...(files.image || []), ...(req.file ? [req.file] : [])];
};

/** Saves one uploaded file (Cloudinary when configured, otherwise public/uploads/properties). */
export const storePropertyImage = async (file) => {
  if (cloudinaryService?.isConfigured?.()) {
    const uploaded = await cloudinaryService.uploadBuffer(file.buffer, { folder: 'properties' });
    return { url: uploaded.url, public_id: uploaded.public_id || '', uploadedAt: new Date() };
  }
  await fs.promises.mkdir(propertyUploadsDir, { recursive: true });
  const extension = MIME_EXTENSIONS[String(file.mimetype || '').toLowerCase()] || '.jpg';
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}${extension}`;
  await fs.promises.writeFile(path.join(propertyUploadsDir, filename), file.buffer);
  return { url: `/uploads/properties/${filename}`, public_id: '', uploadedAt: new Date() };
};

export const storePropertyImages = async (files = []) => {
  const stored = [];
  try {
    for (const file of files) {
      stored.push(await storePropertyImage(file));
    }
    return stored;
  } catch (error) {
    await removePropertyImages(stored);
    throw error;
  }
};

/** Resolves a /uploads/... URL to an absolute path inside public/uploads (never outside it). */
const resolveUploadPath = (url) => {
  if (!url || typeof url !== 'string') return null;
  const clean = url.split('?')[0].replace(/^https?:\/\/[^/]+/i, '');
  if (!clean.startsWith('/uploads/')) return null; // never delete seeded /images/... assets
  const resolved = path.resolve(publicRoot, `.${clean}`);
  const uploadsRoot = path.resolve(publicRoot, 'uploads');
  return resolved.startsWith(`${uploadsRoot}${path.sep}`) ? resolved : null;
};

export const removePropertyImages = async (images = []) => {
  for (const image of images) {
    const url = typeof image === 'string' ? image : image?.url;
    const publicId = typeof image === 'object' ? image?.public_id : '';
    if (publicId && cloudinaryService?.isConfigured?.()) {
      try { await cloudinaryService.deleteByPublicId(publicId); } catch (error) {
        console.warn('Unable to remove Cloudinary image:', error?.message || error);
      }
      continue;
    }
    const filePath = resolveUploadPath(url);
    if (!filePath) continue;
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn('Unable to remove image file:', error?.message || error);
    }
  }
};
