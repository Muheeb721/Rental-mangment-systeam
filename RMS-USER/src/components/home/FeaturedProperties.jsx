import React from 'react';
import { Row, Col, Card, Tag, Button } from 'antd';
import FavoriteToggle from '../../components/FavoriteToggle';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import './home-redesign.css';
import { FALLBACK_IMAGE, getPrimaryImage } from '../../utils/imageUtils';

export default function FeaturedProperties({items}){
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth || {});

  const handleProtectedNavigation = (targetUrl) => {
    if (!user?.isLoggedIn) {
      navigate(`/login?redirect=${encodeURIComponent(targetUrl)}`);
      return;
    }

    navigate(targetUrl);
  };

  return (
    <section className="hr-section">
      <div className="section-header">
        <div>
          <h3 className="section-title">Featured Properties</h3>
          <p className="section-sub">Explore some of our most popular properties.</p>
        </div>
        <Button type="link" onClick={()=>navigate('/properties')}>View all</Button>
      </div>
      <Row gutter={[16,16]}>
        {items.map((property, index)=> (
          <Col xs={24} sm={12} md={8} key={property.id}>
            <Card className="property-card" cover={<img alt={property.title} src={getPrimaryImage(property, index, 'home') || FALLBACK_IMAGE} loading="lazy" style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: 12 }} onError={(e)=>{ e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_IMAGE; }} /> }>
              <div className="card-body">
                <div className="card-top-row">
                  <Tag color={property.transactionType==='Rent' ? 'cyan' : 'blue'}>{property.transactionType==='Rent' ? 'FOR RENT' : property.type}</Tag>
                  <span className="card-price">{property.rentPrice || property.price}</span>
                </div>
                <div className="card-title">{property.title}</div>
                <div className="card-address">{property.address}</div>
                <div className="meta-row">
                  <span className="meta-pill">{property.bedrooms} beds</span>
                  <span className="meta-pill">{property.bathrooms} baths</span>
                  <span className="meta-pill">{property.area}</span>
                </div>
                <div className="card-actions">
                  <Button onClick={() => handleProtectedNavigation(`/properties/${property.id}`)}>View Details</Button>
                  <FavoriteToggle item={property} label="Save" />
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </section>
  );
}
