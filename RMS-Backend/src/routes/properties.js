import express from 'express';
import {
  listProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
  updatePropertyStatus,
  updatePropertyPrice,
  recommendProperties,
  addPropertyImages,
  deletePropertyImage,
  reorderPropertyImages,
  setPropertyCoverImage,
  replacePropertyImage,
  getPropertyNearby,
} from '../controllers/propertyController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { acceptPropertyImages } from '../utils/propertyMedia.js';

const router = express.Router();
const admin = [requireAuth, requireAdmin];

// Public
router.get('/', listProperties);
router.post('/recommend', recommendProperties);
router.get('/:id/nearby', getPropertyNearby);
router.get('/:id', getProperty);

// Admin: property CRUD (JSON or multipart/form-data with `images` files)
router.post('/', ...admin, acceptPropertyImages, createProperty);
router.put('/:id', ...admin, acceptPropertyImages, updateProperty);
router.patch('/:id', ...admin, acceptPropertyImages, updateProperty);
router.delete('/:id', ...admin, deleteProperty);
router.post('/:id/status', ...admin, updatePropertyStatus);
router.patch('/:id/status', ...admin, updatePropertyStatus);
router.post('/:id/price', ...admin, updatePropertyPrice);

// Admin: image management
router.post('/:id/images', ...admin, acceptPropertyImages, addPropertyImages);
router.put('/:id/images/order', ...admin, reorderPropertyImages);
router.put('/:id/images/:imageId/cover', ...admin, setPropertyCoverImage);
router.post('/:id/images/:imageId', ...admin, acceptPropertyImages, replacePropertyImage);
router.post('/:id/images/id/:imageId', ...admin, acceptPropertyImages, replacePropertyImage);
router.delete('/:id/images/:imageId', ...admin, deletePropertyImage);
router.delete('/:id/images/id/:imageId', ...admin, deletePropertyImage);

export default router;
