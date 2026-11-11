import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import './SettingsPage.css';

const defaultSettings = {
  darkMode: false,
  notifications: true,
  autoApprove: false,
  emailAlerts: true,
  dateFormat: 'DD/MM/YYYY',
  timezone: 'GMT+5',
  itemsPerPage: 10,
};

const settingLabels = {
  darkMode: 'Dark Mode',
  notifications: 'Notifications',
  autoApprove: 'Auto Approve Bookings',
  emailAlerts: 'Email Alerts',
  dateFormat: 'Date Format',
  timezone: 'Timezone',
  itemsPerPage: 'Items Per Page',
};

function SettingsPage({ appData, setAppData, notify }) {
  const settings = { ...defaultSettings, ...(appData.settings || {}) };
  const [siteContent, setSiteContent] = useState({
    brandName: 'RMS',
    brandTagline: 'Residential Management System',
    heroChip: 'SMART PROPERTY + RENTAL MANAGEMENT',
    heroTitle: 'Find Your Perfect Home',
    heroSubtitle: 'RMS helps you buy, rent, manage rentals, track payments, and stay on top of maintenance in DHA and Askari communities.',
    heroPrimaryCta: 'Explore Properties',
    heroSecondaryCta: 'Find a Rental',
    aboutIntroTitle: 'Making Residential Management Simple & Smarter',
    aboutIntroText: 'RMS is a smart and comprehensive Residential Management System designed to connect residents, property managers, landlords, and service providers on one integrated platform.',
    aboutWhoTitle: 'Who We Are',
    aboutWhoText: 'RMS is a digital platform designed to simplify and automate residential property management with modern tools for residents, owners, and operators.',
    aboutMissionTitle: 'Our mission is to create smarter, safer, and better-managed residential communities.',
    aboutVisionTitle: 'Our Vision',
    aboutVisionText: 'To become a leading residential management platform that transforms how communities are managed, experienced, and connected.',
    aboutCtaTitle: 'Ready to Manage Your Property Smarter?',
    aboutCtaText: 'Join RMS and simplify your residential management experience.',
    servicesIntroLabel: 'Built for residential operations',
    servicesTitle: 'Residential Management Services',
    servicesSubtitle: 'Deliver modern property management for houses, apartments, and hostels with a polished platform that combines rent tracking, maintenance, resident records, and reporting.',
    servicesCtaTitle: 'Bring operations, payments and resident services together in one platform.',
    servicesCtaText: 'Ready to modernize residential management?',
    contactPhone: '+92 304 0044410',
    contactEmail: 'muheebshahid75@gmail.com',
    contactLocationLabel: 'DHA Lahore, Pakistan',
    footerDescription: 'Premium residential management for properties, residents, payments, and maintenance.',
    companyDescription: 'RMS is a smart and comprehensive Residential Management System designed to connect residents, property managers, landlords, and service providers on one integrated platform.',
  });
  const [savingContent, setSavingContent] = useState(false);

  useEffect(() => {
    let active = true;
    apiService.request('/site-content', { method: 'GET' })
      .then((response) => {
        if (!active || !response?.success || !response.data) return;
        setSiteContent((prev) => ({ ...prev, ...response.data }));
      })
      .catch(() => {
        // keep default values
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSiteContentSave = async () => {
    setSavingContent(true);
    try {
      const response = await apiService.request('/site-content', {
        method: 'POST',
        body: siteContent,
      });
      if (!response?.success) throw new Error(response?.message || 'Unable to save site content.');
      notify({ message: 'Public site content updated.', variant: 'success' });
    } catch (error) {
      notify({ message: error?.message || 'Unable to save site content.', variant: 'error' });
    } finally {
      setSavingContent(false);
    }
  };

  const handleToggle = (key) => {
    const nextValue = !settings[key];
    setAppData((prev) => ({
      ...prev,
      settings: { ...(prev.settings || {}), [key]: nextValue },
    }));
    notify({ message: `${settingLabels[key]} ${nextValue ? 'enabled' : 'disabled'}.`, variant: 'success' });
  };

  const handleSelect = (key, value) => {
    const nextValue = key === 'itemsPerPage' ? Number(value) : value;
    setAppData((prev) => ({
      ...prev,
      settings: { ...(prev.settings || {}), [key]: nextValue },
    }));
    notify({ message: `${settingLabels[key]} updated.`, variant: 'success' });
  };

  return (
    <div className="page-section settings-page">
      <section className="panel-card">
        <div className="card-header">
          <h3>Public Site Content</h3>
        </div>
        <div className="settings-list">
          <div className="setting-row">
            <div>
              <strong>Brand Name</strong>
            </div>
            <input value={siteContent.brandName || ''} onChange={(event) => setSiteContent((prev) => ({ ...prev, brandName: event.target.value }))} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Brand Tagline</strong>
            </div>
            <input value={siteContent.brandTagline || ''} onChange={(event) => setSiteContent((prev) => ({ ...prev, brandTagline: event.target.value }))} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Hero Chip</strong>
            </div>
            <input value={siteContent.heroChip || ''} onChange={(event) => setSiteContent((prev) => ({ ...prev, heroChip: event.target.value }))} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Hero Title</strong>
            </div>
            <input value={siteContent.heroTitle || ''} onChange={(event) => setSiteContent((prev) => ({ ...prev, heroTitle: event.target.value }))} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Hero Subtitle</strong>
            </div>
            <textarea rows={3} value={siteContent.heroSubtitle || ''} onChange={(event) => setSiteContent((prev) => ({ ...prev, heroSubtitle: event.target.value }))} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Hero Primary CTA</strong>
            </div>
            <input value={siteContent.heroPrimaryCta || ''} onChange={(event) => setSiteContent((prev) => ({ ...prev, heroPrimaryCta: event.target.value }))} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Hero Secondary CTA</strong>
            </div>
            <input value={siteContent.heroSecondaryCta || ''} onChange={(event) => setSiteContent((prev) => ({ ...prev, heroSecondaryCta: event.target.value }))} />
          </div>
          <div className="setting-row">
            <div>
              <strong>About Intro Title</strong>
            </div>
            <input value={siteContent.aboutIntroTitle || ''} onChange={(event) => setSiteContent((prev) => ({ ...prev, aboutIntroTitle: event.target.value }))} />
          </div>
          <div className="setting-row">
            <div>
              <strong>About Intro Text</strong>
            </div>
            <textarea rows={3} value={siteContent.aboutIntroText || ''} onChange={(event) => setSiteContent((prev) => ({ ...prev, aboutIntroText: event.target.value }))} />
          </div>
          <div className="setting-row">
            <div>
              <strong>About Who Title</strong>
            </div>
            <input value={siteContent.aboutWhoTitle || ''} onChange={(event) => setSiteContent((prev) => ({ ...prev, aboutWhoTitle: event.target.value }))} />
          </div>
          <div className="setting-row">
            <div>
              <strong>About Who Text</strong>
            </div>
            <textarea rows={3} value={siteContent.aboutWhoText || ''} onChange={(event) => setSiteContent((prev) => ({ ...prev, aboutWhoText: event.target.value }))} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Services Label</strong>
            </div>
            <input value={siteContent.servicesIntroLabel || ''} onChange={(event) => setSiteContent((prev) => ({ ...prev, servicesIntroLabel: event.target.value }))} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Services Title</strong>
            </div>
            <input value={siteContent.servicesTitle || ''} onChange={(event) => setSiteContent((prev) => ({ ...prev, servicesTitle: event.target.value }))} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Services Subtitle</strong>
            </div>
            <textarea rows={3} value={siteContent.servicesSubtitle || ''} onChange={(event) => setSiteContent((prev) => ({ ...prev, servicesSubtitle: event.target.value }))} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Footer Description</strong>
            </div>
            <textarea rows={3} value={siteContent.footerDescription || ''} onChange={(event) => setSiteContent((prev) => ({ ...prev, footerDescription: event.target.value }))} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Company Description</strong>
            </div>
            <textarea rows={3} value={siteContent.companyDescription || ''} onChange={(event) => setSiteContent((prev) => ({ ...prev, companyDescription: event.target.value }))} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Phone Number</strong>
            </div>
            <input value={siteContent.contactPhone || ''} onChange={(event) => setSiteContent((prev) => ({ ...prev, contactPhone: event.target.value }))} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Email</strong>
            </div>
            <input value={siteContent.contactEmail || ''} onChange={(event) => setSiteContent((prev) => ({ ...prev, contactEmail: event.target.value }))} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Phone Link</strong>
            </div>
            <input value={siteContent.phoneHref || ''} onChange={(event) => setSiteContent((prev) => ({ ...prev, phoneHref: event.target.value }))} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Email Link</strong>
            </div>
            <input value={siteContent.emailHref || ''} onChange={(event) => setSiteContent((prev) => ({ ...prev, emailHref: event.target.value }))} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Location</strong>
            </div>
            <input value={siteContent.contactLocationLabel || ''} onChange={(event) => setSiteContent((prev) => ({ ...prev, contactLocationLabel: event.target.value }))} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Map Link</strong>
            </div>
            <input value={siteContent.contactMapsHref || ''} onChange={(event) => setSiteContent((prev) => ({ ...prev, contactMapsHref: event.target.value }))} />
          </div>
          <div className="setting-row">
            <div />
            <button type="button" className="primary-button" onClick={handleSiteContentSave} disabled={savingContent}>
              {savingContent ? 'Saving...' : 'Save Public Content'}
            </button>
          </div>
        </div>
      </section>

      <section className="panel-card">
        <div className="card-header">
          <h3>Admin Preferences</h3>
        </div>
        <div className="settings-list">
          {Object.entries(settings).map(([key, value]) => {
            if (typeof value === 'boolean') {
              return (
                <div className="setting-row" key={key}>
                  <div>
                    <strong>{settingLabels[key] || key}</strong>
                    <small className="setting-description">
                      {key === 'darkMode' && 'Apply a dark appearance across the admin panel.'}
                      {key === 'notifications' && 'Show unread notification indicators in the header.'}
                      {key === 'autoApprove' && 'Automatically approve new bookings while the admin panel is online.'}
                      {key === 'emailAlerts' && 'Save your preference for email alerts.'}
                    </small>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={() => handleToggle(key)}
                      aria-label={settingLabels[key] || key}
                    />
                    <span className="slider" />
                  </label>
                </div>
              );
            }

            return (
              <div className="setting-row" key={key}>
                <div>
                  <strong>{settingLabels[key] || key}</strong>
                </div>
                <select
                  value={value}
                  onChange={(event) => handleSelect(key, event.target.value)}
                  aria-label={settingLabels[key] || key}
                >
                  {key === 'dateFormat' && (
                    <>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </>
                  )}
                  {key === 'timezone' && (
                    <>
                      <option value="GMT+5">GMT+5</option>
                      <option value="UTC">UTC</option>
                      <option value="GMT+0">GMT+0</option>
                    </>
                  )}
                  {key === 'itemsPerPage' && (
                    <>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </>
                  )}
                </select>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default SettingsPage;
