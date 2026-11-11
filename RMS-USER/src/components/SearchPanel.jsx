import { useState } from 'react';
import { Card, Input, Select, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import SavedSearchModal from './SavedSearchModal';

function SearchPanel() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('Any Type');
  const [area, setArea] = useState('All Areas');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const navigate = useNavigate();

  const findMatches = () => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (type && type !== 'Any Type') params.set('type', type);
    if (area && area !== 'All Areas') params.set('area', area);
    if (minPrice) params.set('minPrice', String(minPrice));
    if (maxPrice) params.set('maxPrice', String(maxPrice));
    if (bedrooms) params.set('bedrooms', String(bedrooms));
    if (bathrooms) params.set('bathrooms', String(bathrooms));

    navigate(`/properties?${params.toString()}`);
  };

  const handleSave = () => setModalOpen(true);

  const handleSaved = () => {
    setModalOpen(false);
  };

  return (
    <>
      <Card style={{ borderRadius: 24 }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <Input placeholder="Search by area, type, budget, or bedrooms" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Select value={type} onChange={(v) => setType(v)} style={{ width: '100%' }}>
            <Select.Option value="Any Type">Any Type</Select.Option>
            <Select.Option value="House">House</Select.Option>
            <Select.Option value="Apartment">Apartment</Select.Option>
            <Select.Option value="Flat">Flat</Select.Option>
            <Select.Option value="Room">Room</Select.Option>
            <Select.Option value="Commercial Building">Commercial Building</Select.Option>
          </Select>
          <Select value={area} onChange={(v) => setArea(v)} style={{ width: '100%' }}>
            <Select.Option value="All Areas">All Areas</Select.Option>
            <Select.Option value="DHA Lahore">DHA Lahore</Select.Option>
            <Select.Option value="Bahria Town Lahore">Bahria Town Lahore</Select.Option>
            <Select.Option value="Gulberg">Gulberg</Select.Option>
            <Select.Option value="Johar Town">Johar Town</Select.Option>
          </Select>

          <div style={{ display: 'flex', gap: 8 }}>
            <Input placeholder="Min price" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
            <Input placeholder="Max price" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Input placeholder="Bedrooms" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
            <Input placeholder="Bathrooms" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="primary" block onClick={findMatches}>Find Matches</Button>
            <Button onClick={handleSave}>Save This Search</Button>
          </div>
        </div>
      </Card>

      <SavedSearchModal open={modalOpen} onClose={() => setModalOpen(false)} filters={{ q: query, type, area, minPrice, maxPrice, bedrooms, bathrooms }} onSaved={handleSaved} />
    </>
  );
}

export default SearchPanel;
