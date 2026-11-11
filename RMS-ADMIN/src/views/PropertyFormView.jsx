import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, MapPin, Plus, Save, X } from 'lucide-react';
import { api, USER_SITE_URL } from '../lib/api';
import { moneyShort } from '../lib/format';
import { AMENITIES, AREA_UNITS, FURNISHING, PROPERTY_STATUSES, PROPERTY_TYPES } from '../lib/constants';
import { Button, ErrorState, Field, LoadingBlock, PageHeader, useConfirm, useToast } from '../components/ui';
import ImageManager, { validateImageFiles } from '../components/ImageManager';
import { AreaPicker, LocationPicker } from '../components/LocationFields';
import { areaToLocation, useLahoreAreas } from '../lib/areas';

const EMPTY = {
  title: '', description: '', purpose: 'Rent', propertyType: 'House', price: '', deposit: '',
  city: 'Lahore', society: '', phase: '', areaSlug: '', block: '', address: '', latitude: '', longitude: '',
  bedrooms: '', bathrooms: '', parking: '', area: '', areaUnit: 'Marla', furnished: 'Unfurnished', yearBuilt: '',
  amenities: [], status: 'Available', isFeatured: false, ownerName: '', ownerPhone: '', ownerEmail: '',
};

const fromProperty = (p) => ({
  ...EMPTY,
  ...Object.fromEntries(Object.keys(EMPTY).map((key) => [key, p[key] ?? EMPTY[key]])),
  purpose: p.purpose === 'Sale' ? 'Sale' : 'Rent',
  price: p.price || p.rent || p.salePrice || '',
  latitude: p.latitude ?? '', longitude: p.longitude ?? '',
  yearBuilt: p.yearBuilt ?? '', deposit: p.deposit || '',
  amenities: Array.isArray(p.amenities) ? p.amenities : [],
  society: p.society || (String(p.phase).startsWith('DHA') ? 'DHA' : String(p.phase).startsWith('Askari') ? 'Askari' : ''),
});

const NO_ROOMS = ['Plot'];

/** Client-side validation that mirrors the backend rules. */
const validate = (form) => {
  const errors = {};
  const title = form.title.trim();
  if (title.length < 5) errors.title = 'Title must be at least 5 characters.';
  else if (title.length > 150) errors.title = 'Title must be 150 characters or fewer.';
  if (!(Number(form.price) > 0)) errors.price = form.purpose === 'Sale' ? 'Enter the sale price.' : 'Enter the monthly rent.';
  if (!(Number(form.area) > 0)) errors.area = 'Enter the size.';
  if (!form.city.trim()) errors.city = 'City is required.';
  if (!form.address.trim() && !form.phase.trim()) errors.address = 'Enter an address or choose a phase.';
  if (form.latitude !== '' && (Number.isNaN(Number(form.latitude)) || Math.abs(Number(form.latitude)) > 90)) errors.latitude = 'Latitude must be between -90 and 90.';
  if (form.longitude !== '' && (Number.isNaN(Number(form.longitude)) || Math.abs(Number(form.longitude)) > 180)) errors.longitude = 'Longitude must be between -180 and 180.';
  for (const key of ['bedrooms', 'bathrooms', 'parking']) {
    if (form[key] !== '' && (!Number.isInteger(Number(form[key])) || Number(form[key]) < 0 || Number(form[key]) > 100)) errors[key] = 'Whole number from 0 to 100.';
  }
  if (form.ownerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.ownerEmail)) errors.ownerEmail = 'Enter a valid email.';
  if (form.yearBuilt !== '' && (Number(form.yearBuilt) < 1900 || Number(form.yearBuilt) > new Date().getFullYear() + 5)) errors.yearBuilt = 'Enter a valid year.';
  return errors;
};

const toPayload = (form) => {
  const payload = {
    ...form,
    title: form.title.trim(),
    description: form.description.trim(),
    price: Number(form.price),
    deposit: form.deposit === '' ? 0 : Number(form.deposit),
    area: Number(form.area),
    bedrooms: form.bedrooms === '' ? 0 : Number(form.bedrooms),
    bathrooms: form.bathrooms === '' ? 0 : Number(form.bathrooms),
    parking: form.parking === '' ? 0 : Number(form.parking),
    latitude: form.latitude === '' ? null : Number(form.latitude),
    longitude: form.longitude === '' ? null : Number(form.longitude),
    yearBuilt: form.yearBuilt === '' ? null : Number(form.yearBuilt),
    society: form.society === 'Other' ? '' : form.society.trim(),
    areaSlug: form.areaSlug || undefined,
  };
  return payload;
};

export default function PropertyFormView() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [customAmenity, setCustomAmenity] = useState('');
  // images: create mode -> staged File objects; edit mode -> server images (changes saved immediately)
  const [staged, setStaged] = useState([]);
  const [serverImages, setServerImages] = useState([]);
  const [imageBusy, setImageBusy] = useState('');
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState('');

  useEffect(() => {
    if (!isEdit) return undefined;
    let active = true;
    api.get(`/admin/properties/${id}`)
      .then((response) => {
        if (!active) return;
        setForm(fromProperty(response.data));
        setServerImages(response.data.images || []);
      })
      .catch((error) => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, isEdit]);

  // revoke preview URLs when leaving the page
  const stagedRef = useRef(staged);
  useEffect(() => { stagedRef.current = staged; }, [staged]);
  useEffect(() => () => stagedRef.current.forEach((item) => URL.revokeObjectURL(item.src)), []);
  const pendingCounter = useRef(0);

  const set = (key) => (event) => {
    const value = event?.target ? (event.target.type === 'checkbox' ? event.target.checked : event.target.value) : event;
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (formError) setFormError('');
  };

  const { areas: lahoreAreas, error: areasError } = useLahoreAreas();
  const currentArea = useMemo(() => {
    if (form.areaSlug) return lahoreAreas.find((a) => a.slug === form.areaSlug) || null;
    const key = String(form.phase || form.society || '').toLowerCase().trim();
    return key ? lahoreAreas.find((a) => a.name.toLowerCase() === key || (a.aliases || []).some((x) => String(x).toLowerCase() === key)) || null : null;
  }, [lahoreAreas, form.areaSlug, form.phase, form.society]);
  const pickArea = (area) => {
    setForm((prev) => ({ ...prev, ...areaToLocation(area, lahoreAreas) }));
    setErrors((prev) => ({ ...prev, address: undefined, latitude: undefined, longitude: undefined }));
  };
  const setPin = (latitude, longitude) => {
    setForm((prev) => ({ ...prev, latitude, longitude }));
    setErrors((prev) => ({ ...prev, latitude: undefined, longitude: undefined }));
  };

  const toggleAmenity = (amenity) => setForm((prev) => ({
    ...prev,
    amenities: prev.amenities.includes(amenity) ? prev.amenities.filter((item) => item !== amenity) : [...prev.amenities, amenity],
  }));
  const addCustomAmenity = () => {
    const value = customAmenity.trim();
    if (!value) return;
    if (!form.amenities.includes(value)) setForm((prev) => ({ ...prev, amenities: [...prev.amenities, value] }));
    setCustomAmenity('');
  };

  // ---------------- images ----------------
  const imageItems = isEdit
    ? serverImages.map((image) => ({ key: image._id, src: image.url, id: image._id }))
    : staged;

  const addImages = async (files) => {
    setImageError('');
    const { valid, errors: fileErrors } = validateImageFiles(files, imageItems.length);
    if (fileErrors.length) setImageError(fileErrors.join(' '));
    if (!valid.length) return;
    if (!isEdit) {
      setStaged((prev) => [...prev, ...valid.map((file) => ({ key: `new-${(pendingCounter.current += 1)}`, file, src: URL.createObjectURL(file), pending: true }))]);
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      valid.forEach((file) => body.append('images', file));
      const response = await api.post(`/properties/${id}/images`, body);
      setServerImages(response.data.images);
      toast.success(response.message || 'Photos uploaded.');
    } catch (error) {
      setImageError(error.message);
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const moveImage = async (from, to) => {
    if (to < 0 || to >= imageItems.length) return;
    if (!isEdit) {
      setStaged((prev) => { const next = [...prev]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; });
      return;
    }
    const next = [...serverImages];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    const previous = serverImages;
    setServerImages(next);
    setImageBusy(item._id);
    try {
      const response = await api.put(`/properties/${id}/images/order`, { order: next.map((image) => image._id) });
      setServerImages(response.data.images);
    } catch (error) {
      setServerImages(previous);
      toast.error(error.message);
    } finally {
      setImageBusy('');
    }
  };

  const setCover = async (item) => {
    if (!isEdit) {
      setStaged((prev) => [item, ...prev.filter((entry) => entry.key !== item.key)]);
      return;
    }
    setImageBusy(item.key);
    try {
      const response = await api.put(`/properties/${id}/images/${item.id}/cover`);
      setServerImages(response.data.images);
      toast.success('Cover photo updated.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setImageBusy('');
    }
  };

  const removeImage = async (item) => {
    if (!isEdit) {
      URL.revokeObjectURL(item.src);
      setStaged((prev) => prev.filter((entry) => entry.key !== item.key));
      return;
    }
    const ok = await confirm({ title: 'Remove photo?', message: 'This photo will be deleted from the listing and the server.', confirmLabel: 'Remove photo' });
    if (!ok) return;
    setImageBusy(item.key);
    try {
      const response = await api.del(`/properties/${id}/images/${item.id}`);
      setServerImages(response.data.images);
      toast.success('Photo removed.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setImageBusy('');
    }
  };

  // ---------------- submit ----------------
  const submit = async (event) => {
    event.preventDefault();
    setFormError('');
    const clientErrors = validate(form);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) {
      setFormError('Please fix the highlighted fields.');
      document.querySelector('.invalid')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!isEdit && staged.length === 0) {
      const proceed = await confirm({ title: 'No photos added', message: 'Listings with photos get far more enquiries. Save this property without photos?', confirmLabel: 'Save without photos', tone: 'primary' });
      if (!proceed) return;
    }

    setSaving(true);
    try {
      const payload = toPayload(form);
      if (isEdit) {
        await api.put(`/properties/${id}`, payload);
        toast.success('Property updated.');
      } else {
        const body = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (key === 'amenities') body.append(key, JSON.stringify(value));
          else if (value !== null && value !== undefined) body.append(key, String(value));
        });
        staged.forEach((item) => body.append('images', item.file));
        const response = await api.post('/properties', body);
        toast.success(`"${response.data.title}" published with ${response.data.images.length} photo(s).`);
      }
      window.dispatchEvent(new Event('rms-admin:counts-changed'));
      navigate('/properties');
    } catch (error) {
      if (error.errors) setErrors(error.errors);
      setFormError(error.message);
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const pricePreview = useMemo(() => (Number(form.price) > 0 ? `${moneyShort(form.price)}${form.purpose === 'Rent' ? ' per month' : ''}` : ''), [form.price, form.purpose]);

  if (loading) return <LoadingBlock label="Loading property…" />;
  if (loadError) return <ErrorState message={loadError} onRetry={() => window.location.reload()} />;

  const inv = (key) => (errors[key] ? 'invalid' : '');
  const noRooms = NO_ROOMS.includes(form.propertyType);

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        title={isEdit ? 'Edit property' : 'Add a new property'}
        description={isEdit ? form.title : 'Fill in the details and upload photos. The listing goes live on the website as soon as you save.'}
        actions={(
          <>
            <Link to="/properties" className="btn btn-secondary"><ArrowLeft size={15} /> Back</Link>
            {isEdit && <a className="btn btn-secondary" href={`${USER_SITE_URL}/properties/${id}`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> View on site</a>}
            <Button type="submit" variant="primary" icon={Save} loading={saving}>{isEdit ? 'Save changes' : 'Publish property'}</Button>
          </>
        )}
      />
      {formError && <div className="alert alert-error" role="alert" style={{ marginBottom: 16 }}>{formError}</div>}

      <div className="card">
        <div className="form-section">
          <div className="form-section-title">Basic information</div>
          <div className="form-section-desc">What is being listed and how it is described to visitors.</div>
          <div className="form-grid">
            <Field label="Title" required error={errors.title} className="span-2" htmlFor="title">
              <input id="title" name="title" className={`input ${inv('title')}`} value={form.title} onChange={set('title')} placeholder="e.g. Modern 10 Marla House for Rent in K Block, DHA Phase 5" maxLength={150} />
            </Field>
            <Field label="Purpose" required>
              <div className="segmented" role="radiogroup" aria-label="Purpose">
                {['Rent', 'Sale'].map((option) => (
                  <button key={option} type="button" className={form.purpose === option ? 'active' : ''} onClick={() => set('purpose')(option)} aria-pressed={form.purpose === option}>For {option.toLowerCase()}</button>
                ))}
              </div>
            </Field>
            <Field label="Property type" required error={errors.propertyType} htmlFor="propertyType">
              <select id="propertyType" name="propertyType" className="select" value={form.propertyType} onChange={set('propertyType')}>
                {PROPERTY_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>
            </Field>
            <Field label="Description" className="span-2" hint={`${form.description.length}/5000 characters`} error={errors.description} htmlFor="description">
              <textarea id="description" name="description" className={`textarea ${inv('description')}`} rows={5} value={form.description} onChange={set('description')} maxLength={5000} placeholder="Describe the layout, condition, nearby schools, parks and markets, and rental terms." />
            </Field>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">Price</div>
          <div className="form-section-desc">{form.purpose === 'Rent' ? 'Monthly rent in Pakistani rupees.' : 'Total demand in Pakistani rupees.'}</div>
          <div className="form-grid">
            <Field label={form.purpose === 'Rent' ? 'Monthly rent' : 'Sale price'} required error={errors.price} hint={pricePreview} htmlFor="price">
              <div className="input-addon"><span className="addon">PKR</span><input id="price" name="price" className={`input ${inv('price')}`} type="number" min="0" step="1000" value={form.price} onChange={set('price')} placeholder={form.purpose === 'Rent' ? '150000' : '45000000'} /></div>
            </Field>
            {form.purpose === 'Rent' && (
              <Field label="Security deposit" hint="Optional" error={errors.deposit} htmlFor="deposit">
                <div className="input-addon"><span className="addon">PKR</span><input id="deposit" name="deposit" className="input" type="number" min="0" step="1000" value={form.deposit} onChange={set('deposit')} /></div>
              </Field>
            )}
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">Location</div>
          <div className="form-section-desc">Pick any Lahore area to fill in society, phase and the area centre — then click or drag the pin for the exact spot.</div>
          <div className="form-grid-3">
            <Field label="Area" className="span-2" htmlFor="area-picker" hint={areasError ? `Area list unavailable (${areasError}) — type society/phase manually.` : currentArea ? `Selected: ${currentArea.name}` : 'Covers every Lahore society, phase and neighbourhood.'}>
              <AreaPicker id="area-picker" areas={lahoreAreas} value={currentArea?.name || ''} onPick={pickArea} />
            </Field>
            <Field label="City" required error={errors.city} htmlFor="city">
              <input id="city" name="city" className={`input ${inv('city')}`} value={form.city} onChange={set('city')} />
            </Field>
            <Field label="Society / area" htmlFor="society">
              <input id="society" name="society" className="input" value={form.society} onChange={set('society')} placeholder="e.g. DHA, Johar Town" />
            </Field>
            <Field label="Phase / sector" htmlFor="phase">
              <input id="phase" name="phase" className="input" value={form.phase} onChange={set('phase')} placeholder="e.g. DHA Phase 5" />
            </Field>
            <Field label="Block" htmlFor="block">
              <input id="block" name="block" className="input" value={form.block} onChange={set('block')} placeholder="e.g. K Block" />
            </Field>
            <Field label="Street address" className="span-2" error={errors.address} htmlFor="address">
              <input id="address" name="address" className={`input ${inv('address')}`} value={form.address} onChange={set('address')} placeholder="e.g. House 12, Street 4" />
            </Field>
            <Field label="Latitude" error={errors.latitude} htmlFor="latitude">
              <input id="latitude" name="latitude" className={`input ${inv('latitude')}`} type="number" step="0.000001" value={form.latitude} onChange={set('latitude')} placeholder="31.4629" />
            </Field>
            <Field label="Longitude" error={errors.longitude} htmlFor="longitude">
              <input id="longitude" name="longitude" className={`input ${inv('longitude')}`} type="number" step="0.000001" value={form.longitude} onChange={set('longitude')} placeholder="74.4102" />
            </Field>
            <Field label="Check">
              {form.latitude !== '' && form.longitude !== '' ? (
                <a className="btn btn-secondary" href={`https://www.google.com/maps?q=${form.latitude},${form.longitude}`} target="_blank" rel="noreferrer"><MapPin size={15} /> Open in Google Maps</a>
              ) : <span className="muted small" style={{ paddingTop: 8 }}>Pick an area or click the map.</span>}
            </Field>
            <div className="span-3">
              <LocationPicker latitude={form.latitude} longitude={form.longitude} onChange={setPin} />
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">Size &amp; features</div>
          <div className="form-section-desc">Area, rooms and furnishing.</div>
          <div className="form-grid-3">
            <Field label="Area" required error={errors.area} htmlFor="area">
              <input id="area" name="area" className={`input ${inv('area')}`} type="number" min="0" step="0.5" value={form.area} onChange={set('area')} placeholder="10" />
            </Field>
            <Field label="Area unit" required htmlFor="areaUnit">
              <select id="areaUnit" name="areaUnit" className="select" value={form.areaUnit} onChange={set('areaUnit')}>
                {AREA_UNITS.map((unit) => <option key={unit}>{unit}</option>)}
              </select>
            </Field>
            <Field label="Furnishing" htmlFor="furnished">
              <select id="furnished" name="furnished" className="select" value={form.furnished} onChange={set('furnished')} disabled={noRooms}>
                <option value="">Not specified</option>
                {FURNISHING.map((option) => <option key={option}>{option}</option>)}
              </select>
            </Field>
            {!noRooms && (
              <>
                <Field label="Bedrooms" error={errors.bedrooms} htmlFor="bedrooms">
                  <input id="bedrooms" name="bedrooms" className={`input ${inv('bedrooms')}`} type="number" min="0" max="100" value={form.bedrooms} onChange={set('bedrooms')} />
                </Field>
                <Field label="Bathrooms" error={errors.bathrooms} htmlFor="bathrooms">
                  <input id="bathrooms" name="bathrooms" className={`input ${inv('bathrooms')}`} type="number" min="0" max="100" value={form.bathrooms} onChange={set('bathrooms')} />
                </Field>
                <Field label="Parking spaces" error={errors.parking} htmlFor="parking">
                  <input id="parking" name="parking" className={`input ${inv('parking')}`} type="number" min="0" max="100" value={form.parking} onChange={set('parking')} />
                </Field>
                <Field label="Year built" error={errors.yearBuilt} hint="Optional" htmlFor="yearBuilt">
                  <input id="yearBuilt" name="yearBuilt" className={`input ${inv('yearBuilt')}`} type="number" min="1900" value={form.yearBuilt} onChange={set('yearBuilt')} />
                </Field>
              </>
            )}
          </div>
          <div className="field mt-16">
            <span className="field-label">Amenities</span>
            <div className="chips">
              {[...new Set([...AMENITIES, ...form.amenities])].map((amenity) => (
                <button key={amenity} type="button" className={`chip ${form.amenities.includes(amenity) ? 'active' : ''}`} onClick={() => toggleAmenity(amenity)} aria-pressed={form.amenities.includes(amenity)}>
                  {amenity}{form.amenities.includes(amenity) && !AMENITIES.includes(amenity) && <X size={12} />}
                </button>
              ))}
            </div>
            <div className="row mt-8" style={{ maxWidth: 420 }}>
              <input className="input" value={customAmenity} onChange={(event) => setCustomAmenity(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomAmenity(); } }} placeholder="Add another amenity…" aria-label="Custom amenity" />
              <Button icon={Plus} onClick={addCustomAmenity}>Add</Button>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">Photos</div>
          <div className="form-section-desc">
            {isEdit ? 'Changes to photos are saved immediately. Drag to reorder; the first photo is the cover.' : 'Photos are uploaded when you publish. Drag to reorder; the first photo is the cover.'}
          </div>
          <ImageManager items={imageItems} onAdd={addImages} onMove={moveImage} onCover={setCover} onRemove={removeImage} busyKey={imageBusy} uploading={uploading} error={imageError} />
        </div>

        <div className="form-section">
          <div className="form-section-title">Visibility &amp; contact</div>
          <div className="form-section-desc">Inactive listings are hidden from the public website.</div>
          <div className="form-grid-3">
            <Field label="Status" htmlFor="status">
              <select id="status" name="status" className="select" value={form.status} onChange={set('status')}>
                {PROPERTY_STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
            </Field>
            <Field label="Featured">
              <label className="switch" style={{ paddingTop: 8 }}>
                <input type="checkbox" name="isFeatured" checked={form.isFeatured} onChange={set('isFeatured')} />
                Show on the homepage
              </label>
            </Field>
            <span />
            <Field label="Contact name" htmlFor="ownerName">
              <input id="ownerName" name="ownerName" className="input" value={form.ownerName} onChange={set('ownerName')} placeholder="Owner or agent" />
            </Field>
            <Field label="Contact phone" htmlFor="ownerPhone">
              <input id="ownerPhone" name="ownerPhone" className="input" value={form.ownerPhone} onChange={set('ownerPhone')} placeholder="+92 300 1234567" />
            </Field>
            <Field label="Contact email" error={errors.ownerEmail} htmlFor="ownerEmail">
              <input id="ownerEmail" name="ownerEmail" className={`input ${inv('ownerEmail')}`} type="email" value={form.ownerEmail} onChange={set('ownerEmail')} />
            </Field>
          </div>
        </div>
      </div>

      <div className="row mt-16" style={{ justifyContent: 'flex-end' }}>
        <Link to="/properties" className="btn btn-secondary">Cancel</Link>
        <Button type="submit" variant="primary" icon={Save} loading={saving}>{isEdit ? 'Save changes' : 'Publish property'}</Button>
      </div>
    </form>
  );
}
