import { createContext, useContext, useEffect, useMemo, useState } from "react";
import propertyService from '../services/propertyService';
import { recordDashboardSubmission } from '../utils/dashboardSubmissionStorage.jsx';
import { add as addPriceHistory } from '../utils/priceHistoryStorage.jsx';
import { setVerified as setVerifiedStorage, isVerified as isPropertyVerified } from '../utils/propertyVerificationStorage.jsx';
import { createNotification } from '../services/notificationService.jsx';
import { addStoredNotification } from '../utils/notificationsStorage.jsx';
import { increment as incrementPropertyView, getCount as getPropertyViewCount } from '../utils/propertyViewsStorage.jsx';
import { recordAdminAction } from '../services/adminActivityService.jsx';
import { resolveImageUrl } from '../utils/imageUrl';

const STORAGE_KEY = "rms_properties";

const isBlockedRemoteImage = (src = '') => {
  if (!src || typeof src !== 'string') return true;
  if (src.startsWith('data:image/')) return false;
  if (src.startsWith('/')) return false;
  if (/^https?:\/\/source\.unsplash\.com\//i.test(src)) return true;
  if (src.startsWith('http://') || src.startsWith('https://')) return false;
  return false;
};

const buildGeneratedPropertyArt = (type = 'Property', title = 'Property', index = 0) => {
  const safeType = String(type || 'Property').trim() || 'Property';
  const safeTitle = String(title || safeType).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const palette = {
    house: ['#1f7a8c', '#6bbf59', '#f5d76e', '#e76f51'],
    apartment: ['#2d6cdf', '#48bfe3', '#90e0ef', '#0a2342'],
    flat: ['#5c6ac4', '#8ecae6', '#b8f2e6', '#ffb703'],
    room: ['#7f5539', '#d8b4a0', '#f4d35e', '#2a9d8f'],
    hostel: ['#73a9ad', '#b5d99c', '#f6bd60', '#5f4b8b'],
  };
  const colors = palette[String(safeType).toLowerCase()] || ['#0b5d8c', '#11a8ab', '#f4d35e', '#fe7f2d'];
  const bg = colors[(index + safeTitle.length) % colors.length];
  const accent = colors[(index + 2) % colors.length];
  const accent2 = colors[(index + 3) % colors.length];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${bg}"/>
          <stop offset="100%" stop-color="${accent}"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#bg)"/>
      <circle cx="980" cy="120" r="150" fill="${accent2}" opacity="0.2"/>
      <rect x="180" y="260" width="840" height="360" rx="30" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.35)"/>
      <path d="M180 260 L600 120 L1020 260" fill="none" stroke="${accent2}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="250" y="330" width="220" height="150" rx="18" fill="rgba(255,255,255,0.12)"/>
      <rect x="500" y="330" width="180" height="150" rx="18" fill="rgba(255,255,255,0.1)"/>
      <rect x="710" y="330" width="200" height="150" rx="18" fill="rgba(255,255,255,0.14)"/>
      <rect x="320" y="540" width="560" height="54" rx="16" fill="rgba(7,23,33,0.14)"/>
      <text x="600" y="610" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="54" font-weight="700" fill="#ffffff">${safeType}</text>
      <text x="600" y="668" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="28" fill="rgba(255,255,255,0.9)" font-weight="600">${safeTitle.slice(0, 28)}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const normalizeGeneratedImage = (value, type = 'Property', title = 'Property', index = 0) => {
  if (!value || typeof value !== 'string') return buildGeneratedPropertyArt(type, title, index);
  if (value.startsWith('data:image/')) return value;
  if (isBlockedRemoteImage(value)) return buildGeneratedPropertyArt(type, title, index);
  return resolveImageUrl(value);
};

const normalizePropertyState = (rawStatus) => {
  const value = String(rawStatus || '').trim();
  if (!value) return 'Available';
  const lowered = value.toLowerCase();
  if (['available', 'available now', 'ready', 'soon available'].includes(lowered)) return 'Available';
  if (['booked', 'occupied', 'reserved', 'approved', 'confirmed'].includes(lowered)) return 'Booked';
  if (['rented', 'leased', 'tenant occupied'].includes(lowered)) return 'Rented';
  if (['for rent', 'rent'].includes(lowered)) return 'For Rent';
  if (['sold', 'closed'].includes(lowered)) return 'Sold';
  if (['rejected', 'cancelled', 'canceled'].includes(lowered)) return 'Available';
  return value;
};

const normalizeProperty = (item = {}, fallbackId = Date.now(), usedImages = new Set()) => {
  // Accept both legacy string arrays and new object arrays {url, public_id}
  let imagesRaw = [];
  if (Array.isArray(item.images) && item.images.length) {
    imagesRaw = item.images.map((it) => {
      if (!it) return null;
      if (typeof it === 'string') return it;
      if (typeof it === 'object' && it.url) return it.url;
      return null;
    }).filter(Boolean);
  } else if (item.image || item.featuredImage?.url) {
    imagesRaw = [item.image || item.featuredImage.url];
  }

  const effectiveType = item.type || item.propertyType || item.category || 'Property';
  const merged = [];
  // Property images come only from the persisted API fields.
  for (const src of imagesRaw) {
    if (!src) continue;
    if (!merged.includes(src)) merged.push(src);
  }
  // Placeholder is only for records with no stored image.
  if (!merged.length) merged.push(buildGeneratedPropertyArt(effectiveType, item.title || 'Property', fallbackId));

  const cacheVersion = item.updatedAt ? new Date(item.updatedAt).getTime() : '';
  const images = merged.map((src) => {
    const normalized = normalizeGeneratedImage(src, effectiveType, item.title || 'Property', fallbackId);
    if (!cacheVersion || normalized.startsWith('data:') || normalized.includes('?')) return normalized;
    return `${normalized}?v=${cacheVersion}`;
  });

  const videos = Array.isArray(item.videos) && item.videos.length ? item.videos : (item.video ? [item.video] : []);
  const media3d = Array.isArray(item.media3d) && item.media3d.length ? item.media3d : (item.model3d ? [item.model3d] : []);

  // pick cover image; prefer provided item.image if it wasn't skipped
  const rawCoverImage = typeof item.image === 'object'
    ? item.image?.url
    : item.image || item.featuredImage?.url;
  let image = rawCoverImage && !usedImages?.has(rawCoverImage) && !isBlockedRemoteImage(rawCoverImage)
    ? normalizeGeneratedImage(rawCoverImage, effectiveType, item.title || 'Property', fallbackId)
    : images[0] || buildGeneratedPropertyArt(effectiveType, item.title || 'Property', fallbackId);
  if (cacheVersion && image && !image.startsWith('data:') && !image.includes('?')) {
    image = `${image}?v=${cacheVersion}`;
  }
  // mark the chosen cover as used to prevent reuse across properties
  try { if (usedImages && image) usedImages.add(image); } catch (e) {}

  const rawStatus = item.status || item.availability || item.availabilityStatus || 'Available';
  const normalizedStatus = normalizePropertyState(rawStatus);
  const transactionValue = String(
    item.transactionType || item.listingType || item.listing_type || item.purpose || '',
  ).trim().toLowerCase();
  const titleValue = String(item.title || item.name || '').trim().toLowerCase();
  const typeValue = String(item.type || item.propertyType || item.category || 'Property').trim().toLowerCase();
  const inferredTransaction =
    ['sale', 'sell', 'buy', 'purchase', 'for sale'].includes(transactionValue) || titleValue.includes('for sale') || titleValue.includes('sale')
      ? 'Sale'
      : ['rent', 'rental', 'for rent'].includes(transactionValue) || titleValue.includes('for rent') || titleValue.includes('rent')
        ? 'Rent'
        : ['house', 'apartment', 'villa', 'home'].includes(typeValue)
          ? 'Sale'
          : ['flat', 'room', 'studio'].includes(typeValue)
            ? 'Rent'
            : 'Sale';

  return {
    id: item._id || item.id || fallbackId,
    source: 'property',
    title: item.title || item.name || "Untitled Property",
    description: item.description || "Premium property managed through RMS.",
    price:
      item.price || item.rentPrice || item.salePrice || "Contact for price",
    rentPrice: item.rentPrice || item.price || "",
    salePrice: item.salePrice || "",
    type: item.type || "Property",
    listingType: item.listingType || item.listing_type || item.transactionType || item.purpose || "",
    transactionType: item.transactionType || item.listingType || item.listing_type || item.purpose || inferredTransaction,
    location: item.location || item.address || "Lahore",
    address: item.address || item.location || "Lahore",
    area: item.area || "Lahore",
    bedrooms: item.bedrooms ?? 0,
    bathrooms: item.bathrooms ?? 0,
    parking: item.parking ?? 1,
    status: normalizedStatus === 'Available Now' ? 'Available' : normalizedStatus === 'Ready' ? 'Available' : normalizedStatus === 'Soon Available' ? 'Available' : normalizedStatus,
    availability: normalizedStatus === 'Available Now' ? 'Available' : normalizedStatus === 'Ready' ? 'Available' : normalizedStatus === 'Soon Available' ? 'Available' : normalizedStatus,
    amenities: Array.isArray(item.amenities) ? item.amenities : [],
    contact: item.contact || "+92 300 1234567",
    owner: item.owner || "RMS Admin",
    image,
    images,
    videos,
    media3d,
    lat: item.lat ?? 31.5204,
    lng: item.lng ?? 74.3587,
    category: item.category || "Featured",
    verificationStatus: item.verificationStatus || 'Unverified',
    verified: Boolean(item.verified || item.verificationStatus === 'Verified'),
    views: Number(item.views || 0),
    favorites: Number(item.favorites || 0),
    demandScore: Number(item.demandScore || 0),
  };
};

const getInitialProperties = () => {
  // The backend is the source of truth for live listings.
  // Do not populate property listings from dummy data in production flows.
  return [];
};

const decodeTokenPayload = () => {
  try {
    const token = typeof window !== 'undefined' ? window.__RMS_AUTH_TOKEN || '' : '';
    if (!token || !token.includes('.')) return null;
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch (error) {
    return null;
  }
};

const isAdminSession = () => {
  const payload = decodeTokenPayload();
  return Boolean(payload && String(payload.role || '').toLowerCase() === 'admin');
};

const PropertyContext = createContext(null);

export function PropertyProvider({ children }) {
  const [properties, setProperties] = useState(getInitialProperties);

  // no persistent localStorage writes for properties; data should come from backend via API

  // fetch properties from backend on mount, replacing local data when available
  useEffect(() => {
    let mounted = true;
    let timer = null;
    let backendOffline = false;

    const stopPolling = () => {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    const loadProperties = async () => {
      try {
        const res = await propertyService.listProperties();
        if (!mounted) return;

        if (res && res.success && Array.isArray(res.data)) {
          const usedImages = new Set();
          setProperties(res.data.map((p, i) => normalizeProperty(p, i + 1, usedImages)));
          backendOffline = false;
          if (!timer) {
            timer = window.setInterval(loadProperties, 5000);
          }
          return;
        }

        backendOffline = true;
        stopPolling();
        setProperties([]);
      } catch (e) {
        if (!mounted) return;
        console.warn('Property listing load failed; leaving data empty until backend is reachable.', e);
        backendOffline = true;
        stopPolling();
        setProperties([]);
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        loadProperties();
      }
    };

    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    loadProperties();

    return () => {
      mounted = false;
      stopPolling();
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  const value = useMemo(
    () => ({
      properties,
      addProperty: async (property) => {
        if (!isAdminSession()) {
          console.warn('Only admin users can add property listings.');
          return null;
        }

        const usedImages = new Set((properties || []).map((p) => p.image).filter(Boolean));
        const nextProperty = normalizeProperty(
          { ...property, id: property.id || Date.now() },
          Date.now(),
          usedImages,
        );
        // attempt to create on server
        try {
          const res = await propertyService.createProperty(property);
          if (res && res.success) {
            const created = res.data;
            const normalized = normalizeProperty(created, created._id || Date.now());
            setProperties((prev) => [normalized, ...prev]);
            return normalized;
          }
        } catch (e) {
          // fallback to local
        }
        setProperties((prev) => [nextProperty, ...prev]);
        recordDashboardSubmission({
          id: `property-${nextProperty.id}`,
          source: 'property',
          formType: nextProperty.type || 'Property Listing',
          title: nextProperty.title,
          category: nextProperty.type,
          status: nextProperty.status || 'New',
          userName: nextProperty.owner || 'Property Manager',
          email: '',
          phone: nextProperty.contact || '',
          propertyType: nextProperty.type,
          location: nextProperty.address || nextProperty.location || '',
          price: nextProperty.price,
          description: nextProperty.description,
          submittedAt: new Date().toISOString(),
        });
        return nextProperty;
      },
      updateProperty: async (id, updates) => {
        if (!isAdminSession()) {
          console.warn('Only admin users can update property listings.');
          return null;
        }

        // try to update on server
        try {
          const res = await propertyService.updateProperty(id, updates);
          if (res && res.success) {
            const prop = normalizeProperty(res.data, res.data._id || id);
            setProperties((prev) => prev.map((p) => (String(p.id) === String(id) ? prop : p)));
            return prop;
          }
        } catch (e) {
          console.warn('Server update failed, falling back to local update', e);
        }
        // local fallback
        setProperties((prev) => prev.map((item) => (item.id !== id ? item : normalizeProperty({ ...item, ...updates, id }, id))));
      },
      setPropertyStatus: async (id, status) => {
        if (!isAdminSession()) {
          console.warn('Only admin users can change property status.');
          return null;
        }

        const prop = properties.find((p) => p.id === id);
        const previousStatus = prop?.status || 'Available';
        // try server update
        try {
          const res = await propertyService.updateProperty(id, { status });
          if (res && res.success) {
            const updated = normalizeProperty(res.data, res.data._id || id);
            setProperties((prev) => prev.map((p) => (String(p.id) === String(id) ? updated : p)));
          } else {
            setProperties((prev) => prev.map((p) => (p.id === id ? { ...p, status, availability: status } : p)));
          }
        } catch (e) {
          setProperties((prev) => prev.map((p) => (p.id === id ? { ...p, status, availability: status } : p)));
        }
        try {
          await recordAdminAction({
            actionType: 'PROPERTY_STATUS_CHANGED',
            entityType: 'PROPERTY',
            entityId: id,
            userId: prop?.ownerId || '',
            userName: prop?.owner || 'Property Owner',
            propertyName: prop?.title || 'Property',
            previousStatus,
            newStatus: status,
            message: `${prop?.title || 'Property'} status updated to ${status}.`,
            reason: 'Property status was updated by admin review.',
            description: `Admin changed property status for ${prop?.title || 'property'} to ${status}`,
          });
        } catch (e) {}
        try {
          const note = createNotification({ type: 'announcement', title: 'Property Status Changed', message: `${prop?.title || 'Property'} status updated to ${status}` });
          addStoredNotification(note);
        } catch (e) {}
      },
      setPropertyVerified: (id, verified) => {
        if (!isAdminSession()) {
          console.warn('Only admin users can verify properties.');
          return;
        }
        try {
          setVerifiedStorage(id, Boolean(verified));
        } catch (e) {
          console.error('setPropertyVerified', e);
        }
      },
      incrementPropertyView: (id) => {
        try {
          incrementPropertyView(id);
        } catch (e) {
          console.error('incrementPropertyView', e);
        }
      },
      getPropertyViewCount: (id) => getPropertyViewCount(id),
      deleteProperty: async (id) => {
        if (!isAdminSession()) {
          console.warn('Only admin users can delete property listings.');
          return null;
        }

        try {
          const res = await propertyService.deleteProperty?.(id);
          if (res && res.success) {
            setProperties((prev) => prev.filter((item) => String(item.id) !== String(id)));
            return true;
          }
        } catch (e) {
          console.warn('Backend delete failed for property.', e);
        }

        setProperties((prev) => prev.filter((item) => String(item.id) !== String(id)));
        return true;
      },
    }),
    [properties],
  );

  return (
    <PropertyContext.Provider value={value}>
      {children}
    </PropertyContext.Provider>
  );
}

export function useProperties() {
  const context = useContext(PropertyContext);

  if (!context) {
    throw new Error("useProperties must be used within a PropertyProvider");
  }

  return context;
}
