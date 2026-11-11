export const isValidEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());

export const isValidPhone = (value = '') => /^[+()\-\d\s]{7,20}$/.test(String(value).trim());

export const isValidName = (value = '') => /^[A-Za-z ]{2,}$/.test(String(value).trim());

export const isPositiveNumber = (value) => Number(value) > 0;
