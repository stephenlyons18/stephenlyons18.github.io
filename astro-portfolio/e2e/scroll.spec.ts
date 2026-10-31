import { expect, test } from '@playwright/test';

// Scroll progress strip (top) and the touch scrubber (right edge), both in BaseLayout + site.ts.

test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => sessionStorage.setItem('sl-booted', '1'));
});

const scrollTo = (page: import('@playwright/test').Page, f: number) =>
    page.evaluate((f) => {
        const max = document.documentElement.scrollHeight - innerHeight;
        window.scrollTo({ top: max * f, behavior: 'instant' });
    }, f);

test('the progress strip fills with the scroll position', async ({ page }) => {
    await page.goto('/projects/');
    const right = () =>
        page.locator('.scroll-progress').evaluate((el) => el.getBoundingClientRect().right);
    const vw = await page.evaluate(() => innerWidth);
    await scrollTo(page, 0);
    await expect.poll(right).toBeLessThan(vw * 0.05);
    await scrollTo(page, 0.5);
    await expect.poll(right).toBeGreaterThan(vw * 0.4);
    expect(await right()).toBeLessThan(vw * 0.6);
    await scrollTo(page, 1);
    await expect.poll(right).toBeGreaterThan(vw * 0.98);
    // The blocks are revealed, not stretched: the fill stays put at the left edge.
    expect(
        await page
            .locator('.scroll-progress__fill')
            .evaluate((el) => Math.round(el.getBoundingClientRect().left)),
    ).toBe(0);
});

test('touch scrubber: appears on scroll, dragging it scrolls the page, then it hides', async ({
    page,
    isMobile,
}) => {
    const thumb = page.locator('.scrub__thumb');
    await page.goto('/projects/');
    if (!isMobile) {
        await expect(thumb).toBeHidden(); // mouse devices have a real scrollbar
        return;
    }
    await expect(thumb).toHaveCSS('opacity', '0');
    await page.evaluate(() => window.scrollBy(0, 200));
    await expect(thumb).toHaveCSS('opacity', '1');
    const t = (await thumb.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string, y?: number) =>
        cdp.send('Input.dispatchTouchEvent', {
            type,
            touchPoints: y === undefined ? [] : [{ x: t.x + t.width / 2, y }],
        });
    await touch('touchStart', t.y + 20);
    for (let i = 1; i <= 12; i++) await touch('touchMove', t.y + 20 + i * 50);
    const ratio = await page.evaluate(
        () => scrollY / (document.documentElement.scrollHeight - innerHeight),
    );
    expect(ratio).toBeGreaterThan(0.5);
    // The grip stays under the finger.
    expect((await thumb.boundingBox())!.y).toBeGreaterThan(t.y + 450);
    await touch('touchEnd');
    await expect(thumb).toHaveCSS('opacity', '0', { timeout: 3000 });
});
