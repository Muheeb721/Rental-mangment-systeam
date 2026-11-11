import { chromium } from 'playwright';

const url = 'http://localhost:5176/';
const viewports = [
  { w: 320, h: 800 },
  { w: 375, h: 800 },
  { w: 390, h: 800 },
  { w: 430, h: 900 },
  { w: 768, h: 900 },
  { w: 1024, h: 900 },
  { w: 1280, h: 900 },
  { w: 1440, h: 900 },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const results = [];
  for (const vp of viewports) {
    const { w, h } = vp;
    await page.setViewportSize({ width: w, height: h });
    const tag = `${w}x${h}`;
    try {
      // Retry navigation up to twice in case of transient aborts
      for (let attempt=0; attempt<2; attempt++){
        try{
          await page.goto(url, { waitUntil: 'networkidle' });
          break;
        }catch(e){ if (attempt===1) throw e; }
      }
      // wait for hero or legacy hero-card to appear
      try{ await page.waitForSelector('.hr-hero, .hero-card', { timeout: 3000 }); }catch(e){}
      await page.waitForTimeout(300);

      // Basic checks
      const hasSidebar = await page.$('.rms-sidebar') !== null;
      const hasTopbar = await page.$('.topbar') !== null; // optional
      const heroExists = await page.$('.hr-hero, .hero-card') !== null;
      const searchExists = await page.$('.hr-search-card') !== null;
      const propertyImgs = await page.$$('.property-card img, .property-card > img');

      // No horizontal scroll
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 5;
      });

      // Hero image visible and reasonable height
      const heroImageInfo = await page.evaluate(() => {
        const el = document.querySelector('.hr-image') || document.querySelector('.hero-illustration img') || document.querySelector('.property-card img');
        if (!el) return { present: false };
        const r = el.getBoundingClientRect();
        return { present: true, w: Math.round(r.width), h: Math.round(r.height), inViewport: r.top < window.innerHeight && r.bottom > 0 };
      });

      // Search card inside viewport
      const searchInfo = await page.evaluate(() => {
        const el = document.querySelector('.hr-search-card');
        if (!el) return { present: false };
        const r = el.getBoundingClientRect();
        return { present: true, left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) };
      });

      // Card image heights stats
      const imgHeights = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('.property-card img'));
        return imgs.map(i => i.getBoundingClientRect().height).slice(0, 12);
      });

      // Save screenshot
      await page.screenshot({ path: `scripts/screenshots/home-${tag}.png`, fullPage: false });

      results.push({ tag, hasSidebar, hasTopbar, heroExists, searchExists, hasHorizontalScroll, heroImageInfo, searchInfo, imgHeights });
      console.log(tag, 'OK', { hasHorizontalScroll, heroExists, searchExists });
    } catch (e) {
      console.error(tag, 'ERROR', e.message);
      results.push({ tag, error: e.message });
    }
  }

  await browser.close();
  // print summary
  console.log('\nResponsive test summary:\n');
  results.forEach(r => console.log(JSON.stringify(r, null, 2)));
  // exit with code 0
  process.exit(0);
})();
