import express from 'express';
import { listPlaces, getPlaceDetails, getTravel } from '../controllers/placesController.js';

// Public location-intelligence routes. Mounted at /api/places and /api/travel.
export const placesRouter = express.Router();
placesRouter.get('/', listPlaces);
placesRouter.get('/:slug', getPlaceDetails);

export const travelRouter = express.Router();
travelRouter.get('/', getTravel);

export default placesRouter;
