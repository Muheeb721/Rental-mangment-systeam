import express from 'express';
import { listImageAssets, createImageAsset, updateImageAsset, deleteImageAsset, getImagesByCategory } from '../controllers/imageController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', listImageAssets);
router.get('/category/:category', async (req, res) => {
  try {
    const items = await getImagesByCategory(req.params.category);
    return res.json({ success: true, data: items });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to load category images.' });
  }
});
router.post('/', requireAuth, requireAdmin, createImageAsset);
router.patch('/:id', requireAuth, requireAdmin, updateImageAsset);
router.delete('/:id', requireAuth, requireAdmin, deleteImageAsset);

export default router;
