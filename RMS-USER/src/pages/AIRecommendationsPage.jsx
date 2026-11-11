import { useMemo, useState, useEffect } from 'react';
import { Form, Input, Select, Button, Card, Row, Col, Tag, Rate, Divider } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useProperties } from '../contexts/PropertyContext';
import { getRecommendations } from '../services/recommendationService.jsx';
import propertyService from '../services/propertyService';
import FavoriteToggle from '../components/FavoriteToggle';
import { FALLBACK_IMAGE, getPrimaryImage } from '../utils/imageUtils';

const defaultPreferences = {
  budget: 1500000,
  type: 'Apartment',
  location: 'Gulberg',
  bedrooms: 2,
  bathrooms: 2,
  saleType: 'Rent',
  parking: 1,
  amenities: ['parking', 'security'],
};

function AIRecommendationsPage() {
  const navigate = useNavigate();
  const { properties } = useProperties();
  const [form] = Form.useForm();
  const [preferences, setPreferences] = useState(defaultPreferences);

  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await propertyService.recommendProperties(preferences);
        if (mounted && res && res.success && Array.isArray(res.data)) {
          setRecommendations(res.data.map((p) => ({ ...p, id: p._id || p.id })));
          return;
        }
      } catch (e) {
        // ignore
      }
      // fallback to client-side matching
      try {
        const local = getRecommendations(properties, preferences).map((p) => ({ ...p, id: p._id || p.id }));
        if (mounted) setRecommendations(local);
      } catch (e) {
        if (mounted) setRecommendations([]);
      }
    })();
    return () => { mounted = false; };
  }, [preferences, properties]);

  const applyForm = (values) => setPreferences({
    budget: Number(values.budget || 0),
    type: values.type || 'Any',
    location: values.location || '',
    bedrooms: Number(values.bedrooms || 0),
    bathrooms: Number(values.bathrooms || 0),
    saleType: values.saleType || 'Rent',
    parking: Number(values.parking || 0),
    amenities: values.amenities ? String(values.amenities).split(',').map((item) => item.trim()).filter(Boolean) : [],
  });

  return (
    <div className="page-shell">
      <section className="section-card">
        <h2 className="section-title">AI Property Recommendations</h2>
        <p className="section-subtitle">Use your requirements to analyze the live RMS property inventory and rank the best matches.</p>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <Card title="User Requirements" style={{ height: '100%' }}>
              <Form form={form} layout="vertical" initialValues={defaultPreferences} onFinish={applyForm}>
                <Form.Item label="Budget" name="budget"><Input type="number" /></Form.Item>
                <Form.Item label="Property Type" name="type">
                  <Select>
                    <Select.Option value="Any">Any</Select.Option>
                    <Select.Option value="House">House</Select.Option>
                    <Select.Option value="Flat">Flat</Select.Option>
                    <Select.Option value="Apartment">Apartment</Select.Option>
                    <Select.Option value="Hostel">Hostel</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item label="Location" name="location"><Input placeholder="e.g. Gulberg" /></Form.Item>
                <Form.Item label="Bedrooms" name="bedrooms"><Input type="number" /></Form.Item>
                <Form.Item label="Bathrooms" name="bathrooms"><Input type="number" /></Form.Item>
                <Form.Item label="Rent / Sale" name="saleType">
                  <Select>
                    <Select.Option value="Rent">Rent</Select.Option>
                    <Select.Option value="Sale">Sale</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item label="Parking" name="parking"><Input type="number" /></Form.Item>
                <Form.Item label="Amenities" name="amenities"><Input placeholder="security, parking, gym" /></Form.Item>
                <Button type="primary" htmlType="submit" block>Analyze Properties</Button>
              </Form>
            </Card>
          </Col>

          <Col xs={24} lg={16}>
            <Card title="Recommendation Results">
              {recommendations.slice(0, 6).map((property) => (
                <div key={property.id} style={{ border: '1px solid #eef2f8', borderRadius: 16, padding: 12, marginBottom: 12 }}>
                  <Row gutter={[12, 12]} align="middle">
                    <Col xs={24} md={8}>
                      <img src={getPrimaryImage(property) || FALLBACK_IMAGE} alt={property.title} style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 12 }} onError={(e)=>{ e.currentTarget.onerror=null; e.currentTarget.src = FALLBACK_IMAGE; }} />
                    </Col>
                    <Col xs={24} md={16}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <div>
                          <h4 style={{ marginBottom: 4 }}>{property.title}</h4>
                          <div style={{ color: '#64748b' }}>{property.location || property.address}</div>
                        </div>
                        <Tag color="green" style={{ fontSize: 15, padding: '4px 10px' }}>{property.matchScore}% Match</Tag>
                      </div>

                      <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Tag>{property.price}</Tag>
                        <Tag>{property.type}</Tag>
                        <Tag>{property.bedrooms} Beds</Tag>
                        <Tag>{property.bathrooms} Baths</Tag>
                      </div>

                      <div style={{ marginTop: 10, fontSize: 13 }}>
                        <strong>Match breakdown:</strong>
                        <div style={{ display: 'grid', gap: 4, marginTop: 4 }}>
                          {Object.entries(property.matchBreakdown || {}).map(([label, value]) => (
                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                              <span>{label}</span>
                              <strong>{value}</strong>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {property.matchingReasons?.map((reason) => <Tag key={reason}>{reason}</Tag>)}
                      </div>

                      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Button type="primary" onClick={() => navigate(`/properties/${property.id}`)}>View Details</Button>
                        <FavoriteToggle item={property} label="Save" />
                        <Button onClick={() => navigate(`/compare?ids=${property.id}`)}>Compare</Button>
                        <Button onClick={() => navigate(`/bookings`)}>Book</Button>
                      </div>
                    </Col>
                  </Row>
                </div>
              ))}
            </Card>
          </Col>
        </Row>
      </section>
    </div>
  );
}

export default AIRecommendationsPage;
