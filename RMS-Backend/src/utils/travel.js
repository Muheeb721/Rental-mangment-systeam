/**
 * Lahore travel-time and cost ESTIMATES.
 *
 * Road distance = straight-line (haversine) distance x ROAD_FACTOR. Each mode has a typical
 * Lahore door-to-door speed per distance band plus a peak-hour multiplier. Costs use
 * env-configurable petrol prices and ride-hailing fares. Every result carries `estimate: true`.
 *
 * Optional real routing: set ROUTING_URL to an OSRM-compatible server (e.g. http://localhost:5001)
 * and the car distance/time comes from /route/v1/driving (2 s timeout, in-memory cache), falling
 * back to the estimate on any error.
 */
import { LAHORE_LANDMARKS } from '../data/lahorePlaces.js';

const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const travelConfig = () => ({
  roadFactor: num(process.env.ROAD_FACTOR, 1.35),
  petrolPricePkr: num(process.env.PETROL_PRICE_PKR, 265),
  carKmPerLitre: num(process.env.CAR_KM_PER_LITRE, 12),
  bikeKmPerLitre: num(process.env.BIKE_KM_PER_LITRE, 40),
  rickshawBasePkr: num(process.env.RICKSHAW_BASE_FARE_PKR, 100),
  rickshawPerKmPkr: num(process.env.RICKSHAW_PER_KM_PKR, 40),
  rickshawMinFarePkr: num(process.env.RICKSHAW_MIN_FARE_PKR, 150),
  metroFarePkr: num(process.env.METRO_FARE_PKR, 30),
  orangeLineFarePkr: num(process.env.ORANGE_LINE_FARE_PKR, 40),
  busFarePkr: num(process.env.BUS_FARE_PKR, 60),
  stationWalkKm: num(process.env.STATION_WALK_KM, 1.5),
});

const toRad = (deg) => (deg * Math.PI) / 180;
export const haversineKm = (a, b) => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
};

export const roadDistanceKm = (a, b, factor = travelConfig().roadFactor) => haversineKm(a, b) * factor;

// km/h by distance band: [upTo km, speed]; the last band applies beyond.
const MODES = {
  car: { label: 'Car', bands: [[3, 18], [10, 26], [25, 34], [Infinity, 45]], peak: 1.5, overheadMin: 3 },
  motorbike: { label: 'Motorbike', bands: [[3, 22], [10, 30], [25, 36], [Infinity, 45]], peak: 1.25, overheadMin: 1 },
  rickshaw: { label: 'Rickshaw / InDrive', bands: [[3, 17], [10, 23], [25, 28], [Infinity, 35]], peak: 1.45, overheadMin: 6 },
  walking: { label: 'Walking', bands: [[Infinity, 4.5]], peak: 1, overheadMin: 0 },
};
const BUS = { label: 'Bus / Metro', localSpeed: 14, rapidSpeed: 27, waitMin: 8, peak: 1.2, walkSpeed: 4.5 };

const speedFor = (bands, km) => bands.find(([upTo]) => km <= upTo)[1];
const minutesFor = (mode, km) => MODES[mode].overheadMin + (km / speedFor(MODES[mode].bands, km)) * 60;
const round = (value) => Math.max(1, Math.round(value));
const roundCost = (value) => Math.round(value / 5) * 5;

const STATIONS = LAHORE_LANDMARKS.filter((place) => ['metro', 'orange-line'].includes(place.subCategory));
export const nearestStation = (point, line = null) => {
  let best = null;
  for (const station of STATIONS) {
    if (line && station.subCategory !== line) continue;
    const km = haversineKm(point, station);
    if (!best || km < best.km) best = { station, km };
  }
  return best;
};

/** Is "now" (Asia/Karachi) a peak hour? 8-10am and 5-8pm Mon-Sat. */
export const isPeakNow = (date = new Date()) => {
  const pk = new Date(date.getTime() + (5 * 60 + date.getTimezoneOffset()) * 60000);
  const hour = pk.getHours() + pk.getMinutes() / 60;
  return pk.getDay() !== 0 && ((hour >= 8 && hour < 10) || (hour >= 17 && hour < 20));
};

/** Public transport: rapid line (Metro Bus / Orange Line) when both ends are near the same line, else local bus/wagon. */
const busMode = (from, to, km, cfg) => {
  for (const line of ['metro', 'orange-line']) {
    const a = nearestStation(from, line);
    const b = nearestStation(to, line);
    if (a && b && a.station.slug !== b.station.slug && a.km <= cfg.stationWalkKm && b.km <= cfg.stationWalkKm) {
      const rideKm = roadDistanceKm(a.station, b.station, 1.15);
      const walkMin = ((a.km + b.km) * 1.25 / BUS.walkSpeed) * 60;
      const minutes = walkMin + BUS.waitMin / 2 + (rideKm / BUS.rapidSpeed) * 60;
      const fare = line === 'metro' ? cfg.metroFarePkr : cfg.orangeLineFarePkr;
      return {
        mode: 'bus', label: line === 'metro' ? 'Metro Bus' : 'Orange Line',
        minutes: round(minutes), minutesPeak: round(walkMin + BUS.waitMin + (rideKm / BUS.rapidSpeed) * 60 * 1.05),
        costPkr: fare, note: `${a.station.name} to ${b.station.name}; flat fare`, stations: { from: a.station.slug, to: b.station.slug },
      };
    }
  }
  const minutes = BUS.waitMin + (km / BUS.localSpeed) * 60;
  return {
    mode: 'bus', label: 'Local bus / wagon', minutes: round(minutes), minutesPeak: round(minutes * BUS.peak),
    costPkr: cfg.busFarePkr, note: km < 2 ? 'Short trip - walking is usually quicker' : 'Approximate wagon / feeder bus fare',
  };
};

/**
 * Estimate all travel modes between two points.
 * Options: { roadKm } to override the road distance (e.g. from OSRM), { carMinutes } to override car time.
 */
export const estimateTravel = (from, to, { roadKm = null, carMinutes = null, modes = null } = {}) => {
  const cfg = travelConfig();
  const km = roadKm ?? roadDistanceKm(from, to, cfg.roadFactor);
  const list = [];
  const want = (mode) => !modes || modes.includes(mode);

  if (want('car')) {
    const minutes = carMinutes ?? minutesFor('car', km);
    list.push({ mode: 'car', label: MODES.car.label, minutes: round(minutes), minutesPeak: round(minutes * MODES.car.peak), costPkr: roundCost((km / cfg.carKmPerLitre) * cfg.petrolPricePkr), note: 'Petrol cost only' });
  }
  if (want('motorbike')) {
    const minutes = minutesFor('motorbike', km);
    list.push({ mode: 'motorbike', label: MODES.motorbike.label, minutes: round(minutes), minutesPeak: round(minutes * MODES.motorbike.peak), costPkr: roundCost((km / cfg.bikeKmPerLitre) * cfg.petrolPricePkr), note: 'Petrol cost only' });
  }
  if (want('rickshaw')) {
    const minutes = minutesFor('rickshaw', km);
    const fare = Math.max(cfg.rickshawMinFarePkr, cfg.rickshawBasePkr + km * cfg.rickshawPerKmPkr);
    list.push({ mode: 'rickshaw', label: MODES.rickshaw.label, minutes: round(minutes), minutesPeak: round(minutes * MODES.rickshaw.peak), costPkr: roundCost(fare), note: 'Typical fare; ride-hailing surges at peak times' });
  }
  if (want('bus')) list.push(busMode(from, to, km, cfg));
  if (want('walking')) {
    const minutes = minutesFor('walking', km);
    list.push({ mode: 'walking', label: MODES.walking.label, minutes: round(minutes), minutesPeak: round(minutes), costPkr: 0, practical: km <= 3 });
  }
  return { distanceKm: Number(km.toFixed(2)), estimate: true, peakNow: isPeakNow(), modes: list };
};

/** Compact summary used for list results: car / motorbike / rickshaw minutes. */
export const quickTravel = (from, to) => {
  const { distanceKm, modes } = estimateTravel(from, to, { modes: ['car', 'motorbike', 'rickshaw'] });
  const byMode = Object.fromEntries(modes.map((m) => [m.mode, m]));
  return {
    distanceKm,
    estimate: true,
    carMinutes: byMode.car.minutes,
    bikeMinutes: byMode.motorbike.minutes,
    rickshawMinutes: byMode.rickshaw.minutes,
    rickshawCostPkr: byMode.rickshaw.costPkr,
  };
};

const MODE_ALIASES = { bike: 'motorbike', motorcycle: 'motorbike', walk: 'walking', foot: 'walking', metro: 'bus', 'orange-line': 'bus', transit: 'bus', indrive: 'rickshaw', careem: 'rickshaw', uber: 'rickshaw', taxi: 'rickshaw' };
export const normalizeMode = (mode) => {
  const key = String(mode || 'car').toLowerCase();
  const resolved = MODE_ALIASES[key] || key;
  return ['car', 'motorbike', 'rickshaw', 'bus', 'walking'].includes(resolved) ? resolved : 'car';
};

/** Minutes for one mode (used by maxMinutes filters). */
export const minutesByMode = (from, to, mode = 'car') => {
  const result = estimateTravel(from, to, { modes: [normalizeMode(mode)] });
  return result.modes[0]?.minutes ?? null;
};

// ---------------------------------------------------------------------------------------------
// Optional OSRM routing
// ---------------------------------------------------------------------------------------------
const routeCache = new Map();
const CACHE_MAX = 2000;

export const fetchRoute = async (from, to) => {
  const base = String(process.env.ROUTING_URL || '').trim().replace(/\/+$/, '');
  if (!base) return null;
  const key = [from.lat, from.lng, to.lat, to.lng].map((v) => Number(v).toFixed(4)).join(',');
  if (routeCache.has(key)) return routeCache.get(key);
  try {
    const url = `${base}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
    const response = await fetch(url, { signal: AbortSignal.timeout(num(process.env.ROUTING_TIMEOUT_MS, 2000)) });
    if (!response.ok) return null;
    const data = await response.json();
    const route = data?.routes?.[0];
    if (!route || !Number.isFinite(route.distance)) return null;
    const result = { distanceKm: route.distance / 1000, durationMin: route.duration / 60 };
    if (routeCache.size >= CACHE_MAX) routeCache.delete(routeCache.keys().next().value);
    routeCache.set(key, result);
    return result;
  } catch {
    return null;
  }
};

/** Travel estimate using OSRM when configured, otherwise the haversine model. */
export const travelBetween = async (from, to) => {
  const route = await fetchRoute(from, to);
  if (route) {
    // OSRM free-flow times are optimistic for Lahore; add 25% congestion.
    const result = estimateTravel(from, to, { roadKm: route.distanceKm, carMinutes: route.durationMin * 1.25 + 3 });
    return { ...result, source: 'osrm' };
  }
  return { ...estimateTravel(from, to), source: 'estimate' };
};
