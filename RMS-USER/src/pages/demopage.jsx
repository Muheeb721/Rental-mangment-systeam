import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProperties } from '../contexts/PropertyContext';
import './demopage.css';
import { getPrimaryImage } from '../utils/imageUtils';

const categories = ['All', 'House', 'Apartment', 'Hostel', 'Room', 'Commercial'];

const emptyForm = {
  title: '',
  type: 'House',
  price: '',
  address: '',
  area: 'Lahore',
  bedrooms: 2,
  bathrooms: 2,
  parking: 1,
  status: 'Available',
  description: '',
  image: '',
};

function DemoPage() {
  const { properties, addProperty, updateProperty, deleteProperty } = useProperties();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const filteredProperties = useMemo(() => {
    const term = searchTerm.toLowerCase();

    return properties.filter((property) => {
      const matchesCategory = activeCategory === 'All' || String(property.type || '').toLowerCase() === String(activeCategory || '').toLowerCase();
      const matchesSearch =
        !term ||
        property.title?.toLowerCase().includes(term) ||
        property.address?.toLowerCase().includes(term) ||
        property.area?.toLowerCase().includes(term) ||
        property.description?.toLowerCase().includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, properties, searchTerm]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.title || !form.address || !form.price) {
      return;
    }

    const payload = {
      ...form,
      bedrooms: Number(form.bedrooms) || 0,
      bathrooms: Number(form.bathrooms) || 0,
      parking: Number(form.parking) || 0,
      image: form.image || 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80',
      images: [form.image || 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80'],
      location: form.address,
      address: form.address,
      availability: form.status,
      description: form.description || 'Managed through RMS live editing.',
    };

    if (editingId) {
      updateProperty(editingId, payload);
    } else {
      addProperty(payload);
    }

    resetForm();
  };

  const handleEdit = (property) => {
    setEditingId(property.id);
    setForm({
      title: property.title || '',
      type: property.type || 'House',
      price: property.price || '',
      address: property.address || property.location || '',
      area: property.area || 'Lahore',
      bedrooms: property.bedrooms ?? 2,
      bathrooms: property.bathrooms ?? 2,
      parking: property.parking ?? 1,
      status: property.status || 'Available',
      description: property.description || '',
      image: property.image || '',
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleDelete = (id) => {
    deleteProperty(id);
    if (editingId === id) {
      resetForm();
    }
  };

  return (
    <div className="demo-page">
      <header className="demo-header">
        <div className="demo-heading">
          <p className="eyebrow">Property Demo</p>
          <h1>Live property management for RMS</h1>
          <p className="subtitle">
            Add, edit, and remove listings in real time. Every change updates the shared property data used across the website.
          </p>
        </div>

        <div className="demo-search-panel">
          <input
            type="search"
            placeholder="Search properties…"
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
            <h2>Property management console</h2>
            <p>Create a new listing or update an existing one instantly.</p>
          </div>
          <span className="section-count">{properties.length} live records</span>
        </div>

        <div className="management-layout">
          <div className="management-preview">
            <h3>Live listings</h3>
            {filteredProperties.map((property) => (
              <article className="property-card compact" key={property.id}>
                <div className="card-image" style={{ backgroundImage: `url(${getPrimaryImage(property)})` }} />
                <div className="card-body">
                  <div className="card-meta">
                    <span className="card-type">{property.type}</span>
                    <span className={property.status === 'Available' ? 'status-badge available' : 'status-badge occupied'}>
                      {property.status}
                    </span>
                  </div>
                  <h3>{property.title}</h3>
                  <p className="location">📍 {property.address || property.location}</p>
                  <div className="card-footer">
                    <p className="price">{property.price}</p>
                    <div className="card-actions">
                      <Link to={`/properties/${property.id}`} className="secondary-button">View</Link>
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
          <p>Manage Your Residential Properties Smarter</p>
          <h2>
            RMS makes it easy to manage properties, residents, rooms, payments, and maintenance from one powerful platform.
          </h2>
        </div>
        <Link to="/contact" className="cta-button1">
          Get Started
        </Link>
      </section>
    </div>
  );
}

export default DemoPage;