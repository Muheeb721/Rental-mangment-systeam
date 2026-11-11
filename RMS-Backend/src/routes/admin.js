import express from 'express';
import {
  getAdminAnalytics,
  getAdminDashboard,
  getAdminUsers,
  getAdminUserDetail,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  listTenantsWithProperties,
} from '../controllers/adminController.js';
import {
  createProperty,
  deleteProperty,
  getProperty,
  listPropertiesAdmin,
  updateProperty,
} from '../controllers/propertyController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { acceptPropertyImages } from '../utils/propertyMedia.js';

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/dashboard', getAdminDashboard);
router.get('/analytics', getAdminAnalytics);

router.get('/users', getAdminUsers);
router.post('/users', createAdminUser);
router.get('/users/:id', getAdminUserDetail);
router.put('/users/:id', updateAdminUser);
router.patch('/users/:id', updateAdminUser);
router.delete('/users/:id', deleteAdminUser);

router.get('/tenants-overview', listTenantsWithProperties);

// Admin property listing includes Inactive properties; other operations mirror /api/properties
router.get('/properties', listPropertiesAdmin);
router.get('/properties/:id', getProperty);
router.post('/properties', acceptPropertyImages, createProperty);
router.put('/properties/:id', acceptPropertyImages, updateProperty);
router.delete('/properties/:id', deleteProperty);

export default router;
