import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, Tag, Button } from 'antd';
import { useSelector } from 'react-redux';
import { useProperties } from '../contexts/PropertyContext';
import { hostelData } from '../data/dummyData';
import FavoriteToggle from '../components/FavoriteToggle';
import './FavoritesPage.css';
import { FALLBACK_IMAGE, getPrimaryImage } from '../utils/imageUtils';

function FavoritesPage() {
  const { favorites } = useSelector((state) => state.auth || {});
  const { properties } = useProperties();

  const favoriteListings = useMemo(() => {
    if (!Array.isArray(favorites) || favorites.length === 0) return [];

    const propertyFavorites = properties.filter((property) => favorites.includes(`property:${property.id}`));
    const hostelFavorites = hostelData.filter((hostel) => favorites.includes(`hostel:${hostel.id}`));

    return [...propertyFavorites, ...hostelFavorites];
  }, [favorites, properties]);

  return (
    <div className="page-shell favorites-shell">
      <section className="section-card favorites-card">
        <div className="favorites-header">
          <div>
            <h1>Favorites</h1>
            <p>Saved listings appear here for quick review and easy outreach.</p>
          </div>
          <span className="favorites-count">{favoriteListings.length} saved properties</span>
        </div>

        {favoriteListings.length === 0 ? (
          <div className="favorites-empty">
            <div className="empty-icon">💖</div>
            <h2>No Favorites Yet</h2>
            <p>Save properties you like and they will appear here.</p>
            <Link to="/properties" className="btn-primary">
              Browse Properties
            </Link>
          </div>
        ) : (
          <div className="favorites-grid">
            {favoriteListings.map((property) => (
              <Card
                key={property.id}
                className="favorite-card card-hover"
                cover={<img alt={property.title} src={getPrimaryImage(property) || FALLBACK_IMAGE} style={{ width: '100%', height: 200, objectFit: 'cover' }} onError={(e)=>{ e.currentTarget.onerror=null; e.currentTarget.src=FALLBACK_IMAGE; }} />}
              >
                <div className="card-body">
                  <div className="card-top-row">
                    <Tag color="blue">{property.type}</Tag>
                    <span className="card-price">{property.price}</span>
                  </div>
                  <h3 className="card-title">{property.title}</h3>
                  <div className="card-address">{property.address}</div>
                  <div className="meta-row">
                    <span className="meta-pill">{property.bedrooms} beds</span>
                    <span className="meta-pill">{property.bathrooms} baths</span>
                    <span className="meta-pill">{property.area}</span>
                  </div>
                  <div className="favorite-actions">
                    <Link
                      to={property.source === 'hostel' ? `/hostels/${property.id}` : `/properties/${property.id}`}
                      className="btn-secondary"
                      onClick={() => { import('../utils/selectedPropertyStorage.jsx').then(m => m.saveSelectedProperty(property)); }}
                    >
                      View details
                    </Link>
                    <FavoriteToggle item={property} label="Remove" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default FavoritesPage;
