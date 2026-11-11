import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import './AreasPage.css';

export default function AreasPage({ notify }) {
  const [areas, setAreas] = useState([]);
  const [form, setForm] = useState({ name: '', city: '', phase: '', displayOrder: 0, active: true });

  const load = async () => {
    try {
      const resp = await apiService.request('/areas');
      if (!resp?.success) throw new Error(resp?.message || 'Unable to load areas.');
      setAreas(resp.data || []);
    } catch (e) {
      console.error('Load areas failed', e);
      notify && notify({ message: 'Unable to load areas', variant: 'error' });
    }
  };

  useEffect(() => {
    Promise.resolve().then(load);
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const resp = await apiService.request('/areas', { method: 'POST', body: form });
      if (!resp?.success || !resp.data) throw new Error(resp?.message || 'Area creation failed.');
      setAreas((prev) => [resp.data, ...prev]);
      setForm({ name: '', city: '', phase: '', displayOrder: 0, active: true });
      notify && notify({ message: 'Area added', variant: 'success' });
    } catch (err) {
      console.error('Create area failed', err);
      notify && notify({ message: 'Create failed', variant: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this area?')) return;
    try {
      const resp = await apiService.request(`/areas/${id}`, { method: 'DELETE' });
      if (!resp?.success) throw new Error(resp?.message || 'Area deletion failed.');
      setAreas((prev) => prev.filter((a) => a._id !== id && a.id !== id));
      notify && notify({ message: 'Area deleted', variant: 'success' });
    } catch (err) {
      console.error('Delete area failed', err);
      notify && notify({ message: 'Delete failed', variant: 'error' });
    }
  };

  return (
    <div className="page-section areas-page">
      <div className="content-grid two-column">
        <section className="panel-card">
          <div className="card-header"><h3>Create Area</h3></div>
          <form onSubmit={handleCreate} className="property-form">
            <label>Name<input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></label>
            <label>City<input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} /></label>
            <label>Phase<input value={form.phase} onChange={(e) => setForm((p) => ({ ...p, phase: e.target.value }))} /></label>
            <label>Order<input type="number" value={form.displayOrder} onChange={(e) => setForm((p) => ({ ...p, displayOrder: Number(e.target.value || 0) }))} /></label>
            <label><input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} /> Active</label>
            <button className="primary-button" type="submit">Add Area</button>
          </form>
        </section>

        <section className="panel-card">
          <div className="card-header"><h3>Areas</h3></div>
          <div className="list-stack large">
            {areas.map((a) => (
              <div key={a._id || a.id} className="list-row">
                <div>
                  <strong>{a.name}</strong>
                  <small>{a.city} · {a.phase} · Order: {a.displayOrder}</small>
                </div>
                <div className="row-actions">
                  <button className="outline-button" onClick={() => handleDelete(a._id || a.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
