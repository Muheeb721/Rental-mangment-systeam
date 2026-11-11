import express from 'express';
import {
  createMaintenanceRequest,
  listMaintenanceRequests,
  updateMaintenanceRequest,
  deleteMaintenanceRequest,
} from '../controllers/maintenanceController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/', requireAuth, createMaintenanceRequest);
router.get('/', requireAuth, listMaintenanceRequests);
router.get('/all', requireAuth, requireAdmin, listMaintenanceRequests);
router.patch('/:id', requireAuth, requireAdmin, updateMaintenanceRequest);
router.put('/:id', requireAuth, requireAdmin, updateMaintenanceRequest);
router.delete('/:id', requireAuth, deleteMaintenanceRequest);

export default router;
