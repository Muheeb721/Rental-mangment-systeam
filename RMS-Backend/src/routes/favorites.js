import express from 'express';
import { addFavorite, removeFavorite, listFavorites, aggregateFavorites } from '../controllers/favoriteController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/', requireAuth, addFavorite);
router.get('/', requireAuth, listFavorites);
router.get('/aggregate', requireAuth, requireAdmin, aggregateFavorites);
router.delete('/:propertyId', requireAuth, removeFavorite);

export default router;
