import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Button, Card, Descriptions, Input, Tag, Spin, Alert } from "antd";
import {
  BellOutlined,
  EditOutlined,
  HeartOutlined,
  SaveOutlined,
  CameraOutlined,
  SettingOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import { motion } from "framer-motion";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { useProperties } from "../contexts/PropertyContext";
import { hostelData } from "../data/dummyData";
import FavoriteToggle from "../components/FavoriteToggle";
import { sanitizeFullName } from "../utils/nameValidation";
import api from "../services/api";
import "./ProfilePage.css";
import { FALLBACK_IMAGE } from '../utils/imageUtils';
import { resolveCatalogPageImage } from '../utils/propertyImageCatalog';

const defaultProfile = {
  name: "Muheeb ullah",
  role: "Resident • Lahore",
  email: "amina@example.com",
  phone: "+92 300 1234567",
  address: "DHA Lahore, Pakistan",
  image: "",
  description:
    "Manage favorites, property listings, notifications, and account settings from your RMS profile hub.",
};

function ProfilePage() {
  const { favorites = [], notifications = [] } = useSelector((state) => state.auth || {});
  const [profile, setProfile] = useState(defaultProfile);
  const [draft, setDraft] = useState(defaultProfile);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.request('/users/profile');
        if (response && response.success && response.data) {
          const nextProfile = {
            ...defaultProfile,
            ...response.data,
            name: response.data.name || defaultProfile.name,
            email: response.data.email || defaultProfile.email,
            role: response.data.role || defaultProfile.role,
            phone: response.data.phone || defaultProfile.phone,
            address: response.data.address || defaultProfile.address,
            image: response.data.image || "",
          };
          setProfile(nextProfile);
          setDraft(nextProfile);
          setEditing(false);
        }
      } catch (err) {
        console.error('Unable to load profile from backend', err);
        setError('Unable to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    setDraft({ ...defaultProfile, ...profile });
  }, [profile]);

  const handleEdit = () => {
    setDraft({ ...profile });
    setEditing(true);
  };

  const handleSave = async () => {
    const nextProfile = {
      ...draft,
      name: sanitizeFullName(draft.name) || profile.name,
      role: draft.role.trim() || profile.role,
      email: draft.email.trim() || profile.email,
      phone: draft.phone.trim() || profile.phone,
      address: draft.address.trim() || profile.address,
      image: draft.image || "",
    };

    try {
      const response = await api.request('/users/profile', {
        method: 'PUT',
        body: nextProfile,
      });

      if (response && response.success && response.data) {
        const savedProfile = { ...defaultProfile, ...response.data };
        setProfile(savedProfile);
        setDraft(savedProfile);
      }
    } catch (error) {
      console.error('Unable to save profile to backend', error);
    }

    setEditing(false);
  };

  const handleCancel = () => {
    setDraft({ ...profile });
    setEditing(false);
  };

  const saveImageToProfile = (imageDataUrl) => {
    const next = { ...profile, image: imageDataUrl || "" };
    setProfile(next);
    setDraft(next);
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const imageDataUrl = reader.result;
      if (typeof imageDataUrl === "string") {
        if (editing) {
          setDraft((previous) => ({ ...previous, image: imageDataUrl }));
        } else {
          saveImageToProfile(imageDataUrl);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const fileRef = useRef(null);

  const triggerFileChoose = () => {
    if (fileRef.current) fileRef.current.click();
  };

  const handleRemoveImage = (immediate = false) => {
    if (immediate) {
      const next = { ...profile, image: "" };
      setProfile(next);
      setDraft(next);
    } else {
      setDraft((prev) => ({ ...prev, image: "" }));
    }
  };

  const initials = "RMS";
  const profileBannerImage = resolveCatalogPageImage('Profile Page', 'Banner', 0, 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80');
  const { properties } = useProperties();

  const favoriteItems = useMemo(() => {
    if (!Array.isArray(favorites) || favorites.length === 0) return [];

    const propertyMap = properties.reduce((map, item) => {
      map[item.id] = item;
      return map;
    }, {});
    return favorites
      .map((favoriteKey) => {
        const [type, id] = favoriteKey.split(":");
        const itemId = Number(id);
        if (type === "property") {
          return propertyMap[itemId];
        }
        if (type === "hostel") {
          const hostel = hostelData.find((hostelItem) => hostelItem.id === itemId);
          return hostel ? { ...hostel, source: "hostel" } : undefined;
        }
        return undefined;
      })
      .filter(Boolean);
  }, [favorites, properties]);

  const unreadCount = notifications.filter((item) => item.unread).length;
  const recentActivity = Array.isArray(profile.loginHistory) ? [...profile.loginHistory].reverse().slice(0, 4) : [];
  const activeProperties = properties.length;
  const profileCompletion = Math.min(
    100,
    Math.round(
      ([profile.name, profile.email, profile.phone, profile.address, profile.description].filter(Boolean).length / 5) * 100,
    ),
  );

  return (
    <div className="profile-page">
      <motion.div
        className="profile-shell"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <aside className="profile-sidebar">
          <Card
            className="profile-card profile-avatar-card"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(10, 24, 42, 0.18), rgba(10, 24, 42, 0.06)), url(${profileBannerImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="profile-avatar-upload">
              <div className="profile-avatar" onClick={triggerFileChoose} role="button" tabIndex={0}>
                {editing && draft.image ? (
                  <img src={draft.image} alt="Profile preview" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: '50%' }} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_IMAGE; }} />
                ) : profile.image ? (
                  <img src={profile.image} alt="Profile" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: '50%' }} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_IMAGE; }} />
                ) : (
                  initials
                )}
                <div className="camera-overlay" onClick={triggerFileChoose}>
                  <CameraOutlined />
                </div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
            </div>
            <div>
              <h2 className="profile-name">{profile.name}</h2>
              <p className="profile-role">{profile.role}</p>
              <div className="profile-chip">
                <HeartOutlined /> Resident member
              </div>
              <div className="profile-avatar-actions" style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <Button size="small" icon={<CameraOutlined />} onClick={triggerFileChoose}>
                  Update Image
                </Button>
                {((editing && (draft.image || profile.image)) || (!editing && profile.image)) && (
                  <Button size="small" danger onClick={() => handleRemoveImage(!editing)}>
                    Remove Image
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Card className="profile-card">
            <h2>Quick stats</h2>
            <div className="profile-stats">
              <div className="profile-stat">
                <strong>{favoriteItems.length}</strong>
                <span>Saved favorites</span>
              </div>
              <div className="profile-stat">
                <strong>{activeProperties}</strong>
                <span>Available properties</span>
              </div>
              <div className="profile-stat">
                <strong>{unreadCount}</strong>
                <span>Unread notifications</span>
              </div>
              <div className="profile-stat">
                <strong>{profileCompletion}%</strong>
                <span>Profile completion</span>
              </div>
            </div>
          </Card>

          <Card className="profile-card">
            <h2>Overview</h2>
            <p>Keep your account details up to date and access the most important RMS tools right from your profile.</p>
            <div className="profile-meta-list">
              <div className="profile-meta-item">
                <strong>Role</strong>
                <span>{profile.role}</span>
              </div>
              <div className="profile-meta-item">
                <strong>Preferred location</strong>
                <span>{profile.address}</span>
              </div>
              <div className="profile-meta-item">
                <strong>Notifications</strong>
                <span>{unreadCount} unread alerts</span>
              </div>
              <div className="profile-meta-item">
                <strong>Secure settings</strong>
                <span>Review account privacy and security options.</span>
              </div>
            </div>
          </Card>
        </aside>

        <main className="profile-main">
          {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div> : null}
          {error ? <Alert type="error" message={error} style={{ marginBottom: 12 }} /> : null}
          <section className="profile-welcome">
            <div className="profile-welcome-top">
              <div className="profile-welcome-text">
                <h1>Welcome back, {profile.name.split(" ")[0]}.</h1>
                <p>
                  Your RMS profile page is the central hub for saved favorites, property management, notifications, and account controls.
                </p>
              </div>
              <div className="profile-actions">
                {editing ? (
                  <>
                    <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
                      Save Changes
                    </Button>
                      { (draft.image || profile.image) && (
                        <Button danger icon={<CloseCircleOutlined />} onClick={handleRemoveImage}>
                          Remove Image
                        </Button>
                      )}
                      <Button icon={<CloseCircleOutlined />} onClick={handleCancel}>
                        Cancel
                      </Button>
                  </>
                ) : (
                  <Button type="primary" icon={<EditOutlined />} onClick={handleEdit}>
                    Edit Profile
                  </Button>
                )}
              </div>
            </div>

            <div className="profile-house-grid">
              <div className="profile-small-card">
                <h4>Favorites today</h4>
                <p>Manage all saved properties and hostels in one place.</p>
              </div>
              <div className="profile-small-card">
                <h4>Active notifications</h4>
                <p>You have {unreadCount} unread message{unreadCount === 1 ? "" : "s"}.</p>
              </div>
            </div>
          </section>

          <section className="profile-section">
            <div className="section-heading">
              <h3>Profile details</h3>
              <p>Update your resident information and contact details for faster service.</p>
            </div>
            {editing ? (
              <div className="profile-form">
                <div className="form-grid">
                  <div className="form-field">
                    <label>Name</label>
                    <Input
                      value={draft.name}
                      onChange={(event) =>
                        setDraft((previous) => ({
                          ...previous,
                          name: sanitizeFullName(event.target.value),
                        }))
                      }
                      pattern="[A-Za-z ]+"
                      title="Full name can contain only letters and spaces."
                    />
                  </div>
                  <div className="form-field">
                    <label>Role</label>
                    <Input
                      value={draft.role}
                      onChange={(event) =>
                        setDraft((previous) => ({
                          ...previous,
                          role: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Email</label>
                    <Input
                      value={draft.email}
                      onChange={(event) =>
                        setDraft((previous) => ({
                          ...previous,
                          email: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Phone</label>
                    <Input
                      value={draft.phone}
                      onChange={(event) =>
                        setDraft((previous) => ({
                          ...previous,
                          phone: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="form-field form-field-full">
                    <label>Address</label>
                    <Input
                      value={draft.address}
                      onChange={(event) =>
                        setDraft((previous) => ({
                          ...previous,
                          address: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="form-field form-field-full">
                    <label>About you</label>
                    <Input.TextArea
                      rows={4}
                      value={draft.description}
                      onChange={(event) =>
                        setDraft((previous) => ({
                          ...previous,
                          description: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="profile-buttons-group">
                  <Button type="primary" onClick={handleSave}>
                    Save changes
                  </Button>
                  <Button onClick={handleCancel}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Card className="profile-panel">
                <Descriptions column={1} className="profile-descriptions">
                  <Descriptions.Item label="Name">{profile.name}</Descriptions.Item>
                  <Descriptions.Item label="Role">{profile.role}</Descriptions.Item>
                  <Descriptions.Item label="Email">{profile.email}</Descriptions.Item>
                  <Descriptions.Item label="Phone">{profile.phone}</Descriptions.Item>
                  <Descriptions.Item label="Address">{profile.address}</Descriptions.Item>
                  <Descriptions.Item label="About">{profile.description}</Descriptions.Item>
                </Descriptions>
              </Card>
            )}
          </section>

          <section className="profile-section">
            <div className="section-heading">
              <h3>Saved favorites</h3>
              <p>Review your current saved properties and remove them directly from the profile page.</p>
            </div>
            {favoriteItems.length === 0 ? (
              <Card className="profile-panel">
                <p>No favorites yet. Save properties from the listings to see them here.</p>
                <Link to="/favorites" className="btn-secondary">
                  View all favorites
                </Link>
              </Card>
            ) : (
              <div className="profile-list">
                {favoriteItems.slice(0, 3).map((item) => (
                  <div key={`${item.source}-${item.id}`} className="profile-list-item">
                    <div className="item-row">
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.source === 'hostel' ? 'Hostel' : 'Property'} · {item.address || item.area}</span>
                      </div>
                      <div className="item-actions">
                        <Link
                          to={item.source === 'hostel' ? `/hostels/${item.id}` : `/properties/${item.id}`}
                          className="btn-secondary"
                          onClick={() => { import('../utils/selectedPropertyStorage.jsx').then(m => m.saveSelectedProperty(item)); }}
                        >
                          View
                        </Link>
                        <FavoriteToggle item={item} label="Remove" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="profile-section">
            <div className="section-heading">
              <h3>Recent activity</h3>
              <p>Your recent sign-ins, account activity, and secure access history.</p>
            </div>
            <Card className="profile-panel">
              <div className="profile-list">
                {recentActivity.length === 0 ? (
                  <p>No recent activity recorded yet.</p>
                ) : recentActivity.map((item, index) => (
                  <div key={`${item.timestamp || index}`} className="profile-list-item">
                    <div className="item-row">
                      <div>
                        <strong>{item.browser || 'Secure login'}</strong>
                        <span>
                          {new Date(item.timestamp || Date.now()).toLocaleString('en-PK', {
                            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                          })} • {item.device || 'Desktop'} • {item.ip || 'Unknown IP'}
                        </span>
                      </div>
                      <Tag color="green">Success</Tag>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section className="profile-section">
            <div className="section-heading">
              <h3>Notifications</h3>
              <p>Stay on top of recent updates from RMS, including rent reminders and booking confirmations.</p>
            </div>
            <Card className="profile-panel">
              <div className="profile-list">
                {notifications.slice(0, 4).map((item) => (
                  <div key={item.id} className="profile-list-item">
                    <div className="item-row">
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                      </div>
                      <Tag color={item.unread ? 'processing' : 'default'}>
                        {item.unread ? 'New' : 'Read'}
                      </Tag>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section className="profile-section">
            <div className="section-heading">
              <h3>Account settings</h3>
              <p>Manage your security, notification preferences, and privacy controls.</p>
            </div>
            <div className="profile-settings">
              <div className="profile-setting-card">
                <div>
                  <strong>Security settings</strong>
                  <p>Update your password, two-factor authentication, and login preferences.</p>
                </div>
                <Button type="text" icon={<SettingOutlined />}>
                  Manage
                </Button>
              </div>
              <div className="profile-setting-card">
                <div>
                  <strong>Notification preferences</strong>
                  <p>Control alerts for rent, bookings, and community announcements.</p>
                </div>
                <Link to="/notifications" className="btn-ghost">
                  Review
                </Link>
              </div>
              <div className="profile-setting-card">
                <div>
                  <strong>Property access</strong>
                  <p>Review the properties you manage and visibility settings.</p>
                </div>
                <Link to="/properties" className="btn-ghost">
                  Explore
                </Link>
              </div>
            </div>
          </section>
        </main>
      </motion.div>
    </div>
  );
}

export default ProfilePage;
