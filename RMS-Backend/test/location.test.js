import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { closeDatabase, connectDatabase } from '../src/config/database.js';
import { LAHORE_AREAS, LAHORE_LANDMARKS, LAHORE_BOUNDS } from '../src/data/lahorePlaces.js';
import { searchPlaces, resolvePlace, findAreaInText, resolveAreaForProperty, areaFamily, normalizeText, parseLatLng } from '../src/utils/places.js';
import { estimateTravel, haversineKm, roadDistanceKm, travelBetween, normalizeMode } from '../src/utils/travel.js';
import { buildDemoCatalog } from '../src/utils/demoCatalog.js';

// ---------------------------------------------------------------------------------------------
// Dataset + places (pure)
// ---------------------------------------------------------------------------------------------
test('places dataset is large, unique and inside Lahore', () => {
  assert.ok(LAHORE_AREAS.length >= 60, `expected 60+ areas, got ${LAHORE_AREAS.length}`);
  assert.ok(LAHORE_LANDMARKS.length >= 80, `expected 80+ landmarks, got ${LAHORE_LANDMARKS.length}`);
  const slugs = new Set();
  for (const place of [...LAHORE_AREAS, ...LAHORE_LANDMARKS]) {
    assert.ok(!slugs.has(place.slug), `duplicate slug ${place.slug}`);
    slugs.add(place.slug);
    assert.ok(place.lat >= LAHORE_BOUNDS.minLat && place.lat <= LAHORE_BOUNDS.maxLat, `${place.slug} latitude outside Lahore`);
    assert.ok(place.lng >= LAHORE_BOUNDS.minLng && place.lng <= LAHORE_BOUNDS.maxLng, `${place.slug} longitude outside Lahore`);
  }
  for (const area of LAHORE_AREAS) {
    assert.ok(['premium', 'upper-mid', 'mid', 'budget'].includes(area.tier), `${area.slug} tier`);
    assert.ok(area.description.length > 40, `${area.slug} description`);
    if (area.parent) assert.ok(slugs.has(area.parent), `${area.slug} parent missing`);
  }
});

test('fuzzy search matches aliases, abbreviations and typos', () => {
  assert.equal(searchPlaces('DHA Ph 5')[0].slug, 'dha-phase-5');
  assert.equal(searchPlaces('dha 6')[0].slug, 'dha-phase-6');
  assert.equal(searchPlaces('gulberg 3')[0].slug, 'gulberg-3');
  assert.equal(searchPlaces('askari 10')[0].slug, 'askari-10');
  assert.equal(searchPlaces('UCP', { type: 'landmark' })[0].slug, 'ucp');
  assert.equal(resolvePlace('johr town').slug, 'johar-town');
  assert.equal(searchPlaces('', { type: 'landmark', category: 'hospital' }).every((p) => p.category === 'hospital'), true);
  assert.equal(normalizeText('Gulberg III'), 'gulberg 3');
  assert.deepEqual(parseLatLng('31.47, 74.41'), { lat: 31.47, lng: 74.41 });
  assert.equal(parseLatLng('dha'), null);
});

test('listings resolve to the right area and areas include their phases', () => {
  assert.equal(resolveAreaForProperty({ phase: 'DHA Phase 5', society: 'DHA' }).slug, 'dha-phase-5');
  assert.equal(resolveAreaForProperty({ phase: 'Askari 1' }).slug, 'askari-1');
  assert.equal(resolveAreaForProperty({ phase: 'Askari 11', location: 'Bedian Road' }).slug, 'askari-11');
  assert.equal(findAreaInText('House 4, R-1 Block, Johar Town, Lahore').slug, 'johar-town');
  const family = areaFamily('dha-lahore').map((a) => a.slug);
  assert.ok(family.includes('dha-phase-5') && family.includes('dha-raya') && family.length >= 15);
});

test('demo catalog covers Lahore with ~120 consistent listings', () => {
  const catalog = buildDemoCatalog();
  assert.ok(catalog.length >= 115, `catalog has ${catalog.length}`);
  assert.equal(new Set(catalog.map((item) => item.seedKey)).size, catalog.length);
  assert.ok(new Set(catalog.map((item) => item.areaSlug)).size >= 50);
  for (const item of catalog) {
    assert.ok(item.areaSlug, `${item.seedKey} has an area`);
    assert.ok(Number.isFinite(item.latitude) && Number.isFinite(item.longitude), `${item.seedKey} coords`);
    assert.ok(item.images.length >= 1 && item.images.length <= 5);
    assert.ok(item.price > 0);
  }
});

// ---------------------------------------------------------------------------------------------
// Travel engine (pure)
// ---------------------------------------------------------------------------------------------
test('travel estimates are sane for Lahore trips', () => {
  const dha5 = resolvePlace('dha-phase-5');
  const lums = resolvePlace('lums');
  const gcu = resolvePlace('gcu');
  assert.ok(Math.abs(haversineKm(dha5, gcu) - 16.5) < 3, 'DHA5 -> GCU straight line ~16 km');
  assert.ok(roadDistanceKm(dha5, gcu) > haversineKm(dha5, gcu));

  const short = estimateTravel(dha5, lums);
  assert.equal(short.estimate, true);
  assert.deepEqual(short.modes.map((m) => m.mode), ['car', 'motorbike', 'rickshaw', 'bus', 'walking']);

  const long = estimateTravel(dha5, gcu);
  const byMode = Object.fromEntries(long.modes.map((m) => [m.mode, m]));
  assert.ok(byMode.car.minutes >= 25 && byMode.car.minutes <= 60, `car ${byMode.car.minutes}`);
  assert.ok(byMode.car.minutesPeak > byMode.car.minutes);
  assert.ok(byMode.motorbike.minutes <= byMode.car.minutes);
  assert.ok(byMode.walking.minutes > byMode.car.minutes * 4);
  assert.ok(byMode.car.costPkr > byMode.motorbike.costPkr, 'car uses more petrol than a bike');
  assert.ok(byMode.rickshaw.costPkr > byMode.car.costPkr, 'ride-hailing costs more than petrol');
  assert.equal(byMode.walking.practical, false);
});

test('metro / orange line fare applies when both ends are near the same line', () => {
  const kalma = resolvePlace('metro-kalma-chowk');
  const azadi = resolvePlace('metro-azadi-chowk');
  const bus = estimateTravel({ lat: kalma.lat + 0.002, lng: kalma.lng }, { lat: azadi.lat, lng: azadi.lng + 0.002 }).modes.find((m) => m.mode === 'bus');
  assert.equal(bus.label, 'Metro Bus');
  assert.equal(bus.costPkr, 30);
});

test('petrol price is configurable through the environment', () => {
  const a = resolvePlace('johar-town');
  const b = resolvePlace('gulberg-3');
  const before = estimateTravel(a, b).modes.find((m) => m.mode === 'car').costPkr;
  process.env.PETROL_PRICE_PKR = '530';
  try {
    const after = estimateTravel(a, b).modes.find((m) => m.mode === 'car').costPkr;
    assert.ok(Math.abs(after - before * 2) <= 10, `${after} vs ${before}`);
  } finally {
    delete process.env.PETROL_PRICE_PKR;
  }
  assert.equal(normalizeMode('bike'), 'motorbike');
  assert.equal(normalizeMode('indrive'), 'rickshaw');
  assert.equal(normalizeMode('nonsense'), 'car');
});

test('optional routing falls back to the estimate when the router is unreachable', async () => {
  process.env.ROUTING_URL = 'http://127.0.0.1:9';
  try {
    const result = await travelBetween(resolvePlace('lums'), resolvePlace('gcu'));
    assert.equal(result.source, 'estimate');
    assert.equal(result.estimate, true);
  } finally {
    delete process.env.ROUTING_URL;
  }
});

// ---------------------------------------------------------------------------------------------
// HTTP endpoints (isolated in-memory database)
// ---------------------------------------------------------------------------------------------
let server;
let baseUrl;
let Property;

before(async () => {
  await connectDatabase({ ephemeral: true });
  ({ default: Property } = await import('../src/models/Property.js'));
  const { seedLahoreAreas } = await import('../src/utils/demoSeeder.js');
  const { default: propertyRoutes } = await import('../src/routes/properties.js');
  const { default: areaRoutes } = await import('../src/routes/areas.js');
  const { placesRouter, travelRouter } = await import('../src/routes/places.js');
  await seedLahoreAreas({ log: () => {} });
  const catalog = buildDemoCatalog();
  await Property.insertMany(catalog.map((item) => ({ ...item, updatedAt: new Date() })));
  const app = express();
  app.use(express.json());
  app.use('/api/properties', propertyRoutes);
  app.use('/api/areas', areaRoutes);
  app.use('/api/places', placesRouter);
  app.use('/api/travel', travelRouter);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await closeDatabase();
});

const getJson = async (path) => {
  const response = await fetch(`${baseUrl}${path}`);
  return { status: response.status, body: await response.json() };
};

test('GET /api/places searches areas and landmarks', async () => {
  const { status, body } = await getJson('/api/places?type=landmark&category=university&q=lums');
  assert.equal(status, 200);
  assert.equal(body.data[0].slug, 'lums');
  const areas = await getJson('/api/places?type=area');
  assert.ok(areas.body.data.length >= 60);
  const one = await getJson('/api/places/johar-town');
  assert.equal(one.body.data.slug, 'johar-town');
  assert.ok(one.body.data.nearbyLandmarks.university.length > 0);
  assert.equal((await getJson('/api/places/not-a-real-place-zzz')).status, 404);
});

test('GET /api/travel works with property ids, slugs and coordinates', async () => {
  const property = await Property.findOne({ seedKey: 'dha5-k-1kanal-house-rent' }).lean();
  const { status, body } = await getJson(`/api/travel?from=${property._id}&to=lums`);
  assert.equal(status, 200);
  assert.equal(body.estimate, true);
  assert.equal(body.from.kind, 'property');
  assert.ok(body.distanceKm > 0 && body.distanceKm < 5);
  assert.equal(body.modes.length, 5);
  const coords = await getJson('/api/travel?from=31.5204,74.3587&to=gcu');
  assert.equal(coords.status, 200);
  assert.equal((await getJson('/api/travel?from=lums')).status, 400);
});

test('GET /api/areas returns live stats and /api/areas/:slug the guide', async () => {
  const { body } = await getJson('/api/areas');
  const johar = body.data.find((area) => area.slug === 'johar-town');
  assert.ok(johar.stats.listingCount >= 10);
  assert.ok(johar.stats.rent.min > 0 && johar.stats.rent.max >= johar.stats.rent.avg);
  const dha = body.data.find((area) => area.slug === 'dha-lahore');
  const dha5 = body.data.find((area) => area.slug === 'dha-phase-5');
  assert.ok(dha.stats.listingCount > dha5.stats.listingCount, 'parent includes its phases');
  // older rows keep their fields
  assert.ok(body.data.every((area) => typeof area.name === 'string' && '_id' in area && 'active' in area));

  const guide = await getJson('/api/areas/johar-town');
  assert.equal(guide.status, 200);
  assert.equal(guide.body.data.slug, 'johar-town');
  assert.ok(guide.body.data.listings.length > 0);
  assert.ok(guide.body.data.nearbyLandmarks.hospital.length > 0);
});

test('GET /api/properties supports area, near, radius, maxMinutes and sort=distance', async () => {
  const dha = await getJson('/api/properties?area=dha-lahore');
  const dha5 = await getJson('/api/properties?area=dha-phase-5');
  assert.ok(dha.body.meta.total > dha5.body.meta.total && dha5.body.meta.total > 0);
  assert.ok(dha5.body.data.every((p) => p.areaSlug === 'dha-phase-5'));
  const askari1 = await getJson('/api/properties?area=askari-1');
  assert.ok(askari1.body.data.every((p) => p.phase === 'Askari 1'), 'askari-1 does not match askari-10/11');

  const near = await getJson('/api/properties?near=ucp&radiusKm=3&type=flat&sort=distance');
  assert.equal(near.status, 200);
  assert.ok(near.body.data.length >= 1);
  assert.ok(near.body.data.every((p) => p.distanceKm <= 3 && p.travel.estimate === true && p.propertyType === 'Flat'));
  const distances = near.body.data.map((p) => p.distanceKm);
  assert.deepEqual(distances, [...distances].sort((a, b) => a - b));

  const quick = await getJson('/api/properties?near=lums&maxMinutes=10&mode=bike');
  assert.ok(quick.body.data.every((p) => p.travel.minutes <= 10 && p.travel.mode === 'motorbike'));
  assert.equal((await getJson('/api/properties?near=nowhere-zzzz')).status, 400);
});

test('GET /api/properties/:id/nearby lists landmarks per category; missing coords get an approximate pin', async () => {
  const property = await Property.create({ title: 'Test house without pin', phase: 'Model Town', society: 'Model Town', city: 'Lahore', price: 50000 });
  assert.equal(property.locationApproximate, true);
  assert.equal(property.areaSlug, 'model-town');
  assert.ok(Math.abs(property.latitude - 31.483) < 0.01);

  const { status, body } = await getJson(`/api/properties/${property._id}/nearby`);
  assert.equal(status, 200);
  assert.ok(body.data.nearby.university.length > 0);
  const first = body.data.nearby.university[0];
  assert.ok(first.distanceKm > 0 && first.carMinutes > 0 && first.bikeMinutes > 0 && first.rickshawMinutes > 0);
  const hospitals = await getJson(`/api/properties/${property._id}/nearby?category=hospital&limit=2`);
  assert.equal(hospitals.body.data.nearby.hospital.length, 2);
});
