import { searchPlaces, getPlace, childAreas, LAHORE_AREAS } from '../utils/places.js';
import { resolvePoint, nearbyLandmarks } from '../utils/locationService.js';
import { haversineKm, travelBetween } from '../utils/travel.js';

const DISCLAIMER = 'Estimates only: road distance is approximated from straight-line distance and typical Lahore speeds; actual time and fares vary with traffic and demand.';

const publicPlace = ({ score, ...place }) => place;

/** GET /api/places?type=area|landmark&category=&q=&limit= */
export const listPlaces = (req, res) => {
  try {
    const { type = '', category = '', q = '' } = req.query || {};
    const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || 300, 1), 500);
    if (type && !['area', 'landmark'].includes(String(type).toLowerCase())) {
      return res.status(400).json({ success: false, message: 'type must be "area" or "landmark".' });
    }
    const results = searchPlaces(q, { type, category, limit });
    const data = results.map((place) => (q ? { ...publicPlace(place), score: place.score } : publicPlace(place)));
    return res.json({ success: true, data, meta: { total: data.length, query: q || null, type: type || null, category: category || null } });
  } catch (error) {
    console.error('List places failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list places.' });
  }
};

/** GET /api/places/:slug */
export const getPlaceDetails = (req, res) => {
  const place = getPlace(req.params.slug) || searchPlaces(req.params.slug, { limit: 1 }).find((p) => p.score >= 55);
  if (!place) return res.status(404).json({ success: false, message: 'Place not found.' });
  const clean = publicPlace(getPlace(place.slug));
  const nearestAreas = LAHORE_AREAS
    .filter((area) => area.slug !== clean.slug && !area.subdivisions.includes(clean.name))
    .map((area) => ({ slug: area.slug, name: area.name, tier: area.tier, distanceKm: Number(haversineKm(clean, area).toFixed(2)) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 5);
  const data = {
    ...clean,
    ...(clean.type === 'area' ? { children: childAreas(clean.slug).map(({ slug, name, tier }) => ({ slug, name, tier })) } : {}),
    nearestAreas,
    nearbyLandmarks: nearbyLandmarks(clean, { perCategory: 2, maxKm: 10, excludeSlug: clean.slug }),
    estimate: true,
  };
  return res.json({ success: true, data });
};

/** GET /api/travel?from=<slug|lat,lng|propertyId>&to=<slug|lat,lng|propertyId> */
export const getTravel = async (req, res) => {
  try {
    const { from: fromInput, to: toInput } = req.query || {};
    if (!fromInput || !toInput) return res.status(400).json({ success: false, message: 'Both "from" and "to" are required (place slug, "lat,lng" or property id).' });
    const [from, to] = await Promise.all([resolvePoint(fromInput), resolvePoint(toInput)]);
    if (!from) return res.status(404).json({ success: false, message: `Could not find a location for "${fromInput}".` });
    if (!to) return res.status(404).json({ success: false, message: `Could not find a location for "${toInput}".` });
    const result = await travelBetween(from, to);
    return res.json({
      success: true,
      from,
      to,
      distanceKm: result.distanceKm,
      straightLineKm: Number(haversineKm(from, to).toFixed(2)),
      estimate: true,
      source: result.source,
      peakNow: result.peakNow,
      modes: result.modes,
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    console.error('Travel estimate failed', error);
    return res.status(500).json({ success: false, message: 'Unable to estimate travel.' });
  }
};

export { DISCLAIMER as TRAVEL_DISCLAIMER };
