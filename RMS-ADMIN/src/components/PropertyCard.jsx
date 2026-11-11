import './PropertyCard.css';

export default function PropertyCard({ property, onUpdate, onReplaceImage }) {
  const image = Array.isArray(property.images) && property.images.length ? (typeof property.images[0] === 'string' ? property.images[0] : property.images[0].url) : (property.image || 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=300&q=80');

  return (
    <div className="property-card">
      <div className="thumb" style={{ backgroundImage: `url(${image})` }} />
      <div className="meta">
        <h4>{property.title}</h4>
        <div className="meta-row">
          <span>{property.propertyType}</span>
          <strong>{property.city}</strong>
        </div>
        <div className="buttons">
          <button className="primary" onClick={() => onUpdate(property)}>Update</button>
          <label className="file-label small">
            Replace Image
            <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onReplaceImage(property, f); e.target.value = ''; }} style={{ display: 'none' }} />
          </label>
        </div>
      </div>
    </div>
  );
}
