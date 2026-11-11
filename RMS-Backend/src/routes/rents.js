import express from 'express';
import { createRentRecord, listRentRecords, updateRentRecord, deleteRentRecord, submitRentPayment, verifyRentRecordPayment } from '../controllers/rentController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { objectIdParam } from '../middleware/validateId.js';
import { propertyImageUpload } from '../utils/propertyMedia.js';

const router = express.Router();
router.param('id', objectIdParam('Rent record'));

router.post('/', requireAuth, requireAdmin, createRentRecord);
router.get('/', requireAuth, listRentRecords);
router.get('/all', requireAuth, requireAdmin, listRentRecords);
router.post('/:id/pay', requireAuth, propertyImageUpload.single('proof'), submitRentPayment);
router.post('/:id/verify', requireAuth, requireAdmin, verifyRentRecordPayment);
router.patch('/:id', requireAuth, requireAdmin, updateRentRecord);
router.put('/:id', requireAuth, requireAdmin, updateRentRecord);
router.delete('/:id', requireAuth, requireAdmin, deleteRentRecord);

export default router;
