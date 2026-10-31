import { expect, test, type Page } from '@playwright/test';

// Interactive motion (fx.ts + global.css): page transitions, card tilt, draggable art.

test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => sessionStorage.setItem('sl-booted', '1'));
});

const fxReady = (page: Page) =>
    expect
        .poll(
            () =>
                page.evaluate(() =>
                    performance.getEntriesByType('resource').some((r) => /fx\.js/.test(r.name)),
                ),
            { timeout: 5000 },
        )
        .toBe(true);

/** Is the element rendered with a non-identity transform right now? */
const moved = (page: Page, sel: string) =>
    page
        .locator(sel)
        .first()
        .evaluate((el) => {
            const t = getComputedStyle(el).transform;
            if (t === 'none') return false;
            const m = new DOMMatrixReadOnly(t);
            return Math.abs(m.m41) > 1 || Math.abs(m.m42) > 1 || Math.abs(m.m13) > 0.001;
        });

test('same-site navigation runs a page view transition (and none under reduced motion)', async ({
    page,
    isMobile,
}) => {
    test.skip(isMobile, 'nav links live in the mobile menu; covered on desktop/laptop');
    // The outgoing page learns whether a transition will run (pageswap); keep it for the next one.
    await page.addInitScript(() => {
        addEventListener('pageswap', (e) => {
            sessionStorage.setItem('vt', String(!!(e as PageSwapEvent).viewTransition));
        });
    });
    await page.goto('/');
    await page.locator('.nav-links a', { hasText: 'About' }).first().click();
    await page.waitForURL(/about/);
    expect(await page.evaluate(() => sessionStorage.getItem('vt'))).toBe('true');
    // The header is its own transition group, so it stays put while the page changes.
    expect(
        await page
            .locator('.site-header')
            .evaluate((el) => getComputedStyle(el).viewTransitionName),
    ).toBe('site-header');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('.nav-links a[href*="projects"]').first().click();
    await page.waitForURL(/projects/);
    expect(await page.evaluate(() => sessionStorage.getItem('vt'))).toBe('false');
});

test('cards tilt toward the mouse and spring back level', async ({ page, isMobile }) => {
    test.skip(isMobile, 'tilt is a mouse effect');
    await page.goto('/');
    await fxReady(page);
    const card = page.locator('.featured-grid .card').first();
    await card.scrollIntoViewIfNeeded();
    const b = (await card.boundingBox())!;
    await page.mouse.move(b.x + b.width * 0.9, b.y + b.height * 0.2);
    await page.mouse.move(b.x + b.width * 0.95, b.y + b.height * 0.1, { steps: 4 });
    await expect(card).toHaveClass(/is-live/);
    await expect.poll(() => moved(page, '.featured-grid .card'), { timeout: 1500 }).toBe(true);
    await page.mouse.move(5, 5);
    await expect(card).not.toHaveClass(/is-live|is-settling/, { timeout: 5000 });
});

test('the avatar can be dragged and snaps home', async ({ page }) => {
    await page.goto('/about/');
    await fxReady(page);
    const art = page.locator('.about-avatar [data-drag]');
    await art.scrollIntoViewIfNeeded();
    const b = (await art.boundingBox())!;
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 120, cy + 40, { steps: 8 });
    const held = (await art.boundingBox())!;
    expect(held.x - b.x).toBeGreaterThan(30); // follows the pointer (against a rubber band)
    expect(held.x - b.x).toBeLessThan(120); // …but resists
    await page.mouse.up();
    await expect
        .poll(async () => Math.abs((await art.boundingBox())!.x - b.x), { timeout: 2500 })
        .toBeLessThan(1);
});

test('reduced motion: no tilt, no drag, nothing moves', async ({ page, isMobile }) => {
    test.skip(isMobile, 'mouse interactions');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/about/');
    await page.waitForTimeout(2000);
    const art = page.locator('.about-avatar [data-drag]');
    const b = (await art.boundingBox())!;
    await page.mouse.move(b.x + 20, b.y + 20);
    await page.mouse.down();
    await page.mouse.move(b.x + 140, b.y + 60, { steps: 6 });
    expect(Math.abs((await art.boundingBox())!.x - b.x)).toBeLessThan(1);
    await page.mouse.up();
});

for (const path of ['/about/', '/projects/', '/contact/']) {
    test(`${path} header can be grabbed with a mouse and snaps home`, async ({
        page,
        isMobile,
    }) => {
        test.skip(isMobile, 'big art drags with a mouse only; touch keeps scrolling');
        await page.goto(path);
        await fxReady(page);
        const art = page.locator('.drag-art[data-drag="fine"]').first();
        const b = (await art.boundingBox())!;
        await page.mouse.move(b.x + b.width / 3, b.y + b.height / 2);
        await page.mouse.down();
        await page.mouse.move(b.x + b.width / 3 + 120, b.y + b.height / 2 + 40, { steps: 8 });
        expect((await art.boundingBox())!.x - b.x).toBeGreaterThan(30);
        await page.mouse.up();
        await expect
            .poll(async () => Math.abs((await art.boundingBox())!.x - b.x), { timeout: 2500 })
            .toBeLessThan(1);
    });
}

test('hero: the name and the subheader are separate pieces (own entrance, own drag)', async ({
    page,
    isMobile,
}) => {
    await page.goto('/');
    // Two entrances: the subheader's is its own animation, a beat after the name's.
    const names = await page.evaluate(() =>
        ['.hero-name', '.hero-tagline'].map((s) =>
            document
                .querySelector(s)!
                .getAnimations()
                .map((a) => (a as CSSAnimation).animationName),
        ),
    );
    expect(names[0]).toEqual(['reveal-fade-up']);
    expect(names[1]).toEqual(['hero-tagline-in']);
    test.skip(isMobile, 'big art drags with a mouse only; touch keeps scrolling');
    await fxReady(page);
    await page.waitForTimeout(1200); // entrances done
    const name = page.locator('.hero-name [data-drag]');
    const sub = page.locator('.hero-tagline [data-drag]');
    for (const [grab, other] of [
        [name, sub],
        [sub, name],
    ] as const) {
        const g = (await grab.boundingBox())!;
        const o = (await other.boundingBox())!;
        // Grab the middle of the piece's top half (below it, the subheader overlaps the name).
        const y = grab === name ? g.y + g.height * 0.3 : g.y + g.height * 0.6;
        await page.mouse.move(g.x + g.width / 3, y);
        await page.mouse.down();
        await page.mouse.move(g.x + g.width / 3 + 120, y + 40, { steps: 8 });
        expect((await grab.boundingBox())!.x - g.x).toBeGreaterThan(30);
        expect(Math.abs((await other.boundingBox())!.x - o.x)).toBeLessThan(1);
        await page.mouse.up();
        await expect
            .poll(async () => Math.abs((await grab.boundingBox())!.x - g.x), { timeout: 2500 })
            .toBeLessThan(1);
        // The snap-back is a bouncy spring: it passes home while still oscillating. Let it finish,
        // or the next drag measures this piece still moving (a CI flake under load, R56).
        await expect
            .poll(
                () =>
                    grab.evaluate((el) =>
                        el
                            .closest('.hero-name, .hero-tagline')!
                            .getAnimations({ subtree: true })
                            .some((a) => a.playState === 'running'),
                    ),
                { timeout: 3000 },
            )
            .toBe(false);
    }
});
