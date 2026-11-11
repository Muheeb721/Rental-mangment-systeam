import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProperties } from '../contexts/PropertyContext';
import './demopage.css';
import FavoriteToggle from '../components/FavoriteToggle';
import { saveSelectedProperty } from '../utils/selectedPropertyStorage.jsx';
import { getPrimaryImage } from '../utils/imageUtils';
import { resolveUniquePropertyImage } from '../utils/propertyImageCatalog';

const categories = ['All', 'House', 'Apartment', 'Room', 'Commercial'];

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

function HouseDemoPage() {
  const navigate = useNavigate();
  const { properties, addProperty, updateProperty, deleteProperty } = useProperties();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const houseProperties = useMemo(() => properties.filter((property) => String(property.type || '').toLowerCase() === 'house'), [properties]);

  const filteredProperties = useMemo(() => {
    const term = searchTerm.toLowerCase();

    return houseProperties.filter((property) => {
      const matchesCategory = activeCategory === 'All' || property.type === activeCategory;
      const matchesSearch =
        !term ||
        property.title?.toLowerCase().includes(term) ||
        property.address?.toLowerCase().includes(term) ||
        property.area?.toLowerCase().includes(term) ||
        property.description?.toLowerCase().includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, houseProperties, searchTerm]);

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
      type: 'House',
      bedrooms: Number(form.bedrooms) || 0,
      bathrooms: Number(form.bathrooms) || 0,
      parking: Number(form.parking) || 0,
      image: form.image || 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80',
      images: [form.image || 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80'],
      location: form.address,
      address: form.address,
      availability: form.status,
      description: form.description || 'House listing managed through RMS.',
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
      type: 'House',
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

  const handleViewProperty = (property) => {
    saveSelectedProperty(property);
    navigate(property.id ? `/properties/${property.id}` : '/contact');
  };

  const handleReserveProperty = (property) => {
    saveSelectedProperty(property);
    navigate(`/contact?propertyTitle=${encodeURIComponent(property.title || '')}&propertyType=${encodeURIComponent(property.type || '')}`);
  };

  return (
    <div className="demo-page">
      <header className="demo-header">
        <div className="demo-heading">
          <p className="eyebrow">House Demo</p>
          <h1>House-only property management</h1>
          <p className="subtitle">This view contains only house listings. Hostel data stays isolated and never appears here.</p>
        </div>

        <div className="demo-search-panel">
          <input
            type="search"
            placeholder="Search houses…"
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
            <h2>House management console</h2>
            <p>Create a new house listing or update an existing one instantly.</p>
          </div>
          <span className="section-count">{Math.min(houseProperties.length, 10)} house records</span>
        </div>

        <div className="management-layout">
          <form className="management-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <label>
                Property title
                <input name="title" value={form.title} onChange={handleChange} placeholder="Luxury family villa" required />
              </label>
              <label>
                Type
                <select name="type" value={form.type} onChange={handleChange}>
                  <option value="House">House</option>
                  <option value="Apartment">Apartment</option>
                  <option value="Room">Room</option>
                  <option value="Commercial">Commercial</option>
                </select>
              </label>
            </div>

            <div className="form-row">
              <label>
                Price
                <input name="price" value={form.price} onChange={handleChange} placeholder="Rs 85 Lakh" required />
              </label>
              <label>
                Address
                <input name="address" value={form.address} onChange={handleChange} placeholder="Main Boulevard, Lahore" required />
              </label>
            </div>

            <div className="form-row">
              <label>
                Area
                <input name="area" value={form.area} onChange={handleChange} placeholder="DHA Lahore" />
              </label>
              <label>
                Status
                <select name="status" value={form.status} onChange={handleChange}>
                  <option value="Available">Available</option>
                  <option value="Booked">Booked</option>
                  <option value="Occupied">Occupied</option>
                  <option value="Pending">Pending</option>
                </select>
              </label>
            </div>

            <div className="form-row">
              <label>
                Bedrooms
                <input type="number" name="bedrooms" value={form.bedrooms} onChange={handleChange} />
              </label>
              <label>
                Bathrooms
                <input type="number" name="bathrooms" value={form.bathrooms} onChange={handleChange} />
              </label>
              <label>
                Parking
                <input type="number" name="parking" value={form.parking} onChange={handleChange} />
              </label>
            </div>

            <label>
              Image URL
              <input name="image" value={form.image} onChange={handleChange} placeholder="https://example.com/photo.jpg" />
            </label>

            <label>
              Description
              <textarea name="description" value={form.description} onChange={handleChange} rows="4" placeholder="Describe the house" />
            </label>

            <div className="form-actions">
              <button type="submit" className="details-button">
                {editingId ? 'Save changes' : 'Add house'}
              </button>
              <button type="button" className="secondary-button" onClick={resetForm}>
                Reset
              </button>
            </div>
          </form>

          <div className="management-preview">
            <h3>Live house listings</h3>
            {filteredProperties.slice(0, 10).map((property, index) => (
              <article className="property-card compact" key={property.id}>
                <div className="card-image" style={{ backgroundImage: `url(${resolveUniquePropertyImage(property, 'demo', index)})` }} />
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
                    <p className="price" style={{ visibility: 'hidden' }}>—</p>
                    <div className="card-actions">
                      <button type="button" className="secondary-button" onClick={() => handleViewProperty(property)}>
                        View
                      </button>
                      <button type="button" className="details-button" onClick={() => handleReserveProperty(property)}>
                        Reserve
                      </button>
                    </div>
                    <FavoriteToggle item={property} label="Save" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="demo-cta">
        <div>
          <p>House Portfolio Management</p>
          <h2>Keep your house listings organized, searchable, and ready for buyers and tenants.</h2>
        </div>
        <Link to="/demo/apartments" className="cta-button1">Open Apartment View</Link>
      </section>
    </div>
  );
}

export default HouseDemoPage;
