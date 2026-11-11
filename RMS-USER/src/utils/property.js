import { resolveImageUrl } from './imageUrl';

const nf = new Intl.NumberFormat('en-US');

export const formatNumber = (n) => (Number.isFinite(Number(n)) ? nf.format(Math.round(Number(n))) : '0');

const trimZeros = (v) => String(Number(v.toFixed(2)));

/** Compact PKR amount: "PKR 2.5 Crore", "PKR 85 Lakh", "PKR 85,000". */
export function formatPKR(amount, { compact = true } = {}) {
  const n = Number(amount) || 0;
  if (!n) return 'Price on request';
  if (compact && n >= 10000000) return `PKR ${trimZeros(n / 10000000)} Crore`;
  if (compact && n >= 1000000) return `PKR ${trimZeros(n / 100000)} Lakh`;
  return `PKR ${nf.format(Math.round(n))}`;
}

export function formatPrice(property) {
  const p = property || {};
  if (!p.price) return { amount: 'Price on request', suffix: '' };
  if (p.isRent) return { amount: formatPKR(p.price, { compact: false }), suffix: '/ month' };
  return { amount: formatPKR(p.price), suffix: '' };
}

export const priceText = (property) => {
  const { amount, suffix } = formatPrice(property);
  return suffix ? `${amount} ${suffix}` : amount;
};

const SQFT_PER_MARLA = 225;

export function parseArea(area, unit = '') {
  if (typeof area === 'number') return { n: area, u: String(unit || '').toLowerCase() };
  const str = String(area ?? '').trim();
  const m = str.match(/([\d.,]+)\s*(.*)$/);
  const n = m ? Number(m[1].replace(/,/g, '')) : 0;
  return { n: Number.isFinite(n) ? n : 0, u: String(unit || (m && m[2]) || '').toLowerCase() };
}

/** Area in square feet, used for sorting across mixed units. */
export function areaInSqft(area, unit = '') {
  const { n, u } = parseArea(area, unit);
  if (u.includes('kanal')) return n * 20 * SQFT_PER_MARLA;
  if (u.includes('marla')) return n * SQFT_PER_MARLA;
  if (u.includes('yd') || u.includes('yard')) return n * 9;
  return n;
}

export function formatArea(area, unit = '') {
  const { n, u } = parseArea(area, unit);
  if (!n) return { label: '', alt: '' };
  if (u.includes('kanal')) return { label: `${trimZeros(n)} Kanal`, alt: `${formatNumber(n * 20 * SQFT_PER_MARLA)} sq ft` };
  if (u.includes('marla')) return { label: `${trimZeros(n)} Marla`, alt: `${formatNumber(n * SQFT_PER_MARLA)} sq ft` };
  if (u.includes('yd') || u.includes('yard')) return { label: `${formatNumber(n)} sq yd`, alt: '' };
  const label = `${formatNumber(n)} sq ft`;
  let alt = '';
  if (n >= 900) {
    const marla = n / SQFT_PER_MARLA;
    alt = marla >= 20 ? `≈ ${trimZeros(Math.round((marla / 20) * 10) / 10)} Kanal` : `≈ ${trimZeros(Math.round(marla * 10) / 10)} Marla`;
  }
  return { label, alt };
}

const isPlaceholderImage = (url) => typeof url === 'string' && /^data:image\/svg\+xml/i.test(url);

const imageUrlOf = (item) => {
  if (!item) return '';
  if (typeof item === 'string') return item;
  return item.url || item.secure_url || item.src || item.path || '';
};

export function collectImages(raw = {}) {
  const list = [];
  const push = (value) => {
    const url = imageUrlOf(value);
    if (!url || isPlaceholderImage(url)) return;
    const resolved = resolveImageUrl(url);
    if (resolved && !list.includes(resolved)) list.push(resolved);
  };
  push(raw.featuredImage);
  (Array.isArray(raw.images) ? raw.images : []).forEach(push);
  push(raw.image);
  push(raw.coverImage);
  return list;
}

// Approximate centroids, used only when a listing has no coordinates.
const AREA_COORDS = [
  [/phase\s*1\b/i, [31.4805, 74.3925]],
  [/phase\s*2\b/i, [31.4727, 74.4122]],
  [/phase\s*3\b/i, [31.4772, 74.3793]],
  [/phase\s*4\b/i, [31.4683, 74.3866]],
  [/phase\s*5\b/i, [31.4632, 74.4103]],
  [/phase\s*6\b/i, [31.4718, 74.4515]],
  [/phase\s*7\b/i, [31.4547, 74.4712]],
  [/phase\s*8\b/i, [31.4906, 74.4282]],
  [/phase\s*9\b/i, [31.4485, 74.4932]],
  [/askari\s*10/i, [31.5206, 74.4025]],
  [/askari\s*11/i, [31.4505, 74.3842]],
];

const DHA_RE = /\bDHA\b|defen[cs]e/i;
const ASKARI_RE = /askari/i;

export function normalizeProperty(raw = {}) {
  const id = String(raw._id || raw.id || '');
  const purposeRaw = `${raw.purpose || ''} ${raw.listingType || ''} ${raw.transactionType || ''} ${raw.status || ''}`.toLowerCase();
  const isSale = /sale|sell|buy/.test(purposeRaw) && !/rent/.test(String(raw.purpose || raw.listingType || '').toLowerCase());
  const isRent = !isSale;
  const price = Number(isRent ? (raw.rent || raw.price) : (raw.salePrice || raw.price)) || 0;
  const type = raw.propertyType || raw.type || raw.category || 'Property';
  const phase = raw.phase || raw.location || '';
  const block = raw.block && !String(phase).includes(raw.block) ? raw.block : '';
  const city = raw.city || 'Lahore';
  const hay = `${raw.society || ''} ${raw.title || ''} ${raw.address || ''} ${raw.location || ''} ${raw.phase || ''}`;
  const society = raw.society || (ASKARI_RE.test(hay) ? 'Askari' : DHA_RE.test(hay) ? 'DHA' : '');
  const area = formatArea(raw.area, raw.areaUnit || raw.unit);
  const images = collectImages(raw);
  const statusText = `${raw.status || ''} ${raw.availability || ''}`.toLowerCase();
  let statusKey = 'available';
  if (/inactive|unavailable/.test(statusText)) statusKey = 'inactive';
  else if (/sold/.test(statusText)) statusKey = 'sold';
  else if (/rented|occupied/.test(statusText)) statusKey = 'rented';
  else if (/booked/.test(statusText)) statusKey = 'booked';
  else if (/reserved/.test(statusText)) statusKey = 'reserved';
  const available = statusKey === 'available';
  // Listed publicly by default: available and reserved; booked/rented/sold/inactive only when asked for.
  const listed = statusKey === 'available' || statusKey === 'reserved';

  let lat = Number(raw.latitude ?? raw.lat ?? raw.coordinates?.lat);
  let lng = Number(raw.longitude ?? raw.lng ?? raw.coordinates?.lng);
  let approximate = false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (!lat && !lng)) {
    lat = NaN; lng = NaN;
    const match = AREA_COORDS.find(([re]) => re.test(`${raw.phase || ''} ${raw.location || ''} ${raw.address || ''}`));
    if (match) { [lat, lng] = match[1]; approximate = true; }
  }

  if (raw.locationApproximate === true) approximate = true;
  const locationParts = [block, phase].filter(Boolean);
  const locationLabel = `${locationParts.join(', ') || city}${city && !locationParts.join(' ').includes(city) ? `, ${city}` : ''}`;

  return {
    id,
    raw,
    title: raw.title || `${type} for ${isRent ? 'Rent' : 'Sale'} in ${phase || city}`,
    description: raw.description || '',
    type,
    purpose: isRent ? 'Rent' : 'Sale',
    isRent,
    price,
    phase,
    block,
    city,
    society,
    address: raw.address || locationLabel,
    locationLabel,
    bedrooms: Number(raw.bedrooms) || 0,
    bathrooms: Number(raw.bathrooms) || 0,
    area: areaInSqft(raw.area, raw.areaUnit || raw.unit),
    areaLabel: area.label,
    areaAlt: area.alt,
    furnished: raw.furnished || '',
    amenities: Array.isArray(raw.amenities) ? raw.amenities.filter(Boolean) : [],
    images,
    cover: images[0] || '',
    lat,
    lng,
    approximate,
    available,
    listed,
    statusKey,
    statusLabel: { available: 'Available', reserved: 'Reserved', booked: 'Booked', rented: 'Rented', sold: 'Sold', inactive: 'Inactive' }[statusKey],
    featured: Boolean(raw.isFeatured),
    deposit: Number(raw.deposit) || 0,
    otherCharges: Number(raw.otherCharges) || 0,
    floor: Number(raw.floor) || 0,
    totalFloors: Number(raw.totalFloors) || 0,
    owner: {
      name: raw.ownerName || raw.managerName || '',
      phone: raw.ownerPhone || '',
      email: raw.ownerEmail || '',
    },
    offer: raw.offerEnabled && Number(raw.discountPercent) > 0 ? Number(raw.discountPercent) : 0,
    createdAt: raw.createdAt || '',
    updatedAt: raw.updatedAt || '',
    views: Number(raw.views || raw.viewCount) || 0,
  };
}

/** Sale price per marla (225 sq ft), or 0 when it can't be worked out. */
export function pricePerMarla(p) {
  if (!p || p.isRent || !p.price || !p.area) return 0;
  const marla = p.area / SQFT_PER_MARLA;
  return marla >= 0.5 ? Math.round(p.price / marla) : 0;
}

export const PROPERTY_TYPES = ['House', 'Apartment', 'Flat', 'Room', 'Plot', 'Commercial'];

export const timeAgo = (value) => {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff)) return '';
  const d = Math.floor(diff / 86400000);
  if (d < 1) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 30) return `${d} days ago`;
  const m = Math.floor(d / 30);
  return m < 12 ? `${m} month${m > 1 ? 's' : ''} ago` : `${Math.floor(m / 12)} yr ago`;
};

export const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
