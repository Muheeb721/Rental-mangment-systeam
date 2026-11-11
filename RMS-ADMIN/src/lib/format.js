/** Formatting helpers shared by admin pages. */

const pkr = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 });

/** PKR 1,250,000 */
export const money = (value) => `PKR ${pkr.format(Number(value || 0))}`;

/** Compact Pakistani notation: 85K, 12.5 Lakh, 4.2 Crore */
export const moneyShort = (value) => {
  const amount = Number(value || 0);
  const trim = (n, digits) => String(Number(n.toFixed(digits)));
  if (amount >= 10_000_000) return `PKR ${trim(amount / 10_000_000, 2)} Crore`;
  if (amount >= 100_000) return `PKR ${trim(amount / 100_000, 2)} Lakh`;
  if (amount >= 1_000) return `PKR ${trim(amount / 1_000, 1)}K`;
  return `PKR ${pkr.format(amount)}`;
};

export const number = (value) => pkr.format(Number(value || 0));

export const date = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const dateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const timeAgo = (value) => {
  if (!value) return '';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (Number.isNaN(seconds)) return '';
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date(value);
};

export const initials = (name = '') => String(name).trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || '?';

export const areaLabel = (property) => {
  if (!property?.area) return '—';
  const unit = property.areaUnit || 'Marla';
  return unit === 'Sq. Ft.' ? `${number(property.area)} sq. ft.` : `${property.area} ${unit}`;
};

export const priceLabel = (property) => {
  const price = Number(property?.price || property?.rent || property?.salePrice || 0);
  return property?.purpose === 'Sale' ? moneyShort(price) : `${money(price)}/mo`;
};

const TONES = {
  green: ['available', 'approved', 'accepted', 'active', 'paid', 'resolved', 'verified', 'on_time', 'completed'],
  amber: ['pending', 'in progress', 'partial', 'reserved', 'submitted', 'new', 'late', 'medium'],
  red: ['rejected', 'blocked', 'overdue', 'failed', 'cancelled', 'urgent', 'high', 'hidden', 'deleted'],
  blue: ['booked', 'rented', 'rent', 'owner', 'info'],
  violet: ['sold', 'sale', 'admin', 'refunded'],
  gray: ['inactive', 'closed', 'low', 'resident', 'left', 'none'],
};

/** Maps any status string to a colour tone used by <Badge>. */
export const toneFor = (status) => {
  const key = String(status || '').trim().toLowerCase();
  return Object.keys(TONES).find((tone) => TONES[tone].includes(key)) || 'gray';
};

export const titleCase = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Client-side text search across several fields. */
export const matches = (item, term, fields) => {
  const needle = String(term || '').trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => String(typeof field === 'function' ? field(item) : item?.[field] ?? '').toLowerCase().includes(needle));
};
