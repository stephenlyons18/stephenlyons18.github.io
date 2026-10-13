import { expect, test } from '@playwright/test';

// Wall pieces (WallPiece.astro): art in the whitespace, sprayed on once when first seen.

test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => sessionStorage.setItem('sl-booted', '1'));
});

for (const path of ['/', '/about/', '/projects/', '/contact/']) {
    test(`${path}: pieces sit in empty wall, never over content`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' }); // all visible, nothing moving
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const hits = await page.evaluate(() => {
            const visible = (el: Element) =>
                el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
            // Boxes that are content as a whole…
            const boxes = [
                ...document.querySelectorAll(
                    'a, button, input, textarea, .card, .hero-terminal, .ansi-title svg, canvas, img',
                ),
            ]
                .filter((el) => !el.closest('.wall-piece') && visible(el))
                .map((el) => [el, el.getBoundingClientRect()] as const);
            // …and text, measured by its line boxes (a centred h2's box spans the container).
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            for (let n = walker.nextNode(); n; n = walker.nextNode()) {
                const el = n.parentElement!;
                if (!n.textContent!.trim() || el.closest('.wall-piece, .sr-only, script, style'))
                    continue;
                if (!visible(el)) continue;
                const range = document.createRange();
                range.selectNodeContents(n);
                for (const r of range.getClientRects()) boxes.push([el, r]);
            }
            const out: string[] = [];
            for (const piece of document.querySelectorAll<HTMLElement>('.wall-piece')) {
                if (!visible(piece) && getComputedStyle(piece).display === 'none') continue;
                const r = piece.getBoundingClientRect();
                if (!r.width) continue;
                for (const [el, c] of boxes) {
                    if (!c.width || !c.height) continue;
                    const overlap =
                        Math.min(r.right, c.right) - Math.max(r.left, c.left) > 2 &&
                        Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top) > 2;
                    if (overlap)
                        out.push(
                            `${piece.className} × ${el.tagName}.${el.className}`.slice(0, 120),
                        );
                }
            }
            return [...new Set(out)];
        });
        expect(hits).toEqual([]);
        // Decoration only: hidden from assistive tech, never a pointer target.
        for (const piece of await page.locator('.wall-piece').all()) {
            await expect(piece).toHaveAttribute('aria-hidden', 'true');
            await expect(piece).toHaveCSS('pointer-events', 'none');
        }
    });
}

test('pieces spray on once, when first scrolled into view', async ({ page }) => {
    await page.goto('/');
    const below = page.locator('.wall-piece--gap-right').last();
    await expect(below).toHaveClass(/is-waiting/);
    await expect(below).toHaveCSS('opacity', '0');
    await below.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect(below).toHaveClass(/is-sprayed/);
    await expect.poll(() => below.evaluate((el) => getComputedStyle(el).opacity)).toBe('0.55');
    // Scrolled away and back: it stays painted, no second spray.
    await page.evaluate(() => window.scrollTo(0, 0));
    await below.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect(below).toHaveClass(/is-sprayed/);
    expect(
        await below.evaluate((el) => el.getAnimations().every((a) => a.playState === 'finished')),
    ).toBe(true);
});

test('reduced motion: pieces are simply there; hide-wall mode hides them', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const below = page.locator('.wall-piece--gap-right').last();
    await expect(below).not.toHaveClass(/is-waiting|is-sprayed/);
    await page.evaluate(() => document.documentElement.setAttribute('data-a11y-wall', ''));
    await expect(below).toBeHidden();
});
