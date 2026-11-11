import { useMemo, useState, useEffect } from 'react';
import './PropertiesPage.css';
import Modal from '../components/Modal';
import { formatCurrency, formatDate } from '../utils/formatters';
import { generateId } from '../services/localStorage';
import { apiService } from '../services/api';
import {
  createAdminProperty,
  deleteAdminProperty,
  updateAdminProperty,
  uploadPropertyImage,
  replacePropertyImage,
  deletePropertyImage,
  replacePropertyImageById,
  deletePropertyImageById,
} from '../services/adminPropertyService';
import AdminPropertySlider from '../components/AdminPropertySlider';
import { getAdminImageUrl } from '../utils/adminImageUrl';

const emptyForm = {
  title: '',
  propertyType: 'House',
  category: 'House',
  listingType: 'rent',
  description: '',
  price: '',
  rent: '',
  salePrice: '',
  deposit: '',
  otherCharges: '',
  location: '',
  phase: '',
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

const statusOptions = ['Available', 'Reserved', 'Sold', 'For Rent', 'Rented', 'For Sale'];
const getPropertyId = (property) => property?._id || property?.id || property?.propertyId || property?.mongoId;

function PropertiesPage({ appData, setAppData, notify, defaultTypeFilter = 'All' }) {
  const properties = appData.properties || [];

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
  const [typeFilter, setTypeFilter] = useState(defaultTypeFilter || 'All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortKey, setSortKey] = useState('createdAt');
  const [modalOpen, setModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [selectedImageFiles, setSelectedImageFiles] = useState([]);
  const [errors, setErrors] = useState({});

  const filteredProperties = useMemo(() => {
    const next = [...properties].filter((item) => {
      const matchesSearch = !search || [item.title, item.location, item.ownerName, item.city].join(' ').toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'All' || item.propertyType === typeFilter;
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });

    next.sort((a, b) => {
      if (sortKey === 'price') return Number(b.price || 0) - Number(a.price || 0);
      if (sortKey === 'title') return String(a.title).localeCompare(String(b.title));
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    return next;
  }, [properties, search, typeFilter, statusFilter, sortKey]);

  const inventoryStats = useMemo(() => {
    const totalValue = properties.reduce((sum, item) => sum + Number(item.price || item.salePrice || 0), 0);
    const available = properties.filter((item) => String(item.status || '').toLowerCase() === 'available').length;
    const forRent = properties.filter((item) => String(item.status || '').toLowerCase() === 'for rent').length;
    const reserved = properties.filter((item) => String(item.status || '').toLowerCase() === 'reserved').length;

    return {
      total: properties.length,
      value: totalValue,
      available,
      forRent,
      reserved,
    };
  }, [properties]);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setSelectedImageFiles([]);
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
      listingType: property.listingType || (property.transactionType === 'Sale' ? 'sale' : 'rent'),
      description: property.description || '',
      price: property.price || '',
      rent: property.rent || '',
      salePrice: property.salePrice || '',
      deposit: property.deposit || '',
      otherCharges: property.otherCharges || '',
      location: property.location || '',
      phase: property.phase || '',
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
      images: Array.isArray(property.images) ? property.images : [],
      status: property.status || 'Available',
    });
    setSelectedImageFiles([]);
    setErrors({});
    setModalOpen(true);
  };

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'rent' || name === 'salePrice') {
        const numericValue = value === '' ? '' : Number(value);
        next.price = Number.isFinite(numericValue) ? numericValue : value;
      }
      if (name === 'listingType') {
        const isSale = String(value).toLowerCase() === 'sale';
        next.status = isSale ? 'For Sale' : (prev.status === 'For Sale' ? 'Available' : prev.status || 'Available');
      }
      return next;
    });
  };

  const handleImagePick = (event) => {
    const files = Array.from(event.target.files || []);
    setSelectedImageFiles(files);
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

    const isSaleListing = String(formData.listingType || 'rent').toLowerCase() === 'sale';
    const activePrice = isSaleListing ? Number(formData.salePrice || formData.price || 0) : Number(formData.rent || formData.price || 0);

    const payload = {
      title: formData.title.trim(),
      propertyType: formData.propertyType,
      category: formData.category || formData.propertyType,
      type: formData.propertyType,
      purpose: isSaleListing ? 'Sale' : 'Rent',
      transactionType: isSaleListing ? 'Sale' : 'Rent',
      listingType: isSaleListing ? 'sale' : 'rent',
      description: formData.description.trim(),
      price: activePrice,
      rent: isSaleListing ? 0 : activePrice,
      salePrice: isSaleListing ? activePrice : 0,
      deposit: Number(formData.deposit || 0),
      otherCharges: Number(formData.otherCharges || 0),
      location: formData.location.trim(),
      phase: formData.phase.trim(),
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

    try {
      const saved = editingId
        ? await updateAdminProperty(editingId, payload)
        : await createAdminProperty(payload, selectedImageFiles);

      const finalProperty = saved || payload;
      const savedId = getPropertyId(finalProperty) || editingId;
      if (editingId && selectedImageFiles.length) {
        for (const file of selectedImageFiles) {
          await uploadPropertyImage(savedId, file);
        }
      }

      await refreshProperties();

      setAppData((prev) => ({
        ...prev,
        notifications: [
          {
            id: `notif-${Date.now()}`,
            title: editingId ? 'Property updated' : 'New property submission',
            message: `${(finalProperty.title || payload.title)} (${finalProperty.propertyType || payload.propertyType}) was ${editingId ? 'updated' : 'added'}.`,
            propertyId: getPropertyId(finalProperty) || editingId,
            propertyType: finalProperty.propertyType || payload.propertyType,
            time: 'Just now',
            date: new Date().toISOString(),
            read: false,
            priority: 'Normal',
          },
          ...(prev.notifications || []),
        ],
      }));

      addActivity(editingId ? 'Property edited' : 'Property added', `${finalProperty.title || payload.title} was ${editingId ? 'updated' : 'added'} in the catalog.`);
      notify({ message: editingId ? 'Property updated successfully.' : 'Property added successfully.', variant: 'success' });
      setModalOpen(false);
      setEditingId(null);
      setFormData(emptyForm);
      setSelectedImageFiles([]);
    } catch (error) {
      console.error('Admin property save failed:', error);
      notify({ message: error.message || 'Unable to save property.', variant: 'error' });
    }
  };

  const handleDelete = async (propertyId) => {
    try {
      await deleteAdminProperty(propertyId);
      await refreshProperties();
      addActivity('Property deleted', 'A property was removed from the catalog.');
      notify({ message: 'Property deleted successfully.', variant: 'success' });
    } catch (error) {
      console.error('Admin property delete failed:', error);
      notify({ message: error.message || 'Unable to delete property.', variant: 'error' });
    }
    setDeletingId(null);
  };

  const changeStatus = (propertyId, nextStatus) => {
    (async () => {
      try {
        notify({ message: 'Updating property status...', variant: 'info' });
        const resp = await apiService.request(`/properties/${propertyId}/status`, { method: 'POST', body: { status: nextStatus } });
        const updated = resp?.data || null;
        if (updated) {
          setAppData((prev) => ({ ...prev, properties: (prev.properties || []).map((p) => (String(getPropertyId(p)) === String(propertyId) ? { ...p, ...updated } : p)) }));
        } else {
          setAppData((prev) => ({ ...prev, properties: (prev.properties || []).map((item) => (String(getPropertyId(item)) === String(propertyId) ? { ...item, status: nextStatus, updatedAt: new Date().toISOString() } : item)) }));
        }
        await refreshProperties();
        addActivity('Property status changed', `A property status was updated to ${nextStatus}.`);
        notify({ message: `Property status updated to ${nextStatus}.`, variant: 'success' });
      } catch (e) {
        console.error('Update status failed', e);
        notify({ message: e?.message || 'Unable to update property status.', variant: 'error' });
      }
    })();
  };

  const duplicateProperty = (property) => {
    (async () => {
      try {
        notify({ message: 'Duplicating property...', variant: 'info' });
        const payload = { ...property };
        delete payload._id;
        delete payload.id;
        payload.title = `${property.title} Copy`;
        payload.createdAt = new Date().toISOString();
        payload.updatedAt = new Date().toISOString();
        const saved = await createAdminProperty(payload);
        const finalProperty = saved || { ...payload, _id: payload._id || generateId('prop') };
        await refreshProperties();
        setEditingId(getPropertyId(finalProperty) || null);
        setFormData({
          title: finalProperty.title || '',
          propertyType: finalProperty.propertyType || 'House',
          category: finalProperty.category || finalProperty.propertyType || 'House',
          listingType: finalProperty.listingType || (finalProperty.transactionType === 'Sale' ? 'sale' : 'rent'),
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
        addActivity('Property duplicated', `${property.title} was duplicated and opened for editing.`);
        notify({ message: 'Property duplicated and opened for editing.', variant: 'success' });
      } catch (e) {
        console.error('Duplicate property failed', e);
        notify({ message: e?.message || 'Unable to duplicate property.', variant: 'error' });
      }
    })();
  };

  const handleUploadImageForSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedProperty) return;

    try {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const MAX_BYTES = Number(import.meta.env.VITE_UPLOAD_MAX_SIZE || 5 * 1024 * 1024);
      if (!allowedTypes.includes(file.type)) {
        notify({ message: 'Invalid image type. Only JPG, PNG and WEBP are allowed.', variant: 'error' });
        return;
      }
      if (file.size && file.size > MAX_BYTES) {
        notify({ message: `Image too large. Maximum ${Math.round(MAX_BYTES / 1024 / 1024)}MB allowed.`, variant: 'error' });
        return;
      }

      const propertyId = getPropertyId(selectedProperty);
      if (!propertyId) {
        throw new Error('Property ID is missing.');
      }

      notify({ message: 'Uploading image...', variant: 'info' });
      const result = await uploadPropertyImage(propertyId, file);
      const nextImages = Array.isArray(result?.images) && result.images.length
        ? result.images.map((img) => (typeof img === 'string' ? img.split('?')[0] : (img && typeof img === 'object' ? img.url?.split('?')[0] : ''))).filter(Boolean)
        : Array.isArray(result?.property?.images) && result.property.images.length
          ? result.property.images.map((img) => (typeof img === 'string' ? img.split('?')[0] : (img && typeof img === 'object' ? img.url?.split('?')[0] : ''))).filter(Boolean)
          : [result?.url || `/images/${file.name}`];

      const updated = {
        ...selectedProperty,
        images: nextImages,
        image: nextImages[0] || '',
      };

      await refreshProperties();
      setSelectedProperty(updated);
      notify({ message: 'Image uploaded.', variant: 'success' });
    } catch (e) {
      console.error('Upload failed', e);
      notify({ message: e.message || 'Image upload failed.', variant: 'error' });
    }
  };

  const handleReplaceImageForSelected = async (index, file) => {
    if (!file || !selectedProperty) return;

    const propertyId = getPropertyId(selectedProperty);
    const currentImages = Array.isArray(selectedProperty.images)
      ? [...selectedProperty.images]
      : (selectedProperty.image ? [selectedProperty.image] : []);

    if (!currentImages[index]) return;

    try {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const MAX_BYTES = Number(import.meta.env.VITE_UPLOAD_MAX_SIZE || 5 * 1024 * 1024);
      if (!allowedTypes.includes(file.type)) {
        notify({ message: 'Invalid image type. Only JPG, PNG and WEBP are allowed.', variant: 'error' });
        return;
      }
      if (file.size && file.size > MAX_BYTES) {
        notify({ message: `Image too large. Maximum ${Math.round(MAX_BYTES / 1024 / 1024)}MB allowed.`, variant: 'error' });
        return;
      }

      notify({ message: 'Replacing image...', variant: 'info' });
      const targetImage = currentImages[index];
      const result = (targetImage && typeof targetImage === 'object' && targetImage._id)
        ? await replacePropertyImageById(propertyId, targetImage._id, file)
        : await replacePropertyImage(propertyId, index, file);

      const nextImages = Array.isArray(result?.images) && result.images.length
        ? result.images.map((img) => (typeof img === 'string' ? img.split('?')[0] : (img && typeof img === 'object' ? img.url?.split('?')[0] : ''))).filter(Boolean)
        : Array.isArray(result?.property?.images) && result.property.images.length
          ? result.property.images.map((img) => (typeof img === 'string' ? img.split('?')[0] : (img && typeof img === 'object' ? img.url?.split('?')[0] : ''))).filter(Boolean)
          : currentImages.map((img) => (typeof img === 'string' ? img.split('?')[0] : (img && typeof img === 'object' ? img.url?.split('?')[0] : ''))).filter(Boolean);

      const updated = {
        ...selectedProperty,
        images: nextImages,
        image: nextImages[0] || '',
      };

      await refreshProperties();
      setSelectedProperty(updated);
      notify({ message: 'Image replaced successfully.', variant: 'success' });
    } catch (e) {
      console.error('Replace failed', e);
      notify({ message: e.message || 'Unable to replace image.', variant: 'error' });
    }
  };

  const handleDeleteImageForSelected = async (index) => {
    if (!selectedProperty) return;

    const propertyId = getPropertyId(selectedProperty);
    const currentImages = Array.isArray(selectedProperty.images)
      ? [...selectedProperty.images]
      : (selectedProperty.image ? [selectedProperty.image] : []);

    if (!currentImages[index]) return;

    try {
      notify({ message: 'Deleting image...', variant: 'info' });
      const targetImage = currentImages[index];
      if (targetImage && typeof targetImage === 'object' && targetImage._id) {
        await deletePropertyImageById(propertyId, targetImage._id);
      } else {
        await deletePropertyImage(propertyId, index);
      }

      const result = await apiService.request(`/properties/${propertyId}`);
      const nextImages = Array.isArray(result?.data?.images)
        ? result.data.images.map((img) => (typeof img === 'string' ? img.split('?')[0] : (img && typeof img === 'object' ? img.url?.split('?')[0] : ''))).filter(Boolean)
        : Array.isArray(result?.data?.property?.images)
          ? result.data.property.images.map((img) => (typeof img === 'string' ? img.split('?')[0] : (img && typeof img === 'object' ? img.url?.split('?')[0] : ''))).filter(Boolean)
          : currentImages.filter((_, i) => i !== index).map((img) => (typeof img === 'string' ? img.split('?')[0] : (img && typeof img === 'object' ? img.url?.split('?')[0] : ''))).filter(Boolean);

      const updated = {
        ...selectedProperty,
        images: nextImages,
        image: nextImages[0] || '',
      };

      await refreshProperties();
      setSelectedProperty(updated);
      notify({ message: 'Image deleted.', variant: 'success' });
    } catch (e) {
      console.error('Delete image failed', e);
      notify({ message: e.message || 'Unable to delete image.', variant: 'error' });
    }
  };

  const moveImage = async (fromIndex, toIndex) => {
    if (!selectedProperty) return;
    const images = Array.isArray(selectedProperty.images) ? [...selectedProperty.images] : (selectedProperty.image ? [selectedProperty.image] : []);
    if (fromIndex < 0 || fromIndex >= images.length || toIndex < 0 || toIndex >= images.length) return;
    const item = images.splice(fromIndex, 1)[0];
    images.splice(toIndex, 0, item);
    const updated = { ...selectedProperty, images, image: images[0] || '' };
    try {
      await updateAdminProperty(getPropertyId(updated), { images: updated.images, image: updated.image });
      await refreshProperties();
      setSelectedProperty(updated);
      notify({ message: 'Image order updated.', variant: 'success' });
    } catch (e) {
      console.error('Reorder failed', e);
      notify({ message: e.message || 'Unable to reorder images.', variant: 'error' });
    }
  };

  const paymentHistory = (appData.payments || []).filter((payment) => (payment.propertyName || payment.property) === (selectedProperty?.title || ''));
  const duesForProperty = (appData.dues || []).filter((due) => (due.propertyName || due.property) === (selectedProperty?.title || ''));

  return (
    <div className="page-section properties-page">
      <div className="summary-strip inventory-strip">
        <div className="summary-item primary">
          <span>Total inventory</span>
          <strong>{inventoryStats.total}</strong>
        </div>
        <div className="summary-item success">
          <span>Available now</span>
          <strong>{inventoryStats.available}</strong>
        </div>
        <div className="summary-item danger">
          <span>For rent</span>
          <strong>{inventoryStats.forRent}</strong>
        </div>
        <div className="summary-item info">
          <span>Portfolio value</span>
          <strong>{formatCurrency(inventoryStats.value)}</strong>
        </div>
      </div>

      <section className="panel-card toolbar-card">
        <div className="toolbar-row">
          <div className="toolbar-search">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title, location, owner..." />
          </div>
          <div className="toolbar-group">
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="All">All Types</option>
              {['House', 'Apartment', 'Flat'].map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
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
            <button type="button" className="primary-button" onClick={openCreateModal}>Add Property</button>
          </div>
        </div>
      </section>

      <section className="panel-card">
              <div className="card-header">
          <h3>Property Inventory</h3>
          <span className="mini-badge">{filteredProperties.length} properties</span>
        </div>
              <AdminPropertySlider properties={filteredProperties} onEdit={openEditModal} />

              {filteredProperties.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏠</div>
            <h4>No properties found</h4>
            <p>Adjust the filters or add a new property.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Property</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Price</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProperties.map((property) => (
                  <tr key={getPropertyId(property) || property.id}>
                    <td>
                      {getAdminImageUrl(property.image || property.images?.[0]) ? (
                        <img src={getAdminImageUrl(property.image || property.images?.[0])} alt={property.title} className="property-thumb" />
                      ) : <div className="property-thumb property-thumb-placeholder">No image</div>}
                    </td>
                    <td>
                      <strong>{property.title}</strong>
                      <small>{property.city}</small>
                    </td>
                    <td>{property.propertyType}</td>
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
        title={editingId ? 'Edit Property' : 'Add Property'}
        onClose={() => { setModalOpen(false); setErrors({}); }}
        footer={
          <>
            <button type="button" className="outline-button" onClick={() => { setModalOpen(false); setErrors({}); }}>Cancel</button>
            <button type="submit" className="primary-button" form="property-form">Save Property</button>
          </>
        }
      >
        <form id="property-form" className="property-form" onSubmit={handleSubmit}>
          <div className="form-grid two-col">
            <label>
              Property title
              <input name="title" value={formData.title} onChange={handleFieldChange} />
              {errors.title && <span className="field-error">{errors.title}</span>}
            </label>
            <label>
              Property type
              <select name="propertyType" value={formData.propertyType} onChange={handleFieldChange}>
                {['House', 'Apartment', 'Flat'].map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              Listing type
              <select name="listingType" value={formData.listingType} onChange={handleFieldChange}>
                <option value="rent">For Rent</option>
                <option value="sale">For Sale</option>
              </select>
            </label>
          </div>

          <div className="form-grid two-col">
            <label>
              Category
              <input
                name="category"
                value={formData.category}
                onChange={handleFieldChange}
                placeholder="e.g. House, Villa, Tower, Luxury Flat"
              />
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
              {formData.listingType === 'sale' ? 'Sale price' : 'Monthly rent'}
              <input type="number" name="price" value={formData.price} onChange={handleFieldChange} />
              {errors.price && <span className="field-error">{errors.price}</span>}
            </label>
            <label>
              {formData.listingType === 'sale' ? 'Sale price (override)' : 'Monthly rent (override)'}
              <input type="number" name={formData.listingType === 'sale' ? 'salePrice' : 'rent'} value={formData.listingType === 'sale' ? formData.salePrice : formData.rent} onChange={handleFieldChange} />
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
            <label>
              Listing Status
              <select name="status" value={formData.status} onChange={handleFieldChange}>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="section-title">Property details</div>
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
            <label>
              Phase
              <input name="phase" value={formData.phase} onChange={handleFieldChange} />
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
            Upload images (multiple)
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleImagePick} />
          </label>
          {Array.isArray(formData.images) && formData.images.length > 0 && (
            <div className="property-image-preview-list">
              {formData.images.map((image, index) => {
                const src = getAdminImageUrl(image);
                return src ? <img key={`${src}-${index}`} src={src} alt={`Current property image ${index + 1}`} className="image-preview" /> : null;
              })}
            </div>
          )}
          {selectedImageFiles.length > 0 && <small>{selectedImageFiles.length} new image(s) selected.</small>}
        </form>
      </Modal>

      <Modal
        open={manageModalOpen && Boolean(selectedProperty)}
        title={`Manage ${selectedProperty?.title || 'Property'}`}
        onClose={() => setManageModalOpen(false)}
        footer={<button type="button" className="outline-button" onClick={() => setManageModalOpen(false)}>Close</button>}
      >
        {selectedProperty && (
          <div className="manage-property-panel">
            <div className="detail-header">
              <img src={getAdminImageUrl(selectedProperty.image || selectedProperty.images?.[0])} alt={selectedProperty.title} className="property-thumb large" />
              <div>
                <h4>{selectedProperty.title}</h4>
                <p>{selectedProperty.propertyType} • {selectedProperty.location}</p>
              </div>
            </div>
            <div className="detail-grid">
              <div><strong>Property ID:</strong> <span>{selectedProperty.id}</span></div>
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
              <h5>Property Payment History</h5>
              {paymentHistory.length ? (
                <ul>
                  {paymentHistory.slice(0, 5).map((payment) => (
                    <li key={payment.id || payment.paymentId}>{formatDate(payment.paymentDate || payment.date)} • {payment.userName || payment.user} • {formatCurrency(payment.amount)} • {payment.status}</li>
                  ))}
                </ul>
              ) : <p>No payment history for this property.</p>}
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
              <p>Upload, preview, replace or delete property images.</p>
              <label className="file-label">
                Add image
                <input type="file" accept="image/*" onChange={handleUploadImageForSelected} />
              </label>
              <div className="images-list">
                {(selectedProperty.images || (selectedProperty.image ? [selectedProperty.image] : [])).map((img, idx) => (
                  <div className="image-item" key={`${String(selectedProperty.id||selectedProperty._id)}-${idx}`}>
                    <img
                      src={getAdminImageUrl(img)}
                      alt={`img-${idx}`}
                    />
                    <div className="image-controls">
                      <label className="small file-label" style={{ display: 'inline-flex', cursor: 'pointer' }}>
                        Replace
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) handleReplaceImageForSelected(idx, file);
                            event.target.value = '';
                          }}
                          style={{ display: 'none' }}
                        />
                      </label>
                      <button type="button" className="small" onClick={() => moveImage(idx, Math.max(0, idx - 1))} disabled={idx === 0}>←</button>
                      <button type="button" className="small" onClick={() => moveImage(idx, idx + 1)} disabled={idx === ((selectedProperty.images || []).length - 1)}>→</button>
                      <button type="button" className="small danger" onClick={() => handleDeleteImageForSelected(idx)}>Delete</button>
                    </div>
                  </div>
                ))}
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

export default PropertiesPage;
