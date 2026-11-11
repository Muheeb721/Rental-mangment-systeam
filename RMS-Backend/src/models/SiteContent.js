import mongoose from 'mongoose';

/** Single document holding editable public-site copy (brand, hero, about, contact). */
const siteContentSchema = new mongoose.Schema({
  key: { type: String, default: 'default', unique: true },
  content: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedBy: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false, minimize: false });

export default mongoose.model('SiteContent', siteContentSchema, 'site_content');
