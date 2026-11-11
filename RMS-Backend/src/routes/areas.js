import express from 'express';
import { listAreas, getAreaGuide, createArea, updateArea, deleteArea, toggleAreaActive } from '../controllers/areaController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', listAreas); // public (with live listing stats)
router.get('/:slug', getAreaGuide); // public area guide (slug, fuzzy name or id)
router.post('/', requireAuth, requireAdmin, createArea);
router.put('/:id', requireAuth, requireAdmin, updateArea);
router.delete('/:id', requireAuth, requireAdmin, deleteArea);
router.post('/:id/toggle', requireAuth, requireAdmin, toggleAreaActive);

export default router;
