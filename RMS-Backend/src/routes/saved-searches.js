import express from 'express';
import { saveSearch, listSavedSearches, deleteSavedSearch } from '../controllers/savedSearchController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/', requireAuth, saveSearch);
router.get('/', requireAuth, listSavedSearches);
router.delete('/:id', requireAuth, deleteSavedSearch);

export default router;
