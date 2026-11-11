import { FALLBACK_IMAGE } from './imageUtils';
import { resolveImageUrl } from './imageUrl';

const LOCAL_IMAGE_ROOT = '/images';
const catalogImageCache = {
  HOME: [],
  HOUSE: [],
  FLAT: [],
  APARTMENT: [],
  PROPERTY: [],
  DEMO: [],
  OTHER: [],
  __all: [],
  __pages: {},
  __loading: false,
};

const normalizeCatalogKey = (value = '') => {
  const text = String(value || '').trim().toUpperCase();
  if (text === 'HOUSES') return 'HOUSE';
  if (text === 'FLATS') return 'FLAT';
  if (text === 'APARTMENTS') return 'APARTMENT';
  if (text === 'PROPERTIES') return 'PROPERTY';
  if (text === 'HOME') return 'HOME';
  if (text === 'DEMO') return 'DEMO';
  return text || 'OTHER';
};

const loadCatalogImages = () => {
  if (typeof window === 'undefined' || catalogImageCache.__loading) return;
  catalogImageCache.__loading = true;

  fetch('/api/images', {
    headers: { Accept: 'application/json' },
  })
    .then((response) => response.json())
    .then((payload) => {
      if (!payload?.success) return;
      const items = Array.isArray(payload.data) ? payload.data : [];
      const next = { HOME: [], HOUSE: [], FLAT: [], APARTMENT: [], PROPERTY: [], DEMO: [], OTHER: [] };
      const pageMap = {};
      items.forEach((item) => {
        const key = normalizeCatalogKey(item.category || 'OTHER');
        const imageUrl = item.imageUrl || item.url || item.src || '';
        if (next[key]) next[key].push(imageUrl);
        const page = String(item.page || 'General').trim() || 'General';
        const section = String(item.section || 'General').trim() || 'General';
        if (!pageMap[page]) pageMap[page] = {};
        if (!pageMap[page][section]) pageMap[page][section] = [];
        if (imageUrl) pageMap[page][section].push(imageUrl);
      });
      Object.assign(catalogImageCache, next, { __all: items, __pages: pageMap });
    })
    .catch(() => undefined)
    .finally(() => {
      catalogImageCache.__loading = false;
    });
};

if (typeof window !== 'undefined') {
  loadCatalogImages();
}

export const resolveCatalogPageImage = (page = 'General', section = 'General', index = 0, fallback = '') => {
  const targetPage = String(page || 'General').trim() || 'General';
  const targetSection = String(section || 'General').trim() || 'General';
  const items = Array.isArray(catalogImageCache.__all) ? catalogImageCache.__all : [];
  const matches = items.filter((item) => {
    const itemPage = String(item.page || 'General').trim() || 'General';
    const itemSection = String(item.section || 'General').trim() || 'General';
    const pageMatch = !targetPage || itemPage.toLowerCase() === targetPage.toLowerCase() || itemPage.toLowerCase().includes(targetPage.toLowerCase()) || targetPage.toLowerCase().includes(itemPage.toLowerCase());
    const sectionMatch = !targetSection || targetSection.toLowerCase() === 'general' || itemSection.toLowerCase() === targetSection.toLowerCase() || itemSection.toLowerCase().includes(targetSection.toLowerCase()) || targetSection.toLowerCase().includes(itemSection.toLowerCase());
    return pageMatch && sectionMatch;
  });

  const imageUrls = matches.map((item) => item.imageUrl || item.url || item.src || '').filter(Boolean);
  if (imageUrls.length) {
    const idx = Math.abs(Number(index) || 0) % imageUrls.length;
    return imageUrls[idx];
  }

  return fallback || '';
};

const isBlockedRemoteImage = (src = '') => {
  if (!src || typeof src !== 'string') return true;
  if (src.startsWith('data:image/')) return false;
  if (src.startsWith('/')) return false;
  if (src.startsWith('http://') || src.startsWith('https://')) return false;
  return false;
};

const hashToPalette = (seed = 0, palette = []) => {
  const safe = Array.isArray(palette) && palette.length ? palette : ['#1c7ed6', '#2f9e44', '#f08c00', '#d9480f'];
  return safe[Math.abs(seed) % safe.length];
};

const buildGeneratedArtSvg = (type = 'Property', title = 'Property', index = 0) => {
  const safeType = String(type || 'Property').trim() || 'Property';
  const safeTitle = String(title || safeType).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const typePalette = {
    house: ['#1f7a8c', '#6bbf59', '#f5d76e', '#e76f51'],
    apartment: ['#2d6cdf', '#48bfe3', '#90e0ef', '#0a2342'],
    flat: ['#5c6ac4', '#8ecae6', '#b8f2e6', '#ffb703'],
    room: ['#7f5539', '#d8b4a0', '#f4d35e', '#2a9d8f'],
    hostel: ['#73a9ad', '#b5d99c', '#f6bd60', '#5f4b8b'],
    default: ['#0b5d8c', '#11a8ab', '#f4d35e', '#fe7f2d'],
  };
  const palette = typePalette[String(safeType).toLowerCase()] || typePalette.default;
  const background = hashToPalette(index + safeTitle.length, palette);
  const accentA = hashToPalette(index + 7, palette);
  const accentB = hashToPalette(index + 13, palette);
  const roof = hashToPalette(index + 19, palette);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" role="img" aria-label="${safeTitle}">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${background}"/>
          <stop offset="100%" stop-color="${accentA}"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#g)"/>
      <circle cx="980" cy="110" r="120" fill="${accentB}" opacity="0.18"/>
      <rect x="170" y="250" width="860" height="370" rx="28" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.35)"/>
      <rect x="220" y="300" width="260" height="180" rx="14" fill="rgba(255,255,255,0.16)"/>
      <rect x="510" y="300" width="220" height="180" rx="14" fill="rgba(255,255,255,0.12)"/>
      <rect x="760" y="300" width="210" height="180" rx="14" fill="rgba(255,255,255,0.16)"/>
      <path d="M180 250 L600 90 L1020 250" fill="none" stroke="${roof}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M330 250 L330 210 L870 210 L870 250" fill="${accentB}" opacity="0.7"/>
      <rect x="300" y="520" width="600" height="70" rx="16" fill="rgba(8,20,35,.18)"/>
      <text x="600" y="610" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="54" fill="#ffffff" font-weight="700">${safeType}</text>
      <text x="600" y="670" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="30" fill="rgba(255,255,255,0.9)" font-weight="600">${safeTitle.slice(0, 28)}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const PROVIDED_CATEGORY_IMAGES = {
  house: [
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1523217582562-09d0def993a6?auto=format&fit=crop&w=1200&q=80'
  ],
  flat: [
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1502005229762-ee1b2b93e0f5?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80'
  ],
  apartment: [
    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1567496898669-ee935f5f647a?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1515263487990-61b07816b324?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1502005096674-719299666c97?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1512915922686-57c11dde9b6b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80'
  ],
  room: [],
  hostel: [],
};

export const propertyAssets = {
  home: {
    houses: PROVIDED_CATEGORY_IMAGES.house,
    apartments: PROVIDED_CATEGORY_IMAGES.apartment,
    flats: PROVIDED_CATEGORY_IMAGES.flat
  },
  properties: {
    houses: PROVIDED_CATEGORY_IMAGES.house,
    apartments: PROVIDED_CATEGORY_IMAGES.apartment,
    flats: PROVIDED_CATEGORY_IMAGES.flat,
    rooms: PROVIDED_CATEGORY_IMAGES.room,
    hostels: PROVIDED_CATEGORY_IMAGES.hostel
  },
  demo: {
    houseTour: PROVIDED_CATEGORY_IMAGES.house,
    flatTour: PROVIDED_CATEGORY_IMAGES.flat,
    apartmentTour: PROVIDED_CATEGORY_IMAGES.apartment,
    roomTour: PROVIDED_CATEGORY_IMAGES.room
  }
};

export const PROPERTY_IMAGE_MAP = {
  '2 storey house': `${LOCAL_IMAGE_ROOT}/houses/house-2-storey.svg`,
  '3 storey house': `${LOCAL_IMAGE_ROOT}/houses/house-3-storey.svg`,
  '4 storey house': `${LOCAL_IMAGE_ROOT}/houses/house-4-storey.svg`,
  '5 storey house': `${LOCAL_IMAGE_ROOT}/houses/house-5-storey.svg`,
  '6 storey house': `${LOCAL_IMAGE_ROOT}/houses/house-6-storey.svg`,
  '7 storey house': `${LOCAL_IMAGE_ROOT}/houses/house-7-storey.svg`,
  'modern villa': `${LOCAL_IMAGE_ROOT}/houses/house-5-storey.svg`,
  'luxury house': `${LOCAL_IMAGE_ROOT}/houses/house-7-storey.svg`,
  'a block': `${LOCAL_IMAGE_ROOT}/apartments/a-block.svg`,
  'a block apartment': `${LOCAL_IMAGE_ROOT}/apartments/a-block.svg`,
  'b block': `${LOCAL_IMAGE_ROOT}/apartments/b-block.svg`,
  'b block apartment': `${LOCAL_IMAGE_ROOT}/apartments/b-block.svg`,
  'c block': `${LOCAL_IMAGE_ROOT}/apartments/c-block.svg`,
  'c block apartment': `${LOCAL_IMAGE_ROOT}/apartments/c-block.svg`,
  'park view flat': `${LOCAL_IMAGE_ROOT}/flats/flat-park-1.svg`,
  'park view flat 1': `${LOCAL_IMAGE_ROOT}/flats/flat-park-1.svg`,
  'park view flat 2': `${LOCAL_IMAGE_ROOT}/flats/flat-park-2.svg`,
  'park view flat 3': `${LOCAL_IMAGE_ROOT}/flats/flat-park-3.svg`,
  'modern flat': `${LOCAL_IMAGE_ROOT}/flats/flat-park-2.svg`,
  'luxury flat': `${LOCAL_IMAGE_ROOT}/flats/flat-park-3.svg`,
  'flat 1': `${LOCAL_IMAGE_ROOT}/flats/flat-park-1.svg`,
  'flat 2': `${LOCAL_IMAGE_ROOT}/flats/flat-park-2.svg`,
  'flat 3': `${LOCAL_IMAGE_ROOT}/flats/flat-park-3.svg`,
};

const categoryAliases = {
  house: 'houses',
  houses: 'houses',
  apartment: 'apartments',
  apartments: 'apartments',
  flat: 'flats',
  flats: 'flats',
  room: 'rooms',
  rooms: 'rooms'
};

const getDemoSectionKey = (type = '') => {
  const normalized = String(type).trim().toLowerCase();
  if (normalized.includes('house')) return 'houseTour';
  if (normalized.includes('apartment')) return 'apartmentTour';
  if (normalized.includes('flat')) return 'flatTour';
  if (normalized.includes('room')) return 'roomTour';
  return 'houseTour';
};

const imageFromTitle = (property = {}) => {
  const title = String(property?.title || property?.name || property?.type || '').trim().toLowerCase();
  const type = String(property?.type || property?.propertyType || property?.category || '').trim().toLowerCase();
  const composite = `${title} ${type}`.trim();

  const matches = Object.entries(PROPERTY_IMAGE_MAP).find(([key]) => {
    if (!key) return false;
    return composite.includes(key) || title.includes(key) || type.includes(key);
  });

  return matches ? matches[1] : null;
};

export const getSectionImageList = (section = 'properties', type = '') => {
  const normalizedType = String(type || '').trim().toLowerCase();
  const resolvedCategory = categoryAliases[normalizedType] || 'houses';

  if (section === 'home') return propertyAssets.home?.[resolvedCategory] || [];
  if (section === 'demo') return propertyAssets.demo?.[getDemoSectionKey(normalizedType)] || [];
  return propertyAssets.properties?.[resolvedCategory] || [];
};

export const resolveUniquePropertyImage = (property = {}, section = 'properties', index = 0) => {
  const textType = String(property?.type || property?.propertyType || property?.category || '').trim();
  const normalizedType = textType.toLowerCase();
  const categoryKey = normalizedType.includes('house') ? 'house'
    : normalizedType.includes('flat') ? 'flat'
    : normalizedType.includes('apartment') ? 'apartment'
    : normalizedType.includes('room') ? 'room'
    : normalizedType.includes('hostel') ? 'hostel'
    : '';

  const candidates = [];
  if (Array.isArray(property?.images) && property.images.length) {
    candidates.push(...property.images
      .map((src) => resolveImageUrl(typeof src === 'object' ? src?.url : src))
      .filter((src) => typeof src === 'string' && src.trim().length > 0 && !isBlockedRemoteImage(src)));
  }

  const primaryImage = typeof property?.image === 'object' ? property.image?.url : property?.image;
  if (primaryImage && !isBlockedRemoteImage(primaryImage)) {
    candidates.push(resolveImageUrl(primaryImage));
  } else if (property?.featuredImage?.url && !isBlockedRemoteImage(property.featuredImage.url)) {
    candidates.push(resolveImageUrl(property.featuredImage.url));
  }

  if (candidates.length) {
    const desiredIndex = Number.isFinite(Number(property?.imageIndex)) ? Number(property.imageIndex) : Number(index) || 0;
    return candidates[Math.abs(desiredIndex) % candidates.length];
  }

  const catalogKey = normalizeCatalogKey(categoryKey || textType || 'OTHER');
  const catalogList = (catalogImageCache[catalogKey] || []).filter((src) => typeof src === 'string' && src.trim().length > 0);
  if (catalogList.length) {
    const desiredIndex = Number.isFinite(Number(property?.imageIndex)) ? Number(property.imageIndex) : Number(index) || 0;
    const safeIndex = ((desiredIndex % catalogList.length) + catalogList.length) % catalogList.length;
    return catalogList[safeIndex];
  }

  if (categoryKey && Array.isArray(PROVIDED_CATEGORY_IMAGES[categoryKey]) && PROVIDED_CATEGORY_IMAGES[categoryKey].length) {
    const desiredIndex = Number.isFinite(Number(property?.imageIndex)) ? Number(property.imageIndex) : Number(index) || 0;
    const safeIndex = ((desiredIndex % PROVIDED_CATEGORY_IMAGES[categoryKey].length) + PROVIDED_CATEGORY_IMAGES[categoryKey].length) % PROVIDED_CATEGORY_IMAGES[categoryKey].length;
    return PROVIDED_CATEGORY_IMAGES[categoryKey][safeIndex];
  }

  const assetList = getSectionImageList(section, textType).filter((src) => !isBlockedRemoteImage(src));
  if (assetList.length) {
    const desiredIndex = Number.isFinite(Number(property?.imageIndex)) ? Number(property.imageIndex) : Number(index) || 0;
    const safeIndex = ((desiredIndex % assetList.length) + assetList.length) % assetList.length;
    return assetList[safeIndex];
  }

  const fallbackMatch = imageFromTitle(property);
  if (fallbackMatch && !isBlockedRemoteImage(fallbackMatch)) return fallbackMatch;

  const type = String(property?.type || property?.propertyType || property?.category || '').toLowerCase();
  if (type.includes('house')) return buildGeneratedArtSvg('House', property?.title || 'House', Number(index) || 1);
  if (type.includes('apartment')) return buildGeneratedArtSvg('Apartment', property?.title || 'Apartment', Number(index) || 2);
  if (type.includes('flat')) return buildGeneratedArtSvg('Flat', property?.title || 'Flat', Number(index) || 3);
  if (type.includes('room') || type.includes('hostel')) return buildGeneratedArtSvg('Hostel', property?.title || 'Hostel', Number(index) || 4);
  return buildGeneratedArtSvg('Property', property?.title || 'Property', Number(index) || 0);
};

export const getPropertyImage = (property = {}, section = 'properties', index = 0) => resolveUniquePropertyImage(property, section, index);

export const getPropertyGallery = (property = []) => {
  const explicit = Array.isArray(property?.images) && property.images.length ? property.images : [];
  const primary = getPropertyImage(property);
  if (explicit.length) return explicit;
  return [primary];
};

export default { PROPERTY_IMAGE_MAP, propertyAssets, getPropertyImage, getPropertyGallery, resolveUniquePropertyImage };
