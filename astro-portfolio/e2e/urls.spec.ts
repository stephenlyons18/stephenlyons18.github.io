import { expect, test } from '@playwright/test';

import { PAGES } from './pages';

// Navigation always lands on clean directory URLs (/about/), never …/index.html or *.html.

test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => sessionStorage.setItem('sl-booted', '1'));
});

for (const path of PAGES) {
    test(`${path}: every internal link is a clean URL`, async ({ page }) => {
        await page.goto(path);
        const bad = await page.$$eval('a[href]', (links) =>
            links
                .map((a) => a as HTMLAnchorElement)
                .filter((a) => a.origin === location.origin && /\.html?$/.test(a.pathname))
                .map((a) => a.getAttribute('href')),
        );
        expect(bad).toEqual([]);
    });
}

test('nav lands on a clean URL and marks the page active', async ({ page, isMobile }) => {
    await page.goto('/');
    if (isMobile) await page.locator('.nav-toggle').click();
    await page.locator('.nav-links a', { hasText: 'Projects' }).click();
    await page.waitForURL('**/projects/');
    expect(new URL(page.url()).pathname).toBe('/projects/');
    await expect(page.locator('.nav-links a.active')).toHaveText(/projects/i);
});

test('terminal cd lands on a clean URL', async ({ page }) => {
    await page.goto('/');
    await page.locator('.nav-terminal-btn').click();
    const input = page.locator('#terminal-input');
    await input.fill('cd contact');
    await input.press('Enter');
    await page.waitForURL('**/contact/');
    expect(new URL(page.url()).pathname).toBe('/contact/');
});

test('the 404 page keeps its styles and links at a nested missing path', async ({ page }) => {
    // GitHub Pages serves 404.html at the requested URL; `astro preview` does the same.
    await page.goto('/no/such/page/');
    await expect(page.locator('.site-header')).toHaveCSS('position', 'fixed');
    const home = await page
        .locator('.nav-links a', { hasText: 'Home' })
        .evaluate((a) => (a as HTMLAnchorElement).pathname);
    expect(home).toBe('/');
});

test('the built site works from disk: the wall tile loads over file:// (R43)', async ({ page }) => {
    const dist = new URL('../dist/', import.meta.url);
    for (const [file, theme] of [
        ['index.html', null],
        ['about/index.html', 'sunset'],
    ] as const) {
        if (theme) await page.addInitScript((t) => localStorage.setItem('sl-theme', t), theme);
        await page.goto(new URL(file, dist).href);
        const src = await page.evaluate(() => {
            const bg = getComputedStyle(document.querySelector('.ansi-wall')!).backgroundImage;
            return bg.match(/url\("?(.*?)"?\)/)?.[1] ?? bg;
        });
        expect(src, file).toMatch(new RegExp(`^file://.*/art/wall-${theme ?? 'wildstyle'}\\.png$`));
        // The file is there: it decodes as an image.
        const loaded = await page.evaluate(
            (u) =>
                new Promise<boolean>((done) => {
                    const img = new Image();
                    img.onload = () => done(img.naturalWidth > 0);
                    img.onerror = () => done(false);
                    img.src = u;
                }),
            src,
        );
        expect(loaded, src).toBe(true);
    }
});
