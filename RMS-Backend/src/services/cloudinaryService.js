import { v2 as cloudinary } from 'cloudinary';

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

let enabled = false;
if (CLOUD_NAME && API_KEY && API_SECRET) {
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET,
    secure: true,
  });
  enabled = true;
}

export async function uploadBuffer(buffer, options = {}) {
  if (!enabled) throw new Error('Cloudinary not configured');

  // upload_stream wrapper
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: options.folder || 'rms', resource_type: 'image', format: options.format },
      (error, result) => {
        if (error) return reject(error);
        return resolve({ url: result.secure_url, public_id: result.public_id, raw: result });
      }
    );

    stream.end(buffer);
  });
}

export async function deleteByPublicId(publicId) {
  if (!enabled) throw new Error('Cloudinary not configured');
  try {
    const res = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    return res;
  } catch (e) {
    throw e;
  }
}

export function isConfigured() {
  return enabled;
}

export default { uploadBuffer, deleteByPublicId, isConfigured };
