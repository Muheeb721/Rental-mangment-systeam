export const isSaleProperty = (property = {}) => {
  const transaction = String(
    property.listingType || property.listing_type || property.transactionType || property.purpose || '',
  ).trim().toLowerCase();
  const type = String(property.type || property.propertyType || property.category || '').trim().toLowerCase();
  const title = String(property.title || property.name || '').trim().toLowerCase();
  const status = String(property.status || property.availability || '').trim().toLowerCase();

  if (['sale', 'sell', 'buy', 'purchase', 'for sale', 'for_sale'].includes(transaction)) return true;
  if (['rent', 'rental', 'for rent', 'for_rent'].includes(transaction)) return false;

  if (title.includes('for sale') || title.includes('sale')) return true;
  if (title.includes('for rent') || title.includes('rent')) return false;
  if (status.includes('for sale') || status.includes('sale')) return true;
  if (status.includes('for rent') || status.includes('rent')) return false;

  const hasExplicitTransaction = Boolean(property.listingType || property.transactionType || property.purpose);
  if (!hasExplicitTransaction) {
    if (['house', 'apartment', 'villa', 'home'].includes(type)) return true;
    if (['flat', 'room', 'studio'].includes(type)) return false;
  }

  if (['house', 'apartment', 'villa', 'home'].includes(type) && !transaction) return true;
  if (['flat', 'room', 'studio'].includes(type) && !transaction) return false;

  return false;
};

export const getPropertyId = (property = {}) => property.id || property._id || '';

export const getSaleInterestRoute = (property = {}) => {
  const id = encodeURIComponent(getPropertyId(property));
  return `/sale-interest?propertyId=${id}`;
};

export default { isSaleProperty, getPropertyId, getSaleInterestRoute };
