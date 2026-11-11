import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../services/api';

const defaultForm = {
  title: '',
  type: 'Apartment',
  location: '',
  price: '',
  status: 'Available',
  description: '',
};

function AdminProperties() {
  const [properties, setProperties] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchProperties = async () => {
    try {
      const response = await api.get('/properties');
      const items = response?.data?.data || response?.data || [];
      setProperties(Array.isArray(items) ? items : []);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to load properties');
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      const payload = {
        ...form,
        price: Number(form.price || 0),
      };

      if (editingId) {
        await api.put(`/properties/${editingId}`, payload);
        toast.success('Property updated');
      } else {
        await api.post('/properties', payload);
        toast.success('Property added');
      }

      setForm(defaultForm);
      setEditingId(null);
      fetchProperties();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Unable to save property');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item._id || item.id);
    setForm({
      title: item.title || '',
      type: item.type || 'Apartment',
      location: item.location || '',
      price: item.price || '',
      status: item.status || 'Available',
      description: item.description || '',
    });
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/properties/${id}`);
      toast.success('Property deleted');
      fetchProperties();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Unable to delete property');
    }
  };

  const handleStatusToggle = async (id, status) => {
    try {
      await api.patch(`/properties/${id}/status`, { status });
      toast.success(`Status updated to ${status}`);
      fetchProperties();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Unable to update status');
    }
  };

  const propertyRows = useMemo(() => properties || [], [properties]);

  return (
    <section style={{ background: '#fff', borderRadius: 18, padding: 24, boxShadow: '0 12px 30px rgba(15, 23, 42, 0.05)' }}>
      <h2 style={{ marginTop: 0 }}>{editingId ? 'Edit listing' : 'Add new property'}</h2>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div>
          <label style={labelStyle}>Title</label>
          <input name="title" value={form.title} onChange={handleChange} style={inputStyle} required />
        </div>
        <div>
          <label style={labelStyle}>Type</label>
          <select name="type" value={form.type} onChange={handleChange} style={inputStyle}>
            <option value="Apartment">Apartment</option>
            <option value="House">House</option>
            <option value="Flat">Flat</option>
            <option value="Land">Land</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Location</label>
          <input name="location" value={form.location} onChange={handleChange} style={inputStyle} required />
        </div>
        <div>
          <label style={labelStyle}>Price</label>
          <input name="price" type="number" value={form.price} onChange={handleChange} style={inputStyle} required />
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select name="status" value={form.status} onChange={handleChange} style={inputStyle}>
            <option value="Available">Available</option>
            <option value="Rented">Rented</option>
            <option value="Sold">Sold</option>
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Description</label>
          <textarea name="description" value={form.description} onChange={handleChange} rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setForm(defaultForm); }} style={{ ...buttonStyle, background: '#eef2ff', color: '#1f2937' }}>
              Cancel
            </button>
          )}
          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading ? 'Saving...' : editingId ? 'Update property' : 'Create property'}
          </button>
        </div>
      </form>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={thStyle}>Title</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Location</th>
              <th style={thStyle}>Price</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {propertyRows.map((item) => (
              <tr key={item._id || item.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                <td style={tdStyle}>{item.title}</td>
                <td style={tdStyle}>{item.type}</td>
                <td style={tdStyle}>{item.location}</td>
                <td style={tdStyle}>PKR {Number(item.price || 0).toLocaleString()}</td>
                <td style={tdStyle}>
                  <select
                    value={item.status || 'Available'}
                    onChange={(event) => handleStatusToggle(item._id || item.id, event.target.value)}
                    style={{ ...inputStyle, minWidth: 130 }}
                  >
                    <option value="Available">Available</option>
                    <option value="Rented">Rented</option>
                    <option value="Sold">Sold</option>
                  </select>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => handleEdit(item)} style={{ ...smallButtonStyle, background: '#dbeafe', color: '#1d4ed8' }}>Edit</button>
                    <button type="button" onClick={() => handleDelete(item._id || item.id)} style={{ ...smallButtonStyle, background: '#fee2e2', color: '#b42318' }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const labelStyle = { display: 'block', marginBottom: 8, fontWeight: 600, color: '#1f2937' };
const inputStyle = {
  width: '100%',
  border: '1px solid #d0d7e2',
  borderRadius: 10,
  padding: '11px 12px',
  fontSize: 14,
  background: '#fff',
  color: '#111827',
};
const buttonStyle = {
  border: 'none',
  borderRadius: 10,
  padding: '12px 18px',
  background: '#123a70',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};
const smallButtonStyle = {
  border: 'none',
  borderRadius: 8,
  padding: '6px 10px',
  cursor: 'pointer',
  fontWeight: 700,
};
const thStyle = { textAlign: 'left', padding: '12px 10px', fontWeight: 700, color: '#334155' };
const tdStyle = { padding: '12px 10px', color: '#334155' };

export default AdminProperties;
