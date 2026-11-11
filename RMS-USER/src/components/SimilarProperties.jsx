import { Row, Col, Card, Tag, Button } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import { useProperties } from '../contexts/PropertyContext';
import { getPrimaryImage, FALLBACK_IMAGE } from '../utils/imageUtils';

function SimilarProperties({ property, limit = 4 }) {
  const { properties } = useProperties();
  if (!property) return null;

  const candidates = properties.filter((p) => p.id !== property.id);

  const scored = candidates.map((p) => {
    let score = 0;
    if (p.type === property.type) score += 3;
    if (p.area === property.area) score += 2;
    const priceA = Number(String(p.price).replace
    (/[^0-9.-]+/g, '')) || 0;
    const priceB = Number(String(property.price).replace
    (/[^0-9.-]+/g, '')) || 0;
    const priceDiff = Math.abs(priceA - priceB);
    if (priceDiff < Math.max(10000, priceB * 0.2)) score += 2;
    if (p.bedrooms === property.bedrooms) score += 1;
    if (p.area === property.area) score += 1;
    return { p, score };
  });

  const sorted = scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.p);

  if (!sorted.length) return null;

  return (
    <div style={{ marginTop: 18 }}>
      <h3>You May Also Like</h3>
      <Row gutter={[12, 12]}>
        {sorted.map((p) => (
          <Col key={p.id} xs={24} sm={12} md={6}>
            <Card size="small" cover={<img alt={p.title} src={getPrimaryImage(p) || FALLBACK_IMAGE} style={{ height: 120, objectFit: 'cover' }} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_IMAGE; }} />}>
              <div style={{ fontWeight: 700 }}>{p.title}</div>
              <div style={{ color: '#64809b', display: 'flex', alignItems: 'center', gap: 6 }}><EnvironmentOutlined /> {p.address}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                <Tag color="blue">{p.type}</Tag>
                <Tag color="green">{p.availability || p.status}</Tag>
              </div>
              <div style={{ marginTop: 8 }}>
                 <Button type="link" onClick={() => { import('../utils/selectedPropertyStorage.jsx').then(m => m.saveSelectedProperty(p)); window.location.href = `/properties/${p.id}`; }}>View</Button>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}

export default SimilarProperties;
