import { useEffect, useState } from 'react';
import { listAdminRentalProfiles, changeAdminRentalStatus } from '../services/adminRentalService';
import { useNavigate } from 'react-router-dom';
import './TenantProfilesPage.css';

function TenantProfilesPage({ notify }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    try {
      setLoading(true);
      const items = await listAdminRentalProfiles();
      setProfiles(items || []);
      setLoading(false);
    } catch (e) {
      console.error('Load rental profiles failed', e);
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(load);
  }, []);

  const handleApprove = async (id) => {
    try {
      const updated = await changeAdminRentalStatus(id, 'Approved');
      setProfiles((prev) => prev.map((p) => (p._id === id ? updated : p)));
      notify && notify({ message: 'Rental approved.', variant: 'success' });
    } catch (e) {
      console.error('Approve failed', e);
      notify && notify({ message: 'Unable to approve rental.', variant: 'error' });
    }
  };

  return (
    <div className="page-section tenant-profiles-page">
      <section className="panel-card">
        <div className="card-header">
          <h3>Tenant Profiles</h3>
          <span className="mini-badge">{profiles.length}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Profile</th><th>Property</th><th>Start</th><th>Duration</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="6">Loading...</td></tr> : profiles.length ? profiles.map((p) => (
                <tr key={p._id}>
                  <td>{p.fullName}<div className="muted">{p.email}</div></td>
                  <td>{p.propertyName || p.propertyId || '—'}</td>
                  <td>{p.rentalStartDate ? new Date(p.rentalStartDate).toLocaleDateString() : '—'}</td>
                  <td>{p.rentalDurationMonths || '—'} months</td>
                  <td><span className={`status-badge ${String(p.status || '').toLowerCase()}`}>{p.status}</span></td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="table-button" onClick={() => navigate(`/admin/tenant-profile/${p._id}`)}>View</button>
                      {p.status !== 'Approved' && <button type="button" className="table-button primary" onClick={() => handleApprove(p._id)}>Approve</button>}
                    </div>
                  </td>
                </tr>
              )) : <tr><td colSpan="6">No tenant profiles found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default TenantProfilesPage;
