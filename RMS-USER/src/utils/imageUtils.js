import { getPropertyImage } from './propertyImageCatalog';

const svgToDataUri = (label = 'RMS Property', accent = '#0b5d8c') => {
  const safeLabel = String(label || 'RMS Property').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#0b5d8c"/>
          <stop offset="100%" stop-color="${accent}"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#bg)"/>
      <circle cx="980" cy="120" r="150" fill="rgba(255,255,255,0.18)"/>
      <rect x="180" y="260" width="840" height="360" rx="30" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.35)"/>
      <path d="M180 260 L600 120 L1020 260" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="250" y="330" width="220" height="150" rx="18" fill="rgba(255,255,255,0.12)"/>
      <rect x="500" y="330" width="180" height="150" rx="18" fill="rgba(255,255,255,0.1)"/>
      <rect x="710" y="330" width="200" height="150" rx="18" fill="rgba(255,255,255,0.14)"/>
      <text x="600" y="620" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="54" font-weight="700" fill="#ffffff">RMS</text>
      <text x="600" y="675" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="28" fill="rgba(255,255,255,0.9)" font-weight="600">${safeLabel.slice(0, 24)}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const HERO_IMAGE = svgToDataUri('RMS Homes', '#0b5d8c');
export const FALLBACK_IMAGE = svgToDataUri('Property Listing', '#11a8ab');
export const HOUSE_FALLBACK = svgToDataUri('House Listing', '#1f7a8c');
export const APARTMENT_FALLBACK = svgToDataUri('Apartment Listing', '#2d6cdf');
export const FLAT_FALLBACK = svgToDataUri('Flat Listing', '#5c6ac4');
export const INTERIOR_FALLBACK = svgToDataUri('Interior Listing', '#0b5d8c');
export const VIDEO_PLACEHOLDER = svgToDataUri('Video Tour', '#8ecae6');

export function getPrimaryImage(property, index = 0, section = 'properties') {
  try {
    return getPropertyImage(property, section, index) || FALLBACK_IMAGE;
  } catch (e) {
    return FALLBACK_IMAGE;
  }
}

export default { getPrimaryImage };
