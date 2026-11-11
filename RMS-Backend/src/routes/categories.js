import express from 'express';
import { listCategories, createCategory, updateCategory, deleteCategory, toggleCategoryActive } from '../controllers/categoryController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', listCategories);
router.post('/', requireAuth, requireAdmin, createCategory);
router.put('/:id', requireAuth, requireAdmin, updateCategory);
router.delete('/:id', requireAuth, requireAdmin, deleteCategory);
router.post('/:id/toggle', requireAuth, requireAdmin, toggleCategoryActive);

export default router;
