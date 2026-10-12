import { chromium } from '@playwright/test';
const [,, path, out, w, h, y='0', dpr='1', prefs=''] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr, isMobile: +w < 500, hasTouch: +w < 500 });
await p.addInitScript((prefs) => { sessionStorage.setItem('sl-booted', '1'); if (prefs) localStorage.setItem('sl-a11y', prefs); }, prefs);
await p.goto('http://localhost:4321' + path, { waitUntil: 'networkidle' });
await p.evaluate((y) => { document.documentElement.style.scrollBehavior='auto'; window.scrollTo(0, +y); }, y);
await p.waitForTimeout(1500);
if (out.includes('menu')) { await p.locator('.a11y-btn').click(); await p.waitForTimeout(300); }
await p.screenshot({ path: out, fullPage: y === 'full' });
await b.close();
