import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { propertyImageUpload, storePropertyImages } from '../utils/propertyMedia.js';

const router = express.Router();

/**
 * POST /api/uploads - any signed-in user uploads one image (field `image` or `file`, JPG/PNG/WEBP, max 5MB).
 * Response: { success, data: { url } } where url is served from /uploads/...
 */
router.post('/', requireAuth, propertyImageUpload.fields([{ name: 'image', maxCount: 1 }, { name: 'file', maxCount: 1 }]), async (req, res) => {
  try {
    const file = req.files?.image?.[0] || req.files?.file?.[0];
    if (!file) return res.status(400).json({ success: false, message: 'Choose an image to upload.' });
    const [stored] = await storePropertyImages([file]);
    return res.status(201).json({ success: true, message: 'Image uploaded.', data: { url: stored.url } });
  } catch (error) {
    console.error('Upload failed', error);
    return res.status(500).json({ success: false, message: 'Unable to upload image.' });
  }
});

export default router;
