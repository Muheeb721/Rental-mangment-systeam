import { chromium, devices } from 'playwright';
import fs from 'fs';

const BASE = process.env.BASE_URL || 'http://localhost:5174';
const API = process.env.API_BASE || 'http://localhost:5000/api';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();

  page.on('console', (msg) => console.log('PAGE_CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('PAGE_ERROR:', err && err.message ? err.message : err));
  page.on('requestfailed', (req) => console.log('REQUEST_FAILED:', req.url(), req.failure() && req.failure().errorText));

  try {
    // wait for backend health
    for (let i = 0; i < 20; i++) {
      try { const h = await fetch(`${API}/health`); if (h && h.ok) break; } catch (e) {}
      await new Promise((r) => setTimeout(r, 300));
    }

    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1000);

    // try various selectors
    const selCandidates = [
      'input[name="email"]',
      'input[placeholder="Enter your email"]',
      'input[type="email"]',
      'input.input',
    ];

    let found = null;
    for (const s of selCandidates) {
      try {
        const ok = await page.$(s);
        if (ok) { found = s; break; }
      } catch (e) {}
    }

    console.log('SELECTOR_FOUND:', found);
    if (!found) {
      const inputs = await page.evaluate(() => Array.from(document.querySelectorAll('input')).map(i => ({ name: i.getAttribute('name'), type: i.type, placeholder: i.getAttribute('placeholder'), class: i.className }))); 
      console.log('PAGE_INPUTS:', JSON.stringify(inputs));
    } else {
      await page.fill(found, 'admin@rms.com');
      // pick password similarly
      const pwdSel = 'input[name="password"]' ;
      await page.fill(pwdSel, 'admin123').catch(async () => {
        const alt = 'input[placeholder="Enter your password"]';
        await page.fill(alt, 'admin123');
      });

      await page.click('button[type="submit"]').catch(() => {});
    }

    await page.waitForTimeout(2000);

    const token = await page.evaluate(() => window.__RMS_AUTH_TOKEN || window.__rms_inmemory_token || null);
    const ls = await page.evaluate(() => ({ auth_session: window.localStorage.getItem('rms_auth_session'), auth_data: window.localStorage.getItem('rms_auth_data'), rms_token: window.localStorage.getItem('rms_admin_token') }));
    console.log('TOKEN_PRESENT:', Boolean(token));
    console.log('LOCALSTORAGE_SNAPSHOT:', ls);

    const tracePath = 'RMS/scripts/playwright-trace.zip';
    await context.tracing.stop({ path: tracePath });
    console.log('Trace saved to', tracePath);

    await browser.close();
    // write a small report
    fs.writeFileSync('RMS/scripts/playwright-trace-report.json', JSON.stringify({ token: !!token, tokenValue: token ? String(token).slice(0,20) : null, ls }, null, 2));
    console.log('Report written to RMS/scripts/playwright-trace-report.json');
    process.exit(0);
  } catch (e) {
    console.error('TRACE_RUN_ERROR', e && e.message ? e.message : e);
    try { await context.tracing.stop({ path: 'RMS/scripts/playwright-trace.zip' }); } catch (e) {}
    await browser.close();
    process.exit(2);
  }
})();
