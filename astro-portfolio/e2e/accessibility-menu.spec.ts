import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { PAGES } from './pages';

// The accessibility menu (Header.astro popover + site.ts initAccessibilityMenu + BaseLayout head script).

test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => sessionStorage.setItem('sl-booted', '1'));
});

const KEYS = ['plain', 'motion', 'font', 'large', 'contrast', 'wall'] as const;
const menu = (page: Page) => page.locator('#accessibility-menu');
const sw = (page: Page, key: string) =>
    page.locator(`#accessibility-menu input[data-accessibility="${key}"]`);

async function openMenu(page: Page) {
    await page.locator('.accessibility-btn').click();
    await expect(menu(page)).toBeVisible();
}

test('menu opens from the header, toggles each mode, and persists across pages', async ({
    page,
}) => {
    await page.goto('/about/');
    await openMenu(page);
    for (const key of KEYS) {
        await sw(page, key).locator('xpath=ancestor::label').click();
        await expect(page.locator('html')).toHaveAttribute(`data-accessibility-${key}`, '');
    }
    await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', '');
    // Persisted, and applied before first paint on the next page (head script).
    await page.goto('/projects/');
    const attrs = await page.evaluate(() =>
        [...document.documentElement.attributes].map((a) => a.name),
    );
    for (const key of KEYS) expect(attrs).toContain(`data-accessibility-${key}`);
    await openMenu(page);
    for (const key of KEYS) await expect(sw(page, key)).toBeChecked();
    // Reset clears everything.
    await page.locator('[data-accessibility-reset]').click();
    for (const key of KEYS)
        await expect(page.locator('html')).not.toHaveAttribute(`data-accessibility-${key}`, '');
    await page.reload();
    expect(await page.evaluate(() => localStorage.getItem('sl-accessibility'))).toBeNull();
});

test('menu is keyboard operable: Space toggles, Escape closes and returns focus', async ({
    page,
    isMobile,
}) => {
    test.skip(isMobile, 'no hardware keyboard on phones');
    await page.goto('/');
    await page.locator('.accessibility-btn').focus();
    await page.keyboard.press('Enter');
    await expect(menu(page)).toBeVisible();
    await sw(page, 'plain').focus();
    await page.keyboard.press('Space');
    await expect(page.locator('html')).toHaveAttribute('data-accessibility-plain', '');
    await page.keyboard.press('Escape');
    await expect(menu(page)).toBeHidden();
    await expect(page.locator('.accessibility-btn')).toBeFocused();
});

test('settings saved under the old key carry over, once, before first paint (R49)', async ({
    page,
}) => {
    // Only on the first load: a later load must not bring the old key back.
    await page.addInitScript(() => {
        if (sessionStorage.getItem('seeded')) return;
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('sl-a11y', '{"plain":true,"wall":true}');
    });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-accessibility-plain', '');
    await expect(page.locator('html')).toHaveAttribute('data-accessibility-wall', '');
    expect(
        await page.evaluate(() => [
            localStorage.getItem('sl-accessibility'),
            localStorage.getItem('sl-a11y'),
        ]),
    ).toEqual(['{"plain":true,"wall":true}', null]);
    // The new key wins from now on.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-accessibility-plain', '');
});

test('plain headings: art hidden, a real visible heading in its place, no overflow', async ({
    page,
}) => {
    await page.addInitScript(() => localStorage.setItem('sl-accessibility', '{"plain":true}'));
    for (const path of PAGES) {
        await page.goto(path);
        const title = page.locator('.ansi-title:not(.ansi-title--deco)').first();
        await expect(title.locator('svg').first()).toBeHidden();
        const heading = title.locator('.ansi-title__text');
        await expect(heading).toBeVisible();
        expect((await heading.boundingBox())!.height).toBeGreaterThan(16);
        const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${path} horizontal overflow`).toBeLessThanOrEqual(0);
    }
});

test('every mode at once still passes axe (WCAG 2.2 AA) on every page', async ({ page }) => {
    test.setTimeout(60_000);
    await page.addInitScript(() =>
        localStorage.setItem(
            'sl-accessibility',
            JSON.stringify({ plain: true, motion: true, large: true, contrast: true, wall: true }),
        ),
    );
    for (const path of PAGES) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            // The art is aria-hidden decoration (its real headings are scanned); walking its path
            // nodes is most of the time.
            .exclude('pre.ansi')
            .exclude('.ansi-svg')
            .exclude('.wall-piece')
            .analyze();
        const serious = results.violations
            .filter((v) => v.impact === 'serious' || v.impact === 'critical')
            .map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`);
        expect(serious, path).toEqual([]);
    }
});

test('the open menu passes axe, and its switches are ≥ 44px tall', async ({ page }) => {
    await page.goto('/');
    await openMenu(page);
    const results = await new AxeBuilder({ page })
        .include('#accessibility-menu')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
    expect(
        results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
    for (const label of await menu(page).locator('.accessibility-switch').all())
        expect((await label.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test('reduce motion from the menu: the hero terminal prints at once', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sl-accessibility', '{"motion":true}'));
    await page.goto('/');
    // The intro is done when its input row replaces the typing cursor.
    await expect(page.locator('.hero-terminal__input')).toBeAttached({ timeout: 1500 });
});

test('readable font swaps the pixel faces for a sans-serif', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sl-accessibility', '{"font":true}'));
    await page.goto('/about/');
    const fam = await page.evaluate(() => ({
        body: getComputedStyle(document.body).fontFamily,
        title: getComputedStyle(document.querySelector('.section-title')!).fontFamily,
    }));
    expect(fam.body).not.toMatch(/Departure|Press Start/);
    expect(fam.title).not.toMatch(/Departure|Press Start/);
});
