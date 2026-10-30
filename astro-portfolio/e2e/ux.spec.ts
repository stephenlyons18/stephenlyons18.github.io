import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { PAGES } from './pages';

test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => sessionStorage.setItem('sl-booted', '1'));
});

// ── Accessibility ────────────────────────────────────────────────────────────
for (const path of PAGES) {
    test(`${path} has no serious/critical axe violations (WCAG 2.2 AA)`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' }); // settle reveal animations
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            // Decorative, aria-hidden ANSI art (wall texture, title pieces, dividers): graphics, not text.
            .exclude('.ansi-wall')
            .exclude('pre.ansi')
            .analyze();
        const serious = results.violations
            .filter((v) => v.impact === 'serious' || v.impact === 'critical')
            .map((v) => `${v.id}: ${v.nodes.length}× ${v.nodes[0]?.target.join(' ')}`);
        expect(serious).toEqual([]);
    });
}

// ── Navigation ───────────────────────────────────────────────────────────────
test('header nav reaches every page', async ({ page, isMobile }) => {
    await page.goto('/');
    for (const [label, url] of [
        ['About', /\/about\//],
        ['Projects', /\/projects\//],
        ['Contact', /\/contact\//],
        ['Home', /\/$/],
    ] as const) {
        if (isMobile) {
            await page.locator('.nav-toggle').click();
            await expect(page.locator('.nav-links')).toHaveClass(/open/);
        }
        await page.locator('.nav-links').getByRole('link', { name: label }).click();
        await expect(page).toHaveURL(url);
    }
});

test('mobile menu: toggles, has 44px targets, and closes after navigating', async ({
    page,
    isMobile,
}) => {
    test.skip(!isMobile, 'hamburger only on phones');
    await page.goto('/');
    const toggle = page.locator('.nav-toggle');
    const box = (await toggle.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await toggle.click();
    await expect(page.locator('.nav-links')).toHaveClass(/open/);
    await page.locator('.nav-links').getByRole('link', { name: 'Projects' }).click();
    await expect(page).toHaveURL(/\/projects\//);
    await expect(page.locator('.nav-links')).not.toHaveClass(/open/);
});

test('keyboard: Tab reaches the nav, and focus is visible', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no hardware keyboard on phones');
    await page.goto('/about/');
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
    const outline = await focused.evaluate((el) => {
        const s = getComputedStyle(el);
        return s.outlineStyle !== 'none' || s.boxShadow !== 'none' || s.textShadow !== 'none';
    });
    expect(outline, 'focused element has a visible focus style').toBe(true);
});

// ── Motion ───────────────────────────────────────────────────────────────────
test('reduced motion: content is visible without animation, art is static', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const hidden = await page.$$eval(
        '.reveal',
        (els) => els.filter((e) => getComputedStyle(e).opacity !== '1').length,
    );
    expect(hidden).toBe(0);
    const running = await page.evaluate(
        () =>
            document
                .getAnimations()
                .filter(
                    (a) =>
                        a.playState === 'running' && a.effect?.getTiming().iterations === Infinity,
                ).length,
    );
    // Only the 1s blinking caret may loop forever.
    expect(running).toBeLessThanOrEqual(1);
});

test('no rAF loop runs while the page is idle (no background animation)', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(9000); // past the hero typing intro
    const callbacks = await page.evaluate(
        () =>
            new Promise<number>((resolve) => {
                let n = 0;
                const orig = window.requestAnimationFrame.bind(window);
                window.requestAnimationFrame = (cb) => {
                    n++;
                    return orig(cb);
                };
                setTimeout(() => resolve(n), 1000);
            }),
    );
    expect(callbacks, 'rAF callbacks scheduled in 1s of idle').toBeLessThanOrEqual(2);
});

// ── Touch vs keyboard ────────────────────────────────────────────────────────
test('keyboard-only hints show only where there is a keyboard', async ({ page, isMobile }) => {
    await page.goto('/contact/');
    const ctrlK = page.getByText('Ctrl+K', { exact: true }).first();
    if (isMobile) {
        await expect(ctrlK).toBeHidden();
        await expect(page.getByText('Tap the button below')).toBeVisible();
        // The pixel scrubber is the scrollbar on touch; the native one is hidden.
        expect(
            await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth),
        ).toBe('none');
    } else {
        await expect(ctrlK).toBeVisible();
        await expect(page.locator('.accessibility-btn')).toContainText('Accessibility'); // label shown above 1100px
    }
    // Either way, the terminal is one button away.
    await page.locator('.card [data-open-terminal]').click();
    await expect(page.locator('.terminal-overlay')).toHaveClass(/active/);
});

// ── Hero ─────────────────────────────────────────────────────────────────────
test('hero: name and subheader have real text, and the terminal sits below the buttons', async ({
    page,
}) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('Stephen Lyons');
    await expect(page.locator('.hero-sub .ansi-title__text')).toHaveText('Cyber Security Engineer');
    await expect(page.locator('.hero-sub svg').first()).toHaveAttribute('aria-hidden', 'true');
    const cta = (await page.locator('.hero-cta').boundingBox())!;
    const term = (await page.locator('.hero-terminal').boundingBox())!;
    expect(term.y).toBeGreaterThan(cta.y + cta.height);
});
