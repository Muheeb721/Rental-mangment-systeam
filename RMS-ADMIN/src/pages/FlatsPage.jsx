import { useMemo, useState, useEffect } from 'react';
import './FlatsPage.css';
import Modal from '../components/Modal';
import { formatCurrency, formatDate } from '../utils/formatters';
import { generateId } from '../services/localStorage';
import { apiService } from '../services/api';
import { createAdminProperty, deleteAdminProperty, updateAdminProperty, uploadPropertyImage, replacePropertyImage } from '../services/adminPropertyService';
import AdminPropertySlider from '../components/AdminPropertySlider';

const emptyForm = {
  title: '',
  propertyType: 'Flat',
  category: 'Flat',
  type: 'Flat',
  purpose: 'Rent',
  transactionType: 'Rent',
  listingType: 'rent',
  description: '',
  price: '',
  rent: '',
  salePrice: '',
  deposit: '',
  otherCharges: '',
  location: '',
  city: '',
  address: '',
  bedrooms: '',
  bathrooms: '',
  area: '',
  furnished: 'Fully Furnished',
  floor: '',
  totalFloors: '',
  ownerName: '',
  ownerPhone: '',
  ownerEmail: '',
  image: '',
  status: 'Available',
};

const statusOptions = ['Available', 'Reserved', 'Sold', 'For Rent'];
const FLAT_DEFAULT_IMAGES = [
  'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1502005229762-ee1b2b93e0f5?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80',
];
const FLAT_DEFAULT_IMAGE = FLAT_DEFAULT_IMAGES[0];
const BACKEND_BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000')
  .replace(/\/api\/?$/, '')
  .replace(/\/$/, '') || 'http://localhost:5000';
const normalizeImageUrl = (value) => {
  if (value && typeof value === 'object') value = value.url;
  if (!value || typeof value !== 'string') return FLAT_DEFAULT_IMAGE;
  const trimmed = value.trim();
  if (!trimmed) return FLAT_DEFAULT_IMAGE;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || /^(https?:)?\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return `${BACKEND_BASE_URL}${trimmed}`;
  return trimmed;
};
const getPropertyImageUrl = (property, index = 0) => {
  const candidateValues = [];
  const rawImages = Array.isArray(property?.images) ? property.images : [];
  rawImages.forEach((item) => item && candidateValues.push(item));
  if (property?.image) candidateValues.push(property.image);
  if (property?.mainImage) candidateValues.push(property.mainImage);
  if (property?.coverImage) candidateValues.push(property.coverImage);
  const deduped = [...new Set(candidateValues.map((item) => normalizeImageUrl(item)).filter(Boolean))];
  const fallback = FLAT_DEFAULT_IMAGES[(Number(index) || 0) % FLAT_DEFAULT_IMAGES.length] || FLAT_DEFAULT_IMAGE;
  return deduped[index] || deduped[0] || fallback;
};
const getPropertyId = (property) => property?._id || property?.id || property?.propertyId || property?.mongoId;
const isSaleListing = (property) => [
  property?.listingType,
  property?.transactionType,
  property?.purpose,
].some((value) => ['sale', 'sell', 'buy', 'purchase', 'for sale'].includes(String(value || '').trim().toLowerCase()));

function FlatsPage({ appData, setAppData, notify }) {
  const properties = (appData.properties || []).filter((item) => (
    !isSaleListing(item)
    && [item.propertyType, item.type, item.category]
      .some((value) => ['flat', 'flats', 'studio', 'studios'].includes(String(value || '').trim().toLowerCase()))
  ));

  const refreshProperties = async () => {
    try {
      const resp = await apiService.request('/admin/properties');
      if (resp?.success) {
        setAppData((prev) => ({ ...prev, properties: resp.data || prev.properties || [] }));
      }
    } catch (error) {
      console.warn('Unable to refresh property list from backend:', error);
    }
  };
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortKey, setSortKey] = useState('createdAt');
  const [modalOpen, setModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [errors, setErrors] = useState({});

  const filteredProperties = useMemo(() => {
    const next = [...properties].filter((item) => {
      const matchesSearch = !search || [item.title, item.location, item.ownerName, item.city].join(' ').toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    next.sort((a, b) => {
      if (sortKey === 'price') return Number(b.price || 0) - Number(a.price || 0);
      if (sortKey === 'title') return String(a.title).localeCompare(String(b.title));
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    return next;
  }, [properties, search, statusFilter, sortKey]);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setSelectedImageFile(null);
    setErrors({});
    setModalOpen(true);
  };

  useEffect(() => {
    const loadProperties = async () => {
      try {
        const resp = await apiService.request('/admin/properties?limit=1000');
        if (resp?.success) setAppData((prev) => ({ ...prev, properties: resp.data || [] }));
      } catch (e) {
        console.warn('Load properties failed', e);
        notify && notify({ message: 'Unable to load properties', variant: 'error' });
      }
    };
    loadProperties();
  }, [setAppData]);

  const openEditModal = (property) => {
    setEditingId(getPropertyId(property));
    setFormData({
      title: property.title || '',
      propertyType: property.propertyType || 'Flat',
      category: property.category || property.propertyType || 'Flat',
      description: property.description || '',
      price: property.price || '',
      rent: property.rent || '',
      salePrice: property.salePrice || '',
      deposit: property.deposit || '',
      otherCharges: property.otherCharges || '',
      location: property.location || '',
      city: property.city || '',
      address: property.address || '',
      bedrooms: property.bedrooms || '',
      bathrooms: property.bathrooms || '',
      area: property.area || '',
      furnished: property.furnished || 'Fully Furnished',
      floor: property.floor || '',
      totalFloors: property.totalFloors || '',
      ownerName: property.ownerName || '',
      ownerPhone: property.ownerPhone || '',
      ownerEmail: property.ownerEmail || '',
      image: property.image || '',
      status: property.status || 'Available',
    });
    setErrors({});
    setModalOpen(true);
  };

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImagePick = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, image: String(reader.result || ''), images: [String(reader.result || '')] }));
    };
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const nextErrors = {};
    if (!formData.title.trim()) nextErrors.title = 'Title is required';
    if (!formData.city.trim()) nextErrors.city = 'City is required';
    if (!formData.location.trim()) nextErrors.location = 'Location is required';
    if (!formData.ownerName.trim()) nextErrors.ownerName = 'Owner name is required';
    if (!formData.ownerPhone.trim()) nextErrors.ownerPhone = 'Owner phone is required';
    if (!formData.ownerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.ownerEmail)) nextErrors.ownerEmail = 'Valid email is required';
    if (!formData.price || Number(formData.price) <= 0) nextErrors.price = 'Price must be greater than zero';
    if (!formData.area || Number(formData.area) <= 0) nextErrors.area = 'Area must be greater than zero';
    return nextErrors;
  };

  const addActivity = (action, details) => {
    setAppData((prev) => ({
      ...prev,
      activityLogs: [{ id: `log-${Date.now()}`, action, details, timestamp: new Date().toISOString() }, ...(prev.activityLogs || [])].slice(0, 20),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const previousProperty = editingId ? properties.find((item) => String(getPropertyId(item)) === String(editingId)) : null;
    const nextPriceHistory = previousProperty?.priceHistory || [];

    if (editingId && previousProperty) {
      const prevPrice = Number(previousProperty.price || 0);
      const nextPrice = Number(formData.price || 0);
      if (prevPrice !== nextPrice) {
        nextPriceHistory.unshift({
          historyId: `hist-${Date.now()}`,
          propertyId: getPropertyId(previousProperty),
          oldPrice: prevPrice,
          newPrice: nextPrice,
          changedBy: 'Admin',
          changedAt: new Date().toISOString(),
        });
      }
    }

    const monthlyRent = Number(formData.price || 0);
    const payload = {
      title: formData.title.trim(),
      propertyType: 'Flat',
      category: 'Flat',
      type: 'Flat',
      purpose: 'Rent',
      transactionType: 'Rent',
      listingType: 'rent',
      description: formData.description.trim(),
      price: monthlyRent,
      rent: monthlyRent,
      salePrice: 0,
      deposit: Number(formData.deposit || 0),
      otherCharges: Number(formData.otherCharges || 0),
      location: formData.location.trim(),
      city: formData.city.trim(),
      address: formData.address.trim(),
      bedrooms: Number(formData.bedrooms || 0),
      bathrooms: Number(formData.bathrooms || 0),
      area: Number(formData.area || 0),
      furnished: formData.furnished,
      floor: Number(formData.floor || 0),
      totalFloors: Number(formData.totalFloors || 0),
      ownerName: formData.ownerName.trim(),
      ownerPhone: formData.ownerPhone.trim(),
      ownerEmail: formData.ownerEmail.trim(),
      status: formData.status,
      createdAt: editingId ? previousProperty?.createdAt || new Date().toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      priceHistory: nextPriceHistory,
    };
    if (!selectedImageFile) {
      payload.image = previousProperty?.image || '';
      payload.images = Array.isArray(previousProperty?.images) ? previousProperty.images : [];
    }

    try {
      const saved = editingId
        ? await updateAdminProperty(editingId, payload)
        : await createAdminProperty(payload);
      const finalProperty = saved || payload;
      const savedId = getPropertyId(finalProperty) || editingId;
      if (selectedImageFile && savedId) {
        if (Array.isArray(previousProperty?.images) && previousProperty.images.length) await replacePropertyImage(savedId, 0, selectedImageFile);
        else await uploadPropertyImage(savedId, selectedImageFile);
      }

      await refreshProperties();

      setAppData((prev) => ({
        ...prev,
        notifications: [
          {
            id: `notif-${Date.now()}`,
            title: editingId ? 'Flat updated' : 'New flat added',
            message: `${finalProperty.title || payload.title} was ${editingId ? 'updated' : 'added'} successfully.`,
            propertyId: getPropertyId(finalProperty) || editingId,
            propertyType: 'Flat',
            time: 'Just now',
            date: new Date().toISOString(),
            read: false,
            priority: 'Normal',
          },
          ...(prev.notifications || []),
        ],
      }));

      addActivity(editingId ? 'Flat edited' : 'Flat added', `${finalProperty.title || payload.title} was ${editingId ? 'updated' : 'added'} to the flat catalog.`);
      notify({ message: editingId ? 'Flat updated successfully.' : 'Flat added successfully.', variant: 'success' });
      setModalOpen(false);
      setSelectedImageFile(null);
      setEditingId(null);
      setFormData(emptyForm);
    } catch (error) {
      console.error('Flat save failed:', error);
      notify({ message: error.message || 'Unable to save flat.', variant: 'error' });
    }
  };

  const handleDelete = async (propertyId) => {
    try {
      await deleteAdminProperty(propertyId);
      await refreshProperties();
      addActivity('Flat deleted', 'A flat was removed from the catalog.');
      notify({ message: 'Flat deleted successfully.', variant: 'success' });
    } catch (error) {
      console.error('Flat delete failed:', error);
      notify({ message: error.message || 'Unable to delete flat.', variant: 'error' });
    }
    setDeletingId(null);
  };

  const changeStatus = (propertyId, nextStatus) => {
    (async () => {
      try {
        notify({ message: 'Updating flat status...', variant: 'info' });
        const resp = await apiService.request(`/properties/${propertyId}/status`, { method: 'POST', body: { status: nextStatus } });
        const updated = resp?.data || null;
        if (updated) {
          setAppData((prev) => ({ ...prev, properties: (prev.properties || []).map((p) => (String(getPropertyId(p)) === String(propertyId) ? { ...p, ...updated } : p)) }));
        } else {
          setAppData((prev) => ({ ...prev, properties: (prev.properties || []).map((item) => (String(getPropertyId(item)) === String(propertyId) ? { ...item, status: nextStatus, updatedAt: new Date().toISOString() } : item)) }));
        }
        await refreshProperties();
        addActivity('Flat status changed', `A flat status was updated to ${nextStatus}.`);
        notify({ message: `Flat status updated to ${nextStatus}.`, variant: 'success' });
      } catch (e) {
        console.error('Update status failed', e);
        notify({ message: e?.message || 'Unable to update flat status.', variant: 'error' });
      }
    })();
  };

  const duplicateProperty = (property) => {
    (async () => {
      try {
        notify({ message: 'Duplicating flat...', variant: 'info' });
        const payload = { ...property };
        delete payload._id;
        delete payload.id;
        payload.title = `${property.title} Copy`;
        payload.propertyType = 'Flat';
        payload.category = 'Flat';
        payload.createdAt = new Date().toISOString();
        payload.updatedAt = new Date().toISOString();
        const saved = await createAdminProperty(payload);
        const finalProperty = saved || { ...payload, _id: payload._id || generateId('prop') };
        await refreshProperties();
        setEditingId(getPropertyId(finalProperty) || null);
        setFormData({
          title: finalProperty.title || '',
          propertyType: 'Flat',
          category: 'Flat',
          description: finalProperty.description || '',
          price: finalProperty.price || '',
          rent: finalProperty.rent || '',
          salePrice: finalProperty.salePrice || '',
          deposit: finalProperty.deposit || '',
          otherCharges: finalProperty.otherCharges || '',
          location: finalProperty.location || '',
          city: finalProperty.city || '',
          address: finalProperty.address || '',
          bedrooms: finalProperty.bedrooms || '',
          bathrooms: finalProperty.bathrooms || '',
          area: finalProperty.area || '',
          furnished: finalProperty.furnished || 'Fully Furnished',
          floor: finalProperty.floor || '',
          totalFloors: finalProperty.totalFloors || '',
          ownerName: finalProperty.ownerName || '',
          ownerPhone: finalProperty.ownerPhone || '',
          ownerEmail: finalProperty.ownerEmail || '',
          image: finalProperty.image || '',
          status: finalProperty.status || 'Available',
        });
        setErrors({});
        setModalOpen(true);
        addActivity('Flat duplicated', `${property.title} was duplicated and opened for editing.`);
        notify({ message: 'Flat duplicated and opened for editing.', variant: 'success' });
      } catch (e) {
        console.error('Duplicate flat failed', e);
        notify({ message: e?.message || 'Unable to duplicate flat.', variant: 'error' });
      }
    })();
  };

  const handleReplaceImage = async (propertyId, index, file) => {
    if (!file) return;
    const form = new FormData();
    form.append('image', file);
    try {
      notify && notify({ message: 'Replacing image...', variant: 'info' });
      await apiService.replacePropertyImage(propertyId, index, form);
      await refreshProperties();
      const resp = await apiService.getProperty(propertyId);
      if (resp?.success) setSelectedProperty(resp.data);
      notify && notify({ message: 'Image replaced successfully.', variant: 'success' });
    } catch (e) {
      console.error('Replace image failed', e);
      notify && notify({ message: e?.message || 'Unable to replace image.', variant: 'error' });
    }
  };

  const handleDeleteImage = async (propertyId, index) => {
    try {
      notify && notify({ message: 'Deleting image...', variant: 'info' });
      await apiService.deletePropertyImage(propertyId, index);
      await refreshProperties();
      const resp = await apiService.getProperty(propertyId);
      if (resp?.success) setSelectedProperty(resp.data);
      notify && notify({ message: 'Image deleted successfully.', variant: 'success' });
    } catch (e) {
      console.error('Delete image failed', e);
      notify && notify({ message: e?.message || 'Unable to delete image.', variant: 'error' });
    }
  };

  const paymentHistory = (appData.payments || []).filter((payment) => (payment.propertyName || payment.property) === (selectedProperty?.title || ''));
  const duesForProperty = (appData.dues || []).filter((due) => (due.propertyName || due.property) === (selectedProperty?.title || ''));

  return (
    <div className="page-section flats-page">
      <section className="panel-card toolbar-card">
        <div className="toolbar-row">
          <div className="toolbar-search">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search flat, area, owner..." />
          </div>
          <div className="toolbar-group">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="All">All Status</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
              <option value="createdAt">Newest</option>
              <option value="price">Price</option>
              <option value="title">Title</option>
            </select>
            <button type="button" className="primary-button" onClick={openCreateModal}>Add Flat</button>
          </div>
        </div>
      </section>

      <section className="panel-card">
        <div className="card-header">
          <h3>Flat Inventory</h3>
          <span className="mini-badge">{filteredProperties.length} flats</span>
        </div>
        <AdminPropertySlider
          properties={filteredProperties}
          onEdit={openEditModal}
          onReplaceImage={(property, file) => handleReplaceImage(getPropertyId(property), 0, file)}
          onDelete={(property) => handleDelete(getPropertyId(property))}
        />

        {filteredProperties.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏙️</div>
            <h4>No flats found</h4>
            <p>Adjust the filters or add a new flat listing.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Flat</th>
                  <th>Location</th>
                  <th>Price</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProperties.map((property, index) => (
                  <tr key={getPropertyId(property) || property.id}>
                    <td>
                      <img
                        src={getPropertyImageUrl(property, index)}
                        alt={property.title || 'Flat'}
                        className="property-thumb"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = FLAT_DEFAULT_IMAGES[index % FLAT_DEFAULT_IMAGES.length] || FLAT_DEFAULT_IMAGE;
                        }}
                      />
                    </td>
                    <td>
                      <strong>{property.title}</strong>
                      <small>{property.city}</small>
                    </td>
                    <td>{property.location}</td>
                    <td>{formatCurrency(property.price || property.salePrice || 0)}</td>
                    <td>{property.ownerName}</td>
                    <td>
                      <select value={property.status} onChange={(event) => changeStatus(getPropertyId(property), event.target.value)} className="status-select">
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td>{formatDate(property.createdAt)}</td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="table-button light" onClick={() => openEditModal(property)}>Edit</button>
                        <button type="button" className="table-button light" onClick={() => { setSelectedProperty(property); setManageModalOpen(true); }}>Manage</button>
                        <button type="button" className="table-button light" onClick={() => duplicateProperty(property)}>Copy & Edit</button>
                        <button type="button" className="table-button danger" onClick={() => setDeletingId(getPropertyId(property))}>Delete</button>
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
        title={editingId ? 'Edit Flat' : 'Add Flat'}
        onClose={() => { setModalOpen(false); setErrors({}); }}
        footer={
          <>
            <button type="button" className="outline-button" onClick={() => { setModalOpen(false); setErrors({}); }}>Cancel</button>
            <button type="submit" className="primary-button" form="flat-form">Save Flat</button>
          </>
        }
      >
        <form id="flat-form" className="property-form" onSubmit={handleSubmit}>
          <div className="form-grid two-col">
            <label>
              Flat title
              <input name="title" value={formData.title} onChange={handleFieldChange} />
              {errors.title && <span className="field-error">{errors.title}</span>}
            </label>
            <label>
              Status
              <select name="status" value={formData.status} onChange={handleFieldChange}>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Description
            <textarea name="description" rows="4" value={formData.description} onChange={handleFieldChange} />
          </label>

          <div className="section-title">Pricing</div>
          <div className="form-grid three-col">
            <label>
              Monthly rent
              <input type="number" name="price" value={formData.price} onChange={handleFieldChange} />
              {errors.price && <span className="field-error">{errors.price}</span>}
            </label>
            <label>
              Deposit
              <input type="number" name="deposit" value={formData.deposit} onChange={handleFieldChange} />
            </label>
          </div>

          <div className="form-grid three-col">
            <label>
              Other charges
              <input type="number" name="otherCharges" value={formData.otherCharges} onChange={handleFieldChange} />
            </label>
            <label>
              Area
              <input type="number" name="area" value={formData.area} onChange={handleFieldChange} />
              {errors.area && <span className="field-error">{errors.area}</span>}
            </label>
          </div>

          <div className="section-title">Flat details</div>
          <div className="form-grid three-col">
            <label>
              Bedrooms
              <input type="number" name="bedrooms" value={formData.bedrooms} onChange={handleFieldChange} />
            </label>
            <label>
              Bathrooms
              <input type="number" name="bathrooms" value={formData.bathrooms} onChange={handleFieldChange} />
            </label>
            <label>
              Furnishing
              <select name="furnished" value={formData.furnished} onChange={handleFieldChange}>
                <option value="Fully Furnished">Fully Furnished</option>
                <option value="Semi Furnished">Semi Furnished</option>
                <option value="Unfurnished">Unfurnished</option>
              </select>
            </label>
          </div>

          <div className="form-grid two-col">
            <label>
              Floor
              <input type="number" name="floor" value={formData.floor} onChange={handleFieldChange} />
            </label>
            <label>
              Total floors
              <input type="number" name="totalFloors" value={formData.totalFloors} onChange={handleFieldChange} />
            </label>
          </div>

          <div className="section-title">Location</div>
          <div className="form-grid two-col">
            <label>
              City
              <input name="city" value={formData.city} onChange={handleFieldChange} />
              {errors.city && <span className="field-error">{errors.city}</span>}
            </label>
            <label>
              Area
              <input name="location" value={formData.location} onChange={handleFieldChange} />
              {errors.location && <span className="field-error">{errors.location}</span>}
            </label>
          </div>
          <label>
            Address
            <textarea name="address" rows="3" value={formData.address} onChange={handleFieldChange} />
          </label>

          <div className="section-title">Owner information</div>
          <div className="form-grid two-col">
            <label>
              Owner name
              <input name="ownerName" value={formData.ownerName} onChange={handleFieldChange} />
              {errors.ownerName && <span className="field-error">{errors.ownerName}</span>}
            </label>
            <label>
              Owner phone
              <input name="ownerPhone" value={formData.ownerPhone} onChange={handleFieldChange} />
              {errors.ownerPhone && <span className="field-error">{errors.ownerPhone}</span>}
            </label>
          </div>
          <label>
            Owner email
            <input name="ownerEmail" type="email" value={formData.ownerEmail} onChange={handleFieldChange} />
            {errors.ownerEmail && <span className="field-error">{errors.ownerEmail}</span>}
          </label>

          <div className="section-title">Images</div>
          <label>
            Main image
            <input type="file" accept="image/*" onChange={handleImagePick} />
          </label>
          {formData.image && (
            <img
              src={normalizeImageUrl(formData.image)}
              alt="Preview"
              className="image-preview"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = FLAT_DEFAULT_IMAGE;
              }}
            />
          )}
        </form>
      </Modal>

      <Modal
        open={manageModalOpen && Boolean(selectedProperty)}
        title={`Manage ${selectedProperty?.title || 'Flat'}`}
        onClose={() => setManageModalOpen(false)}
        footer={<button type="button" className="outline-button" onClick={() => setManageModalOpen(false)}>Close</button>}
      >
        {selectedProperty && (
          <div className="manage-property-panel">
            <div className="detail-header">
              <img
                src={getPropertyImageUrl(selectedProperty, 0)}
                alt={selectedProperty.title || 'Flat'}
                className="property-thumb large"
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = FLAT_DEFAULT_IMAGE;
                }}
              />
              <div>
                <h4>{selectedProperty.title}</h4>
                <p>{selectedProperty.propertyType} • {selectedProperty.location}</p>
              </div>
            </div>
            <div className="detail-grid">
              <div><strong>Flat ID:</strong> <span>{getPropertyId(selectedProperty)}</span></div>
              <div><strong>Status:</strong> <span>{selectedProperty.status}</span></div>
              <div><strong>Price:</strong> <span>{formatCurrency(selectedProperty.price || 0)}</span></div>
              <div><strong>Rent:</strong> <span>{formatCurrency(selectedProperty.rent || 0)}</span></div>
              <div><strong>Deposit:</strong> <span>{formatCurrency(selectedProperty.deposit || 0)}</span></div>
              <div><strong>Owner:</strong> <span>{selectedProperty.ownerName}</span></div>
            </div>

            <div className="subsection-block">
              <h5>Price History</h5>
              {(selectedProperty.priceHistory || []).length ? (
                <ul>
                  {(selectedProperty.priceHistory || []).slice(0, 5).map((item) => (
                    <li key={item.historyId}>{formatDate(item.changedAt)} • {formatCurrency(item.oldPrice)} → {formatCurrency(item.newPrice)}</li>
                  ))}
                </ul>
              ) : <p>No price changes recorded yet.</p>}
            </div>

            <div className="subsection-block">
              <h5>Payment History</h5>
              {paymentHistory.length ? (
                <ul>
                  {paymentHistory.slice(0, 5).map((payment) => (
                    <li key={payment.id || payment.paymentId}>{formatDate(payment.paymentDate || payment.date)} • {payment.userName || payment.user} • {formatCurrency(payment.amount)} • {payment.status}</li>
                  ))}
                </ul>
              ) : <p>No payment history for this flat.</p>}
            </div>

            <div className="subsection-block">
              <h5>Due History</h5>
              {duesForProperty.length ? (
                <ul>
                  {duesForProperty.slice(0, 5).map((due) => (
                    <li key={due.id}>{formatDate(due.dueDate)} • {due.residentName || due.user} • {formatCurrency(due.remainingAmount || due.currentCharge || 0)} • {due.status || due.paymentStatus}</li>
                  ))}
                </ul>
              ) : <p>No due history reported.</p>}
            </div>
            <div className="subsection-block">
              <h5>Images</h5>
              <div className="image-gallery admin-gallery">
                {(() => {
                  const rawImages = Array.isArray(selectedProperty.images) ? selectedProperty.images.slice(0, 6) : [];
                  const candidateValues = [];
                  rawImages.forEach((it) => it && candidateValues.push(it));
                  if (selectedProperty.image) candidateValues.push(selectedProperty.image);
                  if (selectedProperty.mainImage) candidateValues.push(selectedProperty.mainImage);
                  if (selectedProperty.coverImage) candidateValues.push(selectedProperty.coverImage);
                  const deduped = [...new Set(candidateValues.map((item) => normalizeImageUrl(item)).filter(Boolean))];
                  const slots = Array.from({ length: 3 }, (_, i) => deduped[i] || deduped[0] || FLAT_DEFAULT_IMAGES[i % FLAT_DEFAULT_IMAGES.length]);
                  return slots.map((url, idx) => (
                    <div key={idx} className="gallery-item">
                      <img src={url} alt={`Image ${idx + 1}`} className="property-thumb" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FLAT_DEFAULT_IMAGES[idx % FLAT_DEFAULT_IMAGES.length]; }} />
                      <div className="gallery-actions">
                        <label className="btn small">
                          Replace
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleReplaceImage(getPropertyId(selectedProperty), idx, e.target.files?.[0])} />
                        </label>
                        <button type="button" className="btn small danger" onClick={() => handleDeleteImage(getPropertyId(selectedProperty), idx)}>Delete</button>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(deletingId)}
        title="Are you sure?"
        onClose={() => setDeletingId(null)}
        footer={
          <>
            <button type="button" className="outline-button" onClick={() => setDeletingId(null)}>Cancel</button>
            <button type="button" className="primary-button danger-button" onClick={() => { const id = deletingId; handleDelete(id); }}>Delete</button>
          </>
        }
      >
        <p>This action cannot be undone.</p>
      </Modal>
    </div>
  );
}

export default FlatsPage;
