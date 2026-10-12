import { expect, test, type Page } from '@playwright/test';

import { PAGES } from './pages';

// Paint drips (AnsiDrips.astro) and their physics (fx.ts, Motion).

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

test('fx.js loads on pages with drips, and a poke releases a falling drop', async ({
    page,
    isMobile,
}) => {
    await page.goto('/about/');
    await expect.poll(() => fxLoaded(page), { timeout: 5000 }).toBe(true);
    const divider = page.locator('.ansi-divider').first();
    await divider.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const box = (await divider.boundingBox())!;
    if (isMobile) {
        // Tap right on a drip.
        const drip = (await divider.locator('.drip').first().boundingBox())!;
        await page.mouse.click(drip.x + drip.width / 2, box.y + 2);
    } else {
        await page.mouse.move(box.x, box.y + 4);
        await page.mouse.move(box.x + box.width, box.y + 4, { steps: 25 });
    }
    // At least one drop is visible and moving down.
    await expect
        .poll(
            () =>
                divider.evaluate((el) =>
                    [...el.querySelectorAll<HTMLElement>('.drip__drop')].some(
                        (d) => +getComputedStyle(d).opacity > 0.5,
                    ),
                ),
            { timeout: 2000, intervals: [50] },
        )
        .toBe(true);
});

test('reduced motion: fx.js never loads, drips hang still', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForTimeout(2500);
    expect(await fxLoaded(page)).toBe(false);
    await expect(page.locator('.card-drips .drip').first()).toBeVisible();
});

test('turning reduced motion on from the menu stops every drip animation', async ({ page }) => {
    await page.goto('/about/');
    await expect.poll(() => fxLoaded(page), { timeout: 5000 }).toBe(true);
    await page.waitForTimeout(500);
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

/** Vertical offset (px) of the first card's drip paint: < 0 means tucked away inside the edge. */
const paintY = (page: Page) =>
    page
        .locator('.featured-grid .card .drip__paint')
        .first()
        .evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42);

test('card drips are hidden at rest and run out (and drop) only while hovered', async ({
    page,
    isMobile,
}) => {
    test.skip(isMobile, 'hover');
    await page.goto('/');
    await expect.poll(() => fxLoaded(page), { timeout: 5000 }).toBe(true);
    const card = page.locator('.featured-grid .card').first();
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    expect(await paintY(page)).toBeLessThan(-5);
    // Divider drips, by contrast, are always out (once they've run out on first view).
    const divider = page.locator('.ansi-divider').first();
    await divider.scrollIntoViewIfNeeded();
    await expect
        .poll(
            () =>
                divider
                    .locator('.drip__paint')
                    .first()
                    .evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42),
            { timeout: 3000 },
        )
        .toBeCloseTo(0, 0);
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const b = (await card.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await expect.poll(() => paintY(page), { timeout: 2500 }).toBeGreaterThan(-1);
    await expect
        .poll(
            () =>
                card.evaluate((el) =>
                    [...el.querySelectorAll<HTMLElement>('.drip__drop')].some(
                        (d) => +getComputedStyle(d).opacity > 0.3,
                    ),
                ),
            { timeout: 3000, intervals: [50] },
        )
        .toBe(true);

    await page.mouse.move(2, 2);
    await expect.poll(() => paintY(page), { timeout: 2000 }).toBeLessThan(-5);
});

test('keyboard focus on a card link shows its drips too', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no hardware keyboard on phones');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.locator('.featured-grid .card-link').first().focus();
    await expect.poll(() => paintY(page), { timeout: 1000 }).toBeGreaterThan(-1);
});
