import { chromium } from 'playwright';

const API = process.env.API_BASE || 'http://localhost:5000/api';
const BASE = process.env.BASE_URL || 'http://localhost:5175';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHealth() {
  for (let i = 0; i < 30; i += 1) {
    try {
      const response = await fetch(`${API}/health`);
      if (response && response.ok) return true;
    } catch (e) {
      // retry
    }
    await sleep(500);
  }
  return false;
}

async function registerUser(email, password) {
  const response = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Live User',
      email,
      password,
      phone: '+923001234567',
    }),
  });

  const json = await response.json();
  if (!response.ok || !json?.success) {
    throw new Error(json?.message || 'Registration failed');
  }

  return json;
}

async function main() {
  const healthy = await waitForHealth();
  if (!healthy) {
    console.error('USER_E2E: backend not healthy');
    process.exit(2);
  }

  const email = `liveuser${Date.now()}@example.com`;
  const password = 'Password123!';

  try {
    const registration = await registerUser(email, password);
    console.log('USER_E2E: registered', email, 'token', Boolean(registration?.data?.token));

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);

    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[placeholder="Enter your email"]', { timeout: 20000 });
    await page.fill('input[placeholder="Enter your email"]', email);
    await page.fill('input[placeholder="Enter your password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForFunction(
      () => !!window.localStorage.getItem('rms_token') && !!window.localStorage.getItem('rms_auth_session'),
      { timeout: 30000 }
    );

    const token = await page.evaluate(() => window.localStorage.getItem('rms_token'));
    const session = await page.evaluate(() => window.localStorage.getItem('rms_auth_session'));
    const currentUrl = page.url();

    console.log('USER_E2E: currentUrl', currentUrl);
    console.log('USER_E2E: tokenPresent', Boolean(token));
    console.log('USER_E2E: sessionPresent', Boolean(session));

    const redirectOk = currentUrl.includes('/') && !currentUrl.includes('/login');
    console.log('USER_E2E: redirectOk', redirectOk);

    await browser.close();
    process.exit(redirectOk && Boolean(token) && Boolean(session) ? 0 : 2);
  } catch (error) {
    console.error('USER_E2E: failed', error && error.message ? error.message : error);
    process.exit(3);
  }
}

main();
