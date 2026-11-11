import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getProfile, updateProfile, updateProfileImage } from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const uploadsDir = path.join(backendRoot, 'public', 'images', 'admin-profiles');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const buildProfileFilename = (req, file) => {
  const userId = String(req?.user?.id || req?.user?._id || req?.body?.userId || 'admin').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'admin';
  const sanitizedBase = (file.originalname || 'profile-image').replace(/\s+/g, '-');
  const ext = path.extname(sanitizedBase) || '.jpg';
  const base = sanitizedBase.replace(new RegExp(`${ext.replace('.', '\.')}$`), '');
  const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30) || 'profile';
  return `admin_${userId}_${Date.now()}_${safeBase}${ext}`.toLowerCase();
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, buildProfileFilename(req, file)),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(String(file.mimetype).toLowerCase())) {
      cb(null, true);
      return;
    }
    cb(new Error('Only JPEG, PNG, and WEBP images are allowed.'));
  },
});

router.get('/profile', requireAuth, getProfile);
// accept both profileImage and cnicImage when updating/creating profile
router.put('/profile', requireAuth, upload.fields([{ name: 'profileImage', maxCount: 1 }, { name: 'cnicImage', maxCount: 1 }]), updateProfile);
router.post('/profile-image', requireAuth, upload.single('profileImage'), updateProfileImage);

export default router;
