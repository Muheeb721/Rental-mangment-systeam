import { useState } from 'react';
import './CollectionPage.css';
import { formatCurrency } from '../data/adminData';

function CollectionPage({ collectionKey, title, appState, setAppState }) {
  const collection = appState[collectionKey] || [];
  const [form, setForm] = useState({
    name: '',
    location: '',
    units: '',
    status: 'Active',
    price: '',
  });

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.name || !form.location) return;

    const nextItem = {
      id: Date.now(),
      name: form.name,
      location: form.location,
      units: Number(form.units || 1),
      status: form.status,
      price: Number(form.price || 0),
    };

    setAppState((prev) => ({
      ...prev,
      [collectionKey]: [nextItem, ...prev[collectionKey]],
    }));
    setForm({ name: '', location: '', units: '', status: 'Active', price: '' });
  };

  const handleDelete = (id) => {
    setAppState((prev) => ({
      ...prev,
      [collectionKey]: prev[collectionKey].filter((item) => item.id !== id),
    }));
  };

  return (
    <div className="page-section collection-page">
      <div className="content-grid two-column">
        <section className="panel-card">
          <div className="card-header">
            <h3>Add New {title}</h3>
          </div>
          <form onSubmit={handleSubmit} className="property-form">
            <label>
              Name
              <input value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder={`${title} Name`} />
            </label>
            <label>
              Location
              <input value={form.location} onChange={(e) => handleChange('location', e.target.value)} placeholder="City or area" />
            </label>
            <label>
              Units
              <input value={form.units} onChange={(e) => handleChange('units', e.target.value)} type="number" placeholder="0" />
            </label>
            <label>
              Monthly Price
              <input value={form.price} onChange={(e) => handleChange('price', e.target.value)} type="number" placeholder="0" />
            </label>
            <label>
              Status
              <select value={form.status} onChange={(e) => handleChange('status', e.target.value)}>
                <option value="Active">Active</option>
                <option value="Available">Available</option>
                <option value="Occupied">Occupied</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Review">Review</option>
              </select>
            </label>
            <button type="submit" className="primary-button">Create {title}</button>
          </form>
        </section>

        <section className="panel-card">
          <div className="card-header">
            <h3>{title} Inventory</h3>
            <button className="mini-button">Filter</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Location</th>
                  <th>Units</th>
                  <th>Price</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {collection.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.location}</td>
                    <td>{item.units}</td>
                    <td>{formatCurrency(item.price)}</td>
                    <td>
                      <div className="inline-actions">
                        <button className="table-button light">Edit</button>
                        <button className="table-button danger" onClick={() => handleDelete(item.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

export default CollectionPage;
