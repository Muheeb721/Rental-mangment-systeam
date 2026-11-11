import { useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api';

const CATEGORIES = ['HOME', 'HOUSE', 'FLAT', 'APARTMENT', 'PROPERTY', 'DEMO', 'OTHER'];
const CATEGORY_LABELS = {
  HOME: 'Home',
  HOUSE: 'Houses',
  FLAT: 'Flats',
  APARTMENT: 'Apartments',
  PROPERTY: 'Property Images',
  DEMO: 'Demo Images',
  OTHER: 'Other',
};
const PAGE_SUGGESTIONS = [
  'Home Page',
  'Houses',
  'Flats',
  'Apartments',
  'Properties',
  'Property Details',
  'House Demo',
  'Flats Demo',
  'Apartments Demo',
  'Rooms Demo',
  'About Page',
  'Contact Page',
  'Services Page',
  'Login Page',
  'Profile Page',
  'General',
];
const SECTION_SUGGESTIONS = [
  'Hero',
  'Feature Banner',
  'Showcase',
  'Cover',
  'Exterior',
  'Interior',
  'Building',
  'Gallery',
  'Thumbnail',
  'Demo',
  'CTA',
  'Community',
  'Inquiry',
  'General',
];

const emptyForm = {
  title: '',
  imageUrl: '',
  category: 'HOME',
  page: 'Home Page',
  section: 'Hero',
  propertyId: '',
  propertyType: '',
  displayOrder: 0,
  isActive: true,
};

function ImageManagementPage({ notify }) {
  const [items, setItems] = useState([]);
  const [category, setCategory] = useState('HOME');
  const [pageFilter, setPageFilter] = useState('All Pages');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const pageOptions = useMemo(() => {
    const set = new Set([...PAGE_SUGGESTIONS, ...items.map((item) => item.page || 'General')]);
    return ['All Pages', ...Array.from(set).sort()];
  }, [items]);

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const matchCategory = category === 'ALL' ? true : String(item.category || 'OTHER') === String(category);
        const matchPage = pageFilter === 'All Pages' ? true : String(item.page || 'General') === String(pageFilter);
        return matchCategory && matchPage;
      }),
    [items, category, pageFilter],
  );

  const groupedItems = useMemo(() => {
    const groups = {};
    filteredItems.forEach((item) => {
      const pageName = item.page || 'General';
      const sectionName = item.section || 'General';
      if (!groups[pageName]) groups[pageName] = {};
      if (!groups[pageName][sectionName]) groups[pageName][sectionName] = [];
      groups[pageName][sectionName].push(item);
    });
    return groups;
  }, [filteredItems]);

  const sectionTabs = ['HOME', 'HOUSE', 'FLAT', 'APARTMENT', 'PROPERTY', 'DEMO'];

  const loadImages = async () => {
    try {
      setLoading(true);
      const response = await apiService.request('/images');
      if (response?.success) {
        setItems(response.data || []);
      }
    } catch (error) {
      console.warn('Unable to load image assets', error);
      notify && notify({ message: error?.message || 'Unable to load image assets.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(loadImages);
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleInput = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      displayOrder: Number(form.displayOrder || 0),
      isActive: form.isActive !== false,
    };

    try {
      setSaving(true);
      if (editingId) {
        const response = await apiService.request(`/images/${editingId}`, { method: 'PATCH', body: payload });
        if (response?.success) {
          setItems((prev) => prev.map((item) => (String(item._id || item.id) === String(editingId) ? response.data : item)));
          notify && notify({ message: 'Image updated.', variant: 'success' });
        }
      } else {
        const response = await apiService.request('/images', { method: 'POST', body: payload });
        if (response?.success) {
          setItems((prev) => [response.data, ...prev]);
          notify && notify({ message: 'Image created.', variant: 'success' });
        }
      }
      resetForm();
    } catch (error) {
      notify && notify({ message: error?.message || 'Unable to save image.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item._id || item.id);
    setForm({
      title: item.title || '',
      imageUrl: item.imageUrl || '',
      category: item.category || 'HOME',
      page: item.page || 'Home Page',
      section: item.section || '',
      propertyId: item.propertyId || '',
      propertyType: item.propertyType || '',
      displayOrder: item.displayOrder ?? 0,
      isActive: item.isActive !== false,
    });
  };

  const handleDelete = async (item) => {
    const id = item._id || item.id;
    if (!id) return;
    try {
      const response = await apiService.request(`/images/${id}`, { method: 'DELETE' });
      if (response?.success) {
        setItems((prev) => prev.filter((entry) => String(entry._id || entry.id) !== String(id)));
        notify && notify({ message: 'Image removed.', variant: 'success' });
      }
    } catch (error) {
      notify && notify({ message: error?.message || 'Unable to delete image.', variant: 'error' });
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">Image catalog</p>
          <h2>Property and demo image management</h2>
        </div>
      </div>

      <div className="card-block">
        <div className="toolbar-row" style={{ gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button type="button" className={category === 'ALL' ? 'primary-button' : 'outline-button'} onClick={() => setCategory('ALL')}>All</button>
            {sectionTabs.map((option) => (
              <button
                key={option}
                type="button"
                className={category === option ? 'primary-button' : 'outline-button'}
                onClick={() => setCategory(option)}
              >
                {CATEGORY_LABELS[option] || option}
              </button>
            ))}
          </div>
          <label>
            Page
            <select value={pageFilter} onChange={(event) => setPageFilter(event.target.value)}>
              {pageOptions.map((pageOption) => (
                <option key={pageOption} value={pageOption}>{pageOption}</option>
              ))}
            </select>
          </label>
          <button type="button" className="primary-button" onClick={loadImages} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="content-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
        <div className="card-block">
          <div className="table-wrap">
            {Object.keys(groupedItems).length === 0 ? (
              <div>No image assets found for the selected page and category.</div>
            ) : (
              Object.entries(groupedItems).map(([pageName, sectionMap]) => (
                <div key={pageName} style={{ marginBottom: 28 }}>
                  <h3 style={{ marginBottom: 12 }}>{pageName}</h3>
                  {Object.entries(sectionMap).map(([sectionName, sectionItems]) => (
                    <div key={`${pageName}-${sectionName}`} style={{ marginBottom: 18 }}>
                      <h4 style={{ margin: '0 0 10px' }}>{sectionName}</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
                        {sectionItems.map((item) => (
                          <div key={item._id || item.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fff' }}>
                            <img src={item.imageUrl} alt={item.title || 'Image'} style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                            <div style={{ fontWeight: 600, marginTop: 8 }}>{item.title || 'Untitled'}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{item.category || 'OTHER'}</div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                              <button type="button" className="table-button light" onClick={() => handleEdit(item)}>Edit</button>
                              <button type="button" className="table-button danger" onClick={() => handleDelete(item)}>Delete</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card-block">
          <h3>{editingId ? 'Edit image' : 'Add image'}</h3>
          <form onSubmit={handleSubmit} className="form-grid">
            <label>
              Title
              <input name="title" value={form.title} onChange={handleInput} required />
            </label>
            <label>
              Image URL
              <input name="imageUrl" value={form.imageUrl} onChange={handleInput} required />
            </label>
            <label>
              Category
              <select name="category" value={form.category} onChange={handleInput}>
                {CATEGORIES.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              Page
              <input name="page" list="page-suggestions" value={form.page} onChange={handleInput} />
              <datalist id="page-suggestions">
                {PAGE_SUGGESTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </label>
            <label>
              Section
              <input name="section" list="section-suggestions" value={form.section} onChange={handleInput} />
              <datalist id="section-suggestions">
                {SECTION_SUGGESTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </label>
            <label>
              Property ID
              <input name="propertyId" value={form.propertyId} onChange={handleInput} />
            </label>
            <label>
              Property Type
              <input name="propertyType" value={form.propertyType} onChange={handleInput} />
            </label>
            <label>
              Display Order
              <input name="displayOrder" type="number" value={form.displayOrder} onChange={handleInput} />
            </label>
            <label className="checkbox-row">
              <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleInput} />
              Active
            </label>

            <div className="button-row" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Update image' : 'Create image'}</button>
              <button type="button" className="outline-button" onClick={resetForm}>Reset</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ImageManagementPage;
