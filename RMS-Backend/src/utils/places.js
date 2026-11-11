/**
 * Pure helpers over the Lahore places dataset: fuzzy search, slug lookup, area hierarchy and
 * "which area does this listing belong to" resolution. No database access here.
 */
import { LAHORE_AREAS, LAHORE_LANDMARKS } from '../data/lahorePlaces.js';

const ROMAN = { ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10', xi: '11', xii: '12' };

/** lower-case, strip punctuation, unify spellings ("ph" -> "phase", roman numerals -> digits). */
export const normalizeText = (value) => {
  const tokens = String(value ?? '')
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return tokens
    .map((token, index) => {
      if (token === 'ph') return 'phase';
      if (token === 'defense') return 'defence';
      if (ROMAN[token] && index > 0) return ROMAN[token];
      if (token === 'i' && index > 0 && index === tokens.length - 1) return '1';
      return token;
    })
    .join(' ');
};

const ALL_PLACES = [...LAHORE_AREAS, ...LAHORE_LANDMARKS];
const BY_SLUG = new Map(ALL_PLACES.map((place) => [place.slug, place]));

// every normalised name / alias / slug -> place
const termsFor = (place) => [...new Set([place.name, place.slug.replace(/-/g, ' '), ...place.aliases].map(normalizeText).filter(Boolean))];
const TERMS = ALL_PLACES.map((place) => ({ place, terms: termsFor(place) }));

const levenshtein = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
};

const scoreTerm = (query, term) => {
  if (term === query) return 100;
  if (term.startsWith(`${query} `) || term.startsWith(query)) return 85 - Math.min(20, term.length - query.length);
  if (new RegExp(`\\b${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(term)) return 70;
  if (term.includes(query) && query.length >= 3) return 60;
  if (query.length >= 4) {
    const distance = levenshtein(query, term);
    const allowed = query.length >= 8 ? 2 : 1;
    if (distance <= allowed) return 55 - distance * 5;
    // token-wise fuzzy: every query token close to some term token
    const qTokens = query.split(' ');
    const tTokens = term.split(' ');
    const matched = qTokens.filter((qt) => tTokens.some((tt) => tt === qt || (qt.length >= 4 && levenshtein(qt, tt) <= 1) || (qt.length >= 3 && tt.startsWith(qt))));
    if (matched.length === qTokens.length) return 40 + Math.min(10, matched.length * 2);
  }
  return 0;
};

/**
 * Fuzzy place search. Options: type ('area' | 'landmark'), category, limit.
 * Returns places sorted by score with a `score` field.
 */
export const searchPlaces = (q = '', { type = '', category = '', limit = 50 } = {}) => {
  const query = normalizeText(q);
  const wantType = String(type || '').toLowerCase();
  const wantCategory = String(category || '').toLowerCase();
  const results = [];
  for (const { place, terms } of TERMS) {
    if (wantType && place.type !== wantType) continue;
    if (wantCategory && place.category !== wantCategory && place.subCategory !== wantCategory && place.tier !== wantCategory) continue;
    const score = query ? Math.max(...terms.map((term) => scoreTerm(query, term))) : 1;
    if (score > 0) results.push({ ...place, score });
  }
  results.sort((a, b) => b.score - a.score || (a.type === b.type ? 0 : a.type === 'area' ? -1 : 1) || a.name.localeCompare(b.name));
  return results.slice(0, Math.max(1, limit));
};

export const getPlace = (slug) => BY_SLUG.get(String(slug || '').toLowerCase()) || null;
export const getArea = (slug) => {
  const place = getPlace(slug);
  return place?.type === 'area' ? place : null;
};

/** Exact slug, else the best fuzzy match (score >= 45) of the requested type. */
export const resolvePlace = (text, { type = '' } = {}) => {
  const direct = getPlace(text);
  if (direct && (!type || direct.type === type)) return direct;
  const [best] = searchPlaces(text, { type, limit: 1 });
  return best && best.score >= 45 ? BY_SLUG.get(best.slug) : null;
};

export const childAreas = (slug) => LAHORE_AREAS.filter((area) => area.parent === slug);
/** The area plus all of its descendants (phases / sectors stored as separate areas). */
export const areaFamily = (slug) => {
  const root = getArea(slug);
  if (!root) return [];
  const out = [root];
  for (let i = 0; i < out.length; i += 1) out.push(...childAreas(out[i].slug));
  return out;
};

export const CORRIDORS = new Set(['bedian-road', 'raiwind-road', 'ferozepur-road', 'multan-road', 'ghazi-road', 'mall-road']);

// longest-first list of (normalised term -> area) used to find an area inside free text
const AREA_TERMS = LAHORE_AREAS
  .flatMap((area) => termsFor(area).filter((term) => term.length >= 4 || /\d/.test(term)).map((term) => ({ term, area })))
  // road corridors ("Bedian Road") only win when no society name is present in the text
  .sort((a, b) => Number(CORRIDORS.has(a.area.slug)) - Number(CORRIDORS.has(b.area.slug)) || b.term.length - a.term.length);
const AREA_TERM_REGEX = new Map(AREA_TERMS.map(({ term }) => [term, new RegExp(`(^| )${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`)]));

/** Which area does a free-text location ("DHA Phase 5, Lahore", "R-1 Block Johar Town") refer to? */
export const findAreaInText = (text) => {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  for (const { term, area } of AREA_TERMS) {
    if (AREA_TERM_REGEX.get(term).test(normalized)) return area;
  }
  return null;
};

/** Best area for a property document (uses phase first, then society/location/address). */
export const resolveAreaForProperty = (property = {}) => {
  if (property.areaSlug && getArea(property.areaSlug)) return getArea(property.areaSlug);
  const candidates = [
    property.phase,
    [property.society, property.phase].filter(Boolean).join(' '),
    property.location,
    property.society,
    property.address,
  ];
  for (const candidate of candidates) {
    const area = findAreaInText(candidate);
    if (area) return area;
  }
  return null;
};

/** Parse "31.47,74.41" into { lat, lng } (or null). */
export const parseLatLng = (value) => {
  const match = String(value ?? '').trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
};

/** Deterministic small offset (up to ~600 m) from a seed string so approximate pins do not overlap. */
export const approximateOffset = (seed = '') => {
  let hash = 0;
  for (const char of String(seed)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const angle = (hash % 360) * (Math.PI / 180);
  const radius = 0.0015 + ((hash >>> 9) % 40) / 10000; // ~0.17 - 0.6 km
  return { dLat: Math.sin(angle) * radius, dLng: Math.cos(angle) * radius };
};

export { LAHORE_AREAS, LAHORE_LANDMARKS };
