import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';
import favoriteService from '../services/favoriteService';
import { useAuth } from '../contexts/AuthContext';
import { getSaleInterestRoute, isSaleProperty } from '../utils/saleInterest';

const DEFAULT_STATUS = {
  Available: 'success',
  'For Rent': 'processing',
  Booked: 'warning',
  Rented: 'warning',
  Sold: 'error',
};

const normalizeDisplayStatus = (value) => {
  const raw = String(value || '').trim();
  const lowered = raw.toLowerCase();
  if (!raw) return 'Available';
  if (['available', 'available now', 'ready', 'soon available'].includes(lowered)) return 'Available';
  if (['booked', 'occupied', 'reserved'].includes(lowered)) return 'Booked';
  if (['rented', 'leased', 'tenant occupied'].includes(lowered)) return 'Rented';
  if (['for rent', 'rent'].includes(lowered)) return 'For Rent';
  if (['sold', 'closed'].includes(lowered)) return 'Sold';
  return raw;
};

function PropertyCard({ property, onSavedChange }) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [showInquiry, setShowInquiry] = useState(false);
  const [inquiryText, setInquiryText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(Boolean(property?.saved || property?.isSaved));

  const propertyId = property?._id || property?.id;
  const propertyTitle = property?.title || property?.name || 'Property';
  const price = property?.price || property?.rent || property?.askingPrice || 'Contact for price';
  const status = normalizeDisplayStatus(property?.status || property?.availability || 'Available');

  const redirectTarget = useMemo(() => `/properties/${propertyId}`, [propertyId]);

  const handleView = () => {
    const targetRoute = isSaleProperty(property) ? getSaleInterestRoute(property) : redirectTarget;
    if (!isAuthenticated) {
      const next = encodeURIComponent(targetRoute);
      navigate(`/login?redirect=${next}`);
      return;
    }

    navigate(targetRoute);
  };

  const handleContactOpen = () => {
    if (!isAuthenticated) {
      const next = encodeURIComponent(redirectTarget);
      navigate(`/login?redirect=${next}`);
      return;
    }

    setShowInquiry(true);
  };

  const handleContactSubmit = async () => {
    try {
      const response = await api.request('/contact', {
        method: 'POST',
        body: {
          fullName: user?.name || 'Guest User',
          email: user?.email || 'guest@example.com',
          phone: user?.phone || '',
          propertyId,
          propertyName: propertyTitle,
          inquiryType: 'Property Inquiry',
          message: inquiryText || `I am interested in ${propertyTitle}.`,
        },
      });

      if (!response || !response.success) {
        throw new Error(response?.message || 'Unable to send inquiry');
      }

      toast.success('Inquiry sent successfully');
      setShowInquiry(false);
      setInquiryText('');
    } catch (error) {
      toast.error(error?.message || error?.response?.data?.message || 'Unable to send inquiry');
    }
  };

  const handleSave = async () => {
    if (!isAuthenticated) {
      const next = encodeURIComponent(redirectTarget);
      navigate(`/login?redirect=${next}`);
      return;
    }

    const nextSavedState = !saved;

    try {
      setSaving(true);
      const result = nextSavedState
        ? await favoriteService.addFavorite(propertyId)
        : await favoriteService.removeFavorite(propertyId);

      if (!result || !result.success) {
        throw new Error(result?.message || 'Unable to update saved property');
      }

      setSaved(nextSavedState);
      if (onSavedChange) onSavedChange(propertyId, nextSavedState);
      toast.success(nextSavedState ? 'Property saved' : 'Property removed from saved list');
    } catch (error) {
      toast.error(error?.message || error?.response?.data?.message || 'Unable to update saved property');
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="property-card" style={{ border: '1px solid #e6edf3', borderRadius: 16, padding: 16, background: '#fff', boxShadow: '0 12px 24px rgba(17, 24, 39, 0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{propertyTitle}</div>
        <span
          style={{
            background: DEFAULT_STATUS[status] === 'success' ? '#e7f8ee' : DEFAULT_STATUS[status] === 'warning' ? '#fff0d8' : DEFAULT_STATUS[status] === 'error' ? '#ffe4e6' : '#e8f1ff',
            color: DEFAULT_STATUS[status] === 'success' ? '#117a43' : DEFAULT_STATUS[status] === 'warning' ? '#b66a00' : DEFAULT_STATUS[status] === 'error' ? '#b42318' : '#1d4ed8',
            borderRadius: 999,
            padding: '5px 10px',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {status}
        </span>
      </div>

      <div style={{ marginBottom: 12, color: '#475467', fontSize: 14 }}>
        {property?.location || property?.area || 'Location not specified'}
      </div>

      <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 14, color: '#123a70' }}>
        {typeof price === 'number' ? `PKR ${price.toLocaleString()}` : price}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={handleView} style={actionButtonStyle}>View</button>
        <button type="button" onClick={handleContactOpen} style={actionButtonStyle}>Contact</button>
        <button type="button" onClick={handleSave} style={{ ...actionButtonStyle, ...(saved ? savedButtonStyle : {}) }} disabled={saving}>
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {showInquiry && (
        <div style={{ marginTop: 16, borderTop: '1px solid #e6edf3', paddingTop: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Inquiry message</label>
          <textarea
            value={inquiryText}
            onChange={(event) => setInquiryText(event.target.value)}
            rows={4}
            placeholder={`Hi, I am interested in ${propertyTitle}.`}
            style={{ width: '100%', border: '1px solid #d0d7e2', borderRadius: 10, padding: 10, resize: 'vertical' }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
            <button type="button" onClick={() => setShowInquiry(false)} style={{ ...actionButtonStyle, background: '#f2f6fb', color: '#1e293b' }}>
              Cancel
            </button>
            <button type="button" onClick={handleContactSubmit} style={actionButtonStyle}>
              Send inquiry
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

const actionButtonStyle = {
  border: 'none',
  borderRadius: 10,
  padding: '10px 14px',
  background: '#123a70',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};

const savedButtonStyle = {
  background: '#e7f8ee',
  color: '#117a43',
};

export default PropertyCard;
