import api from './api';

export const createPayment = async (payload) => {
  try {
    const res = await api.request('/payments', { method: 'POST', body: payload });
    return res;
  } catch (error) {
    console.warn('Create payment failed', error);
    return { success: false, message: 'API unavailable' };
  }
};

export const myPayments = async () => {
  try {
    const res = await api.request('/payments/me');
    return res;
  } catch (error) {
    console.warn('List my payments failed', error);
    return { success: false, message: 'API unavailable' };
  }
};

export default { createPayment, myPayments };
