import { toast } from 'react-toastify';
import { savePendingAction } from './authRedirect';
import { saveSelectedProperty } from './selectedPropertyStorage.jsx';

const isValidPropertyId = (id) => /^[0-9a-fA-F]{24}$/.test(String(id || ''));

export const normalizePropertyAvailability = (value) => {
  const status = String(value || '').trim();
  if (!status) return 'Available';

  const lowered = status.toLowerCase();
  if (['available', 'available now', 'ready', 'soon available', 'for rent'].includes(lowered)) return 'Available';
  if (['booked', 'reserved', 'occupied', 'pending', 'approved', 'confirmed'].includes(lowered)) return 'Booked';
  if (['rented', 'leased', 'tenant occupied'].includes(lowered)) return 'Rented';
  if (['sold', 'sold out', 'closed'].includes(lowered)) return 'Sold';
  if (['unavailable', 'not available'].includes(lowered)) return 'Unavailable';
  return status;
};

export const getPropertyAvailabilityBadge = (property) => {
  const status = normalizePropertyAvailability(property?.status || property?.availability || 'Available');

  if (status === 'Available') return { label: 'Available', kind: 'available' };
  if (['Booked', 'Rented', 'Unavailable'].includes(status)) return { label: 'Not Available', kind: 'unavailable' };
  if (status === 'Sold') return { label: 'Sold Out', kind: 'sold' };
  if (status === 'For Rent') return { label: 'Available', kind: 'available' };
  return { label: status || 'Available', kind: status === 'Sold' ? 'sold' : 'available' };
};

export const isPropertyUnavailable = (property) => {
  const status = normalizePropertyAvailability(property?.status || property?.availability || 'Available');
  return ['Booked', 'Rented', 'Unavailable'].includes(status);
};

export const isPropertySoldOut = (property) => normalizePropertyAvailability(property?.status || property?.availability || 'Available') === 'Sold';

export const getRentUnavailableStatus = (property) => {
  const badge = getPropertyAvailabilityBadge(property);
  if (badge.kind === 'unavailable') return badge.label;
  if (badge.kind === 'sold') return badge.label;
  return '';
};

export const startRentNow = async (property, isAuthenticated, navigate) => {
  const propertyId = property?.id || property?._id;
  if (!property || !isValidPropertyId(propertyId)) {
    toast.error('This property cannot be booked because its listing ID is missing or invalid.');
    return false;
  }

  const savedProperty = await saveSelectedProperty(property);
  if (!savedProperty) {
    toast.error('Unable to preserve the selected property. Please try again.');
    return false;
  }

  const rentRoute = `/rental-application?propertyId=${encodeURIComponent(propertyId)}`;
  if (isAuthenticated) {
    navigate(rentRoute);
    return true;
  }

  savePendingAction({
    action: 'RENT_NOW',
    propertyId,
    propertyType: property?.type || property?.propertyType || '',
    propertyTitle: property?.title || property?.name || '',
    returnRoute: rentRoute,
  });
  navigate(`/signup?redirect=${encodeURIComponent(rentRoute)}`);
  return true;
};
