import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { PAGES } from './pages';

// Heading style + colours (R30): both styles are in the page; <html data-title-style> and
// <html data-theme> pick, set by the a11y menu or the terminal, saved, applied before first paint.

test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => sessionStorage.setItem('sl-booted', '1'));
});

const html = (page: Page) => page.locator('html');
/** The style of every visible title piece on the page. */
const visibleStyles = (page: Page) =>
    page.$$eval('.ansi-title:not(.ansi-title--deco) svg.ansi-svg', (els) => [
        ...new Set(
            els.filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.dataset['piece']),
        ),
    ]);
const fillOf = (page: Page) =>
    page.$eval(
        '.ansi-title:not(.ansi-title--deco) .ansi-title__set:not([style*="none"]) svg .p-f0',
        (el) => getComputedStyle(el).fill,
    );
async function openMenu(page: Page) {
    await page.locator('.a11y-btn').click();
    await expect(page.locator('#a11y-menu')).toBeVisible();
}
const option = (page: Page, name: string) =>
    page.locator('#a11y-menu label', { hasText: new RegExp(`^${name}$`) });

for (const style of ['bubble', 'wild'] as const)
    test(`${style}: every title shows only that style, fits its box, no overflow`, async ({
        page,
    }) => {
        if (style === 'wild')
            await page.addInitScript(() => localStorage.setItem('sl-title-style', 'wild'));
        for (const path of PAGES) {
            await page.goto(path);
            expect(await visibleStyles(page), path).toEqual([style]);
            const over = await page.$$eval('.ansi-title svg.ansi-svg', (els) =>
                els
                    .filter((e) => e.getBoundingClientRect().width > 0)
                    .map(
                        (e) =>
                            e.getBoundingClientRect().width -
                            (e.closest('.ansi-title') as HTMLElement).clientWidth,
                    ),
            );
            for (const o of over)
                expect(o, `${path} art wider than its box`).toBeLessThanOrEqual(1);
            const overflow = await page.evaluate(
                () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
            );
            expect(overflow, `${path} horizontal overflow`).toBeLessThanOrEqual(0);
        }
    });

test('the menu switches style and colours at once, previews, and both persist', async ({
    page,
}) => {
    await page.goto('/about/');
    const before = await fillOf(page);
    await openMenu(page);
    await expect(page.locator('#a11y-menu [data-title-style-opt][value="bubble"]')).toBeChecked();
    await expect(page.locator('#a11y-menu [data-theme-opt][value="wildstyle"]')).toBeChecked();

    // Style: applied the moment it is picked.
    await option(page, 'Wildstyle').click();
    await expect(html(page)).toHaveAttribute('data-title-style', 'wild');
    expect(await visibleStyles(page)).toEqual(['wild']);

    // Colours: hovering previews in the box only; picking applies to the page.
    const swatch = page.locator('.a11y-preview__swatch');
    const box0 = await swatch.evaluate((e) => getComputedStyle(e).backgroundImage);
    await option(page, 'Phosphor').hover();
    await expect
        .poll(() => swatch.evaluate((e) => getComputedStyle(e).backgroundImage))
        .not.toBe(box0);
    await expect(html(page)).not.toHaveAttribute('data-theme', /.+/);
    await option(page, 'Sunset').click();
    await expect(html(page)).toHaveAttribute('data-theme', 'sunset');
    await expect(page.locator('[data-a11y-preview-name]')).toHaveText('Sunset · Wildstyle');
    expect(await fillOf(page)).not.toBe(before);

    // Saved, and applied before first paint on the next page.
    await page.goto('/projects/');
    expect(
        await page.evaluate(() => [
            document.documentElement.getAttribute('data-title-style'),
            document.documentElement.getAttribute('data-theme'),
        ]),
    ).toEqual(['wild', 'sunset']);
    expect(await visibleStyles(page)).toEqual(['wild']);

    // Reset puts both back.
    await openMenu(page);
    await page.locator('[data-a11y-reset]').click();
    await expect(html(page)).not.toHaveAttribute('data-title-style', /.+/);
    await expect(html(page)).not.toHaveAttribute('data-theme', /.+/);
});

test('the terminal sets the same choices, and the menu follows', async ({ page }) => {
    await page.goto('/');
    await page.locator('.nav-terminal-btn').click();
    const input = page.locator('#terminal-input');
    await input.fill('style wildstyle');
    await input.press('Enter');
    await input.fill('theme mint');
    await input.press('Enter');
    await expect(page.locator('#terminal-body')).toContainText('Theme switched to Mint.');
    await input.press('Escape');
    await expect(html(page)).toHaveAttribute('data-title-style', 'wild');
    await expect(html(page)).toHaveAttribute('data-theme', 'bubble');
    await openMenu(page);
    await expect(page.locator('#a11y-menu [data-title-style-opt][value="wild"]')).toBeChecked();
    await expect(page.locator('#a11y-menu [data-theme-opt][value="bubble"]')).toBeChecked();
});

test('wildstyle titles pass axe on every page; the new menu controls are ≥ 44px', async ({
    page,
}) => {
    test.setTimeout(60_000);
    // Settle reveal animations first (as ux.spec does): mid-fade, axe measures blended colours
    // (the hero terminal's title read under 4.5:1 on a slower CI runner; 4.85:1 at rest).
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('sl-title-style', 'wild'));
    for (const path of PAGES) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        // The art is aria-hidden decoration (its real headings are scanned); walking its thousands
        // of path nodes made this take minutes.
        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            .exclude('.ansi-svg')
            .exclude('.wall-piece')
            .analyze();
        const serious = results.violations
            .filter((v) => v.impact === 'serious' || v.impact === 'critical')
            .map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`);
        expect(serious, path).toEqual([]);
    }
    await openMenu(page);
    for (const tile of await page.locator('.a11y-seg__opt, .a11y-theme').all())
        expect(Math.round((await tile.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
});
