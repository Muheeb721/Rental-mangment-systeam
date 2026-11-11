import api from './api';

export const createSaleInterest = async (payload) => api.request('/sale-interest', {
  method: 'POST',
  body: payload,
});

export default { createSaleInterest };
