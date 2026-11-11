import { chromium } from 'playwright';

const API = process.env.API_BASE || 'http://localhost:5000/api';
const BASE = process.env.BASE_URL || 'http://localhost:5175';

const log = (...args) => console.log('[E2E]', ...args);

(async () => {
  try {
    const unique = Date.now();
    const email = `ui-e2e-${unique}@example.com`;
    const signup = await fetch(`${API}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'UI E2E', email, password: 'Pass1234', phone: '+1000000' }) });
    const signupJson = await signup.json().catch(() => null);
    log('signup', signup.status, signupJson && signupJson.success);

    const login = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Pass1234' }) });
    const loginJson = await login.json();
    if (!loginJson || !loginJson.data || !loginJson.data.token) throw new Error('Login failed');
    const token = loginJson.data.token;
    const userId = loginJson.data.user.id || loginJson.data.user._id;
    log('login token for', email, userId);

    // get property
    const propsRes = await fetch(`${API}/properties`);
    const propsJson = await propsRes.json();
    const prop = Array.isArray(propsJson.data) && propsJson.data.length ? propsJson.data[0] : { _id: 'prop-demo', title: 'Demo Prop' };

    // create booking via API
    const bookingPayload = { propertyId: prop._id, propertyTitle: prop.title || prop.name || 'Demo Prop', amount: 11111, notes: 'UI E2E booking' };
    const bkRes = await fetch(`${API}/bookings`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(bookingPayload) });
    const bkJson = await bkRes.json();
    log('booking create', bkRes.status, bkJson && bkJson.success);
    const bookingId = bkJson.data && bkJson.data._id;

    // Start browser
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on('console', (msg) => {
      try { log('PAGE:', msg.type(), msg.text()); } catch (e) {}
    });
    page.on('requestfailed', (req) => {
      try { log('REQUESTFAILED', req.url(), req.failure() && req.failure().errorText); } catch (e) {}
    });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });

    // set token in localStorage and reload
    await page.evaluate((t) => { window.localStorage.setItem('rms_token', t); window.dispatchEvent(new Event('storage')); }, token);
    await page.reload({ waitUntil: 'networkidle' });

    // navigate to notifications after the route has lazy-loaded
    await page.goto(BASE + '/notifications', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.notifications-page', { timeout: 30000 }).catch(() => {});
    await page.waitForFunction(() => document.querySelector('.notifications-page') !== null || document.querySelector('.notification-card') !== null, { timeout: 30000 });
    await page.waitForTimeout(1000);

    // debug: dump localStorage notifications and DOM list
    const rawNotesLS = await page.evaluate(() => window.localStorage.getItem('rms_notifications'));
    log('localStorage rms_notifications:', rawNotesLS ? rawNotesLS.slice(0, 2000) : rawNotesLS);
    const cardCount = await page.evaluate(() => document.querySelectorAll('.notification-card').length).catch(() => 0);
    log('notification-card count in DOM:', cardCount);

    // wait for notification listing to include our booking submission text
    const bookingText = `Your booking for ${bookingPayload.propertyTitle} has been submitted.`;
    log('looking for booking text in notifications:', bookingText);

    const found = await page.locator(`text=${bookingText}`).first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    if (!found) {
      // try more generic
      const generic = await page.locator(`text=has been submitted`).first().count();
      if (!generic) throw new Error('Notification not visible in UI');
    }
    log('notification visible in UI');

    // get unread count from panel header ("X unread")
    const headerText = await page.locator('text=unread').first().innerText().catch(() => null);
    log('header unread text:', headerText);

    // click mark read button for the notification (first "Mark read")
    const markBtn = await page.locator('button:has-text("Mark read")').first();
    const markExists = await markBtn.count();
    if (markExists) {
      await markBtn.click();
      log('clicked Mark read');
    } else {
      log('no mark button found, aborting');
    }

    // wait a moment and refresh page
    await page.waitForTimeout(500);
    await page.reload({ waitUntil: 'networkidle' });
    await page.goto(BASE + '/notifications', { waitUntil: 'networkidle' });

    // check backend notification is marked read
    const notesRes = await fetch(`${API}/notifications`, { headers: { Authorization: `Bearer ${token}` } });
    const notesJson = await notesRes.json();
    const myNotes = Array.isArray(notesJson.data) ? notesJson.data.filter(n => String(n.entityId) === String(bookingId) || (n.actionType && n.actionType.includes('BOOKING_SUBMITTED'))) : [];
    log('backend notifications for booking:', myNotes.length, myNotes.map(n => ({ id: n._id, actionType: n.actionType, isRead: n.isRead })));

    const backendMarked = myNotes.some(n => n.isRead === true);
    if (!backendMarked) log('Backend mark-as-read not reflected yet');

    await browser.close();

    if (!found) throw new Error('Notification not found in UI');

    log('E2E UI verification completed — found notification, attempted mark-read');
    process.exit(0);
  } catch (e) {
    console.error('Playwright UI E2E failed', e && e.message ? e.message : e);
    process.exit(2);
  }
})();
