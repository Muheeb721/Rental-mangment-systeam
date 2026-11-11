import { useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api';
import { useNavigate } from 'react-router-dom';
import './ProfilePage.css';

const defaultProfile = {
  fullName: 'Ayesha Khan',
  name: 'Ayesha Khan',
  email: 'muheebshahid75@gmail.com',
  phone: '+92 300 1234567',
  role: 'Super Administrator',
  profileImage: '',
};

const emptyProfile = () => ({
  fullName: '',
  name: '',
  email: '',
  phone: '',
  role: '',
  profileImage: '',
});

function ProfilePage({ appData, setAppData, notify }) {
  const navigate = useNavigate();

  const savedProfile = useMemo(() => appData.profile || appData.admin || defaultProfile, [appData.profile, appData.admin]);
  const [form, setForm] = useState(emptyProfile());
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const next = {
      fullName: savedProfile.fullName || savedProfile.name || '',
      name: savedProfile.name || savedProfile.fullName || '',
      email: savedProfile.email || '',
      phone: savedProfile.phone || '',
      role: savedProfile.role || '',
      profileImage: savedProfile.profileImage || savedProfile.image || '',
    };

    Promise.resolve().then(() => {
      setForm(next);
      setPreviewUrl(next.profileImage || '');
      setProfileImageFile(null);
    });
  }, [savedProfile]);

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setProfileImageFile(file);
    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const cleanedForm = {
      fullName: (form.fullName || form.name || '').trim(),
      name: (form.name || form.fullName || '').trim(),
      email: (form.email || '').trim(),
      phone: (form.phone || '').trim(),
      role: (form.role || '').trim(),
    };

    if (!cleanedForm.fullName && !cleanedForm.name && !cleanedForm.email && !cleanedForm.phone && !cleanedForm.role) {
      notify({ message: 'Please enter profile details before updating.', variant: 'error' });
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      const effectiveName = cleanedForm.name || cleanedForm.fullName;
      const effectiveFullName = cleanedForm.fullName || cleanedForm.name;
      const effectiveRole = cleanedForm.role || 'admin';

      formData.append('name', effectiveName);
      formData.append('fullName', effectiveFullName);
      formData.append('email', cleanedForm.email);
      formData.append('phone', cleanedForm.phone);
      formData.append('role', effectiveRole);

      if (profileImageFile) {
        formData.append('profileImage', profileImageFile);
      } else if (form.profileImage) {
        formData.append('profileImage', form.profileImage);
      }

      const payload = profileImageFile ? formData : {
        name: effectiveName,
        fullName: effectiveFullName,
        email: cleanedForm.email,
        phone: cleanedForm.phone,
        role: effectiveRole,
        profileImage: form.profileImage || savedProfile.profileImage || '',
        profile: {
          name: effectiveName,
          fullName: effectiveFullName,
          email: cleanedForm.email,
          phone: cleanedForm.phone,
          role: effectiveRole,
          profileImage: form.profileImage || savedProfile.profileImage || '',
        },
      };

      const profileResponse = await apiService.request('/users/profile', {
        method: 'PUT',
        body: payload,
      });

      const updated = profileResponse?.data || {
        ...savedProfile,
        name: effectiveName,
        fullName: effectiveFullName,
        email: cleanedForm.email,
        phone: cleanedForm.phone,
        role: effectiveRole,
        profileImage: form.profileImage || savedProfile.profileImage || '',
      };

      setAppData((prev) => ({
        ...prev,
        admin: { ...(prev.admin || {}), ...updated },
        profile: { ...(prev.profile || {}), ...updated },
        notifications: [
          {
            id: `notif-${Date.now()}`,
            title: 'Profile updated',
            message: `${updated.name || updated.fullName || effectiveName} updated the admin profile.`,
            detail: `Name: ${updated.name || updated.fullName} | Email: ${updated.email} | Phone: ${updated.phone} | Role: ${updated.role || 'admin'}`,
            type: 'Profile',
            recipient: updated.email || 'Admin',
            date: new Date().toISOString(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            read: false,
            priority: 'High',
          },
          ...(prev.notifications || []),
        ],
      }));

      notify({ message: 'Profile updated successfully.', variant: 'success' });
      setProfileImageFile(null);
      setForm((prev) => ({
        ...prev,
        fullName: effectiveFullName,
        name: effectiveName,
        email: cleanedForm.email,
        phone: cleanedForm.phone,
        role: effectiveRole,
        profileImage: updated.profileImage || previewUrl || prev.profileImage || '',
      }));
      navigate('/admin');
    } catch (error) {
      console.error('Profile update failed', error);
      notify({ message: error?.message || 'Unable to update profile on server.', variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-section profile-page">
      <section className="panel-card">
        <div className="card-header">
          <h3>Admin Profile</h3>
        </div>
        <form onSubmit={handleSubmit} className="property-form">
          <div className="form-grid two-col">
            <label>
              Full Name
              <input value={form.fullName || form.name || ''} onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value, name: event.target.value }))} />
            </label>
            <label>
              Role
              <input value={form.role || ''} onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))} />
            </label>
          </div>
          <div className="form-grid two-col">
            <label>
              Email
              <input type="email" value={form.email || ''} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
            </label>
            <label>
              Phone
              <input value={form.phone || ''} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
            </label>
          </div>

          <div className="form-grid two-col" style={{ alignItems: 'end' }}>
            <label>
              Profile Image
              <input type="file" accept="image/*" onChange={handleImageChange} />
            </label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', minHeight: '64px' }}>
              {(previewUrl || form.profileImage) && (
                <img
                  src={previewUrl || form.profileImage}
                  alt="Admin profile preview"
                  style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid #dfe7f5' }}
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              )}
            </div>
          </div>

          <div className="form-actions" style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Profile'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default ProfilePage;
