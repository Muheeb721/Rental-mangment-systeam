import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { listVerifications, saveVerifications, setVerified, getVerification } from '../controllers/propertyVerificationController.js';

const router = express.Router();

// list all verifications (admin only)
router.get('/', requireAuth, requireAdmin, listVerifications);

// bulk save verifications (admin only)
router.post('/', requireAuth, requireAdmin, saveVerifications);

// set verification for a property (admin only)
router.post('/:propertyId', requireAuth, requireAdmin, setVerified);

// get verification for a property
router.get('/:propertyId', getVerification);

export default router;
