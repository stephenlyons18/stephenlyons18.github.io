import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Spray paint (R53): the spray cursor, paint mode, drips/fade, Shift + wheel, kept paint, touch.

// Past the first-visit boot screen, which covers the page (and the paint) for its first ~2s.
test.beforeEach(({ page }) => page.addInitScript(() => sessionStorage.setItem('sl-booted', '1')));

/** Painted (non-transparent) canvas pixels across the paint layer. */
const painted = (page: Page) =>
    page.evaluate(() => {
        let n = 0;
        for (const cv of document.querySelectorAll<HTMLCanvasElement>('.paint-layer canvas')) {
            const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
            for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
        }
        return n;
    });

/** Mouse pages: switch paint on with P (which loads paint.js) and wake the cursor. */
async function ready(page: Page, path = '/') {
    await page.goto(path);
    await page.mouse.move(400, 400);
    await page.keyboard.press('p');
    await expect(page.locator('.paint-fab--can')).toHaveAttribute('aria-pressed', 'true');
    await page.mouse.move(420, 420);
}

async function drag(page: Page, from: [number, number], to: [number, number], steps = 20) {
    await page.mouse.move(...from);
    await page.mouse.down();
    await page.mouse.move(...to, { steps });
    await page.mouse.up();
}

test.describe('mouse', () => {
    test.skip(({ isMobile }) => isMobile, 'mouse devices');

    test('paint off is the normal site; paint on gives the hollow spray ring', async ({ page }) => {
        await page.goto('/');
        await page.mouse.move(400, 400);
        await page.waitForTimeout(2500);
        // Off: no engine, no ring, the native cursor, and a drag is a normal drag.
        expect(await page.evaluate(() => !!window.slPaint)).toBe(false);
        await expect(page.locator('.spray-ring')).toHaveCount(0);
        expect(await page.evaluate(() => getComputedStyle(document.body).cursor)).toBe('auto');
        await drag(page, [200, 500], [600, 520]);
        expect(await painted(page)).toBe(0);

        await page.keyboard.press('p');
        await expect(page.locator('.paint-fab--can')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('[data-paint-toast]')).toContainText('Paint on');
        await page.mouse.move(420, 420);
        const art = page.locator('.spray-ring__art');
        await expect(art).toBeVisible();
        expect(await page.locator('.spray-ring').evaluate((el) => el.style.transform)).toContain(
            '420px',
        );
        // Hollow: nothing is drawn in the middle of the ring.
        expect(
            await art.evaluate((svg) => {
                const r = svg.getBoundingClientRect();
                const hit = document.elementsFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                return hit.some((e) => e.tagName === 'path');
            }),
        ).toBe(false);
        await drag(page, [200, 500], [600, 520]);
        await expect.poll(() => painted(page)).toBeGreaterThan(200);
        // Over the header the normal cursor is back.
        await page.mouse.move(400, 20);
        await expect(art).toBeHidden();
        await page.keyboard.press('Escape');
        await expect(page.locator('.paint-fab--can')).toHaveAttribute('aria-pressed', 'false');
        await page.mouse.move(420, 420);
        await expect(art).toBeHidden();
    });

    test('painting over a link sprays instead of following it', async ({ page }) => {
        await ready(page);
        const cta = (await page.locator('.hero a.btn').first().boundingBox())!;
        const url = page.url();
        await page.mouse.click(cta.x + cta.width / 2, cta.y + cta.height / 2);
        await page.waitForTimeout(300);
        expect(page.url()).toBe(url);
        // The header stays usable while painting.
        await expect(page.locator('.nav-links a').first()).toBeVisible();
    });

    test('paint fades by default and the loop stops after', async ({ page }) => {
        // Not the home page: its hero terminal types its intro with rAF for ~9s after load.
        await ready(page, '/contact/');

        await drag(page, [300, 500], [700, 500]);
        await expect.poll(() => painted(page)).toBeGreaterThan(0);
        await expect.poll(() => painted(page), { timeout: 6000 }).toBe(0);
        await expect(page.locator('.paint-layer canvas')).toHaveCount(0);
        const callbacks = await page.evaluate(
            () =>
                new Promise<number>((resolve) => {
                    let n = 0;
                    const orig = window.requestAnimationFrame.bind(window);
                    window.requestAnimationFrame = (cb) => (n++, orig(cb));
                    setTimeout(() => resolve(n), 800);
                }),
        );
        expect(callbacks, 'paint idles with no rAF').toBeLessThanOrEqual(2);
    });

    test('holding still drips down the page', async ({ page }) => {
        await page.addInitScript(() =>
            localStorage.setItem('sl-paint', JSON.stringify({ drips: 'lots', keep: true })),
        );
        await ready(page);
        await page.mouse.move(700, 300);
        await page.mouse.down();
        await page.waitForTimeout(1500);
        await page.mouse.up();
        // The lowest painted row keeps moving down after the can lifts, then settles.
        const lowest = () =>
            page.evaluate(() => {
                let low = 0;
                for (const cv of document.querySelectorAll<HTMLCanvasElement>(
                    '.paint-layer canvas',
                )) {
                    const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
                    for (let i = d.length - 1; i >= 3; i -= 4)
                        if (d[i]) {
                            const y = Math.floor((i - 3) / 4 / cv.width) / cv.height;
                            low = Math.max(
                                low,
                                cv.getBoundingClientRect().top + y * cv.offsetHeight,
                            );
                            break;
                        }
                }
                return low;
            });
        const first = await lowest();
        await expect.poll(lowest, { timeout: 5000 }).toBeGreaterThan(first + 12);
    });

    test('Shift + wheel resizes without scrolling; the tip shows once, then goes', async ({
        page,
    }) => {
        await ready(page);
        const tip = page.locator('.spray-ring__tip');

        await expect(tip).toBeHidden();
        await drag(page, [300, 500], [500, 500]);
        await expect(tip).toBeVisible();
        const size = () => page.evaluate(() => JSON.parse(localStorage.getItem('sl-paint')!).size);
        const before = await page.evaluate(() => scrollY);
        await page.mouse.move(600, 400);
        await page.keyboard.down('Shift');
        await page.mouse.wheel(0, -120);
        await page.mouse.wheel(0, -120);
        await page.keyboard.up('Shift');
        await expect.poll(size).toBe(7);
        expect(await page.evaluate(() => scrollY)).toBe(before);
        await expect(tip).toBeHidden();
        // Plain scrolling is untouched.
        await page.mouse.wheel(0, 400);
        await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
        // Done for good: it doesn't come back on the next visit.
        await ready(page, '/about/');
        await drag(page, [300, 500], [500, 500]);
        await expect(tip).toBeHidden();
    });

    test('kept paint stays with the page for the visit; a reload clears it', async ({ page }) => {
        await ready(page);
        await page.locator('.paint-fab--menu').click();
        await page.locator('[data-paint-keep]').check({ force: true });
        await page.keyboard.press('Escape');
        await drag(page, [300, 500], [700, 520]);
        await page.waitForTimeout(3500); // past the fade time: kept paint doesn't fade
        const n = await painted(page);
        expect(n).toBeGreaterThan(200);
        await page.keyboard.press('Escape'); // paint off: the header link is a link again
        await page.locator('.nav-links a[href*="about"]').click();
        await page.waitForURL(/about/);
        await page.goBack();
        await expect.poll(() => painted(page), { timeout: 8000 }).toBeGreaterThan(n * 0.8);
        await page.reload();
        await page.waitForTimeout(2500);
        expect(await painted(page)).toBe(0);
    });

    test('menu: colours follow the theme until a custom one is picked', async ({ page }) => {
        await ready(page);
        const color = () =>
            page.evaluate(() => document.documentElement.style.getPropertyValue('--paint-color'));
        expect(await color()).toBe('#22c7ff'); // Burner's --title-hi
        await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'sunset'));
        await expect.poll(color).toBe('#ffd23f');
        await page.locator('.paint-fab--menu').click();
        const hex = page.locator('[data-paint-hex]');
        await hex.fill('#12ab34');
        await expect.poll(color).toBe('#12ab34');
        await expect(page.locator('input[name="paint-color"][value="custom"]')).toBeChecked();
        await hex.fill('nope');
        await expect(hex).toHaveAttribute('aria-invalid', 'true');
        await page.locator('.paint-cap', { hasText: 'Block' }).click();
        await page.locator('.paint-opt', { hasText: 'Lots' }).click();
        expect(
            await page.evaluate(() => JSON.parse(localStorage.getItem('sl-paint')!)),
        ).toMatchObject({ color: '#12ab34', cap: 'block', drips: 'lots' });
    });
});

test('the menu passes axe and fits the screen', async ({ page }) => {
    await page.goto('/');
    await page.locator('.paint-fab--menu').click();
    const menu = page.locator('#paint-menu');
    await expect(menu).toBeVisible();
    await page.waitForFunction(() => !!window.slPaint, null, { timeout: 8000 });
    const box = (await menu.boundingBox())!;
    const vw = page.viewportSize()!.width;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vw);
    const results = await new AxeBuilder({ page })
        .include('#paint-menu')
        .include('.paint-kit')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('reduced motion: no kit, no cursor, no engine', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.mouse.move(300, 300);
    await page.waitForTimeout(2500);
    await expect(page.locator('.paint-kit')).toBeHidden();
    expect(await page.evaluate(() => !!window.slPaint)).toBe(false);
    await expect(page.locator('html')).not.toHaveClass(/spray-cursor/);
});

test.describe('touch', () => {
    test.skip(({ isMobile }) => !isMobile, 'touch devices');

    test('scrolling never paints; the can switches paint on; two fingers scroll', async ({
        page,
    }) => {
        await page.goto('/');
        await page.waitForTimeout(1500);
        const cdp = await page.context().newCDPSession(page);
        const touch = (type: string, pts: [number, number][]) =>
            cdp.send('Input.dispatchTouchEvent', {
                type: type as 'touchStart',
                touchPoints: pts.map(([x, y], id) => ({ x, y, id })),
            });
        const swipe = async (from: [number, number], dy: number, fingers = 1, dx = 0) => {
            const at = (k: number) =>
                Array.from({ length: fingers }, (_, f) => [
                    from[0] + f * 60 + (dx * k) / 12,
                    from[1] + (dy * k) / 12,
                ]) as [number, number][];
            await touch('touchStart', at(0));
            for (let k = 1; k <= 12; k++) await touch('touchMove', at(k));
            await touch('touchEnd', []);
        };
        const scrollY = () => page.evaluate(() => scrollY);

        // Paint off: a swipe is a scroll, and the engine isn't even loaded.
        await swipe([200, 600], -300);
        await expect.poll(scrollY).toBeGreaterThan(100);
        expect(await page.evaluate(() => !!window.slPaint)).toBe(false);
        expect(await painted(page)).toBe(0);

        // Let the fling settle: a tap during one only stops it (no click), as on a real phone.
        await page.waitForTimeout(1000);
        await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
        await page.locator('.paint-fab--can').tap();
        await expect(page.locator('.paint-fab--can')).toHaveAttribute('aria-pressed', 'true');
        await swipe([60, 400], 40, 1, 260);
        expect(await scrollY()).toBe(0);
        await expect.poll(() => painted(page)).toBeGreaterThan(100);

        await swipe([120, 600], -300, 2);
        await expect.poll(scrollY).toBeGreaterThan(100);

        await page.waitForTimeout(1000);
        await page.locator('.paint-fab--can').tap();
        await expect(page.locator('.paint-capture')).toBeHidden();
    });
});
