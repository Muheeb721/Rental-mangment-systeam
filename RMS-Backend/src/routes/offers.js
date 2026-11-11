import express from 'express';
import { listOffers, createOffer, updateOffer, deleteOffer, toggleOfferActive } from '../controllers/offerController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', listOffers);
router.post('/', requireAuth, requireAdmin, createOffer);
router.put('/:id', requireAuth, requireAdmin, updateOffer);
router.delete('/:id', requireAuth, requireAdmin, deleteOffer);
router.post('/:id/toggle', requireAuth, requireAdmin, toggleOfferActive);

export default router;
