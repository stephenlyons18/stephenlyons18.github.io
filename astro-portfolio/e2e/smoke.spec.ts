import { expect, test } from '@playwright/test';

export const PAGES = ['/', '/about/', '/projects/', '/contact/'];

test.beforeEach(async ({ context }) => {
    // Skip the once-per-session boot animation so tests start on the real page.
    await context.addInitScript(() => sessionStorage.setItem('sl-booted', '1'));
});

for (const path of PAGES) {
    test(`${path} loads cleanly`, async ({ page }) => {
        const problems: string[] = [];
        page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
        page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
        page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()}`));
        page.on('response', (r) => r.status() >= 400 && problems.push(`${r.status()}: ${r.url()}`));

        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await expect(page.locator('h1').first()).toBeAttached();

        // Nothing may push the page sideways at any viewport.
        const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, 'horizontal overflow (px)').toBeLessThanOrEqual(0);
        expect(problems).toEqual([]);
    });
}
