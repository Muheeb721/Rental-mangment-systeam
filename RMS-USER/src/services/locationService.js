import api from './api';
import { FALLBACK_PLACES, slugify } from '../data/lahorePlaces';

export { slugify };

export const CATEGORY_LABELS = {
  area: 'Areas',
  university: 'Universities',
  hospital: 'Hospitals',
  school: 'Schools',
  mall: 'Shopping',
  transport: 'Transport',
  park: 'Parks',
  mosque: 'Mosques',
};
export const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

export const TIER_LABELS = { premium: 'Premium', upscale: 'Upper-mid', mid: 'Mid-range', affordable: 'Budget' };
export const tierKey = (tier) => {
  if (tier == null || tier === '') return '';
  if (typeof tier === 'number') return ['', 'premium', 'upscale', 'mid', 'affordable'][tier] || 'mid';
  const t = String(tier).toLowerCase();
  if (/prem|luxury|elite|^a\+?$|1/.test(t)) return 'premium';
  if (/upscale|upper|high|^a$|2/.test(t)) return 'upscale';
  if (/afford|budget|low|econ|4/.test(t)) return 'affordable';
  return 'mid';
};

const num = (v) => (v === '' || v == null ? NaN : Number(v));

export function normalizePlace(raw = {}) {
  const name = raw.name || raw.title || '';
  const coords = Array.isArray(raw.location?.coordinates) ? raw.location.coordinates : null;
  const lat = num(raw.lat ?? raw.latitude ?? raw.centre?.lat ?? raw.center?.lat ?? (coords ? coords[1] : undefined));
  const lng = num(raw.lng ?? raw.longitude ?? raw.centre?.lng ?? raw.center?.lng ?? (coords ? coords[0] : undefined));
  const type = raw.type === 'area' || raw.category === 'area' ? 'area' : (raw.type || 'landmark');
  const parentRaw = raw.parent && typeof raw.parent === 'object' ? (raw.parent.slug || raw.parent.name) : raw.parent;
  return {
    name,
    slug: raw.slug || slugify(name),
    type,
    category: type === 'area' ? 'area' : String(raw.category || 'other').toLowerCase(),
    aliases: Array.isArray(raw.aliases) ? raw.aliases.filter(Boolean) : [],
    parent: parentRaw ? slugify(parentRaw) : '',
    parentName: raw.parent && typeof raw.parent === 'object' ? raw.parent.name || '' : '',
    lat,
    lng,
    tier: tierKey(raw.tier),
    description: raw.description || '',
    image: raw.image || raw.cover || raw.photo || '',
  };
}

const unwrap = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.items)) return res.data.items;
  if (Array.isArray(res?.places)) return res.places;
  if (Array.isArray(res?.areas)) return res.areas;
  if (Array.isArray(res?.items)) return res.items;
  return null;
};
/** Flatten `{ university: [...], hospital: [...] }` (or an array) into one list. */
const flattenCats = (v) => {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([cat, arr]) => (Array.isArray(arr) ? arr.map((x) => ({ category: cat, ...x })) : []));
  return [];
};
const unwrapObj = (res) => (res?.data && !Array.isArray(res.data) ? res.data : res);

async function tryGet(path, params) {
  try {
    const res = await api.request(path, { params });
    return res;
  } catch {
    return null;
  }
}

/* ---------------- places ---------------- */
let placesPromise = null;
let placesSource = 'fallback';
export const placesFromApi = () => placesSource === 'api';

export function getPlaces({ force = false } = {}) {
  if (placesPromise && !force) return placesPromise;
  placesPromise = (async () => {
    const res = await tryGet('/places', { limit: 1000 });
    const list = unwrap(res);
    if (list && list.length) {
      placesSource = 'api';
      return list.map(normalizePlace).filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng));
    }
    placesSource = 'fallback';
    return FALLBACK_PLACES.map(normalizePlace);
  })();
  placesPromise.catch(() => { placesPromise = null; });
  return placesPromise;
}

export const findPlace = (places, key) => {
  if (!key) return null;
  const k = String(key).trim();
  const s = slugify(k);
  return places.find((p) => p.slug === k || p.slug === s)
    || places.find((p) => slugify(p.name) === s || p.aliases.some((a) => slugify(a) === s))
    || null;
};

/* ---------------- fuzzy matching ---------------- */
const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();

function lev(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    let best = cur[0];
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

function scoreText(q, text) {
  const t = norm(text);
  if (!t) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 90 - Math.min(20, t.length - q.length);
  const words = t.split(' ');
  if (words.some((w) => w.startsWith(q))) return 75;
  if (t.includes(q)) return 65;
  const qWords = q.split(' ');
  // every query word is a prefix of (or close typo of) some word
  let total = 0;
  for (const qw of qWords) {
    let best = 0;
    for (const w of words) {
      if (w.startsWith(qw)) best = Math.max(best, 1);
      else if (qw.length >= 3 && lev(qw, w.slice(0, qw.length + 1), qw.length > 5 ? 2 : 1) <= (qw.length > 5 ? 2 : 1)) best = Math.max(best, 0.7);
    }
    if (!best) return 0;
    total += best;
  }
  const ratio = total / qWords.length;
  if (ratio >= 0.7) return Math.round(50 * ratio);
  // loose subsequence (e.g. "jtwn" → johar town)
  let i = 0;
  const flat = t.replace(/ /g, '');
  for (const ch of q.replace(/ /g, '')) { i = flat.indexOf(ch, i); if (i < 0) return 0; i += 1; }
  return q.length >= 3 ? 20 : 0;
}

export function searchPlaces(places, query, { limit = 30, types } = {}) {
  const q = norm(query);
  const pool = types ? places.filter((p) => types.includes(p.type)) : places;
  if (!q) return [];
  return pool
    .map((p) => {
      const s = Math.max(scoreText(q, p.name), ...p.aliases.map((a) => scoreText(q, a) - 3));
      return { p, s: s + (s && p.type === 'area' ? 2 : 0) };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name))
    .slice(0, limit)
    .map((x) => x.p);
}

export function groupPlaces(list) {
  const groups = new Map();
  list.forEach((p) => {
    const key = p.type === 'area' ? 'area' : p.category;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  });
  return [...groups.entries()]
    .sort((a, b) => (CATEGORY_ORDER.indexOf(a[0]) + 99 * (CATEGORY_ORDER.indexOf(a[0]) < 0)) - (CATEGORY_ORDER.indexOf(b[0]) + 99 * (CATEGORY_ORDER.indexOf(b[0]) < 0)))
    .map(([key, items]) => ({ key, label: CATEGORY_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1), items }));
}

/* ---------------- geo + travel estimates ---------------- */
export function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const ROAD_FACTOR = 1.35;
export const roadKm = (a, b) => Math.max(0.3, haversineKm(a, b) * ROAD_FACTOR);

const MODEL = [
  { mode: 'car', label: 'Car', kmh: 26, peakKmh: 16, cost: (km) => 24 * km },
  { mode: 'bike', label: 'Motorbike', kmh: 30, peakKmh: 23, cost: (km) => 7 * km },
  { mode: 'rickshaw', label: 'Rickshaw', kmh: 22, peakKmh: 14, cost: (km) => 100 + 45 * km },
  { mode: 'ride', label: 'Ride-hailing', kmh: 26, peakKmh: 16, cost: (km) => 180 + 60 * km },
];

export const estimateMinutes = (km, mode = 'car', peak = false) => {
  const m = MODEL.find((x) => x.mode === mode) || MODEL[0];
  return Math.max(2, Math.round((km / (peak ? m.peakKmh : m.kmh)) * 60 + 3));
};

export function estimateTravel(from, to) {
  const km = roadKm(from, to);
  return {
    distanceKm: Math.round(km * 10) / 10,
    estimate: true,
    modes: MODEL.map((m) => ({
      mode: m.mode,
      label: m.label,
      minutes: estimateMinutes(km, m.mode),
      minutesPeak: estimateMinutes(km, m.mode, true),
      costPkr: Math.round(m.cost(km) / 10) * 10,
    })),
  };
}

const hasLL = (x) => x && Number.isFinite(x.lat) && Number.isFinite(x.lng);
const llKey = (x) => `${x.lat.toFixed(5)},${x.lng.toFixed(5)}`;

function normalizeTravel(raw, fallback) {
  const d = unwrapObj(raw);
  if (!d || !Array.isArray(d.modes) || !d.modes.length) return null;
  return {
    ...fallback,
    ...d,
    distanceKm: Number(d.distanceKm ?? d.distance_km ?? fallback?.distanceKm) || 0,
    estimate: true,
    modes: d.modes.map((m) => ({
      mode: m.mode,
      label: m.label || m.mode,
      minutes: Number(m.minutes ?? m.time) || 0,
      minutesPeak: Number(m.minutesPeak ?? m.peakMinutes ?? m.minutes) || 0,
      costPkr: Number(m.costPkr ?? m.cost ?? 0) || 0,
    })),
  };
}

/** from/to: a place object, a property ({ id, lat, lng }), or { lat, lng }. */
export async function getTravel(from, to) {
  const ref = (x) => (x?.slug ? x.slug : x?.id && !x.slug ? x.id : hasLL(x) ? llKey(x) : '');
  const fallback = hasLL(from) && hasLL(to) ? estimateTravel(from, to) : null;
  const res = await tryGet('/travel', { from: ref(from), to: ref(to) });
  return normalizeTravel(res, fallback) || fallback;
}

/* ---------------- nearby ---------------- */
export function nearbyLocal(origin, places, { category, limit = 6 } = {}) {
  if (!hasLL(origin)) return [];
  return places
    .filter((p) => p.type !== 'area' && (!category || p.category === category))
    .map((p) => {
      const km = roadKm(origin, p);
      return { place: p, distanceKm: Math.round(km * 10) / 10, minutes: { car: estimateMinutes(km, 'car'), bike: estimateMinutes(km, 'bike'), rickshaw: estimateMinutes(km, 'rickshaw') } };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

function normalizeNearbyItem(it) {
  const place = normalizePlace(it.place || it.landmark || it);
  const t = it.minutes || it.travel || it.times || {};
  const pick = (mode) => {
    const v = t[mode] ?? it[`${mode}Minutes`];
    if (v && typeof v === 'object') return Number(v.minutes) || 0;
    if (Array.isArray(t)) return Number(t.find((m) => m.mode === mode)?.minutes) || 0;
    return Number(v) || 0;
  };
  const km = Number(it.distanceKm ?? it.distance_km ?? it.distance) || 0;
  return { place, distanceKm: Math.round(km * 10) / 10, minutes: { car: pick('car') || estimateMinutes(km, 'car'), bike: pick('bike') || estimateMinutes(km, 'bike'), rickshaw: pick('rickshaw') || estimateMinutes(km, 'rickshaw') } };
}

export async function getNearbyForProperty(property, { category, limit = 6 } = {}) {
  const res = await tryGet(`/properties/${property.id}/nearby`, { category, limit });
  const list = unwrap(res) || flattenCats(res?.data?.nearby ?? res?.nearby);
  if (list && list.length) {
    return list.map((it) => normalizeNearbyItem({ type: 'landmark', ...it }))
      .filter((x) => x.place.name && (!category || x.place.category === category))
      .sort((a, b) => a.distanceKm - b.distanceKm).slice(0, limit);
  }
  const places = await getPlaces();
  return nearbyLocal(property, places, { category, limit });
}

/* ---------------- areas ---------------- */
const avg = (arr) => (arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0);
const range = (arr) => ({ min: arr.length ? Math.min(...arr) : 0, avg: avg(arr), max: arr.length ? Math.max(...arr) : 0 });

/** Does a normalised property belong to an area (including its sub-areas)? */
export function propertyInArea(p, area, places = []) {
  if (!p || !area) return false;
  const rawSlug = p.raw?.areaSlug || p.raw?.area_slug || p.raw?.placeSlug;
  const children = [];
  const queue = [area.slug];
  while (queue.length && children.length < 200) {
    const slug = queue.shift();
    places.forEach((x) => { if (x.type === 'area' && x.parent === slug && !children.includes(x)) { children.push(x); queue.push(x.slug); } });
  }
  if (rawSlug && (rawSlug === area.slug || children.some((c) => c.slug === rawSlug))) return true;
  const hay = ` ${norm(`${p.phase} | ${p.society} | ${p.locationLabel} | ${p.address} | ${p.raw?.area_name || ''}`)} `;
  const names = [area.name, ...area.aliases, ...children.flatMap((c) => [c.name, ...c.aliases])];
  return names.some((n) => {
    const k = norm(n);
    return k.length >= 3 && hay.includes(` ${k} `);
  });
}

export function computeAreaStats(items) {
  const rent = items.filter((p) => p.isRent && p.price);
  const sale = items.filter((p) => !p.isRent && p.price);
  const byTypeMap = new Map();
  items.forEach((p) => {
    const cur = byTypeMap.get(p.type) || { type: p.type, count: 0, rents: [], sales: [] };
    cur.count += 1;
    if (p.price) (p.isRent ? cur.rents : cur.sales).push(p.price);
    byTypeMap.set(p.type, cur);
  });
  return {
    count: items.length,
    rentCount: rent.length,
    saleCount: sale.length,
    rent: range(rent.map((p) => p.price)),
    sale: range(sale.map((p) => p.price)),
    byType: [...byTypeMap.values()].map((t) => ({ type: t.type, count: t.count, avgRent: avg(t.rents), avgSale: avg(t.sales) })).sort((a, b) => b.count - a.count),
  };
}

function normalizeStats(raw = {}) {
  const s = raw.stats || raw;
  const r = (obj, prefix) => {
    const o = (s[prefix] && typeof s[prefix] === 'object' ? s[prefix] : null) || (s.prices?.[prefix]) || {};
    const cap = prefix.charAt(0).toUpperCase() + prefix.slice(1);
    return {
      min: Number(o.min ?? s[`min${cap}`] ?? s[`${prefix}Min`]) || 0,
      avg: Number(o.avg ?? o.average ?? s[`avg${cap}`] ?? s[`${prefix}Avg`]) || 0,
      max: Number(o.max ?? s[`max${cap}`] ?? s[`${prefix}Max`]) || 0,
    };
  };
  let byType = s.byType || s.types || [];
  if (byType && !Array.isArray(byType)) byType = Object.entries(byType).map(([type, v]) => ({ type, ...(typeof v === 'object' ? v : { count: v }) }));
  return {
    count: Number(s.listingCount ?? s.listings ?? s.count ?? s.total ?? s.totalListings) || 0,
    rentCount: Number(s.rentCount ?? s.forRent ?? s.rent?.count) || 0,
    saleCount: Number(s.saleCount ?? s.forSale ?? s.sale?.count) || 0,
    rent: r(s, 'rent'),
    sale: r(s, 'sale'),
    byType: byType.map((t) => ({
      type: t.type || t.propertyType || t._id || 'Other',
      count: Number(t.count ?? t.listingCount) || 0,
      avgRent: Number(t.avgRent ?? t.rent?.avg ?? t.rentAvg) || 0,
      avgSale: Number(t.avgSale ?? t.sale?.avg ?? t.saleAvg) || 0,
    })),
  };
}

const hasStats = (raw) => raw && (raw.stats || raw.listingCount != null || raw.count != null || raw.rentCount != null);

/** All Lahore areas with stats. Prefers /api/areas; computes from places + listings otherwise. */
export async function getAreas(properties = []) {
  const [res, places] = await Promise.all([tryGet('/areas'), getPlaces()]);
  const list = unwrap(res);
  const areaPlaces = places.filter((p) => p.type === 'area');
  if (list && list.length && list.some(hasStats)) {
    return list.map((raw) => {
      const base = normalizePlace({ ...findPlace(areaPlaces, raw.slug || raw.name), ...raw, type: 'area' });
      return { ...base, stats: normalizeStats(raw), source: 'api' };
    });
  }
  return areaPlaces.map((a) => ({ ...a, stats: computeAreaStats(properties.filter((p) => propertyInArea(p, a, places))), source: 'local' }));
}

export async function getAreaGuide(slug) {
  const res = await tryGet(`/areas/${encodeURIComponent(slug)}`);
  const d = unwrapObj(res);
  if (!d || (!d.name && !d.area)) return null;
  const core = d.area || d;
  const nearby = flattenCats(d.nearby || d.landmarks || d.nearbyLandmarks).map((x) => ({ type: 'landmark', ...x }));
  return {
    ...normalizePlace({ ...core, type: 'area' }),
    stats: normalizeStats(d.stats ? d : core),
    nearby: nearby.map(normalizeNearbyItem).sort((a, b) => a.distanceKm - b.distanceKm),
    sampleListings: unwrap(d.listings || d.sampleListings || d.properties) || [],
  };
}

/* ---------------- display helpers ---------------- */
export const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000 / 50) * 50} m` : `${(Math.round(km * 10) / 10).toFixed(1)} km`);
export const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim() : `${m} min`);
