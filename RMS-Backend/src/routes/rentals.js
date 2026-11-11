import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { createRentalProfile, getRentalProfile, getUserRentalProfile, updateRentalProfile, listRentalProfiles, changeRentalStatus } from '../controllers/rentalController.js';

const router = express.Router();

// Public/user endpoints
router.get('/me', requireAuth, getUserRentalProfile);
router.post('/', requireAuth, createRentalProfile);
router.get('/:id', requireAuth, getRentalProfile);
router.put('/:id', requireAuth, updateRentalProfile);

// Admin endpoints
router.get('/admin/all', requireAuth, requireAdmin, listRentalProfiles);
router.post('/:id/status', requireAuth, requireAdmin, changeRentalStatus);

export default router;
