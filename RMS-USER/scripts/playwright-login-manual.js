import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:5174';
const API = process.env.API_BASE || 'http://localhost:5000/api';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1500);

    // screenshot initial
    await page.screenshot({ path: 'RMS/scripts/screenshot-before.png', fullPage: true });

    const emailSel = 'input[placeholder="Enter your email"]';
    const passSel = 'input[placeholder="Enter your password"]';
    await page.waitForSelector(emailSel, { timeout: 15000 });
    await page.waitForSelector(passSel, { timeout: 15000 });

    await page.fill(emailSel, 'admin@rms.com');
    await page.fill(passSel, 'admin123');

    await page.click('button[type="submit"]');

    // wait for possible navigation and token set
    await page.waitForTimeout(2000);

    // screenshot after
    await page.screenshot({ path: 'RMS/scripts/screenshot-after.png', fullPage: true });

    const token = await page.evaluate(() => window.__RMS_AUTH_TOKEN || window.__rms_inmemory_token || null);
    console.log('TOKEN_PRESENT:', Boolean(token));
    if (token) console.log('TOKEN_LEN:', token.length || 0);

    await browser.close();
    process.exit(token ? 0 : 2);
  } catch (e) {
    console.error('MANUAL PLAYWRIGHT ERROR', e && e.message ? e.message : e);
    await browser.close();
    process.exit(3);
  }
})();
