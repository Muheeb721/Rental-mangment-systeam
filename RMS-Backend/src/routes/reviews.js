import express from 'express';
import { listReviews, listAllReviewsAdmin, createReview, updateReviewStatus, deleteReview } from '../controllers/reviewsController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { objectIdParam } from '../middleware/validateId.js';

const router = express.Router();
router.param('id', objectIdParam('Review'));

router.get('/', listReviews);
router.get('/admin/all', requireAuth, requireAdmin, listAllReviewsAdmin);
router.post('/', requireAuth, createReview);
router.patch('/:id', requireAuth, requireAdmin, updateReviewStatus);
router.put('/:id', requireAuth, requireAdmin, updateReviewStatus);
router.delete('/:id', requireAuth, deleteReview);

export default router;
