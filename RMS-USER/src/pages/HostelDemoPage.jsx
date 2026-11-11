import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { hostelData } from '../data/dummyData';
import './demopage.css';
import { saveSelectedProperty } from '../utils/selectedPropertyStorage.jsx';
import { resolveUniquePropertyImage } from '../utils/propertyImageCatalog';

const categories = ['All', 'Hostel', 'Boys Hostel', 'Girls Hostel', 'Family Hostel'];

function HostelDemoPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const filteredHostels = useMemo(() => {
    const term = searchTerm.toLowerCase();

    return hostelData.filter((hostel) => {
      const matchesCategory = activeCategory === 'All' || hostel.type === activeCategory;
      const matchesSearch =
        !term ||
        hostel.title?.toLowerCase().includes(term) ||
        hostel.address?.toLowerCase().includes(term) ||
        hostel.area?.toLowerCase().includes(term) ||
        hostel.description?.toLowerCase().includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchTerm]);

  const handleViewProperty = (property) => {
    saveSelectedProperty(property);
    navigate(property.id ? `/hostels/${property.id}` : '/contact');
  };

  const handleReserveProperty = (property) => {
    saveSelectedProperty(property);
    navigate(`/contact?propertyTitle=${encodeURIComponent(property.title || '')}&propertyType=${encodeURIComponent(property.type || '')}`);
  };

  return (
    <div className="demo-page">
      <header className="demo-header">
        <div className="demo-heading">
          <p className="eyebrow">Hostel Demo</p>
          <h1>Hostel-only management view</h1>
          <p className="subtitle">This page shows hostel listings only. House content remains completely separate and hidden here.</p>
        </div>

        <div className="demo-search-panel">
          <input
            type="search"
            placeholder="Search hostels…"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <div className="demo-filters">
            {categories.map((category) => (
              <button
                key={category}
                className={category === activeCategory ? 'filter-button active' : 'filter-button'}
                onClick={() => setActiveCategory(category)}
                type="button"
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="property-section">
        <div className="section-header">
          <div>
            <h2>Hostel management console</h2>
            <p>Browse hostel listings and keep all accommodation information in its own dedicated space.</p>
          </div>
          <span className="section-count">{filteredHostels.length} hostel records</span>
        </div>

        <div className="management-layout" style={{ gridTemplateColumns: '1fr' }}>
          <div className="management-preview">
            {filteredHostels.map((hostel, index) => (
              <article className="property-card compact" key={hostel.id}>
                <div className="card-image" style={{ backgroundImage: `url(${resolveUniquePropertyImage(hostel, 'demo', index)})` }} />
                <div className="card-body">
                  <div className="card-meta">
                    <span className="card-type">{hostel.type}</span>
                    <span className="status-badge available">{hostel.status || 'Available'}</span>
                  </div>
                  <h3>{hostel.title}</h3>
                  <p className="location">📍 {hostel.address}</p>
                  <div className="card-footer">
                    <p className="price">{hostel.monthlyFee}</p>
                    <div className="card-actions">
                      <button type="button" className="secondary-button" onClick={() => handleViewProperty(hostel)}>View</button>
                      <button type="button" className="details-button" onClick={() => handleReserveProperty(hostel)}>Reserve</button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="demo-cta">
        <div>
          <p>Hostel Portfolio Management</p>
          <h2>Handle rooms, occupancy, and budgets without mixing in residential property data.</h2>
        </div>
        <Link to="/demo/house" className="cta-button1">Open House View</Link>
      </section>
    </div>
  );
}

export default HostelDemoPage;
