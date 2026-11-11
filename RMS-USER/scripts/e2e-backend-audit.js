// Use global fetch (Node 18+); no node-fetch dependency required
const API = process.env.API_BASE || 'http://localhost:5000/api';

const log = (title, obj) => {
  console.log('---', title, '---');
  try { console.log(typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)); } catch(e) { console.log(obj); }
};

import axios from 'axios';

import http from 'node:http';
import https from 'node:https';

// Disable keepAlive to avoid ECONNRESET on some Windows setups
const client = axios.create({ baseURL: API.replace(/\/$/, ''), timeout: 20000, httpAgent: new http.Agent({ keepAlive: false }), httpsAgent: new https.Agent({ keepAlive: false }) });

const request = async (path, opts = {}) => {
  try {
    const method = (opts.method || 'GET').toLowerCase();
    const headers = opts.headers || {};
    const data = opts.body ? JSON.parse(opts.body) : undefined;
    const res = await client.request({ url: path, method, headers, data });
    return { status: res.status, ok: res.status >= 200 && res.status < 300, body: res.data };
  } catch (e) {
    if (e.response) return { status: e.response.status, ok: false, body: e.response.data };
    throw e;
  }
};

(async () => {
  try {
    // 1. Register user
    const unique = Date.now();
    const userEmail = `e2e-user-${unique}@example.com`;
    const signupPayload = { name: 'E2E User', email: userEmail, password: 'Pass1234', phone: '+100000000' };
    let r = await request('/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(signupPayload) });
    log('signup', r);

    // 2. Login user
    r = await request('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: userEmail, password: 'Pass1234' }) });
    log('login', r);
    if (!r.ok) process.exit(2);
    const token = r.body.data.token;
    const userId = r.body.data.user.id;

    // 3. GET /auth/me
    r = await request('/auth/me', { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    log('me', r);

    // 4. Update profile
    const profileUpdates = { phone: '+199999999', profile: { address: '123 Test St' } };
    r = await request('/users/profile', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(profileUpdates) });
    log('update profile', r);

    // 5. List properties
    r = await request('/properties', { method: 'GET' });
    log('properties list', r);
    const prop = Array.isArray(r.body.data) && r.body.data.length ? r.body.data[0] : null;

    // 6. Favorite a property (if exists)
    if (prop) {
      r = await request('/favorites', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId: prop._id }) });
      log('add favorite', r);
      r = await request('/favorites', { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
      log('list favorites', r);
    }

    // 7. Save a search
    const search = { name: 'E2E search', query: { q: 'Test' } };
    r = await request('/saved-searches', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(search) });
    log('save search', r);
    r = await request('/saved-searches', { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    log('list saved searches', r);

    // 8. Create booking
    const bookingPayload = { propertyId: prop ? prop._id : 'prop-demo', propertyTitle: prop ? prop.title || prop.name : 'Demo Prop', amount: 12345, notes: 'E2E booking' };
    r = await request('/bookings', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(bookingPayload) });
    log('create booking', r);
    const bookingId = r.body.data ? r.body.data._id : null;

    // 9. List my bookings
    r = await request('/bookings/me', { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    log('my bookings', r);

    // 10. Create payment
    const paymentPayload = { bookingId: bookingId || 'bk-demo', propertyId: prop?._id || '', amount: 5000, paymentType: 'Advance', transactionId: `txn-${unique}`, status: 'Completed', propertyName: prop ? prop.title || '' : '' };
    r = await request('/payments', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(paymentPayload) });
    log('create payment', r);

    // 11. List my payments
    r = await request('/payments/me', { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    log('my payments', r);

    // 12. Notifications (should be empty or include messages)
    r = await request('/notifications', { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    log('notifications', r);

    // 13. Admin actions: login admin
    r = await request('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@rms.com', password: 'admin123' }) });
    log('admin login', r);
    const adminToken = r.ok ? r.body.data.token : null;

    // 14. Admin list bookings
    r = await request('/bookings', { method: 'GET', headers: { Authorization: `Bearer ${adminToken}` } });
    log('admin bookings', r);
    const adminBooking = Array.isArray(r.body.data) ? r.body.data.find(b => String(b.userId) === String(userId) || (b._id === bookingId)) : null;

    // 15. Admin approve booking (if found)
    if (adminBooking) {
      r = await request(`/bookings/${adminBooking._id}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      log('approve booking', r);
    }

    // 16. Admin create announcement
    const adminMessage = { userId: userId, userName: 'E2E User', title: 'Admin Notice', message: 'This is a test announcement', entityType: 'GENERAL', actionType: 'ANNOUNCEMENT' };
    r = await request('/admin/message', { method: 'POST', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(adminMessage) });
    log('admin message', r);

    // 17. Check user notifications
    r = await request('/notifications', { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    log('notifications after admin', r);

    // 18. Verify booking status for user
    r = await request('/bookings/me', { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    log('my bookings after approval', r);

    console.log('\nE2E backend audit completed');
    process.exit(0);
  } catch (e) {
    console.error('E2E backend audit failed', e);
    process.exit(1);
  }
})();
