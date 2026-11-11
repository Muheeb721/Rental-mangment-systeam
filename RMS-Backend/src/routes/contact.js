import express from 'express';
import {
  createContact,
  listContacts,
  updateContact,
  deleteContact,
  createPropertyInquiry,
  listPropertyInquiries,
  updatePropertyInquiry,
  deletePropertyInquiry,
  batchPropertyInquiries,
} from '../controllers/contactController.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { objectIdParam } from '../middleware/validateId.js';

const router = express.Router();
router.param('id', objectIdParam('Message'));

// public contact form; links the message to the user when a token is present
router.post('/', optionalAuth, createContact);
router.get('/', requireAuth, listContacts);
router.put('/:id', requireAuth, updateContact);
router.patch('/:id', requireAuth, updateContact);
router.delete('/:id', requireAuth, deleteContact);

router.post('/property-inquiries', optionalAuth, createPropertyInquiry);
router.get('/property-inquiries', requireAuth, listPropertyInquiries);
router.post('/property-inquiries/batch', requireAuth, batchPropertyInquiries);
router.put('/property-inquiries/:id', requireAuth, updatePropertyInquiry);
router.delete('/property-inquiries/:id', requireAuth, deletePropertyInquiry);

export default router;
