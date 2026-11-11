import { chromium } from 'playwright';

const API = process.env.API_BASE || 'http://localhost:5000/api';
const BASE = process.env.BASE_URL || 'http://localhost:5174';

const log = (...args) => console.log('[E2E-ADMIN]', ...args);

(async () => {
  // wait for backend health before launching browser
  const maxAttempts = 20;
  let healthy = false;
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const h = await fetch(`${API}/health`);
      if (h && h.ok) { healthy = true; break; }
    } catch (e) {}
    // wait 500ms
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!healthy) {
    console.error('E2E-ADMIN: backend not healthy, aborting');
    process.exit(2);
  }
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    page.on('console', (msg) => {
      try { log('PAGE:', msg.type(), msg.text()); } catch (e) {}
    });
    page.on('requestfailed', (req) => {
      try { log('REQUESTFAILED', req.url(), req.failure() && req.failure().errorText); } catch (e) {}
    });

    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(120000);
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 120000 });

    // fill form - use robust selectors matching current LoginPage
    const emailSel = 'input[type="email"]';
    const passSel = 'input[type="password"]';
    const submitSel = 'button[type="submit"]';
    await page.waitForSelector(emailSel, { timeout: 15000 });
    await page.fill(emailSel, 'admin@rms.com');
    await page.fill(passSel, 'admin123');
    await page.click(submitSel);

    // wait for admin layout to appear or URL to include /admin
    await page.waitForFunction(() => window.location.pathname.includes('/admin') || window.location.pathname.includes('/dashboard'), { timeout: 15000 });

    // check localStorage for token and auth flag
    const token = await page.evaluate(() => window.localStorage.getItem('rms_admin_token'));
    const authFlag = await page.evaluate(() => window.localStorage.getItem('rms_admin_auth'));
    log('localStorage token present:', Boolean(token));
    log('localStorage auth flag:', authFlag);

    if (!token) throw new Error('Token not saved to localStorage');

    // verify backend accepts token by calling a protected endpoint
    const resp = await page.evaluate(async (opts) => {
      const { api, t } = opts;
      try {
        const r = await fetch(`${api}/admin/dashboard`, { headers: { Authorization: `Bearer ${t}` } });
        const j = await r.json().catch(() => null);
        return { status: r.status, ok: r.ok, json: j };
      } catch (e) {
        return { error: String(e) };
      }
    }, { api: API, t: token });

    log('protected endpoint response:', resp && (resp.error || `${resp.status} ok=${resp.ok}`));

    await browser.close();
    console.log('E2E-ADMIN: PASS');
    process.exit(0);
  } catch (e) {
    console.error('E2E-ADMIN: FAIL', e && e.message ? e.message : e);
    process.exit(2);
  }
})();
