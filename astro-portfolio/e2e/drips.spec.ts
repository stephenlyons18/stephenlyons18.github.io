import { expect, test, type Page } from '@playwright/test';

import { PAGES } from './pages';

// Paint drips (AnsiDrips.astro): runs of drips that pour out on hover/focus (CSS, global.css
// .drip-run), plus fx.ts's taps on touch and tucking dividers below the fold.

test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => sessionStorage.setItem('sl-booted', '1'));
});

const fxLoaded = (page: Page) =>
    page.evaluate(() =>
        performance.getEntriesByType('resource').some((r) => /fx\.js/.test(r.name)),
    );

test('drips are decorative: aria-hidden, never take the pointer, never overlap another card', async ({
    page,
}) => {
    for (const path of PAGES) {
        await page.goto(path);
        for (const d of await page.locator('[data-drips]').all()) {
            await expect(d).toHaveAttribute('aria-hidden', 'true');
            expect(await d.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
        }
        const hits = await page.evaluate(() => {
            const bad: string[] = [];
            const cards = [...document.querySelectorAll('.card')];
            for (const strip of document.querySelectorAll('.card-drips')) {
                const own = strip.closest('.card');
                const r = strip.getBoundingClientRect();
                for (const c of cards) {
                    if (c === own) continue;
                    const o = c.getBoundingClientRect();
                    if (
                        r.left < o.right &&
                        o.left < r.right &&
                        r.top < o.bottom &&
                        o.top < r.bottom
                    )
                        bad.push(`${own?.querySelector('.card__title')?.textContent?.trim()}`);
                }
            }
            return bad;
        });
        expect(hits, `${path}: card drips overlapping another card`).toEqual([]);
    }
});

/** Vertical offset (px) of a strip's first run: −height when tucked away, 0 when fully out. */
const runY = (page: Page, sel: string) =>
    page
        .locator(`${sel} .drip-run`)
        .first()
        .evaluate((el) => ({
            y: new DOMMatrixReadOnly(getComputedStyle(el).transform).m42,
            h: el.getBoundingClientRect().height,
            visible: getComputedStyle(el).visibility === 'visible',
        }));

test('a strip animates as a few run layers, never one animation per drip', async ({ page }) => {
    await page.goto('/projects/');
    const counts = await page.evaluate(() =>
        [...document.querySelectorAll('[data-drips]')].map((s) => [
            s.querySelectorAll('.drip-run').length,
            s.querySelectorAll('.drip').length,
        ]),
    );
    for (const [runs, drips] of counts) {
        expect(runs).toBeLessThanOrEqual(4);
        expect(drips).toBeGreaterThan(runs!);
    }
    // No falling drops or splats: paint only runs down.
    expect(await page.locator('.drip__drop').count()).toBe(0);
});

test('divider drips hang halfway out, and all run out together on hover (or a tap)', async ({
    page,
    isMobile,
}) => {
    await page.goto('/about/');
    await expect.poll(() => fxLoaded(page), { timeout: 5000 }).toBe(true);
    const divider = page.locator('.ansi-divider').first();
    await divider.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
    const rest = await runY(page, '.ansi-divider');
    expect(rest.visible).toBe(true);
    expect(rest.y).toBeLessThan(-rest.h * 0.3);
    expect(rest.y).toBeGreaterThan(-rest.h * 0.6);
    const box = (await divider.boundingBox())!;
    if (isMobile) await page.touchscreen.tap(box.x + box.width / 2, box.y + 3);
    else await page.mouse.move(box.x + box.width / 2, box.y + 3);
    // Every run is moving out at once (no per-drip pokes).
    await expect
        .poll(
            () =>
                divider.evaluate((el) =>
                    [...el.querySelectorAll('.drip-run')].every((r) => r.getAnimations().length),
                ),
            { timeout: 1000 },
        )
        .toBe(true);
    await expect
        .poll(async () => (await runY(page, '.ansi-divider')).y, { timeout: 4000 })
        .toBeCloseTo(0, 0);
});

test('reduced motion: fx.js never loads; card drips still only show on focus', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForTimeout(2500);
    expect(await fxLoaded(page)).toBe(false);
    expect((await runY(page, '.featured-grid .card')).visible).toBe(false);
    await expect(page.locator('.ansi-divider .drip').first()).toBeVisible();
});

test('turning reduced motion on from the menu stops every drip animation', async ({ page }) => {
    await page.goto('/about/');
    await expect.poll(() => fxLoaded(page), { timeout: 5000 }).toBe(true);
    const divider = page.locator('.ansi-divider').first();
    await divider.scrollIntoViewIfNeeded();
    await divider.hover({ force: true }).catch(() => {});
    await page.evaluate(() => document.documentElement.setAttribute('data-reduce-motion', ''));
    await page.waitForTimeout(100);
    const running = await page.evaluate(
        () =>
            [...document.querySelectorAll('[data-drips] *')].flatMap((el) =>
                el.getAnimations().filter((a) => a.playState === 'running'),
            ).length,
    );
    expect(running).toBe(0);
});

test('card drips: not a pixel at rest, pour out while hovered, gone after', async ({
    page,
    isMobile,
}) => {
    test.skip(isMobile, 'hover');
    await page.goto('/');
    await expect.poll(() => fxLoaded(page), { timeout: 5000 }).toBe(true);
    const card = page.locator('.featured-grid .card').first();
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    // At rest every run on every card is hidden and tucked fully inside the clip.
    const atRest = await page.evaluate(() =>
        [...document.querySelectorAll('.card-drips .drip-run')].every((r) => {
            const y = new DOMMatrixReadOnly(getComputedStyle(r).transform).m42;
            return (
                getComputedStyle(r).visibility === 'hidden' &&
                y <= -r.getBoundingClientRect().height + 0.5
            );
        }),
    );
    expect(atRest).toBe(true);

    const b = (await card.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await expect.poll(async () => (await runY(page, '.featured-grid .card')).visible).toBe(true);
    await expect
        .poll(async () => (await runY(page, '.featured-grid .card')).y, { timeout: 4000 })
        .toBeCloseTo(0, 0);

    await page.mouse.move(2, 2);
    await expect
        .poll(async () => (await runY(page, '.featured-grid .card')).visible, { timeout: 2000 })
        .toBe(false);
});

test('keyboard focus on a card link shows its drips too', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no hardware keyboard on phones');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.locator('.featured-grid .card-link').first().focus();
    await expect
        .poll(async () => (await runY(page, '.featured-grid .card')).y, { timeout: 1000 })
        .toBeCloseTo(0, 0);
});

test('a still pointer over a lifted card keeps it hovered (no flicker at the edges)', async ({
    page,
    isMobile,
}) => {
    test.skip(isMobile, 'hover');
    await page.goto('/');
    const card = page.locator('.grid-3 .card').first();
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const b = (await card.boundingBox())!;
    // 1px inside the bottom-right corner: the lift moves the card up-left, away from the pointer.
    await page.mouse.move(b.x + b.width - 1, b.y + b.height - 1);
    await page.waitForTimeout(600);
    expect(await card.evaluate((el) => el.matches(':hover'))).toBe(true);
});
