/**
 * Realistic demo listings across Lahore. Photos live in public/images/demo-photos
 * (Unsplash licence) and are served at /images/demo-photos/<file>.
 */
import { getArea, resolveAreaForProperty, approximateOffset } from './places.js';

const PHOTO_BASE = '/images/demo-photos';
const photo = (name) => `${PHOTO_BASE}/${name}.jpg`;
const pad = (n) => String(n).padStart(2, '0');
const pickCycle = (prefix, count, index) => photo(`${prefix}-${pad((index % count) + 1)}`);

const LOCATIONS = {
  'DHA Phase 1': { society: 'DHA', lat: 31.4733, lng: 74.3864 },
  'DHA Phase 2': { society: 'DHA', lat: 31.4589, lng: 74.4123 },
  'DHA Phase 3': { society: 'DHA', lat: 31.4748, lng: 74.3779 },
  'DHA Phase 4': { society: 'DHA', lat: 31.4642, lng: 74.3893 },
  'DHA Phase 5': { society: 'DHA', lat: 31.4629, lng: 74.4102 },
  'DHA Phase 6': { society: 'DHA', lat: 31.4719, lng: 74.4498 },
  'DHA Phase 7': { society: 'DHA', lat: 31.4421, lng: 74.4633 },
  'DHA Phase 8': { society: 'DHA', lat: 31.4882, lng: 74.4301 },
  'Askari 10': { society: 'Askari', lat: 31.5043, lng: 74.4006 },
  'Askari 11': { society: 'Askari', lat: 31.4512, lng: 74.4517 },
};

// [key, type, purpose, price, area, unit, beds, baths, phase, block, furnished, featured]
const ROWS = [
  ['dha5-k-1kanal-house-rent', 'House', 'Rent', 350000, 1, 'Kanal', 5, 6, 'DHA Phase 5', 'K Block', 'Semi-Furnished', true],
  ['dha6-c-10marla-house-rent', 'House', 'Rent', 185000, 10, 'Marla', 4, 5, 'DHA Phase 6', 'C Block', 'Unfurnished', true],
  ['dha8-ex-park-5marla-house-rent', 'House', 'Rent', 95000, 5, 'Marla', 3, 4, 'DHA Phase 8', 'Ex Park View', 'Unfurnished', false],
  ['dha4-cc-10marla-house-rent', 'House', 'Rent', 165000, 10, 'Marla', 4, 4, 'DHA Phase 4', 'CC Block', 'Furnished', false],
  ['dha1-h-1kanal-house-rent', 'House', 'Rent', 300000, 1, 'Kanal', 5, 5, 'DHA Phase 1', 'H Block', 'Unfurnished', false],
  ['dha3-y-1kanal-upper-rent', 'House', 'Rent', 140000, 1, 'Kanal', 3, 3, 'DHA Phase 3', 'Y Block', 'Unfurnished', false],
  ['dha7-u-5marla-house-rent', 'House', 'Rent', 85000, 5, 'Marla', 3, 3, 'DHA Phase 7', 'U Block', 'Unfurnished', false],
  ['askari11-b-10marla-house-rent', 'House', 'Rent', 130000, 10, 'Marla', 4, 4, 'Askari 11', 'Sector B', 'Unfurnished', false],
  ['askari10-f-1kanal-house-rent', 'House', 'Rent', 260000, 1, 'Kanal', 5, 5, 'Askari 10', 'Sector F', 'Semi-Furnished', true],
  ['dha2-q-10marla-house-rent', 'House', 'Rent', 170000, 10, 'Marla', 4, 5, 'DHA Phase 2', 'Q Block', 'Unfurnished', false],

  ['dha6-d-1kanal-house-sale', 'House', 'Sale', 125000000, 1, 'Kanal', 5, 6, 'DHA Phase 6', 'D Block', 'Unfurnished', true],
  ['dha5-l-10marla-house-sale', 'House', 'Sale', 62500000, 10, 'Marla', 4, 5, 'DHA Phase 5', 'L Block', 'Unfurnished', false],
  ['dha9-town-5marla-house-sale', 'House', 'Sale', 29500000, 5, 'Marla', 3, 4, 'DHA Phase 8', 'Air Avenue', 'Unfurnished', false],
  ['dha7-r-1kanal-house-sale', 'House', 'Sale', 98000000, 1, 'Kanal', 5, 6, 'DHA Phase 7', 'R Block', 'Unfurnished', false],
  ['askari11-c-10marla-house-sale', 'House', 'Sale', 41000000, 10, 'Marla', 4, 4, 'Askari 11', 'Sector C', 'Unfurnished', false],

  ['askari10-s1-apartment-rent', 'Apartment', 'Rent', 85000, 2250, 'Sq. Ft.', 3, 3, 'Askari 10', 'Sector S-1', 'Unfurnished', true],
  ['askari11-b-apartment-rent', 'Apartment', 'Rent', 70000, 1800, 'Sq. Ft.', 3, 3, 'Askari 11', 'Sector B', 'Semi-Furnished', false],
  ['dha8-gold-crest-apartment-rent', 'Apartment', 'Rent', 175000, 1650, 'Sq. Ft.', 2, 2, 'DHA Phase 8', 'Goldcrest', 'Furnished', true],
  ['dha6-penthouse-apartment-rent', 'Apartment', 'Rent', 240000, 3200, 'Sq. Ft.', 4, 4, 'DHA Phase 6', 'Main Boulevard', 'Furnished', false],
  ['askari10-s3-apartment-sale', 'Apartment', 'Sale', 24500000, 2250, 'Sq. Ft.', 3, 3, 'Askari 10', 'Sector S-3', 'Unfurnished', false],
  ['dha8-penta-square-apartment-sale', 'Apartment', 'Sale', 38000000, 1450, 'Sq. Ft.', 2, 2, 'DHA Phase 8', 'Penta Square', 'Furnished', false],

  ['dha5-commercial-flat-rent', 'Flat', 'Rent', 65000, 1100, 'Sq. Ft.', 2, 2, 'DHA Phase 5', 'CCA Commercial', 'Unfurnished', false],
  ['dha6-mb-studio-flat-rent', 'Flat', 'Rent', 55000, 650, 'Sq. Ft.', 1, 1, 'DHA Phase 6', 'MB Commercial', 'Furnished', false],
  ['dha2-commercial-flat-rent', 'Flat', 'Rent', 60000, 1000, 'Sq. Ft.', 2, 2, 'DHA Phase 2', 'Commercial Area', 'Semi-Furnished', false],
  ['dha4-flat-rent', 'Flat', 'Rent', 75000, 1250, 'Sq. Ft.', 3, 2, 'DHA Phase 4', 'AA Commercial', 'Unfurnished', false],
  ['dha1-flat-rent', 'Flat', 'Rent', 48000, 850, 'Sq. Ft.', 2, 1, 'DHA Phase 1', 'K Commercial', 'Unfurnished', false],
  ['dha3-xx-flat-sale', 'Flat', 'Sale', 13500000, 1000, 'Sq. Ft.', 2, 2, 'DHA Phase 3', 'XX Commercial', 'Unfurnished', false],

  ['dha7-z1-1kanal-plot-sale', 'Plot', 'Sale', 52000000, 1, 'Kanal', 0, 0, 'DHA Phase 7', 'Z-1 Block', '', false],
  ['dha9-prism-5marla-plot-sale', 'Plot', 'Sale', 14500000, 5, 'Marla', 0, 0, 'DHA Phase 6', 'N Block', '', false],

  ['dha8-broadway-shop-rent', 'Commercial', 'Rent', 450000, 4, 'Marla', 0, 2, 'DHA Phase 8', 'Broadway Commercial', '', true],
  ['dha6-cca-office-rent', 'Commercial', 'Rent', 280000, 2400, 'Sq. Ft.', 0, 2, 'DHA Phase 6', 'CCA-1', 'Furnished', false],
  ['dha5-cca-building-sale', 'Commercial', 'Sale', 210000000, 8, 'Marla', 0, 6, 'DHA Phase 5', 'CCA Block', '', false],
];

// Listings across the rest of Lahore.
// [key, type, purpose, price, area, unit, beds, baths, areaSlug, block, furnished, featured, subType, { lat, lng }?]
// Rows without explicit coordinates are placed near the area centre with a small deterministic offset.
const CITY_ROWS = [
  // DHA (premium)
  ['dha1-g-1kanal-lower-rent', 'House', 'Rent', 120000, 1, 'Kanal', 3, 3, 'dha-phase-1', 'Block G', 'Unfurnished', false, 'Lower Portion'],
  ['dha3-w-1kanal-house-sale', 'House', 'Sale', 95000000, 1, 'Kanal', 5, 6, 'dha-phase-3', 'Block W', 'Unfurnished', false],
  ['dha4-dd-10marla-upper-rent', 'House', 'Rent', 75000, 10, 'Marla', 2, 2, 'dha-phase-4', 'Block DD', 'Unfurnished', false, 'Upper Portion'],
  ['dha9town-c-5marla-house-rent', 'House', 'Rent', 70000, 5, 'Marla', 3, 3, 'dha-phase-9-town', 'Block C', 'Unfurnished', false],
  ['dha9prism-j-10marla-house-sale', 'House', 'Sale', 36000000, 10, 'Marla', 4, 5, 'dha-phase-9-prism', 'Block J', 'Unfurnished', false],
  ['dha10-a-1kanal-plot-sale', 'Plot', 'Sale', 24000000, 1, 'Kanal', 0, 0, 'dha-phase-10', 'Sector A', '', false],
  ['dha11-rahbar-5marla-house-rent', 'House', 'Rent', 55000, 5, 'Marla', 3, 3, 'dha-phase-11', 'Rahbar Sector 2', 'Unfurnished', false],
  ['dha11-halloki-10marla-house-sale', 'House', 'Sale', 29000000, 10, 'Marla', 4, 5, 'dha-phase-11', 'Halloki Gardens', 'Unfurnished', false],
  ['dha12-eme-b-10marla-house-rent', 'House', 'Rent', 95000, 10, 'Marla', 4, 4, 'dha-phase-12', 'Block B', 'Semi-Furnished', false],
  ['dha13-a-5marla-plot-sale', 'Plot', 'Sale', 7500000, 5, 'Marla', 0, 0, 'dha-phase-13', 'Sector A', '', false],
  ['dha-raya-golf-apartment-rent', 'Apartment', 'Rent', 220000, 2400, 'Sq. Ft.', 3, 3, 'dha-raya', 'Raya Golf Residences', 'Furnished', true],
  ['dha6-l-1kanal-plot-sale', 'Plot', 'Sale', 62000000, 1, 'Kanal', 0, 0, 'dha-phase-6', 'Block L', '', false],
  ['dha5-cca-office-rent', 'Commercial', 'Rent', 180000, 1200, 'Sq. Ft.', 0, 1, 'dha-phase-5', 'CCA Block', 'Furnished', false, 'Office'],
  // Askari (upper-mid)
  ['askari1-1kanal-house-rent', 'House', 'Rent', 220000, 1, 'Kanal', 5, 5, 'askari-1', 'Main Boulevard', 'Semi-Furnished', false],
  ['askari2-apartment-rent', 'Apartment', 'Rent', 75000, 2000, 'Sq. Ft.', 3, 3, 'askari-2', 'Tufail Road', 'Unfurnished', false],
  ['askari5-c-10marla-house-sale', 'House', 'Sale', 38000000, 10, 'Marla', 4, 4, 'askari-5', 'Block C', 'Unfurnished', false],
  ['askari6-b-apartment-sale', 'Apartment', 'Sale', 21000000, 1950, 'Sq. Ft.', 3, 3, 'askari-6', 'Block B', 'Unfurnished', false],
  ['askari7-apartment-rent', 'Apartment', 'Rent', 65000, 1650, 'Sq. Ft.', 3, 2, 'askari-7', 'Shami Road', 'Semi-Furnished', false],
  ['askari9-10marla-house-rent', 'House', 'Rent', 120000, 10, 'Marla', 4, 4, 'askari-9', 'Zarrar Shaheed Road', 'Unfurnished', false],
  ['askari11-d-5marla-house-rent', 'House', 'Rent', 65000, 5, 'Marla', 3, 3, 'askari-11', 'Sector D', 'Unfurnished', false],
  // Gulberg (premium)
  ['gulberg1-jail-road-office-rent', 'Commercial', 'Rent', 350000, 3000, 'Sq. Ft.', 0, 2, 'gulberg-1', 'Jail Road', 'Furnished', false, 'Office'],
  ['gulberg2-d-2kanal-house-rent', 'House', 'Rent', 650000, 2, 'Kanal', 6, 7, 'gulberg-2', 'Block D', 'Unfurnished', false],
  ['gulberg3-mmalam-apartment-rent', 'Apartment', 'Rent', 160000, 1800, 'Sq. Ft.', 3, 3, 'gulberg-3', 'MM Alam Road', 'Furnished', false],
  ['gulberg3-liberty-shop-rent', 'Commercial', 'Rent', 400000, 3, 'Marla', 0, 1, 'gulberg-3', 'Liberty Market', '', false, 'Shop'],
  ['gulberg3-boulevard-apartment-sale', 'Apartment', 'Sale', 55000000, 2200, 'Sq. Ft.', 3, 3, 'gulberg-3', 'Main Boulevard', 'Semi-Furnished', false],
  ['gulberg4-e-1kanal-house-sale', 'House', 'Sale', 140000000, 1, 'Kanal', 5, 6, 'gulberg-4', 'Block E', 'Unfurnished', false],
  ['gulberg5-c-1kanal-lower-rent', 'House', 'Rent', 160000, 1, 'Kanal', 3, 3, 'gulberg-5', 'Block C', 'Semi-Furnished', false, 'Lower Portion'],
  // Johar Town (mid)
  ['johar-r1-10marla-house-rent', 'House', 'Rent', 95000, 10, 'Marla', 4, 4, 'johar-town', 'R-1 Block', 'Unfurnished', true],
  ['johar-j-5marla-house-rent', 'House', 'Rent', 55000, 5, 'Marla', 3, 3, 'johar-town', 'Block J', 'Unfurnished', false],
  ['johar-e-10marla-upper-rent', 'House', 'Rent', 45000, 10, 'Marla', 2, 2, 'johar-town', 'Block E', 'Unfurnished', false, 'Upper Portion'],
  ['johar-g-1kanal-lower-rent', 'House', 'Rent', 70000, 1, 'Kanal', 3, 3, 'johar-town', 'Block G', 'Semi-Furnished', false, 'Lower Portion'],
  ['johar-h-flat-rent', 'Flat', 'Rent', 35000, 750, 'Sq. Ft.', 2, 1, 'johar-town', 'Block H', 'Semi-Furnished', false],
  ['johar-r2-studio-flat-rent', 'Flat', 'Rent', 28000, 450, 'Sq. Ft.', 1, 1, 'johar-town', 'R-2 Block', 'Furnished', false],
  ['johar-l-flat-sale', 'Flat', 'Sale', 9500000, 850, 'Sq. Ft.', 2, 2, 'johar-town', 'Block L', 'Unfurnished', false],
  ['aecs-f-flat-rent', 'Flat', 'Rent', 30000, 700, 'Sq. Ft.', 2, 1, 'architects-engineers', 'Block F', 'Semi-Furnished', false],
  ['johar-r3-flat-rent', 'Flat', 'Rent', 32000, 650, 'Sq. Ft.', 2, 1, 'johar-town', 'R-3 Block', 'Semi-Furnished', false, '', { lat: 31.4492, lng: 74.2668 }],
  ['wapda-commercial-studio-flat-rent', 'Flat', 'Rent', 27000, 550, 'Sq. Ft.', 1, 1, 'wapda-town', 'Wapda Town Commercial', 'Furnished', false, '', { lat: 31.4440, lng: 74.2700 }],
  ['johar-d-10marla-house-sale', 'House', 'Sale', 32000000, 10, 'Marla', 4, 5, 'johar-town', 'Block D', 'Unfurnished', false],
  ['johar-q-5marla-house-sale', 'House', 'Sale', 17500000, 5, 'Marla', 3, 4, 'johar-town', 'Block Q', 'Unfurnished', false],
  ['johar-p-10marla-plot-sale', 'Plot', 'Sale', 18000000, 10, 'Marla', 0, 0, 'johar-town', 'Block P', '', false],
  ['johar-boulevard-shop-rent', 'Commercial', 'Rent', 150000, 2, 'Marla', 0, 1, 'johar-town', 'Main Boulevard', '', false, 'Shop'],
  ['johar-e2-office-rent', 'Commercial', 'Rent', 120000, 1500, 'Sq. Ft.', 0, 2, 'johar-town', 'Block E-2', 'Furnished', false, 'Office'],
  ['johar-k-apartment-sale', 'Apartment', 'Sale', 16500000, 1400, 'Sq. Ft.', 3, 2, 'johar-town', 'Block K', 'Unfurnished', false],
  // Model Town / Garden Town / Faisal Town (upper-mid)
  ['modeltown-c-1kanal-house-rent', 'House', 'Rent', 220000, 1, 'Kanal', 5, 5, 'model-town', 'Block C', 'Unfurnished', true],
  ['modeltown-j-1kanal-upper-rent', 'House', 'Rent', 85000, 1, 'Kanal', 3, 3, 'model-town', 'Block J', 'Unfurnished', false, 'Upper Portion'],
  ['modeltown-f-1kanal-house-sale', 'House', 'Sale', 85000000, 1, 'Kanal', 5, 6, 'model-town', 'Block F', 'Unfurnished', false],
  ['gardentown-ali-1kanal-house-rent', 'House', 'Rent', 175000, 1, 'Kanal', 5, 5, 'garden-town', 'Ali Block', 'Unfurnished', false],
  ['gardentown-barkat-shop-rent', 'Commercial', 'Rent', 140000, 2, 'Marla', 0, 1, 'garden-town', 'Barkat Market', '', false, 'Shop'],
  ['faisaltown-a-10marla-house-rent', 'House', 'Rent', 85000, 10, 'Marla', 4, 4, 'faisal-town', 'Block A', 'Unfurnished', false],
  ['faisaltown-c-10marla-upper-rent', 'House', 'Rent', 48000, 10, 'Marla', 2, 2, 'faisal-town', 'Block C', 'Semi-Furnished', false, 'Upper Portion'],
  ['faisaltown-d-10marla-house-sale', 'House', 'Sale', 30000000, 10, 'Marla', 4, 5, 'faisal-town', 'Block D', 'Unfurnished', false],
  // Wapda Town / Cantt
  ['wapda-f-10marla-house-rent', 'House', 'Rent', 75000, 10, 'Marla', 4, 4, 'wapda-town', 'Block F', 'Unfurnished', false],
  ['wapda-k-1kanal-lower-rent', 'House', 'Rent', 60000, 1, 'Kanal', 3, 3, 'wapda-town', 'Block K', 'Unfurnished', false, 'Lower Portion'],
  ['wapda-ph2-5marla-house-sale', 'House', 'Sale', 15500000, 5, 'Marla', 3, 4, 'wapda-town', 'Phase 2', 'Unfurnished', false],
  ['cantt-sarwar-2kanal-house-rent', 'House', 'Rent', 450000, 2, 'Kanal', 6, 6, 'lahore-cantt', 'Sarwar Road', 'Unfurnished', false],
  // Bahria / Orchard / Lake City / Raiwind Road schemes
  ['bahria-c-10marla-house-rent', 'House', 'Rent', 75000, 10, 'Marla', 4, 5, 'bahria-town', 'Sector C', 'Unfurnished', true],
  ['bahria-jasmine-5marla-house-rent', 'House', 'Rent', 48000, 5, 'Marla', 3, 3, 'bahria-town', 'Jasmine Block', 'Unfurnished', false],
  ['bahria-overseas-a-10marla-house-sale', 'House', 'Sale', 30000000, 10, 'Marla', 5, 5, 'bahria-town', 'Overseas A', 'Unfurnished', false],
  ['bahria-takbeer-5marla-plot-sale', 'Plot', 'Sale', 7800000, 5, 'Marla', 0, 0, 'bahria-town', 'Takbeer Block', '', false],
  ['orchard-central-5marla-house-rent', 'House', 'Rent', 38000, 5, 'Marla', 3, 3, 'bahria-orchard', 'Central Block', 'Unfurnished', false],
  ['orchard-eastern-10marla-house-sale', 'House', 'Sale', 21000000, 10, 'Marla', 4, 5, 'bahria-orchard', 'Eastern Block', 'Unfurnished', false],
  ['lakecity-m2-1kanal-house-sale', 'House', 'Sale', 72000000, 1, 'Kanal', 5, 6, 'lake-city', 'Sector M-2', 'Unfurnished', false],
  ['valencia-h-10marla-house-rent', 'House', 'Rent', 85000, 10, 'Marla', 4, 4, 'valencia', 'Block H', 'Unfurnished', false],
  ['eme-d-1kanal-house-sale', 'House', 'Sale', 55000000, 1, 'Kanal', 5, 6, 'eme-society', 'Block D', 'Unfurnished', false],
  ['statelife-b-10marla-house-rent', 'House', 'Rent', 90000, 10, 'Marla', 4, 4, 'state-life', 'Block B', 'Unfurnished', false],
  ['paragon-orchard-5marla-house-rent', 'House', 'Rent', 50000, 5, 'Marla', 3, 3, 'paragon-city', 'Orchard Block', 'Unfurnished', false],
  ['parkview-tulip-5marla-house-sale', 'House', 'Sale', 14500000, 5, 'Marla', 3, 4, 'park-view-city', 'Tulip Block', 'Unfurnished', false],
  ['centralpark-a-5marla-house-rent', 'House', 'Rent', 38000, 5, 'Marla', 3, 3, 'central-park', 'Block A', 'Unfurnished', false],
  ['canalgarden-aa-5marla-house-rent', 'House', 'Rent', 35000, 5, 'Marla', 3, 3, 'canal-garden', 'Block AA', 'Unfurnished', false],
  ['etihad-ph1-5marla-plot-sale', 'Plot', 'Sale', 5800000, 5, 'Marla', 0, 0, 'etihad-town', 'Phase 1', '', false],
  ['khayaban-amin-l-10marla-house-rent', 'House', 'Rent', 65000, 10, 'Marla', 4, 4, 'khayaban-e-amin', 'Block L', 'Unfurnished', false],
  ['sukhchayn-c-10marla-house-rent', 'House', 'Rent', 85000, 10, 'Marla', 4, 4, 'sukh-chayn', 'Block C', 'Semi-Furnished', false],
  ['bedian-4kanal-farmhouse-sale', 'House', 'Sale', 110000000, 4, 'Kanal', 5, 6, 'bedian-road', 'Farmhouse Lane', 'Semi-Furnished', false, 'Farmhouse'],
  // Central / older neighbourhoods
  ['iqbaltown-kashmir-10marla-house-rent', 'House', 'Rent', 65000, 10, 'Marla', 4, 4, 'allama-iqbal-town', 'Kashmir Block', 'Unfurnished', false],
  ['iqbaltown-karim-10marla-upper-rent', 'House', 'Rent', 38000, 10, 'Marla', 2, 2, 'allama-iqbal-town', 'Karim Block', 'Unfurnished', false, 'Upper Portion'],
  ['township-a2-5marla-house-rent', 'House', 'Rent', 35000, 5, 'Marla', 3, 3, 'township', 'Sector A-2', 'Unfurnished', false],
  ['township-b1-5marla-lower-rent', 'House', 'Rent', 22000, 5, 'Marla', 2, 1, 'township', 'Sector B-1', 'Unfurnished', false, 'Lower Portion'],
  ['township-a1-flat-rent', 'Flat', 'Rent', 20000, 600, 'Sq. Ft.', 2, 1, 'township', 'Sector A-1', 'Unfurnished', false],
  ['samanabad-d-flat-rent', 'Flat', 'Rent', 25000, 700, 'Sq. Ft.', 2, 1, 'samanabad', 'Block D', 'Unfurnished', false],
  ['township-c2-5marla-house-sale', 'House', 'Sale', 10500000, 5, 'Marla', 3, 3, 'township', 'Sector C-2', 'Unfurnished', false],
  ['gulshanravi-g-5marla-house-rent', 'House', 'Rent', 38000, 5, 'Marla', 3, 3, 'gulshan-e-ravi', 'Block G', 'Unfurnished', false],
  ['samanabad-n-5marla-upper-rent', 'House', 'Rent', 25000, 5, 'Marla', 2, 1, 'samanabad', 'Block N', 'Unfurnished', false, 'Upper Portion'],
  ['shadman2-1kanal-house-rent', 'House', 'Rent', 160000, 1, 'Kanal', 5, 5, 'shadman', 'Shadman 2', 'Unfurnished', false],
  ['garhishahu-flat-rent', 'Flat', 'Rent', 30000, 800, 'Sq. Ft.', 2, 1, 'garhi-shahu', 'Allama Iqbal Road', 'Unfurnished', false],
  ['upper-mall-office-rent', 'Commercial', 'Rent', 200000, 1800, 'Sq. Ft.', 0, 2, 'mall-road', 'Upper Mall', 'Furnished', false, 'Office'],
  ['cavalry-ext-10marla-house-rent', 'House', 'Rent', 130000, 10, 'Marla', 4, 4, 'cavalry-ground', 'Cavalry Ground Extension', 'Unfurnished', false],
  ['sabzazar-l-5marla-house-rent', 'House', 'Rent', 32000, 5, 'Marla', 3, 2, 'sabzazar', 'Block L', 'Unfurnished', false],
  ['pcsir-ph2-10marla-house-rent', 'House', 'Rent', 80000, 10, 'Marla', 4, 4, 'pcsir', 'Phase 2', 'Unfurnished', false],
  ['nfc-ph1-10marla-house-sale', 'House', 'Sale', 25000000, 10, 'Marla', 4, 5, 'nfc', 'Phase 1', 'Unfurnished', false],
  ['punjabcoop-c-10marla-house-rent', 'House', 'Rent', 110000, 10, 'Marla', 4, 4, 'punjab-coop', 'Block C', 'Unfurnished', false],
  ['alrehman-ph2-5marla-house-sale', 'House', 'Sale', 9000000, 5, 'Marla', 3, 3, 'al-rehman-garden', 'Phase 2', 'Unfurnished', false],
  ['alrehman-ph4-5marla-house-rent', 'House', 'Rent', 28000, 5, 'Marla', 3, 2, 'al-rehman-garden', 'Phase 4', 'Unfurnished', false],
  ['muslimtown-10marla-upper-rent', 'House', 'Rent', 45000, 10, 'Marla', 2, 2, 'muslim-town', 'Canal Bank', 'Semi-Furnished', false, 'Upper Portion'],
  ['mustafatown-5marla-house-rent', 'House', 'Rent', 33000, 5, 'Marla', 3, 2, 'mustafa-town', 'Wahdat Road', 'Unfurnished', false],
  ['iqbalavenue-ph1-10marla-house-rent', 'House', 'Rent', 75000, 10, 'Marla', 4, 4, 'iqbal-avenue', 'Phase 1', 'Unfurnished', false],
  ['tariqgardens-b-10marla-house-sale', 'House', 'Sale', 26000000, 10, 'Marla', 4, 5, 'tariq-gardens', 'Block B', 'Unfurnished', false],
  ['ichhra-bazaar-shop-rent', 'Commercial', 'Rent', 85000, 1, 'Marla', 0, 0, 'ichhra', 'Ichhra Bazaar', '', false, 'Shop'],
  ['mughalpura-5marla-house-rent', 'House', 'Rent', 30000, 5, 'Marla', 3, 2, 'mughalpura', 'Lal Pul', 'Unfurnished', false],
];

const AMENITIES = {
  House: ['Servant Quarter', 'Lawn / Garden', 'Car Porch', 'Drawing Room', 'Dining Room', 'Store Room', 'Gas Connection', 'Backup Generator', 'Water Tank', 'Security Guard', 'Near Park', 'Near Mosque', 'Solar Panels', 'Double Glazed Windows'],
  Apartment: ['Lift / Elevator', 'Reserved Parking', 'Backup Power', '24/7 Security', 'CCTV', 'Gym', 'Swimming Pool', 'Gas Connection', 'Water Supply', 'Balcony', 'Community Hall', 'Kids Play Area'],
  Flat: ['Lift / Elevator', 'Parking', 'Backup Power', 'Security', 'Gas Connection', 'Water Supply', 'Near Market', 'Balcony'],
  Plot: ['Possession Available', 'Corner', 'Park Facing', 'Boulevard Access', 'Electricity Available', 'Sui Gas Available', 'Near Commercial'],
  Commercial: ['Lift / Elevator', 'Backup Generator', 'Central AC', 'Parking', 'CCTV', 'Main Road Facing', 'Fibre Internet', 'Washrooms'],
};

const formatArea = (area, unit) => (unit === 'Sq. Ft.' ? `${area.toLocaleString('en-PK')} sq. ft.` : `${area} ${unit}`);

const STYLES = ['Brand New', 'Beautiful', 'Modern', 'Well-Maintained', 'Elegant', 'Spacious', 'Luxury'];
const OWNERS = [
  ['RMS Property Desk', '+92 300 1234567', 'listings@rms.pk'],
  ['RMS Lahore South Desk', '+92 321 1234567', 'south@rms.pk'],
  ['RMS Central Lahore Desk', '+92 333 1234567', 'central@rms.pk'],
];

const titleFor = ({ type, purpose, area, unit, beds, phase, block, furnished, subType, index }) => {
  const size = formatArea(area, unit);
  const purposeText = purpose === 'Rent' ? 'for Rent' : 'for Sale';
  const where = `${block}, ${phase}`;
  if (type === 'House') {
    const style = STYLES[index % STYLES.length];
    const kind = subType || 'House';
    return `${style} ${size} ${beds}-Bed ${kind} ${purposeText} in ${where}`;
  }
  if (type === 'Apartment') return `${furnished === 'Furnished' ? 'Fully Furnished ' : ''}${beds}-Bed Apartment ${purposeText} in ${where}`;
  if (type === 'Flat') return `${beds === 1 ? 'Studio' : `${beds}-Bed`} Flat ${purposeText} in ${where}`;
  if (type === 'Plot') return `${size} Residential Plot ${purposeText} in ${where}`;
  if (subType === 'Shop') return `${size} Shop ${purposeText} in ${where}`;
  if (subType === 'Office') return `${size} ${furnished === 'Furnished' ? 'Furnished ' : ''}Office ${purposeText} in ${where}`;
  return `${size} Commercial ${unit === 'Sq. Ft.' ? 'Office' : 'Space'} ${purposeText} in ${where}`;
};

const firstSentence = (text = '') => (String(text).match(/^.*?[.!?](\s|$)/)?.[0] || String(text)).trim();

const descriptionFor = ({ type, purpose, area, unit, beds, baths, phase, block, furnished, society, subType, areaInfo, legacy }) => {
  const size = formatArea(area, unit);
  const where = `${block}, ${phase}`;
  let intro = {
    House: `This well-maintained ${size} house in ${where} offers ${beds} spacious bedrooms with attached bathrooms (${baths} in total), a modern kitchen, drawing and dining rooms, and a TV lounge.`,
    Apartment: `A bright ${beds}-bedroom apartment (${size}) in ${where} with an open-plan lounge, fitted kitchen and ${baths} bathrooms, in a secure building with lift and backup power.`,
    Flat: `A practical ${beds === 1 ? 'studio' : `${beds}-bedroom`} flat (${size}) in ${where}, ideal for working professionals, students and small families who want everything within walking distance.`,
    Plot: `A ${size} residential plot in ${where} with possession and all utilities available. The location is ideal for building your dream home.`,
    Commercial: `Prime ${size} commercial property on ${where} with excellent frontage, high footfall and ample parking - suitable for retail, offices or a showroom.`,
  }[type];
  if (subType === 'Upper Portion' || subType === 'Lower Portion') {
    intro = `A ${subType.toLowerCase()} of a ${size} house in ${where} with a separate entrance, ${beds} bedrooms, ${baths} bathrooms, a kitchen and TV lounge. Separate electricity meter; gas and water shared.`;
  } else if (subType === 'Farmhouse') {
    intro = `A ${size} farmhouse on ${where} with ${beds} bedrooms, a large lawn, fruit trees, a swimming pool and staff quarters - perfect for weekends or events.`;
  } else if (subType === 'Shop') {
    intro = `A ${size} ground-floor shop in ${where} with wide frontage on a busy road, a washroom and shutter security - ideal for retail, a pharmacy or a cafe.`;
  } else if (subType === 'Office') {
    intro = `A ${size} ${furnished ? `${furnished.toLowerCase()} ` : ''}office in ${where} with reception, workstations, a meeting room, lift access and backup power.`;
  }
  const furnishing = furnished && !['Shop', 'Office'].includes(subType) ? ` The property is ${furnished.toLowerCase()}.` : '';
  let areaText;
  if (legacy) {
    areaText = society === 'Askari'
      ? ' Askari is a secure, gated community managed by the army with wide roads, parks, schools and mosques nearby.'
      : ' DHA Lahore offers 24/7 security, wide roads, parks, international schools and the best commercial hubs in the city.';
  } else {
    areaText = areaInfo ? ` ${firstSentence(areaInfo.description)}` : '';
  }
  const terms = purpose === 'Rent'
    ? (type === 'Commercial' ? ' Three months\' advance and a 10% yearly increase; lease agreement required.' : ' Two months\' advance and one month\'s security deposit; rent is payable monthly. Family preferred.')
    : ' Clear title and transfer-ready documentation. Serious buyers are welcome to arrange a visit.';
  return `${intro}${furnishing}${areaText}${terms}`;
};

const imagesFor = (type, index, subType = '') => {
  if (type === 'House' && /Portion/.test(subType)) return [pickCycle('house-exterior', 13, index), pickCycle('living-room', 11, index + 3), pickCycle('kitchen', 5, index + 1), pickCycle('bedroom', 6, index + 2)];
  if (type === 'House') return [pickCycle('house-exterior', 13, index), pickCycle('living-room', 11, index), pickCycle('kitchen', 5, index), pickCycle('bedroom', 6, index), pickCycle('bathroom', 3, index)];
  if (type === 'Apartment') return [pickCycle('apartment-building', 5, index), pickCycle('living-room', 11, index + 4), pickCycle('kitchen', 5, index + 2), pickCycle('bedroom', 6, index + 3)];
  if (type === 'Flat') return [pickCycle('living-room', 11, index + 7), pickCycle('bedroom', 6, index + 1), pickCycle('kitchen', 5, index + 1), pickCycle('bathroom', 3, index + 1)];
  if (type === 'Plot') return index < ROWS.length ? [photo('plot-01')] : [photo('plot-01'), pickCycle('house-exterior', 13, index + 5)];
  if (subType === 'Office') return [pickCycle('commercial', 3, index), pickCycle('living-room', 11, index + 2), pickCycle('commercial', 3, index + 1)];
  return [pickCycle('commercial', 3, index), pickCycle('commercial', 3, index + 1), pickCycle('commercial', 3, index + 2)];
};

/** Normalise both row formats into one shape. */
const legacyRow = (row) => {
  const [key, type, purpose, price, area, unit, beds, baths, phase, block, furnished, featured] = row;
  const location = LOCATIONS[phase];
  const areaInfo = resolveAreaForProperty({ phase });
  return {
    key, type, purpose, price, area, unit, beds, baths, phase, block, furnished, featured,
    subType: key.includes('upper') ? 'Upper Portion' : '',
    society: location.society, lat: location.lat, lng: location.lng, areaInfo, legacy: true,
  };
};
const cityRow = (row) => {
  const [key, type, purpose, price, area, unit, beds, baths, areaSlug, block, furnished, featured, subType = '', coords = null] = row;
  const areaInfo = getArea(areaSlug);
  if (!areaInfo) throw new Error(`Unknown area slug in demo catalog: ${areaSlug}`);
  const parent = areaInfo.parent ? getArea(areaInfo.parent) : null;
  const society = parent ? parent.name.replace(/ \(Lahore\)$/, '').replace(/^DHA Lahore$/, 'DHA') : areaInfo.name;
  const { dLat, dLng } = approximateOffset(key);
  return {
    key, type, purpose, price, area, unit, beds, baths, phase: areaInfo.name, block, furnished, featured, subType,
    society, lat: coords?.lat ?? areaInfo.lat + dLat, lng: coords?.lng ?? areaInfo.lng + dLng, areaInfo, legacy: false,
  };
};

export const DEMO_ROWS_COUNT = ROWS.length + CITY_ROWS.length;

export const buildDemoCatalog = () => [...ROWS.map(legacyRow), ...CITY_ROWS.map(cityRow)].map((fields, index) => {
  const { key, type, purpose, price, area, unit, beds, baths, phase, block, furnished, featured, subType, society, areaInfo, legacy } = fields;
  const all = { ...fields, index };
  // legacy rows keep their original small deterministic offset so markers do not overlap
  const jitter = legacy ? ((index * 37) % 17) / 10000 : 0;
  const amenities = AMENITIES[type].filter((_, i) => (i + index) % 3 !== 0).slice(0, 8);
  const images = imagesFor(type, index, subType).map((url) => ({ url, public_id: '' }));
  const [ownerName, ownerPhone, ownerEmail] = legacy ? OWNERS[0] : OWNERS[index % OWNERS.length];
  const total = ROWS.length + CITY_ROWS.length;
  return {
    seedKey: key,
    title: titleFor(all),
    description: descriptionFor(all),
    propertyType: type,
    type,
    category: type,
    subType,
    purpose,
    transactionType: purpose,
    listingType: purpose.toLowerCase(),
    price,
    rent: purpose === 'Rent' ? price : 0,
    salePrice: purpose === 'Sale' ? price : 0,
    deposit: purpose === 'Rent' ? price : 0,
    city: 'Lahore',
    society,
    phase,
    block,
    address: `${type === 'Commercial' ? 'Plaza' : type === 'Plot' ? 'Plot' : 'House'} ${10 + ((index * 7) % 90)}, ${block}, ${phase}, Lahore`,
    location: `${phase}, Lahore`,
    areaSlug: areaInfo?.slug || '',
    latitude: Number((fields.lat + jitter).toFixed(6)),
    longitude: Number((fields.lng - jitter).toFixed(6)),
    locationApproximate: false,
    bedrooms: beds,
    bathrooms: baths,
    parking: type === 'House' ? (unit === 'Kanal' ? 3 : 1) : type === 'Plot' ? 0 : 1,
    area,
    areaUnit: unit,
    furnished,
    amenities,
    yearBuilt: type === 'Plot' ? null : 2012 + (index % 13),
    ownerName,
    ownerPhone,
    ownerEmail,
    status: 'Available',
    availability: 'Available',
    isFeatured: Boolean(featured),
    images,
    image: images[0].url,
    featuredImage: images[0],
    ownerId: 'demo-seed',
    // spread listing dates over the last ~6 weeks in a mixed order so 'newest first' looks natural
    createdAt: new Date(Date.now() - (((index * 7) % total) + 1) * 9 * 60 * 60 * 1000),
  };
});

export const DEMO_OWNER_IDS = ['demo-seed', 'rms-rental-showcase-seed'];
