import express from 'express';
import {
  createPropertyInquiry,
  listPropertyInquiries,
  updatePropertyInquiry,
  deletePropertyInquiry,
  batchPropertyInquiries,
} from '../controllers/contactController.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { objectIdParam } from '../middleware/validateId.js';

const router = express.Router();
router.param('id', objectIdParam('Inquiry'));

router.post('/', optionalAuth, createPropertyInquiry);
router.get('/', requireAuth, listPropertyInquiries);
router.post('/batch', requireAuth, batchPropertyInquiries);
router.put('/:id', requireAuth, updatePropertyInquiry);
router.delete('/:id', requireAuth, deletePropertyInquiry);

export default router;
