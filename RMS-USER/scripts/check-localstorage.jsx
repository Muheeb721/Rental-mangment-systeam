import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const base = process.env.BASE_URL || 'http://localhost:5175';
  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(() => {
      const bookings = JSON.parse(localStorage.getItem('rms_rental_bookings') || '[]');
      const payments = JSON.parse(localStorage.getItem('rms_payments') || '[]');
      const notes = JSON.parse(localStorage.getItem('rms_notifications') || '[]');
      return { bookingsCount: bookings.length, paymentsCount: payments.length, notificationsCount: notes.length, bookings: bookings.slice(0,3), payments: payments.slice(0,3), notifications: notes.slice(0,3) };
    });
    console.log('LocalStorage summary:', JSON.stringify(result, null, 2));
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error('Failed to read localStorage via Playwright', e);
    await browser.close();
    process.exit(2);
  }
}

run();

export default run;
