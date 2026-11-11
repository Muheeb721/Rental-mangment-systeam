import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createSaleInterestSubmission } from '../controllers/saleInterestController.js';

const router = express.Router();

router.post('/', requireAuth, createSaleInterestSubmission);

export default router;
