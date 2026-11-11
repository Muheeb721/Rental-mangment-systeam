const parseNumber = (value) => {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
};

const normalizeText = (value) => (typeof value === 'string' ? value.toLowerCase().trim() : '');

const asLocationMatch = (property, preferredLocation) => {
  if (!preferredLocation) return 100;
  const target = normalizeText(preferredLocation);
  const haystack = `${property.location || ''} ${property.address || ''} ${property.area || ''}`.toLowerCase();
  return haystack.includes(target) ? 100 : 70;
};

const computeAmenityScore = (property, preferredAmenities = []) => {
  const propertyAmenities = Array.isArray(property.amenities) ? property.amenities.map((item) => String(item).toLowerCase()) : [];
  const preferred = Array.isArray(preferredAmenities) ? preferredAmenities.map((item) => String(item).toLowerCase()) : [];
  if (!preferred.length) return 100;
  const matches = preferred.filter((item) => propertyAmenities.includes(item)).length;
  return Math.round((matches / preferred.length) * 100);
};

const propertyPrice = (property) => {
  const numeric = parseNumber(property.rentPrice || property.salePrice || property.price || 0);
  return numeric || 0;
};

const propertyType = (property) => String(property.type || property.category || '').trim();

export const matchPropertyToPreferences = (property = {}, preferences = {}) => {
  const budget = parseNumber(preferences.budget || 0);
  const targetBedrooms = parseNumber(preferences.bedrooms || 0);
  const targetBathrooms = parseNumber(preferences.bathrooms || 0);
  const preferredType = normalizeText(preferences.type || '');
  const preferredLocation = String(preferences.location || '');
  const preferredSaleType = normalizeText(preferences.saleType || preferences.rentSale || preferences.transactionType || '');
  const preferredParking = parseNumber(preferences.parking || 0);
  const preferredAmenities = Array.isArray(preferences.amenities) ? preferences.amenities : [];

  // Deterministic prioritized matching
  const propType = normalizeText(propertyType(property));

  // Type matching - highest priority. Use strict matching for selected types.
  let typeMatch;
  if (!preferredType || preferredType === '' || preferredType === 'any' || preferredType === 'all') {
    typeMatch = 100;
  } else {
    const target = preferredType;
    const apartmentSet = ['apartment', 'flat'];
    const hostelSet = ['hostel', 'room', 'hostel'];
    const houseSet = ['house', 'villa', 'home'];
    const prop = propType;
    const matchesApartment = apartmentSet.some((t) => target.includes(t)) && apartmentSet.some((t) => prop.includes(t));
    const matchesHostel = hostelSet.some((t) => target.includes(t)) && hostelSet.some((t) => prop.includes(t));
    const matchesHouse = houseSet.some((t) => target.includes(t)) && houseSet.some((t) => prop.includes(t));
    if (matchesApartment || matchesHostel || matchesHouse || prop.includes(target)) {
      typeMatch = 100;
    } else {
      // strong penalty for non-matching type to keep recommendations focused
      typeMatch = 20;
    }
  }

  // Transaction / sale vs rent
  let transactionMatch = 100;
  if (preferredSaleType) {
    const propTxn = normalizeText(property.transactionType || property.status || '');
    if (preferredSaleType.includes('rent')) {
      transactionMatch = propTxn.includes('rent') || propType.includes('hostel') ? 100 : 20;
    } else if (preferredSaleType.includes('sale') || preferredSaleType.includes('buy')) {
      transactionMatch = propTxn.includes('sale') || propTxn.includes('sell') || propTxn.includes('sale') ? 100 : 20;
    } else {
      transactionMatch = 100;
    }
  }

  // Budget match: full score if within budget, decreased proportionally if over budget
  const price = propertyPrice(property) || 0;
  let budgetMatch;
  if (budget > 0) {
    if (price === 0) budgetMatch = 50; // unknown price
    else if (price <= budget) budgetMatch = 100;
    else {
      const pctOver = ((price - budget) / Math.max(budget, 1)) * 100;
      budgetMatch = Math.max(0, Math.round(100 - Math.min(100, pctOver)));
    }
  } else {
    budgetMatch = 100;
  }

  const locationMatch = asLocationMatch(property, preferredLocation);

  const availabilityPref = normalizeText(preferences.availability || preferences.avail || '');
  let availabilityMatch = 100;
  if (availabilityPref && availabilityPref !== 'all') {
    const propAvail = normalizeText(property.availability || property.status || '');
    availabilityMatch = propAvail && propAvail.includes(availabilityPref) ? 100 : 30;
  }

  const bedroomMatch = targetBedrooms > 0
    ? Math.min(100, Math.round((Number(property.bedrooms || 0) / Math.max(targetBedrooms, 1)) * 100))
    : 100;

  const bathroomMatch = targetBathrooms > 0
    ? Math.min(100, Math.round((Number(property.bathrooms || 0) / Math.max(targetBathrooms, 1)) * 100))
    : 100;

  const amenitiesMatch = computeAmenityScore(property, preferredAmenities);

  // Weights: enforce priority order
  const weights = {
    type: 0.35,
    transaction: 0.25,
    budget: 0.18,
    location: 0.12,
    availability: 0.05,
    bedrooms: 0.03,
    bathrooms: 0.02,
    // amenities and parking are tiebreakers (small influence)
    amenities: 0.02,
  };

  const rawScore = (
    (typeMatch * weights.type) +
    (transactionMatch * weights.transaction) +
    (budgetMatch * weights.budget) +
    (locationMatch * weights.location) +
    (availabilityMatch * weights.availability) +
    (bedroomMatch * weights.bedrooms) +
    (bathroomMatch * weights.bathrooms) +
    (amenitiesMatch * weights.amenities)
  );

  const score = Math.round(Math.min(100, Math.max(0, rawScore)));

  const reasons = [];
  if (typeMatch >= 100) reasons.push('Property type match');
  if (transactionMatch >= 100) reasons.push('Transaction match');
  if (budgetMatch >= 90) reasons.push('Budget match');
  if (locationMatch >= 90) reasons.push('Location match');
  if (availabilityMatch >= 90) reasons.push('Available');
  if (reasons.length === 0) reasons.push('Overall match');

  return {
    score: Math.min(100, Math.max(0, score)),
    budgetMatch,
    locationMatch,
    bedroomMatch,
    bathroomMatch,
    typeMatch,
    amenitiesMatch,
    transactionMatch,
    availabilityMatch,
    reasons: reasons.slice(0, 5),
  };
};

export const getRecommendations = (properties = [], preferences = {}) => {
  if (!Array.isArray(properties) || !properties.length) return [];

  return properties
    .map((property) => ({
      property,
      match: matchPropertyToPreferences(property, preferences),
    }))
    .sort((a, b) => b.match.score - a.match.score)
    .map(({ property, match }) => ({
      ...property,
      matchScore: match.score,
      matchBreakdown: {
        Budget: `${match.budgetMatch}%`,
        Location: `${match.locationMatch}%`,
        Bedrooms: `${match.bedroomMatch}%`,
        Bathrooms: `${match.bathroomMatch}%`,
        Parking: match.parkingMatch ? `${match.parkingMatch}%` : 'N/A',
        Amenities: `${match.amenitiesMatch}%`,
      },
      matchingReasons: match.reasons,
    }));
};

export default { matchPropertyToPreferences, getRecommendations };
