import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { objectIdParam } from '../middleware/validateId.js';
import {
  createApplication,
  listUserApplications,
  listAllApplications,
  getApplicationById,
  acceptApplication,
  rejectApplication,
  deleteApplication,
  downloadApplicationAgreement,
} from '../controllers/rentApplicationController.js';

const router = express.Router();
router.param('id', objectIdParam('Application'));

router.post('/', requireAuth, createApplication);
router.get('/me', requireAuth, listUserApplications);
router.get('/:id/agreement', requireAuth, downloadApplicationAgreement);
router.get('/', requireAuth, requireAdmin, listAllApplications);
router.get('/:id', requireAuth, getApplicationById);
router.put('/:id/accept', requireAuth, requireAdmin, acceptApplication);
router.post('/:id/accept', requireAuth, requireAdmin, acceptApplication);
router.put('/:id/reject', requireAuth, requireAdmin, rejectApplication);
router.post('/:id/reject', requireAuth, requireAdmin, rejectApplication);
router.delete('/:id', requireAuth, deleteApplication);

export default router;
