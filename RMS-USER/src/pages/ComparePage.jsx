import { useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Row, Col, Card, Button, Table } from 'antd';
import { useProperties } from '../contexts/PropertyContext';
import CompareSaveModal from '../components/CompareSaveModal';
import { getPrimaryImage, FALLBACK_IMAGE } from '../utils/imageUtils';
import { toast } from 'react-toastify';

function ComparePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { properties } = useProperties();

  const idsParam = searchParams.get('ids') || '';
  const ids = idsParam ? idsParam.split(',').map((s) => Number(s)) : [];

  const selected = useMemo(() => properties.filter((p) => ids.includes(Number(p.id))).slice(0,3), [properties, ids]);

  const [modalOpen, setModalOpen] = useState(false);
  const handleSave = () => setModalOpen(true);
  const handleSaved = (payload) => {
    try {
      toast.success('Comparison saved');
    } catch (e) {}
  };

  if (!selected.length) return <div className="page-shell"><section className="section-card"><h2 className="section-title">Compare Properties</h2><p className="section-subtitle">Select up to 3 properties to compare. Use the listings page to add to compare.</p></section></div>;

  const fields = ['price','type','location','area','bedrooms','bathrooms','floor','parking','furnished','status','amenities'];

  return (
    <div className="page-shell">
      <section className="section-card">
        <h2 className="section-title">Compare Properties</h2>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <Button onClick={() => navigate('/properties')}>Back to Listings</Button>
          <Button type="primary" onClick={handleSave}>Save Comparison</Button>
        </div>
        <CompareSaveModal open={modalOpen} onClose={() => setModalOpen(false)} propertyIds={selected.map((s) => s.id)} onSaved={handleSaved} />

        <Row gutter={[12,12]}>
          {selected.map((p) => (
            <Col key={p.id} xs={24} md={8}>
              <Card cover={<img alt={p.title} src={getPrimaryImage(p) || FALLBACK_IMAGE} style={{ height: 160, objectFit: 'cover' }} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_IMAGE; }} />}>
                <h3>{p.title}</h3>
                <div>{p.address}</div>
                <div style={{ marginTop: 8 }}><strong>{p.price}</strong></div>
                <div style={{ marginTop: 8 }}>{p.bedrooms} beds • {p.bathrooms} baths • {p.area}</div>
              </Card>
            </Col>
          ))}
        </Row>

        <div style={{ marginTop: 16 }}>
          <Table
            pagination={false}
            columns={[{ title: 'Feature', dataIndex: 'feature', key: 'feature' }, ...selected.map((p) => ({ title: p.title, dataIndex: String(p.id), key: String(p.id) }))]}
            dataSource={fields.map((f) => ({ key: f, feature: f.charAt(0).toUpperCase() + f.slice(1), ...selected.reduce((acc, p) => ({ ...acc, [String(p.id)]: Array.isArray(p[f]) ? p[f].join(', ') : p[f] ?? '—' }), {}) }))}
          />
        </div>
      </section>
    </div>
  );
}

export default ComparePage;
