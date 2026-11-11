import SiteContent from '../models/SiteContent.js';

export const DEFAULT_SITE_CONTENT = Object.freeze({
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
  aboutMissionText: 'To provide smart, secure, and efficient tools that simplify property operations and improve the living experience for residents and managers.',
  aboutVisionTitle: 'Our Vision',
  aboutVisionText: 'To become a leading residential management platform that transforms how communities are managed, experienced, and connected.',
  aboutCtaTitle: 'Ready to Manage Your Property Smarter?',
  aboutCtaText: 'Join RMS and simplify your residential management experience.',
  footerDescription: 'Premium residential management for properties, residents, payments, and maintenance.',
  contactPhone: '+92 300 1234567',
  phoneHref: 'tel:+923001234567',
  contactEmail: 'support@rms.pk',
  emailHref: 'mailto:support@rms.pk',
  contactLocationLabel: 'DHA Phase 5, Lahore, Pakistan',
  contactMapsHref: 'https://maps.google.com/?q=DHA+Phase+5+Lahore',
});

const ALLOWED_KEYS = Object.keys(DEFAULT_SITE_CONTENT);

const readContent = async () => {
  const doc = await SiteContent.findOne({ key: 'default' }).lean();
  return { ...DEFAULT_SITE_CONTENT, ...(doc?.content || {}), updatedAt: doc?.updatedAt || null };
};

/** GET /api/site-content - public; always returns a complete object (defaults merged with saved values). */
export const getSiteContent = async (_req, res) => {
  try {
    return res.json({ success: true, data: await readContent() });
  } catch (error) {
    console.error('Get site content failed', error);
    return res.json({ success: true, data: { ...DEFAULT_SITE_CONTENT } });
  }
};

/** PUT /api/site-content - admin; accepts any subset of the known keys. Empty string resets a key to its default. */
export const updateSiteContent = async (req, res) => {
  try {
    const body = req.body || {};
    const existing = (await SiteContent.findOne({ key: 'default' }).lean())?.content || {};
    const next = { ...existing };
    const errors = {};
    for (const key of ALLOWED_KEYS) {
      if (body[key] === undefined) continue;
      const value = String(body[key] ?? '').trim();
      if (value.length > 2000) errors[key] = `${key} must be 2000 characters or fewer.`;
      if (value) next[key] = value; else delete next[key];
    }
    if (Object.keys(errors).length) return res.status(400).json({ success: false, message: Object.values(errors)[0], errors });
    await SiteContent.findOneAndUpdate(
      { key: 'default' },
      { $set: { content: next, updatedBy: req.user?.email || '', updatedAt: new Date() } },
      { upsert: true, new: true },
    );
    return res.json({ success: true, message: 'Site content saved.', data: await readContent() });
  } catch (error) {
    console.error('Update site content failed', error);
    return res.status(500).json({ success: false, message: 'Unable to save site content.' });
  }
};
