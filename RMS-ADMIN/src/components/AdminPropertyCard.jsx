import { useRef, useState } from 'react';
import {
  deleteAdminProperty,
  replaceMainPropertyImage,
} from '../services/adminPropertyService';

const BACKEND_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:5000'
)
  .replace(/\/api\/?$/, '')
  .replace(/\/$/, '');

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80';

const getImageUrl = (property) => {
  const firstImage = Array.isArray(property?.images)
    ? property.images[0]
    : null;

  const image =
    property?.image ||
    property?.featuredImage?.url ||
    (typeof firstImage === 'string' ? firstImage : firstImage?.url);

  if (!image || typeof image !== 'string') {
    return FALLBACK_IMAGE;
  }

  if (
    image.startsWith('data:') ||
    image.startsWith('blob:') ||
    /^https?:\/\//i.test(image)
  ) {
    return image;
  }

  return image.startsWith('/')
    ? `${BACKEND_BASE_URL}${image}`
    : image;
};

const getPropertyId = (property) =>
  property?._id ||
  property?.id ||
  property?.propertyId ||
  property?.mongoId;

function AdminPropertyCard({
  property,
  onEdit,
  onUpdated,
  onDeleted,
  notify,
}) {
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const propertyId = getPropertyId(property);

  const showNotification = (message, variant = 'info') => {
    if (typeof notify === 'function') {
      notify({ message, variant });
    }
  };

  const handleReplaceImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !propertyId) {
      return;
    }

    try {
      setBusy(true);
      showNotification('Replacing image...', 'info');

      const response = await replaceMainPropertyImage(propertyId, file);
      const updatedProperty = response?.property || response;
      console.debug('[AdminPropertyCard] Main image update response:', {
        propertyId,
        success: Boolean(response),
        returnedProperty: Boolean(response?.property),
        image: updatedProperty?.image || updatedProperty?.featuredImage?.url || '',
      });

      if (!updatedProperty || typeof updatedProperty !== 'object') {
        throw new Error('Image update returned an invalid property response.');
      }

      if (typeof onUpdated === 'function') {
        onUpdated(updatedProperty);
      }

      showNotification('Image replaced successfully.', 'success');
    } catch (error) {
      console.error('Replace property image failed:', error);
      showNotification(
        error.message || 'Unable to replace image.',
        'error'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!propertyId) {
      showNotification('This listing has no valid ID.', 'error');
      return;
    }

    const confirmed = window.confirm(
      `Delete "${property.title || 'this listing'}"? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setBusy(true);
      showNotification('Deleting listing...', 'info');

      await deleteAdminProperty(propertyId);

      if (typeof onDeleted === 'function') {
        onDeleted(propertyId);
      }

      showNotification('Listing deleted successfully.', 'success');
    } catch (error) {
      console.error('Delete property failed:', error);
      showNotification(
        error.message || 'Unable to delete listing.',
        'error'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="admin-property-card">
      <img
        src={getImageUrl(property)}
        alt={property.title || 'Property'}
        className="admin-property-card__image"
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = FALLBACK_IMAGE;
        }}
      />

      <div className="admin-property-card__content">
        <div className="admin-property-card__header">
          <h3>{property.title || 'Untitled listing'}</h3>
          <span>{property.propertyType || property.type || 'Property'}</span>
        </div>

        <p className="admin-property-card__price">
          {Number(property.price || 0).toLocaleString()}
        </p>

        <p className="admin-property-card__description">
          {property.description || 'No description provided.'}
        </p>

        <div className="admin-property-card__actions">
          <button
            type="button"
            className="table-button light"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            Replace Image
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={handleReplaceImage}
          />

          <button
            type="button"
            className="table-button light"
            disabled={busy}
            onClick={() => onEdit(property)}
          >
            Edit
          </button>

          <button
            type="button"
            className="table-button danger"
            disabled={busy}
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

export default AdminPropertyCard;
