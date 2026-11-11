import { useMemo, useState, useEffect } from 'react';
import './HousesPage.css';
import Modal from '../components/Modal';
import { formatCurrency, formatDate } from '../utils/formatters';
import { apiService } from '../services/api';
import {
  createAdminProperty,
  deleteAdminProperty,
  updateAdminProperty,
  uploadPropertyImage,
  replacePropertyImage,
  deletePropertyImage,
} from '../services/adminPropertyService';
import AdminPropertySlider from '../components/AdminPropertySlider';

const emptyForm = {
  title: '',
  propertyType: 'House',
  category: 'House',
  type: 'House',
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
const HOUSE_DEFAULT_IMAGES = [
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1523217582562-09d0def993a6?auto=format&fit=crop&w=900&q=80',
];
const HOUSE_DEFAULT_IMAGE = HOUSE_DEFAULT_IMAGES[0];
const BACKEND_BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000')
  .replace(/\/api\/?$/, '')
  .replace(/\/$/, '') || 'http://localhost:5000';
const normalizeImageUrl = (value) => {
  if (value && typeof value === 'object') value = value.url;
  if (!value || typeof value !== 'string') return HOUSE_DEFAULT_IMAGE;
  const trimmed = value.trim();
  if (!trimmed) return HOUSE_DEFAULT_IMAGE;
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
  const fallback = HOUSE_DEFAULT_IMAGES[(Number(index) || 0) % HOUSE_DEFAULT_IMAGES.length] || HOUSE_DEFAULT_IMAGE;
  return deduped[index] || deduped[0] || fallback;
};
const getPropertyId = (property) => property?._id || property?.id || property?.propertyId || property?.mongoId;
const isSaleListing = (property) => [
  property?.listingType,
  property?.transactionType,
  property?.purpose,
].some((value) => ['sale', 'sell', 'buy', 'purchase', 'for sale'].includes(String(value || '').trim().toLowerCase()));

function HousesPage({ appData, setAppData, notify }) {
  const properties = (appData.properties || []).filter((item) => {
    const propertyType = String(item?.propertyType || '').trim().toLowerCase();
    const category = String(item?.category || '').trim().toLowerCase();
    const type = String(item?.type || '').trim().toLowerCase();
    return !isSaleListing(item) && [propertyType, category, type].some((value) => ['house', 'houses', 'villa', 'villas'].includes(value));
  });

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
      propertyType: property.propertyType || 'House',
      category: property.category || property.propertyType || 'House',
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
      propertyType: 'House',
      category: 'House',
      type: 'House',
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
        const existingImages = Array.isArray(previousProperty?.images) ? previousProperty.images : [];
        if (existingImages.length) {
          await replacePropertyImage(savedId, 0, selectedImageFile);
        } else {
          await uploadPropertyImage(savedId, selectedImageFile);
        }
      }

      await refreshProperties();

      setAppData((prev) => ({
        ...prev,
        notifications: [
          {
            id: `notif-${Date.now()}`,
            title: editingId ? 'House updated' : 'New house added',
            message: `${finalProperty.title || payload.title} was ${editingId ? 'updated' : 'added'} successfully.`,
            propertyId: getPropertyId(finalProperty) || editingId,
            propertyType: 'House',
            time: 'Just now',
            date: new Date().toISOString(),
            read: false,
            priority: 'Normal',
          },
          ...(prev.notifications || []),
        ],
      }));

      addActivity(editingId ? 'House edited' : 'House added', `${finalProperty.title || payload.title} was ${editingId ? 'updated' : 'added'} to the house catalog.`);
      notify({ message: editingId ? 'House updated successfully.' : 'House added successfully.', variant: 'success' });
      setModalOpen(false);
      setEditingId(null);
      setSelectedImageFile(null);
      setFormData(emptyForm);
    } catch (error) {
      console.error('House save failed:', error);
      notify({ message: error.message || 'Unable to save house.', variant: 'error' });
    }
  };

  const handleDelete = async (propertyId) => {
    try {
      await deleteAdminProperty(propertyId);
      setAppData((previous) => ({
        ...previous,
        properties: (previous.properties || []).filter(
          (item) => String(getPropertyId(item)) !== String(propertyId)
        ),
      }));
      await refreshProperties();
      addActivity('House deleted', 'A house was removed from the catalog.');
      notify({ message: 'House deleted successfully.', variant: 'success' });
    } catch (error) {
      console.error('House delete failed:', error);
      notify({ message: error.message || 'Unable to delete house.', variant: 'error' });
    }
    setDeletingId(null);
  };

  const handleUploadImage = async (property, file) => {
    const propertyId = getPropertyId(property);
    if (!propertyId || !file) return;

    try {
      notify && notify({ message: 'Uploading image...', variant: 'info' });
      const response = await uploadPropertyImage(propertyId, file);
      const updatedProperty = response?.property;
      if (updatedProperty) {
        setAppData((previous) => ({
          ...previous,
          properties: (previous.properties || []).map((item) =>
            String(getPropertyId(item)) === String(propertyId)
              ? { ...item, ...updatedProperty }
              : item
          ),
        }));
      }
      await refreshProperties();
      notify && notify({ message: 'Image uploaded and saved.', variant: 'success' });
    } catch (error) {
      console.error('House image upload failed:', error);
      notify && notify({ message: error?.message || 'Unable to upload house image.', variant: 'error' });
    }
  };

  const handleReplaceImage = async (propertyId, index, file) => {
    if (!file) return;
    try {
      notify && notify({ message: 'Replacing image...', variant: 'info' });
      await replacePropertyImage(propertyId, index, file);
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
      const propertyResponse = await apiService.getProperty(propertyId);
      const currentImages = Array.isArray(propertyResponse?.data?.images)
        ? propertyResponse.data.images
        : [];

      if (index < 0 || index >= currentImages.length) {
        notify && notify({
          message: 'That image is no longer available. Refreshing the gallery.',
          variant: 'info',
        });
        if (propertyResponse?.success) setSelectedProperty(propertyResponse.data);
        return;
      }

      await deletePropertyImage(propertyId, index);
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
    <div className="page-section houses-page">
      <section className="panel-card toolbar-card">
        <div className="toolbar-row">
          <div className="toolbar-search">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search house, area, owner..." />
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
            <button type="button" className="primary-button" onClick={openCreateModal}>Add House</button>
          </div>
        </div>
      </section>

      <section className="panel-card">
        <div className="card-header">
          <h3>House Inventory</h3>
          <span className="mini-badge">{filteredProperties.length} houses</span>
        </div>
        <AdminPropertySlider
          properties={filteredProperties}
          onEdit={openEditModal}
          onUploadImage={handleUploadImage}
          onReplaceImage={(property, file) => handleReplaceImage(getPropertyId(property), 0, file)}
          onDelete={(property) => handleDelete(getPropertyId(property))}
        />
      </section>

      <Modal
        open={modalOpen}
        title={editingId ? 'Edit House' : 'Add House'}
        onClose={() => { setModalOpen(false); setErrors({}); }}
        footer={
          <>
            <button type="button" className="outline-button" onClick={() => { setModalOpen(false); setErrors({}); }}>Cancel</button>
            <button type="submit" className="primary-button" form="house-form">Save House</button>
          </>
        }
      >
        <form id="house-form" className="property-form" onSubmit={handleSubmit}>
          <div className="form-grid two-col">
            <label>
              House title
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

          <div className="section-title">House details</div>
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
          {formData.image && <img src={normalizeImageUrl(formData.image)} alt="Preview" className="image-preview" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = HOUSE_DEFAULT_IMAGE; }} />}
        </form>
      </Modal>

      <Modal
        open={manageModalOpen && Boolean(selectedProperty)}
        title={`Manage ${selectedProperty?.title || 'House'}`}
        onClose={() => setManageModalOpen(false)}
        footer={<button type="button" className="outline-button" onClick={() => setManageModalOpen(false)}>Close</button>}
      >
        {selectedProperty && (
          <div className="manage-property-panel">
            <div className="detail-header">
              <img
                src={getPropertyImageUrl(selectedProperty, 0)}
                alt={selectedProperty.title || 'House'}
                className="property-thumb large"
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = HOUSE_DEFAULT_IMAGE;
                }}
              />
              <div>
                <h4>{selectedProperty.title}</h4>
                <p>{selectedProperty.propertyType} • {selectedProperty.location}</p>
              </div>
            </div>
            <div className="detail-grid">
              <div><strong>House ID:</strong> <span>{getPropertyId(selectedProperty)}</span></div>
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
              <h5>House Payment History</h5>
              {paymentHistory.length ? (
                <ul>
                  {paymentHistory.slice(0, 5).map((payment) => (
                    <li key={payment.id || payment.paymentId}>{formatDate(payment.paymentDate || payment.date)} • {payment.userName || payment.user} • {formatCurrency(payment.amount)} • {payment.status}</li>
                  ))}
                </ul>
              ) : <p>No payment history for this house.</p>}
            </div>

            <div className="subsection-block">
              <h5>Images</h5>
              <div className="image-gallery admin-gallery">
                {(() => {
                  const rawImages = Array.isArray(selectedProperty.images)
                    ? selectedProperty.images.slice(0, 6)
                    : [];

                  if (!rawImages.length) {
                    return (
                      <div className="gallery-item gallery-item-empty">
                        <p>No uploaded images.</p>
                        <label className="btn small">
                          Upload image
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => handleReplaceImage(
                              getPropertyId(selectedProperty),
                              0,
                              e.target.files?.[0]
                            )}
                          />
                        </label>
                      </div>
                    );
                  }

                  return rawImages.map((image, idx) => {
                    const imageValue = typeof image === 'string' ? image : image?.url;
                    const url = normalizeImageUrl(imageValue);
                    return (
                    <div key={idx} className="gallery-item">
                      <img src={url} alt={`Image ${idx + 1}`} className="property-thumb" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = HOUSE_DEFAULT_IMAGES[idx % HOUSE_DEFAULT_IMAGES.length]; }} />
                      <div className="gallery-actions">
                        <label className="btn small">
                          Replace
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleReplaceImage(getPropertyId(selectedProperty), idx, e.target.files?.[0])} />
                        </label>
                        <button type="button" className="btn small danger" onClick={() => handleDeleteImage(getPropertyId(selectedProperty), idx)}>Delete</button>
                      </div>
                    </div>
                    );
                  });
                })()}
              </div>
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

export default HousesPage;
