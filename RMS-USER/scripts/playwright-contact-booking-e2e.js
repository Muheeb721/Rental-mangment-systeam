import { chromium } from 'playwright';

const API = process.env.API_BASE || 'http://localhost:5000/api';
const BASE = process.env.BASE_URL || 'http://localhost:5175';

const log = (...args) => console.log('[E2E-CONTACT-BOOKING]', ...args);

(async () => {
  // wait for backend health
  const maxAttempts = 20;
  let healthy = false;
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const h = await fetch(`${API}/health`);
      if (h && h.ok) { healthy = true; break; }
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!healthy) {
    console.error('E2E-CONTACT-BOOKING: backend not healthy, aborting');
    process.exit(2);
  }

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    page.on('console', (msg) => { try { log('PAGE:', msg.type(), msg.text()); } catch (e) {} });
    page.on('requestfailed', (req) => { try { log('REQUESTFAILED', req.url(), req.failure() && req.failure().errorText); } catch (e) {} });

    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(120000);

    // Login as test user
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    const emailSel = 'input[placeholder="Enter your email"]';
    const passSel = 'input[placeholder="Enter your password"]';
    const submitSel = 'button[type="submit"]';
    await page.waitForSelector(emailSel, { timeout: 15000 });
    await page.fill(emailSel, 'testuser42@example.com');
    await page.fill(passSel, 'Passw0rd!');
    await page.click(submitSel);

    // wait for navigation away from login
    await page.waitForFunction(() => window.location.pathname !== '/login', { timeout: 15000 });

    // navigate to known test property
    await page.goto(`${BASE}/properties/p-test-1`, { waitUntil: 'domcontentloaded' });

    // click contact button
    await page.waitForSelector('button', { timeout: 10000 });
    await page.click('text=Contact About This Property');

    // should navigate to /contact
    await page.waitForFunction(() => window.location.pathname.startsWith('/contact'), { timeout: 10000 });

    // fill contact form
    await page.waitForSelector('#fullName', { timeout: 10000 });
    await page.fill('#fullName', 'E2E Tester');
    await page.fill('#email', 'testuser42@example.com');
    await page.fill('#phone', '+923001111111');
    await page.fill('#message', 'E2E contact from automated test');
    await page.click('button[type="submit"]');

    // wait for success modal
    try {
      await page.waitForSelector('.success-modal', { timeout: 10000 });
      log('Contact form submitted - success modal shown');
    } catch (e) {
      log('Success modal not detected, will verify via API');
    }

    // extract token from localStorage to verify backend record
    const token = await page.evaluate(() => window.localStorage.getItem('rms_token') || window.__RMS_AUTH_TOKEN || '');
    if (!token) {
      throw new Error('No auth token found in localStorage after login');
    }

    // verify contact was created via API - fetch latest user contacts
    const resp = await page.evaluate(async (opts) => {
      try {
        const r = await fetch(`${opts.api}/contact`, { headers: { Authorization: `Bearer ${opts.t}` } });
        const j = await r.json().catch(() => null);
        return { status: r.status, ok: r.ok, json: j };
      } catch (e) { return { error: String(e) }; }
    }, { api: API, t: token });

    log('API /contact response:', resp && (resp.error || `${resp.status} ok=${resp.ok}`));
    if (!resp || !resp.ok || !Array.isArray(resp.json?.data)) {
      throw new Error('Contact API verification failed');
    }

    const found = resp.json.data.find((c) => String(c.email || '').toLowerCase() === 'testuser42@example.com' && (c.message || '').includes('E2E contact'));
    if (!found) throw new Error('Submitted contact not found in API results');

    log('E2E-CONTACT-BOOKING: PASS - contact found', found._id || found.id || 'no-id');
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error('E2E-CONTACT-BOOKING: FAIL', e && e.message ? e.message : e);
    process.exit(2);
  }
})();
