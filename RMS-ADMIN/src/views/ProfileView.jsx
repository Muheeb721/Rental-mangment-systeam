import { useRef, useState } from 'react';
import { Camera, KeyRound, Save } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { dateTime } from '../lib/format';
import { Avatar, Button, Field, PageHeader, useToast } from '../components/ui';

export default function ProfileView() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const fileRef = useRef(null);
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwErrors, setPwErrors] = useState({});
  const [changing, setChanging] = useState(false);

  const saveProfile = async (event) => {
    event.preventDefault();
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email.';
    if (form.phone && !/^\+?[\d\s-]{7,20}$/.test(form.phone)) next.phone = 'Enter a valid phone number.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const response = await api.put('/users/profile', { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() });
      setUser((prev) => ({ ...prev, ...response.data }));
      toast.success('Profile updated.');
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const uploadPhoto = async (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast.error('Use a JPG, PNG or WEBP image.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be 5MB or smaller.'); return; }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('profileImage', file);
      const response = await api.post('/users/profile-image', body);
      setUser((prev) => ({ ...prev, profileImage: response.data.profileImage }));
      toast.success('Profile photo updated.');
    } catch (err) { toast.error(err.message); } finally { setUploading(false); }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    const next = {};
    if (!pw.currentPassword) next.currentPassword = 'Enter your current password.';
    if (pw.newPassword.length < 8) next.newPassword = 'At least 8 characters.';
    if (pw.confirmPassword !== pw.newPassword) next.confirmPassword = 'Passwords do not match.';
    setPwErrors(next);
    if (Object.keys(next).length) return;
    setChanging(true);
    try {
      await api.put('/auth/change-password', pw);
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password changed.');
    } catch (err) {
      setPwErrors({ currentPassword: err.message });
      toast.error(err.message);
    } finally { setChanging(false); }
  };

  return (
    <>
      <PageHeader title="My profile" description="Your admin account details and password." />
      <div className="grid grid-wide-alt">
        <form className="card" onSubmit={saveProfile} noValidate>
          <div className="card-header"><h2>Account details</h2></div>
          <div className="card-body">
            <div className="row" style={{ gap: 16, marginBottom: 20 }}>
              <Avatar name={user?.name} src={user?.profileImage} size="lg" />
              <div>
                <Button icon={Camera} loading={uploading} onClick={() => fileRef.current?.click()}>Change photo</Button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { uploadPhoto(e.target.files?.[0]); e.target.value = ''; }} />
                <div className="small muted mt-8">Last login: {dateTime(user?.lastLoginAt)}</div>
              </div>
            </div>
            <div className="form-grid">
              <Field label="Full name" required error={errors.name}><input className={`input ${errors.name ? 'invalid' : ''}`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Phone" error={errors.phone}><input className={`input ${errors.phone ? 'invalid' : ''}`} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Email" required error={errors.email} className="span-2"><input className={`input ${errors.email ? 'invalid' : ''}`} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            </div>
            <div className="row mt-16" style={{ justifyContent: 'flex-end' }}><Button type="submit" variant="primary" icon={Save} loading={saving}>Save profile</Button></div>
          </div>
        </form>
        <form className="card" onSubmit={changePassword} noValidate style={{ alignSelf: 'start' }}>
          <div className="card-header"><h2>Change password</h2></div>
          <div className="card-body stack">
            <Field label="Current password" error={pwErrors.currentPassword}><input className={`input ${pwErrors.currentPassword ? 'invalid' : ''}`} type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
            <Field label="New password" error={pwErrors.newPassword} hint="At least 8 characters."><input className={`input ${pwErrors.newPassword ? 'invalid' : ''}`} type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
            <Field label="Confirm new password" error={pwErrors.confirmPassword}><input className={`input ${pwErrors.confirmPassword ? 'invalid' : ''}`} type="password" autoComplete="new-password" value={pw.confirmPassword} onChange={(e) => setPw({ ...pw, confirmPassword: e.target.value })} /></Field>
            <Button type="submit" variant="primary" icon={KeyRound} loading={changing}>Update password</Button>
          </div>
        </form>
      </div>
    </>
  );
}
