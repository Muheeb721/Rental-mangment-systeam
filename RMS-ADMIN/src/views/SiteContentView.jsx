import { useState } from 'react';
import { ExternalLink, RotateCcw, Save } from 'lucide-react';
import { api, USER_SITE_URL } from '../lib/api';
import { dateTime } from '../lib/format';
import { Button, ErrorState, Field, LoadingBlock, PageHeader, useAsync, useConfirm, useToast } from '../components/ui';

const SECTIONS = [
  { title: 'Brand', desc: 'Shown in the website header and footer.', fields: [['brandName', 'Brand name'], ['brandTagline', 'Tagline'], ['footerDescription', 'Footer description', true]] },
  { title: 'Home page hero', desc: 'The first thing visitors see.', fields: [['heroChip', 'Small label above the title'], ['heroTitle', 'Headline'], ['heroSubtitle', 'Sub-headline', true], ['heroPrimaryCta', 'Primary button text'], ['heroSecondaryCta', 'Secondary button text']] },
  { title: 'About page', desc: 'Copy on the About Us page.', fields: [['aboutIntroTitle', 'Intro title'], ['aboutIntroText', 'Intro text', true], ['aboutWhoTitle', '"Who we are" title'], ['aboutWhoText', '"Who we are" text', true], ['aboutMissionTitle', 'Mission headline'], ['aboutMissionText', 'Mission text', true], ['aboutVisionTitle', 'Vision title'], ['aboutVisionText', 'Vision text', true], ['aboutCtaTitle', 'Call-to-action title'], ['aboutCtaText', 'Call-to-action text', true]] },
  { title: 'Contact details', desc: 'Used on the Contact page and footer.', fields: [['contactPhone', 'Phone (display)'], ['phoneHref', 'Phone link', false, 'tel:+923001234567'], ['contactEmail', 'Email (display)'], ['emailHref', 'Email link', false, 'mailto:support@rms.pk'], ['contactLocationLabel', 'Office location'], ['contactMapsHref', 'Google Maps link']] },
];

export default function SiteContentView() {
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const { data, loading, error, reload } = useAsync(() => api.get('/site-content').then((r) => { setForm(r.data); return r.data; }), []);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await api.put('/site-content', form);
      setForm(response.data);
      toast.success('Website content saved. Changes are live.');
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };
  const resetField = async (key) => {
    const ok = await confirm({ title: 'Reset to default?', message: 'This field will go back to the default RMS copy.', confirmLabel: 'Reset', tone: 'primary' });
    if (!ok) return;
    try {
      const response = await api.put('/site-content', { [key]: '' });
      setForm(response.data);
      toast.success('Field reset.');
    } catch (err) { toast.error(err.message); }
  };

  if (loading && !form) return <LoadingBlock />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <form onSubmit={save}>
      <PageHeader
        title="Site content"
        description={`Edit the public website copy without touching code.${data?.updatedAt ? ` Last saved ${dateTime(data.updatedAt)}.` : ''}`}
        actions={(
          <>
            <a className="btn btn-secondary" href={USER_SITE_URL} target="_blank" rel="noreferrer"><ExternalLink size={15} /> View website</a>
            <Button type="submit" variant="primary" icon={Save} loading={saving}>Save changes</Button>
          </>
        )}
      />
      <div className="card">
        {SECTIONS.map((section) => (
          <div key={section.title} className="form-section">
            <div className="form-section-title">{section.title}</div>
            <div className="form-section-desc">{section.desc}</div>
            <div className="form-grid">
              {section.fields.map(([key, label, multiline, placeholder]) => (
                <Field key={key} label={label} className={multiline ? 'span-2' : ''}>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    {multiline
                      ? <textarea className="textarea" rows={3} value={form?.[key] || ''} onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))} maxLength={2000} />
                      : <input className="input" value={form?.[key] || ''} placeholder={placeholder} onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))} maxLength={2000} />}
                    <button type="button" className="icon-btn" title="Reset to default" aria-label={`Reset ${label}`} onClick={() => resetField(key)}><RotateCcw size={15} /></button>
                  </div>
                </Field>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="row mt-16" style={{ justifyContent: 'flex-end' }}>
        <Button type="submit" variant="primary" icon={Save} loading={saving}>Save changes</Button>
      </div>
    </form>
  );
}
