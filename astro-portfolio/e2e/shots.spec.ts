import { test } from '@playwright/test';

import { PAGES } from './pages';

/**
 * Visual evidence for PRs — `pnpm shots` (skipped in normal e2e runs).
 * Writes full-page screenshots of every page and short interaction videos per device into
 * test-results/. Attach them to the PR (or the pr-media branch); never commit them.
 */
test.skip(!process.env.SHOTS, 'run with `pnpm shots`');
test.use({ video: 'on', reducedMotion: 'reduce' });

test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => sessionStorage.setItem('sl-booted', '1'));
});

test('pages', async ({ page }, info) => {
    for (const path of PAGES) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        // Hydrate visible-triggered islands so full-page shots aren't blank where they sit.
        await page.evaluate(async () => {
            for (let y = 0; y < document.documentElement.scrollHeight; y += 400) {
                window.scrollTo(0, y);
                await new Promise((r) => setTimeout(r, 60));
            }
            window.scrollTo(0, 0);
        });
        await page.waitForTimeout(400);
        const name = path.replace(/\W+/g, '_').replace(/^_|_$/g, '') || 'home';
        await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
    }
});

test('interactions', async ({ page, isMobile }) => {
    // Skill graph: hover/tap a few nodes, zoom, switch to the list view.
    await page.goto('/about/');
    await page.locator('.skill-graph').scrollIntoViewIfNeeded();
    await page
        .locator('astro-island[opts*="SkillGraph"]:not([ssr])')
        .waitFor({ state: 'attached' });
    if (isMobile) await page.getByRole('button', { name: /Graph/ }).click();
    const canvas = page.locator('.sg-canvas-wrap canvas');
    await canvas.scrollIntoViewIfNeeded();
    const c = (await canvas.boundingBox())!;
    for (const [fx, fy] of [
        [0.3, 0.3],
        [0.5, 0.5],
        [0.7, 0.6],
    ]) {
        const [x, y] = [c.x + c.width * fx, c.y + c.height * fy];
        if (isMobile) await page.touchscreen.tap(x, y);
        else await page.mouse.move(x, y, { steps: 12 });
        await page.waitForTimeout(500);
    }
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /List/ }).click();
    await page.waitForTimeout(600);
    // Terminal.
    await page.locator('.nav-terminal-btn').click();
    await page.waitForTimeout(1500);
    await page.keyboard.type('help', { delay: 60 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    await page.keyboard.press('Escape');
    // Mobile menu.
    if (isMobile) {
        await page.locator('.nav-toggle').click();
        await page.waitForTimeout(600);
        await page.locator('.nav-links').getByRole('link', { name: 'Projects' }).click();
        await page.waitForTimeout(800);
    }
});
