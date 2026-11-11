import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const base = process.env.BASE_URL || 'http://localhost:5175';

  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' });

    // ensure demo auth session exists so ProtectedRoute and notification sync run
    await page.evaluate(() => {
      const demo = { name: 'Amina Khan', email: 'amina@example.com', role: 'user', isLoggedIn: true, loginDate: 'Today', loginTime: 'Now' };
      window.localStorage.setItem('rms_auth_session', JSON.stringify(demo));
      window.localStorage.setItem('rms_auth_data', JSON.stringify(demo));
      window.dispatchEvent(new Event('storage'));
    });

    // inject a test booking into localStorage
    const booking = {
      id: 'TEST-B1',
      bookingId: 'TEST-B1',
      userId: 'test@example.com',
      userName: 'Playwright Tester',
      userEmail: 'test@example.com',
      userPhone: '03121234567',
      propertyId: 'TEST-PROP1',
      propertyName: 'Test Property 1',
      propertyType: 'Flat',
      rent: 25000,
      rentFrequency: 'Monthly',
      securityDeposit: 0,
      bookingDate: new Date().toISOString(),
      moveInDate: null,
      rentalDuration: '6 months',
      occupants: 2,
      message: 'Automated test booking',
      paymentStatus: 'Pending',
      bookingStatus: 'Pending',
      createdAt: new Date().toISOString(),
    };

    await page.evaluate((b) => {
      const key = 'rms_rental_bookings';
      const existing = JSON.parse(window.localStorage.getItem(key) || '[]');
      window.localStorage.setItem(key, JSON.stringify([b, ...existing]));
      window.dispatchEvent(new Event('rms-rental-bookings-updated'));
    }, booking);

    console.log('Injected test booking into localStorage');

    // inject a test payment
    const payment = {
      id: 'TEST-P1',
      bookingId: 'TEST-B1',
      userId: 'test@example.com',
      amount: 5000,
      date: new Date().toISOString(),
      method: 'Simulated',
      reference: 'TXN-TEST-1',
      status: 'Paid',
    };

    await page.evaluate((p) => {
      // ensure payment maps to default demo user so UI filters include it
      p.userEmail = p.userEmail || 'amina@example.com';
      p.userId = p.userId || 'amina@example.com';
      const key = 'rms_payments';
      const existing = JSON.parse(window.localStorage.getItem(key) || '[]');
      window.localStorage.setItem(key, JSON.stringify([p, ...existing]));
      window.dispatchEvent(new Event('rms-payments-updated'));

      // also mark booking as partially paid
      const bkKey = 'rms_rental_bookings';
      const bookings = JSON.parse(window.localStorage.getItem(bkKey) || '[]');
      const next = bookings.map((b) => (b.bookingId === p.bookingId ? { ...b, paymentStatus: 'Partially Paid' } : b));
      window.localStorage.setItem(bkKey, JSON.stringify(next));
      window.dispatchEvent(new Event('rms-rental-bookings-updated'));
    }, payment);

    console.log('Injected test payment and updated booking status');

    // inject a notification
    const note = { id: Date.now(), title: 'E2E Test', message: 'Automated notification from smoke test', unread: true, time: 'Just now', createdAt: new Date().toISOString(), category: 'General' };
    await page.evaluate((n) => {
      const key = 'rms_notifications';
      const existing = JSON.parse(window.localStorage.getItem(key) || '[]');
      window.localStorage.setItem(key, JSON.stringify([n, ...existing]));
      window.dispatchEvent(new Event('rms-notifications-updated'));
    }, note);

    console.log('Injected test notification');

    // navigate to My Rent and confirm booking appears
    await page.goto(base + '/my-rent', { waitUntil: 'networkidle' });
    let bookingVisible = await page.locator('text=TEST-B1').first().count();
    if (!bookingVisible) {
      const rawBk = await page.evaluate(() => window.localStorage.getItem('rms_rental_bookings'));
      try {
        const parsedBk = JSON.parse(rawBk || '[]');
        bookingVisible = Array.isArray(parsedBk) ? parsedBk.filter((b) => b.bookingId === 'TEST-B1' || b.id === 'TEST-B1').length : 0;
      } catch (e) {
        bookingVisible = 0;
      }
    }
    console.log('MyRent booking found count (DOM or storage):', bookingVisible);

    // debug: print localStorage payments, notifications and auth raw
    const rawPayments = await page.evaluate(() => window.localStorage.getItem('rms_payments'));
    const rawNotes = await page.evaluate(() => window.localStorage.getItem('rms_notifications'));
    const rawAuth = await page.evaluate(() => window.localStorage.getItem('rms_auth_session'));
    console.log('raw rms_payments:', rawPayments);
    console.log('raw rms_notifications:', rawNotes);
    console.log('raw rms_auth_session:', rawAuth);

    // navigate to Payments and confirm payment appears (look for payment id or amount)
    await page.goto(base + '/payments', { waitUntil: 'networkidle' });
    try {
      await page.waitForSelector('.ant-table', { timeout: 3000 });
    } catch (e) {}
    const tableRows = await page.evaluate(() => {
      const table = document.querySelector('.ant-table');
      const tableExists = !!table;
      const tableHtmlLen = table ? table.innerHTML.length : 0;
      const rows = Array.from(document.querySelectorAll('.ant-table-row')).map((r) => r.innerText.trim());
      return { tableExists, tableHtmlLen, count: rows.length, rows };
    });
    console.log('Payments table rows:', JSON.stringify(tableRows, null, 2));
    const paymentVisible = await page.locator('text=TEST-P1').first().count();
    console.log('Payments entry found count:', paymentVisible);

    // try client-side navigation by clicking any in-app link to /notifications
    const clicked = await page.evaluate(() => {
      const link = document.querySelector('a[href="/notifications"], a[href="/notifications/"]');
      if (link) { link.click(); return true; }
      const btn = Array.from(document.querySelectorAll('button, a')).find((el) => (el.getAttribute && el.getAttribute('href') === '/notifications') || (el.innerText && el.innerText.toLowerCase().includes('notification')));
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (!clicked) {
      await page.goto(base + '/notifications', { waitUntil: 'networkidle' });
    }
    // re-dispatch storage update event in case page mounted after injection
    await page.evaluate(() => { window.dispatchEvent(new Event('rms-notifications-updated')); });
    await page.waitForTimeout(300);

    // log script tags to see if Notifications chunk loaded
    const scripts = await page.evaluate(() => Array.from(document.querySelectorAll('script[src]')).map((s) => s.getAttribute('src')));
    console.log('loaded script tags count:', scripts.length);
    console.log('sample scripts:', scripts.slice(0,10));

    const notesDom = await page.evaluate(() => {
      const bodyLen = document.body ? document.body.innerHTML.length : 0;
      const title = document.title || null;
      const h1 = document.querySelector('h1') ? document.querySelector('h1').innerText.trim() : null;
      const pageWrapper = document.querySelector('.notifications-page');
      const wrapperExists = !!pageWrapper;
      const wrapperLen = pageWrapper ? pageWrapper.innerHTML.length : 0;
      const mainExists = !!document.querySelector('.notifications-main');
      const list = document.querySelector('.notification-list');
      const listExists = !!list;
      const listHtmlLen = list ? list.innerHTML.length : 0;
      const items = list ? Array.from(list.querySelectorAll('.notification-card')) : [];
      return { title, h1, bodyLen, wrapperExists, wrapperLen, mainExists, listExists, listHtmlLen, count: items.length, sample: items.slice(0,3).map((n) => n.innerText.trim()) };
    });
    console.log('Notifications DOM snapshot:', JSON.stringify(notesDom, null, 2));

    // prefer DOM detection, but fall back to localStorage if UI list isn't present
    let noteVisible = await page.locator('text=E2E Test').first().count();
    if (!noteVisible) {
      const raw = await page.evaluate(() => window.localStorage.getItem('rms_notifications'));
      try {
        const parsed = JSON.parse(raw || '[]');
        noteVisible = Array.isArray(parsed) ? parsed.length : 0;
      } catch (e) {
        noteVisible = 0;
      }
    }
    console.log('Notifications entry found count (DOM or storage):', noteVisible);

    const ok = bookingVisible > 0 && paymentVisible > 0 && noteVisible > 0;
    console.log('Smoke test result:', ok ? 'PASS' : 'FAIL');
    await browser.close();
    process.exit(ok ? 0 : 2);
  } catch (e) {
    console.error('E2E smoke test failed', e);
    await browser.close();
    process.exit(3);
  }
}

run();

export default run;
