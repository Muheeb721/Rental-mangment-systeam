import Property from '../models/Property.js';

// --- Recommendation helpers (deterministic, same priorities as frontend)
const normalizeText = (v) => (typeof v === 'string' ? v.toLowerCase().trim() : '');
const parseNumber = (v) => { const n = Number(String(v || 0).replace(/[^0-9.-]+/g, '')); return Number.isFinite(n) ? n : 0; };
const asLocationMatch = (property, preferredLocation) => {
  if (!preferredLocation) return 100;
  const target = normalizeText(preferredLocation);
  const haystack = `${property.location || ''} ${property.address || ''} ${property.area || ''}`.toLowerCase();
  return haystack.includes(target) ? 100 : 70;
};
const propertyPrice = (property) => Number(property.price || property.salePrice || property.rent || 0) || 0;
const propertyTypeValue = (property) => String(property.type || property.propertyType || property.category || '').toLowerCase();

const scoreProperty = (property, prefs = {}) => {
  const budget = parseNumber(prefs.budget || 0);
  const preferredType = normalizeText(prefs.type || '');
  const preferredSaleType = normalizeText(prefs.saleType || prefs.transaction || '');
  const preferredLocation = prefs.location || '';
  const availabilityPref = normalizeText(prefs.availability || '');
  const targetBedrooms = parseNumber(prefs.bedrooms || 0);
  const targetBathrooms = parseNumber(prefs.bathrooms || 0);

  // type
  const propType = propertyTypeValue(property);
  let typeMatch = 100;
  if (preferredType && preferredType !== 'any' && preferredType !== 'all') {
    const target = preferredType;
    const apartmentSet = ['apartment','flat'];
    const hostelSet = ['hostel','room'];
    const houseSet = ['house','villa','home'];
    const matchesApartment = apartmentSet.some(t => target.includes(t)) && apartmentSet.some(t => propType.includes(t));
    const matchesHostel = hostelSet.some(t => target.includes(t)) && hostelSet.some(t => propType.includes(t));
    const matchesHouse = houseSet.some(t => target.includes(t)) && houseSet.some(t => propType.includes(t));
    if (!(matchesApartment || matchesHostel || matchesHouse || propType.includes(target))) {
      typeMatch = 20;
    }
  }

  // transaction
  let transactionMatch = 100;
  if (preferredSaleType) {
    const propTxn = normalizeText(property.transactionType || property.status || '');
    if (preferredSaleType.includes('rent')) {
      transactionMatch = propTxn.includes('rent') || propType.includes('hostel') ? 100 : 20;
    } else if (preferredSaleType.includes('sale') || preferredSaleType.includes('buy')) {
      transactionMatch = propTxn.includes('sale') || propTxn.includes('sell') ? 100 : 20;
    }
  }

  // budget
  const price = propertyPrice(property) || 0;
  let budgetMatch = 100;
  if (budget > 0) {
    if (price === 0) budgetMatch = 50;
    else if (price <= budget) budgetMatch = 100;
    else {
      const pctOver = ((price - budget) / Math.max(budget, 1)) * 100;
      budgetMatch = Math.max(0, Math.round(100 - Math.min(100, pctOver)));
    }
  }

  const locationMatch = asLocationMatch(property, preferredLocation);

  let availabilityMatch = 100;
  if (availabilityPref && availabilityPref !== 'all') {
    const propAvail = normalizeText(property.availability || property.status || '');
    availabilityMatch = propAvail && propAvail.includes(availabilityPref) ? 100 : 30;
  }

  const bedroomMatch = targetBedrooms > 0 ? Math.min(100, Math.round((Number(property.bedrooms || 0) / Math.max(targetBedrooms, 1)) * 100)) : 100;
  const bathroomMatch = targetBathrooms > 0 ? Math.min(100, Math.round((Number(property.bathrooms || 0) / Math.max(targetBathrooms, 1)) * 100)) : 100;

  const weights = { type: 0.35, transaction: 0.25, budget: 0.18, location: 0.12, availability: 0.05, bedrooms: 0.03, bathrooms: 0.02 };

  const raw = (typeMatch * weights.type) + (transactionMatch * weights.transaction) + (budgetMatch * weights.budget) + (locationMatch * weights.location) + (availabilityMatch * weights.availability) + (bedroomMatch * weights.bedrooms) + (bathroomMatch * weights.bathrooms);
  const score = Math.round(Math.min(100, Math.max(0, raw)));

  return { score, breakdown: { typeMatch, transactionMatch, budgetMatch, locationMatch, availabilityMatch, bedroomMatch, bathroomMatch } };
};

export const recommendProperties = async (req, res) => {
  try {
    const prefs = req.body || {};
    const all = await Property.find({ status: { $ne: 'Inactive' } }).lean();
    const scored = all.map((p) => ({ property: p, score: scoreProperty(p, prefs) }));
    scored.sort((a, b) => b.score.score - a.score.score);
    const mapped = scored.map(({ property, score }) => ({ ...property, matchScore: score.score, matchBreakdown: score.breakdown }));
    return res.json({ success: true, data: mapped });
  } catch (error) {
    console.error('Recommend properties failed', error);
    return res.status(500).json({ success: false, message: 'Unable to recommend properties.' });
  }
};

