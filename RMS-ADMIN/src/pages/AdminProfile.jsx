import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import { apiService } from '../services/api';
import './AdminProfile.css';

export default function AdminProfile({ appData, setAppData, notify }) {
  const [profile, setProfile] = useState(appData.adminProfile || { name: '', email: '', phone: '', image: '' });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(profile.image || '');

  useEffect(() => {
    Promise.resolve().then(() => {
      setProfile(appData.adminProfile || { name: '', email: '', phone: '', image: '' });
      setPreview((appData.adminProfile && appData.adminProfile.image) || '');
    });
  }, [appData.adminProfile]);

  const handleField = (e) => setProfile((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSave = async () => {
    setBusy(true);
    try {
      const nextProfile = {
        ...(profile || {}),
        name: profile.name || profile.fullName || '',
        fullName: profile.fullName || profile.name || '',
        image: preview || profile.image || '',
      };

      const resp = await apiService.request('/admin/profile', { method: 'PUT', body: nextProfile });
      if (!resp?.success) throw new Error(resp?.message || 'Save failed');

      const savedProfile = { ...(resp.data || nextProfile), image: resp.data?.image || nextProfile.image || '' };
      setProfile(savedProfile);
      setPreview(savedProfile.image || '');
      setAppData((prev) => ({ ...prev, adminProfile: savedProfile }));
      notify({ message: 'Profile updated', variant: 'success' });
      setEditing(false);
    } catch (e) {
      console.error('Profile save failed', e);
      notify({ message: e.message || 'Unable to save profile', variant: 'error' });
    } finally { setBusy(false); }
  };

  const handleReplaceImage = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('image', file, file.name);
      const resp = await apiService.request('/admin/profile/image', { method: 'PUT', body: fd });
      if (!resp?.success) throw new Error(resp?.message || 'Upload failed');

      const nextProfile = {
        ...(profile || {}),
        ...(resp.data || {}),
        image: resp.data?.image || profile.image || '',
      };

      setProfile(nextProfile);
      setPreview(nextProfile.image || '');
      setAppData((prev) => ({ ...prev, adminProfile: nextProfile }));

      const fresh = await apiService.request('/admin/profile');
      if (fresh?.success) {
        const refreshedProfile = fresh.data || nextProfile;
        setProfile(refreshedProfile);
        setPreview(refreshedProfile.image || '');
        setAppData((prev) => ({ ...prev, adminProfile: refreshedProfile }));
      }

      notify({ message: 'Profile image updated', variant: 'success' });
    } catch (e) {
      console.error('Replace profile image failed', e);
      notify({ message: e.message || 'Unable to replace profile image', variant: 'error' });
    } finally { setBusy(false); }
  };

  return (
    <div className="admin-profile-page">
      <div className="profile-card">
        <div className="avatar" style={{ backgroundImage: `url(${preview || 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=200&q=80'})` }} />
        <div className="info">
          <h3>{profile.name || 'Admin'}</h3>
          <p>{profile.email}</p>
          <p>{profile.phone}</p>
          <div className="buttons">
            <button className="primary" onClick={() => setEditing((s) => !s)} disabled={busy}>{editing ? 'Cancel' : 'Update'}</button>
            <label className="file-label small">
              Replace Image
              <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReplaceImage(f); e.target.value = ''; }} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      </div>

      {editing && (
        <Modal open={editing} title="Edit Profile" onClose={() => setEditing(false)} footer={<>
          <button className="outline-button" onClick={() => setEditing(false)}>Cancel</button>
          <button className="primary-button" onClick={handleSave} disabled={busy}>Save</button>
        </>}>
          <div className="profile-form">
            <label>
              Name
              <input name="name" value={profile.name || ''} onChange={handleField} />
            </label>
            <label>
              Email
              <input name="email" value={profile.email || ''} onChange={handleField} />
            </label>
            <label>
              Phone
              <input name="phone" value={profile.phone || ''} onChange={handleField} />
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
