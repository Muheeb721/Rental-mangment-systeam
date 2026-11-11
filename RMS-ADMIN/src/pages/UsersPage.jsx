import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './UsersPage.css';
import Modal from '../components/Modal';
import { formatDate } from '../utils/formatters';
import { apiService } from '../services/api';

const emptyForm = {
  fullName: '',
  email: '',
  phone: '',
  role: 'Tenant',
  status: 'Active',
  password: '',
};

function UsersPage({ appData, setAppData, notify }) {
  const users = appData.users || [];
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [sortBy, setSortBy] = useState('registrationDate');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [deletingId, setDeletingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const filteredUsers = useMemo(() => {
    const next = [...users].filter((user) => {
      const matchesSearch = !search || [user.fullName, user.email, user.phone].join(' ').toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'All' || user.status === statusFilter;
      const matchesRole = roleFilter === 'All' || user.role === roleFilter;
      return matchesSearch && matchesStatus && matchesRole;
    });

    next.sort((a, b) => {
      if (sortBy === 'name') return String(a.fullName || a.name).localeCompare(String(b.fullName || b.name));
      if (sortBy === 'recent') return new Date(b.lastActivity || b.registrationDate || 0) - new Date(a.lastActivity || a.registrationDate || 0);
      return new Date(b.registrationDate || 0) - new Date(a.registrationDate || 0);
    });

    return next;
  }, [users, search, statusFilter, roleFilter, sortBy]);

  const userStats = useMemo(() => {
    const counts = users.reduce((acc, user) => {
      acc.total += 1;
      acc.active += String(user.status || '').toLowerCase() === 'active' ? 1 : 0;
      acc.pending += String(user.status || '').toLowerCase() === 'pending' ? 1 : 0;
      acc.tenants += String(user.role || '').toLowerCase() === 'tenant' ? 1 : 0;
      return acc;
    }, { total: 0, active: 0, pending: 0, tenants: 0 });

    return counts;
  }, [users]);

  const addActivity = (action, details) => {
    setAppData((prev) => ({
      ...prev,
      activityLogs: [{ id: `log-${Date.now()}`, action, details, timestamp: new Date().toISOString() }, ...(prev.activityLogs || [])].slice(0, 20),
    }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!formData.fullName.trim() || !/^[A-Za-z ]{2,}$/.test(formData.fullName.trim())) nextErrors.fullName = 'Full name is required and should contain letters only';
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) nextErrors.email = 'Valid email is required';
    if (!formData.phone.trim() || !/^[+()\-\d\s]{7,20}$/.test(formData.phone)) nextErrors.phone = 'Valid phone is required';
    return nextErrors;
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setErrors({});
    setModalOpen(true);
  };

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const resp = await apiService.request('/admin/users');
        if (resp?.success) {
          const nextUsers = Array.isArray(resp.data) ? resp.data : [];
          setAppData((prev) => ({
            ...prev,
            users: nextUsers,
            tenants: nextUsers.map((user, index) => ({
              id: user._id || user.id || `tenant-${index + 1}`,
              _id: user._id || user.id || `tenant-${index + 1}`,
              fullName: user.fullName || user.name || 'Unknown Tenant',
              name: user.name || user.fullName || 'Unknown Tenant',
              email: user.email || '',
              phone: user.phone || '',
              status: user.status || 'Active',
              propertyName: user.propertyName || user.property || '',
              propertyId: user.propertyId || '',
              createdAt: user.createdAt || new Date().toISOString(),
            })),
          }));
        }
      } catch (e) {
        console.warn('Unable to load users', e?.message || e);
      }
    };

    loadUsers();
  }, [setAppData]);

  const openEditModal = (user) => {
    setEditingId(user._id || user.id);
    setFormData({
      fullName: user.fullName || user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      status: user.status,
    });
    setErrors({});
    setModalOpen(true);
  };

  const saveUser = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const payload = {
      name: formData.fullName.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      role: formData.role,
      status: formData.status,
      profile: {},
    };

    try {
      setSaving(true);
      if (!editingId) {
        if (!formData.password) {
          setErrors({ password: 'Password is required for new users' });
          return;
        }
        payload.password = formData.password;
        const resp = await apiService.request('/admin/users', { method: 'POST', body: payload });
        if (!resp?.success || !resp.data) throw new Error(resp?.message || 'User creation failed.');
        const nextUser = resp.data;
        setAppData((prev) => ({
          ...prev,
          users: [nextUser, ...(prev.users || [])],
          tenants: [
            {
              id: nextUser._id || nextUser.id,
              _id: nextUser._id || nextUser.id,
              fullName: nextUser.fullName || nextUser.name || 'Unknown Tenant',
              name: nextUser.name || nextUser.fullName || 'Unknown Tenant',
              email: nextUser.email || '',
              phone: nextUser.phone || '',
              status: nextUser.status || 'Active',
              propertyName: nextUser.propertyName || nextUser.property || '',
              propertyId: nextUser.propertyId || '',
              createdAt: nextUser.createdAt || new Date().toISOString(),
            },
            ...(prev.tenants || []),
          ],
        }));
        addActivity('User added', `${nextUser.name || nextUser.fullName} was added by admin.`);
        notify({ message: 'User created successfully.', variant: 'success' });
      } else {
        const resp = await apiService.request(`/admin/users/${editingId}`, { method: 'PUT', body: payload });
        if (!resp?.success || !resp.data) throw new Error(resp?.message || 'User update failed.');
        const updatedUser = resp.data;
        setAppData((prev) => ({
          ...prev,
          users: (prev.users || []).map((u) => (String(u._id || u.id) === String(editingId) ? updatedUser : u)),
          tenants: (prev.tenants || []).map((u) => (String(u._id || u.id) === String(editingId)
            ? {
                ...u,
                id: updatedUser._id || updatedUser.id || u.id,
                _id: updatedUser._id || updatedUser.id || u._id,
                fullName: updatedUser.fullName || updatedUser.name || u.fullName || u.name,
                name: updatedUser.name || updatedUser.fullName || u.name || u.fullName,
                email: updatedUser.email || u.email,
                phone: updatedUser.phone || u.phone,
                status: updatedUser.status || u.status,
              }
            : u)),
        }));
        addActivity('User edited', `${updatedUser.name || updatedUser.fullName} was updated by admin.`);
        notify({ message: 'User updated successfully.', variant: 'success' });
      }

      setModalOpen(false);
      setEditingId(null);
      setFormData(emptyForm);
    } catch (e) {
      console.error('Save user failed', e);
      notify({ message: e?.message || 'Unable to save user.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (userId) => {
    try {
      const resp = await apiService.request(`/admin/users/${userId}`, { method: 'DELETE' });
      if (!resp?.success) throw new Error(resp?.message || 'User deletion failed.');
      setAppData((prev) => ({
        ...prev,
        users: (prev.users || []).filter((u) => String(u._id || u.id) !== String(userId)),
        tenants: (prev.tenants || []).filter((u) => String(u._id || u.id) !== String(userId)),
      }));
      addActivity('User archived', `User ${userId} archived by admin.`);
      notify({ message: 'User archived successfully.', variant: 'success' });
    } catch (e) {
      console.error('Delete user failed', e);
      notify({ message: e?.message || 'Unable to archive user.', variant: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  const toggleStatus = async (userId, nextStatus) => {
    try {
      const resp = await apiService.request(`/admin/users/${userId}`, { method: 'PUT', body: { status: nextStatus } });
      if (!resp?.success || !resp.data) throw new Error(resp?.message || 'User status update failed.');
      const updatedUser = resp.data;
      setAppData((prev) => ({
        ...prev,
        users: (prev.users || []).map((u) => (String(u._id || u.id) === String(userId) ? updatedUser : u)),
        tenants: (prev.tenants || []).map((u) => (String(u._id || u.id) === String(userId)
          ? { ...u, status: updatedUser.status || u.status, fullName: updatedUser.fullName || updatedUser.name || u.fullName || u.name }
          : u)),
      }));
      notify({ message: `User status updated to ${nextStatus}.`, variant: 'success' });
    } catch (e) {
      console.error('Toggle status failed', e);
      notify({ message: e?.message || 'Unable to update status.', variant: 'error' });
    }
  };

  return (
    <div className="page-section users-page">
      <div className="summary-strip user-strip">
        <div className="summary-item primary">
          <span>Total users</span>
          <strong>{userStats.total}</strong>
        </div>
        <div className="summary-item success">
          <span>Active</span>
          <strong>{userStats.active}</strong>
        </div>
        <div className="summary-item danger">
          <span>Pending</span>
          <strong>{userStats.pending}</strong>
        </div>
        <div className="summary-item info">
          <span>Tenants</span>
          <strong>{userStats.tenants}</strong>
        </div>
      </div>

      <section className="panel-card toolbar-card">
        <div className="toolbar-row">
          <div className="toolbar-search">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, email, phone" />
          </div>
          <div className="toolbar-group">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Pending">Pending</option>
            </select>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="All">All Roles</option>
              <option value="Tenant">Tenant</option>
              <option value="Buyer">Buyer</option>
              <option value="Landlord">Landlord</option>
              <option value="Admin">Admin</option>
            </select>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="registrationDate">Newest</option>
              <option value="recent">Recent Activity</option>
              <option value="name">Name</option>
            </select>
            <button type="button" className="primary-button" onClick={openCreateModal}>Add User</button>
          </div>
        </div>
      </section>

      <section className="panel-card">
        <div className="card-header">
          <h3>User Directory</h3>
          <span className="mini-badge">{filteredUsers.length} users</span>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👤</div>
            <h4>No users found</h4>
            <p>Try a different search or add a new user.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Last Activity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user._id || user.id}>
                    <td>{user._id || user.id}</td>
                    <td>{user.fullName || user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.phone || '—'}</td>
                    <td>{user.role}</td>
                    <td>
                      <select value={user.status} onChange={(event) => toggleStatus(user._id || user.id, event.target.value)} className="status-select">
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Pending">Pending</option>
                      </select>
                    </td>
                    <td>{formatDate(user.registrationDate)}</td>
                    <td>{formatDate(user.lastActivity)}</td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="table-button light" onClick={() => navigate(`/admin/tenant-profile/${encodeURIComponent(user._id || user.id || user.fullName || user.name)}`)}>Profile</button>
                        <button type="button" className="table-button light" onClick={() => openEditModal(user)}>Edit</button>
                        <button type="button" className="table-button danger" onClick={() => setDeletingId(user._id || user.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={modalOpen}
        title={editingId ? 'Edit User' : 'Add User'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="outline-button" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="primary-button" form="user-form" disabled={saving}>{saving ? 'Saving...' : 'Save User'}</button>
          </>
        }
      >
        <form id="user-form" className="property-form" onSubmit={saveUser}>
          <label>
            Full Name
            <input value={formData.fullName} onChange={(event) => setFormData((prev) => ({ ...prev, fullName: event.target.value }))} />
            {errors.fullName && <span className="field-error">{errors.fullName}</span>}
          </label>
          <label>
            Email
            <input type="email" value={formData.email} onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))} />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </label>
          {!editingId && (
            <label>
              Password
              <input type="password" value={formData.password} onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))} />
              {errors.password && <span className="field-error">{errors.password}</span>}
            </label>
          )}
          <label>
            Phone
            <input value={formData.phone} onChange={(event) => setFormData((prev) => ({ ...prev, phone: event.target.value }))} />
            {errors.phone && <span className="field-error">{errors.phone}</span>}
          </label>
          <div className="form-grid two-col">
            <label>
              Role
              <select value={formData.role} onChange={(event) => setFormData((prev) => ({ ...prev, role: event.target.value }))}>
                <option value="Tenant">Tenant</option>
                <option value="Buyer">Buyer</option>
                <option value="Landlord">Landlord</option>
                <option value="Admin">Admin</option>
              </select>
            </label>
            <label>
              Status
              <select value={formData.status} onChange={(event) => setFormData((prev) => ({ ...prev, status: event.target.value }))}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Pending">Pending</option>
              </select>
            </label>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deletingId)}
        title="Are you sure?"
        onClose={() => setDeletingId(null)}
        footer={
          <>
            <button type="button" className="outline-button" onClick={() => setDeletingId(null)}>Cancel</button>
            <button type="button" className="primary-button danger-button" onClick={() => deleteUser(deletingId)}>Delete</button>
          </>
        }
      >
        <p>This action cannot be undone.</p>
      </Modal>
    </div>
  );
}

export default UsersPage;
