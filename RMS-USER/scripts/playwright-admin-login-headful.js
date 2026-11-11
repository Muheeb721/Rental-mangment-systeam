import { chromium } from 'playwright';

const API = process.env.API_BASE || 'http://localhost:5000/api';
const BASE = process.env.BASE_URL || 'http://localhost:5173';

const log = (...args) => console.log('[E2E-ADMIN-HF]', ...args);

(async () => {
  try {
    const browser = await chromium.launch({ headless: false, slowMo: 75 });
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

    const emailSel = 'input[placeholder="Enter your email"]' ;
    const passSel = 'input[placeholder="Enter your password"]' ;
    const submitSel = 'button[type="submit"]';
    await page.waitForSelector(emailSel, { timeout: 15000 });
    await page.fill(emailSel, 'admin@rms.com');
    await page.fill(passSel, 'admin123');
    await page.click(submitSel);

    await page.waitForFunction(() => window.location.pathname.includes('/admin') || window.location.pathname.includes('/dashboard'), { timeout: 15000 });

    // dump localStorage values for inspection
    const dump = await page.evaluate(() => ({
      token: window.localStorage.getItem('rms_admin_token'),
      flag: window.localStorage.getItem('rms_admin_auth'),
      session: window.localStorage.getItem('rms_auth_session')
    }));

    log('localStorage dump:', dump);

    // take a screenshot for the user
    await page.screenshot({ path: 'RMS/scripts/e2e-headful-screenshot.png', fullPage: true });

    // verify protected endpoint
    const resp = await page.evaluate(async (opts) => {
      const { api, t } = opts;
      try {
        const r = await fetch(`${api}/admin/dashboard`, { headers: { Authorization: `Bearer ${t}` } });
        const j = await r.json().catch(() => null);
        return { status: r.status, ok: r.ok, json: j };
      } catch (e) {
        return { error: String(e) };
      }
    }, { api: API, t: dump.token });

    log('protected endpoint response:', resp && (resp.error || `${resp.status} ok=${resp.ok}`));

    console.log('E2E-ADMIN-HF: COMPLETE');

    // keep browser open briefly so user can view it
    await new Promise((r) => setTimeout(r, 3000));
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error('E2E-ADMIN-HF: FAIL', e && e.message ? e.message : e);
    process.exit(2);
  }
})();
