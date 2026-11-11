import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:5174';
const API = process.env.API_BASE || 'http://localhost:5000/api';

(async () => {
  // wait briefly for backend to be healthy
  const max = 20; let healthy = false;
  for (let i = 0; i < max; i += 1) {
    try {
      const r = await fetch(`${API}/health`);
      if (r && r.ok) { healthy = true; break; }
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!healthy) {
    console.error('Backend not healthy'); process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
    page.on('console', (msg) => console.log('PAGE_CONSOLE:', msg.type(), msg.text()));
    page.on('pageerror', (err) => console.log('PAGE_ERROR:', err && err.message ? err.message : err));
    // debug: list inputs present after navigation
    const inputs = await page.evaluate(() => Array.from(document.querySelectorAll('input')).map(i => ({ name: i.getAttribute('name'), type: i.type, placeholder: i.getAttribute('placeholder'), class: i.className })));
    console.log('PAGE_INPUTS:', JSON.stringify(inputs));
    await page.waitForSelector('input[name="email"]', { timeout: 15000 });
    await page.waitForSelector('input[name="password"]', { timeout: 15000 });
    await page.fill('input[name="email"]', 'admin@rms.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // wait for a short while for navigation/actions
    await page.waitForTimeout(1500);

    const token = await page.evaluate(() => window.__RMS_AUTH_TOKEN || window.__rms_inmemory_token || null);
    console.log('TOKEN_PRESENT:', Boolean(token));
    if (!token) {
      console.error('No token found on window after login');
      await browser.close();
      process.exit(2);
    }

    // also check authenticated protected endpoint using token
    const resp = await page.evaluate(async (api, t) => {
      try {
        const r = await fetch(`${api}/admin/activity`, { method: 'GET', headers: { Authorization: `Bearer ${t}` } });
        const j = await r.json().catch(() => null);
        return { status: r.status, ok: r.ok, json: j };
      } catch (e) { return { error: String(e) }; }
    }, API, token);

    console.log('PROTECTED_CHECK:', resp && (resp.error ? resp.error : `${resp.status} ok=${resp.ok}`));
    await browser.close();
    process.exit(resp && resp.ok ? 0 : 3);
  } catch (e) {
    console.error('E2E LOGIN CHECK FAILED', e);
    await browser.close();
    process.exit(4);
  }
})();
