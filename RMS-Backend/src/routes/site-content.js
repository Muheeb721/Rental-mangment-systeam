import express from 'express';
import { getSiteContent, updateSiteContent } from '../controllers/siteContentController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
router.get('/', getSiteContent);
router.put('/', requireAuth, requireAdmin, updateSiteContent);
export default router;
