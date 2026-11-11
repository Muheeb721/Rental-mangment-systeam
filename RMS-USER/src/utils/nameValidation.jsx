export const FULL_NAME_PATTERN = /^[A-Za-z ]+$/;

export const sanitizeFullName = (value = '') =>
  String(value)
    .replace(/[^A-Za-z\s]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

export const fullNameRule = (fieldLabel = 'Full Name') => ({
  validator: (_, value) => {
    const trimmedValue = typeof value === 'string' ? value.trim() : '';

    if (!trimmedValue) {
      return Promise.reject(new Error(`Please enter your ${fieldLabel.toLowerCase()}`));
    }

    if (!FULL_NAME_PATTERN.test(trimmedValue)) {
      return Promise.reject(new Error('Full name can contain only letters and spaces.'));
    }

    return Promise.resolve();
  },
});
