import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { closeDatabase, connectDatabase } from '../src/config/database.js';
import Property from '../src/models/Property.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDirectory, '../.env') });

const MINIMUM_PER_CATEGORY = 5;
const SEED_OWNER_ID = 'rms-rental-showcase-seed';
const sampleLocations = [
  { phase: 'Phase 7', city: 'Lahore', block: 'B Block' },
  { phase: 'Phase 8', city: 'Lahore', block: 'E Block' },
  { phase: 'S3/10', city: 'Lahore', block: 'S3' },
  { phase: 'S3/11', city: 'Lahore', block: 'S3' },
  { phase: 'S3/12', city: 'Lahore', block: 'S3' },
];
const sampleCategories = [
  {
    type: 'House',
    prices: [95000, 108000, 115000, 127000, 139000],
    bedrooms: [4, 5, 3, 4, 5],
    palette: ['#0f766e', '#2563eb', '#b45309', '#7c3aed', '#be123c'],
  },
  {
    type: 'Flat',
    prices: [42000, 48000, 51000, 56500, 62000],
    bedrooms: [2, 3, 2, 2, 3],
    palette: ['#0369a1', '#9333ea', '#15803d', '#c2410c', '#4338ca'],
  },
];

const normalize = (value) => String(value || '').trim().toLowerCase();
const isSaleListing = (property) => [
  property.listingType,
  property.transactionType,
  property.purpose,
].some((value) => ['sale', 'sell', 'buy', 'purchase', 'for sale'].includes(normalize(value)));

const matchesCategory = (property, type) => {
  const aliases = type === 'House' ? ['house', 'houses', 'villa', 'villas'] : ['flat', 'flats', 'studio', 'studios'];
  return [property.propertyType, property.type, property.category]
    .some((value) => aliases.includes(normalize(value)));
};

const createUniqueImage = (type, index, color, location) => {
  const caption = `${type} ${index + 1} - ${location.phase}`
    .replace(/[&<>"]/g, '');
  const building = type === 'House'
    ? '<path d="M150 340 500 90l350 250v350H150z" fill="#f8fafc"/><path d="M100 350 500 60l400 290" fill="none" stroke="#0f172a" stroke-width="32" stroke-linejoin="round"/>'
    : '<rect x="220" y="110" width="560" height="600" rx="24" fill="#f8fafc"/><path d="M220 270h560M220 430h560M220 590h560" stroke="#cbd5e1" stroke-width="14"/>';
  const windows = type === 'House'
    ? '<rect x="245" y="390" width="130" height="120" rx="12" fill="#7dd3fc"/><rect x="620" y="390" width="130" height="120" rx="12" fill="#7dd3fc"/><rect x="430" y="520" width="140" height="170" rx="10" fill="#a16207"/>'
    : '<g fill="#7dd3fc"><rect x="280" y="160" width="120" height="70" rx="8"/><rect x="600" y="160" width="120" height="70" rx="8"/><rect x="280" y="320" width="120" height="70" rx="8"/><rect x="600" y="320" width="120" height="70" rx="8"/><rect x="280" y="480" width="120" height="70" rx="8"/><rect x="600" y="480" width="120" height="70" rx="8"/></g>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="720" viewBox="0 0 1000 720"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#dbeafe"/></linearGradient></defs><rect width="1000" height="720" fill="url(#sky)"/><circle cx="820" cy="125" r="68" fill="#fde68a"/><path d="M0 590h1000v130H0z" fill="#86a778"/>${building}${windows}<text x="500" y="665" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#0f172a">${caption}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export async function ensureRentalShowcaseProperties() {
  const existing = await Property.find({})
    .select('propertyType type category listingType transactionType purpose title')
    .lean();
  const results = {};

  for (const category of sampleCategories) {
    const current = existing.filter((property) => (
      matchesCategory(property, category.type) && !isSaleListing(property)
    ));
    const titles = new Set(existing.map((property) => normalize(property.title)));
    let created = 0;

    for (let index = 0; index < sampleLocations.length && current.length + created < MINIMUM_PER_CATEGORY; index += 1) {
      const location = sampleLocations[index];
      const title = `${category.type} for Rent - ${location.phase}, Lahore`;
      if (titles.has(normalize(title))) continue;

      const image = createUniqueImage(category.type, index, category.palette[index], location);
      const rent = category.prices[index];
      await Property.create({
        title,
        description: `A bright, well-maintained ${category.type.toLowerCase()} available for rent in ${location.phase}, ${location.city}.`,
        propertyType: category.type,
        type: category.type,
        category: category.type,
        purpose: 'Rent',
        transactionType: 'Rent',
        listingType: 'rent',
        price: rent,
        rent,
        salePrice: 0,
        location: location.phase,
        phase: location.phase,
        block: location.block,
        city: location.city,
        address: `${location.block}, ${location.phase}, ${location.city}`,
        bedrooms: category.bedrooms[index],
        bathrooms: category.type === 'House' ? 3 : 2,
        area: category.type === 'House' ? 2500 + index * 250 : 1100 + index * 100,
        images: [{ url: image, public_id: '' }],
        image,
        featuredImage: { url: image, public_id: '' },
        status: 'Available',
        availability: 'Available',
        ownerId: SEED_OWNER_ID,
      });
      titles.add(normalize(title));
      created += 1;
    }

    results[category.type.toLowerCase()] = { existing: current.length, created };
  }

  return results;
}

const run = async () => {
  try {
    await connectDatabase();
    const result = await ensureRentalShowcaseProperties();
    for (const [category, counts] of Object.entries(result)) {
      console.log(`${category}: found ${counts.existing}, added ${counts.created} rental listings.`);
    }
  } finally {
    await closeDatabase();
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error('Rental showcase seed failed:', error);
    process.exitCode = 1;
  });
}
