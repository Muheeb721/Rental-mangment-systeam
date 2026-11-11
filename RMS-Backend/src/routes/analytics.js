
import express from 'express';
import { getViews, createView, listComparisons, createComparison, deleteComparison, listPriceHistory, createPriceHistory, submitSummary } from '../controllers/analyticsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/views', getViews);
router.post('/views', createView);

router.get('/comparisons', requireAuth, listComparisons);
router.post('/comparisons', requireAuth, createComparison);
router.delete('/comparisons/:id', requireAuth, deleteComparison);

router.get('/price-history', listPriceHistory);
router.post('/price-history', requireAuth, createPriceHistory);

router.post('/summary', submitSummary);

export default router;
