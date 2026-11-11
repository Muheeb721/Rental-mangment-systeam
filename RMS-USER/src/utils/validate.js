export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
// Pakistani mobile/landline, e.g. 0300 1234567, +92 300 1234567, 042 35123456
export const isPhone = (v) => {
  const digits = String(v || '').replace(/[\s()-]/g, '');
  return /^(\+92|0092|0)?\d{9,11}$/.test(digits) && digits.replace(/\D/g, '').length >= 10;
};
export const isCnic = (v) => /^\d{5}-?\d{7}-?\d$/.test(String(v || '').trim());
export const formatCnic = (v) => {
  const d = String(v || '').replace(/\D/g, '').slice(0, 13);
  if (d.length <= 5) return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
};
export const required = (v) => String(v ?? '').trim().length > 0;
export const todayISO = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
};

/** Run a { field: [ [test, message], ... ] } rule map; returns { field: message } for failures. */
export function validate(values, rules) {
  const errors = {};
  Object.entries(rules).forEach(([field, checks]) => {
    for (const [test, message] of checks) {
      if (!test(values[field], values)) { errors[field] = message; break; }
    }
  });
  return errors;
}
