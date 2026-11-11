import { useEffect, useState } from 'react';
import './AdminPropertySlider.css';
import { getAdminImageUrl } from '../utils/adminImageUrl';

const getPlaceholderImage = (title = 'Property') => {
  const safeTitle = String(title).replace(/[&<>"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#e8eef5"/><path d="M180 190l140-110 140 110v95H180z" fill="#b8c8d8"/><text x="50%" y="84%" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#334155">${safeTitle}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

export default function AdminPropertySlider({ properties = [], onEdit, onUploadImage, onReplaceImage, onDelete }) {
  const [start, setStart] = useState(0);
  const activeStart = properties.length ? start % properties.length : 0;
  const visible = Array.from(
    { length: Math.min(5, properties.length) },
    (_, index) => properties[(activeStart + index) % properties.length],
  );
  useEffect(() => {
    if (properties.length <= 5) return undefined;
    const timer = window.setInterval(() => {
      setStart((value) => (value + 1) % properties.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [properties.length]);

  if (!properties.length) {
    return <div className="empty-state">No properties are available in this category yet.</div>;
  }

  return (
    <section className="admin-property-slider" aria-label="Property slider">
      <div className="admin-property-slider-controls">
        <button type="button" className="table-button light" aria-label="Previous properties" disabled={properties.length <= 5} onClick={() => setStart((activeStart - 1 + properties.length) % properties.length)}>Previous</button>
        <span>{activeStart + 1} of {properties.length}</span>
        <button type="button" className="table-button light" aria-label="Next properties" disabled={properties.length <= 5} onClick={() => setStart((activeStart + 1) % properties.length)}>Next</button>
      </div>
      <div className="admin-property-slider-track">
        {visible.map((property, index) => {
          const image = getAdminImageUrl(property.image || property.featuredImage || property.images?.[0]) || getPlaceholderImage(property.title);
          const id = property._id || property.id || `${property.title}-${index}`;
          return (
            <article className="admin-property-slider-card" key={id}>
              <img
                src={image}
                alt={property.title || 'Rental property'}
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = getPlaceholderImage(property.title);
                }}
              />
              <h4>{property.title || 'Untitled property'}</h4>
              <p>{[property.location, property.city].filter(Boolean).join(', ') || 'Location not set'}</p>
              <strong>PKR {Number(property.rent || property.price || 0).toLocaleString()} / month</strong>
              <span>{Number(property.bedrooms || 0)} bedrooms</span>
              <div className="admin-property-slider-actions">
                {onUploadImage && (
                  <label className="table-button light">
                    Add image
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (file) onUploadImage(property, file);
                      }}
                    />
                  </label>
                )}
                {onReplaceImage && (
                  <label className="table-button light">
                    Replace image
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (file) onReplaceImage(property, file);
                      }}
                    />
                  </label>
                )}
                {onEdit && <button type="button" className="table-button light" onClick={() => onEdit(property)}>Edit</button>}
                {onDelete && <button type="button" className="table-button danger" onClick={() => {
                  if (window.confirm(`Delete "${property.title || 'this property'}"? This action cannot be undone.`)) {
                    onDelete(property);
                  }
                }}>Delete</button>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
