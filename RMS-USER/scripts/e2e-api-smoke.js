(async () => {
  const API = process.env.API_BASE || 'http://localhost:5000/api';
  const log = (...args) => console.log('[SMOKE]', ...args);
  try {
    // 1. Login as admin
    log('Logging in as admin...');
    let r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@rms.com', password: 'admin123' }) });
    if (!r.ok) throw new Error('Login failed: ' + r.status);
    const j = await r.json();
    const token = j?.data?.token || j?.token;
    if (!token) throw new Error('No token received');
    log('Logged in, token length:', String(token).length);

    const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    // 2. Create user
    log('Creating test user...');
    r = await fetch(`${API}/admin/users`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ name: 'Smoke Test User', email: `smoke+${Date.now()}@example.com`, password: 'Test@1234', phone: '+923001112233', role: 'tenant' }) });
    const userResp = await r.json();
    if (!userResp.success) throw new Error('Create user failed: ' + JSON.stringify(userResp));
    const user = userResp.data;
    log('Created user id:', user._id || user.id || user.email);

    // 3. Create property
    log('Creating test property...');
    const propertyPayload = { title: `Smoke Property ${Date.now()}`, propertyType: 'House', category: 'House', description: 'Smoke test property', price: 1000000, rent: 50000, location: 'DHA Phase 5', city: 'Karachi', address: 'Test address', bedrooms: 3, bathrooms: 2, area: 1200, ownerName: 'Owner', ownerPhone: '+923001112233', ownerEmail: 'owner@example.com', status: 'Available' };
    r = await fetch(`${API}/admin/properties`, { method: 'POST', headers: authHeaders, body: JSON.stringify(propertyPayload) });
    const propResp = await r.json();
    if (!propResp.success) throw new Error('Create property failed: ' + JSON.stringify(propResp));
    const property = propResp.data;
    log('Created property id:', property._id || property.id);

    // 4. Create booking for that property (as guest supplying userId)
    log('Creating booking...');
    const bookingPayload = { userId: user._id || user.id || user.email, userName: user.name || user.email, userEmail: user.email, propertyId: property._id || property.id || '', propertyTitle: property.title, propertyType: property.propertyType || property.category, amount: Number(property.rent || 0) || 50000, bookingStatus: 'Pending', paymentStatus: 'Pending' };
    r = await fetch(`${API}/bookings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bookingPayload) });
    const bkResp = await r.json();
    if (!bkResp.success) throw new Error('Create booking failed: ' + JSON.stringify(bkResp));
    const booking = bkResp.data;
    log('Created booking id:', booking._id || booking.bookingId || booking.id);

    // 5. Approve booking as admin
    const bookingId = booking._id || booking.bookingId || booking.id;
    log('Approving booking', bookingId);
    r = await fetch(`${API}/bookings/${bookingId}/approve`, { method: 'POST', headers: authHeaders });
    const approveResp = await r.json();
    if (!approveResp.success) throw new Error('Approve booking failed: ' + JSON.stringify(approveResp));
    log('Booking approved');

    // 6. Create payment record for booking
    log('Creating payment...');
    const paymentPayload = { userId: user._id || user.id || user.email, userName: user.name || user.email, userEmail: user.email, bookingId: bookingId, propertyId: property._id || property.id || '', propertyName: property.title, amount: 50000, totalAmount: 50000, amountPaid: 50000, remainingAmount: 0, paymentType: 'Rent', method: 'Bank Transfer', status: 'Pending' };
    r = await fetch(`${API}/payments`, { method: 'POST', headers: authHeaders, body: JSON.stringify(paymentPayload) });
    const payResp = await r.json();
    if (!payResp.success) throw new Error('Create payment failed: ' + JSON.stringify(payResp));
    const payment = payResp.data;
    log('Payment created id:', payment._id || payment.id);

    // 7. Approve payment via admin endpoint
    const paymentId = payment._id || payment.id;
    log('Approving payment', paymentId);
    r = await fetch(`${API}/admin/payment/approve`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ userId: user._id || user.id || user.email, userName: user.name || user.email, paymentId, propertyName: property.title }) });
    const appr = await r.json();
    if (!appr.success) throw new Error('Approve payment failed: ' + JSON.stringify(appr));
    log('Payment approved');

    console.log('\nSMOKE TEST: SUCCESS');
    process.exit(0);
  } catch (e) {
    console.error('SMOKE TEST: FAIL', e && e.message ? e.message : e);
    process.exit(2);
  }
})();
