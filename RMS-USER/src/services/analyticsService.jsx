import { fetchPayments } from '../utils/paymentsStorage.jsx';
import { read as fetchBookings } from './bookingService.jsx';
import { fetchNotifications } from '../utils/notificationsStorage.jsx';
import propertyService from './propertyService';
import apiClient from './apiClient';

export const sendAnalyticsSummary = async () => {
  const [payments, bookings, notifications, propertiesResp] = await Promise.all([
    fetchPayments(),
    fetchBookings(),
    fetchNotifications(),
    propertyService.listProperties(),
  ]);

  const properties = (propertiesResp && propertiesResp.success && Array.isArray(propertiesResp.data)) ? propertiesResp.data : [];

  const revenue = payments.reduce((sum, item) => sum + Number(item.amountPaid || 0), 0);
  const pendingPayments = payments.filter((item) => String(item.status || '').toLowerCase().includes('pending')).length;
  const overduePayments = payments.filter((item) => String(item.status || '').toLowerCase().includes('overdue')).length;
  const data = {
    totalProperties: properties.length,
    available: properties.filter((item) => String(item.status || item.availability || '').toLowerCase().includes('available')).length,
    reserved: properties.filter((item) => String(item.status || item.availability || '').toLowerCase().includes('reserved')).length,
    sold: properties.filter((item) => String(item.status || item.availability || '').toLowerCase().includes('sold')).length,
    forRent: properties.filter((item) => String(item.status || item.availability || '').toLowerCase().includes('rent')).length,
    totalUsers: new Set([...(Array.isArray(payments) ? payments.map((item) => item.userEmail || 'guest') : []), ...(Array.isArray(bookings) ? bookings.map((item) => item.userEmail || 'guest') : [])].filter(Boolean)).size,
    totalBookings: Array.isArray(bookings) ? bookings.length : 0,
    totalRevenue: revenue,
    pendingPayments,
    overduePayments,
    notifications: Array.isArray(notifications) ? notifications.length : 0,
  };

  try {
    const response = await apiClient.post('/analytics/summary', data);
    return response;
  } catch (error) {
    console.error('Failed to send analytics summary', error);
    throw error;
  }
};

export default { sendAnalyticsSummary };
