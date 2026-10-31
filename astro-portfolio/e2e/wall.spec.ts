import { expect, test, type Page } from '@playwright/test';

import { PAGES } from './pages';

// Wall pieces (wall.ts, R32): random graffiti in the free wall, different every visit, re-rolled
// by a new theme, untouched by a heading-style switch, never over content.

test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => sessionStorage.setItem('sl-booted', '1'));
});

const ready = (page: Page) =>
    expect(page.locator('html')).toHaveAttribute('data-wall-ready', '', { timeout: 15000 });
/** What the wall shows: each piece's word, style and colour variant, in page order. */
const signature = (page: Page) =>
    page.$$eval('[data-wall-piece]', (els) =>
        els.map((e) => {
            const d = (e as HTMLElement).dataset;
            return `${d['word']}|${d['style']}|${d['variant']}`;
        }),
    );
const positions = (page: Page) =>
    page.$$eval('[data-wall-piece]', (els) =>
        els.map((e) => `${(e as HTMLElement).style.left},${(e as HTMLElement).style.top}`),
    );

/** Every wall piece that overlaps content (controls, cards, art, media, or a line of text). */
const contentHits = (page: Page) =>
    page.evaluate(() => {
        const visible = (el: Element) => el.checkVisibility();
        // Fixed UI (the header, the paint kit) floats over everything, wall included: not content
        // a piece sits under (wall.ts skips it too, R56).
        const skip = '.wall-piece, .paint-kit, .site-header';
        // Boxes that are content as a whole…
        const boxes = [
            ...document.querySelectorAll(
                'a, button, input, textarea, .card, .hero-terminal, .ansi-title svg, canvas, img',
            ),
        ]
            .filter((el) => !el.closest(skip) && visible(el))
            .map((el) => [el, el.getBoundingClientRect()] as const);
        // …and text, measured by its line boxes (a centred h2's box spans the container).
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            const el = n.parentElement!;
            if (!n.textContent!.trim() || el.closest(`${skip}, .sr-only, script, style`)) continue;
            if (!visible(el)) continue;
            const range = document.createRange();
            range.selectNodeContents(n);
            for (const r of range.getClientRects()) boxes.push([el, r]);
        }
        const out: string[] = [];
        for (const piece of document.querySelectorAll<HTMLElement>('.wall-piece')) {
            const r = piece.getBoundingClientRect();
            for (const [el, c] of boxes) {
                if (!c.width || !c.height) continue;
                const overlap =
                    Math.min(r.right, c.right) - Math.max(r.left, c.left) > 2 &&
                    Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top) > 2;
                if (overlap)
                    out.push(
                        `${piece.dataset['word']} × ${el.tagName}.${el.className}`.slice(0, 120),
                    );
            }
        }
        return [...new Set(out)];
    });

for (const path of PAGES) {
    test(`${path}: pieces sit in empty wall, never over content`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' }); // all visible, nothing moving
        await page.goto(path);
        await ready(page);
        const hits = await contentHits(page);
        expect(hits).toEqual([]);
        // Never pushes the page sideways; decoration only.
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
            ),
        ).toBeLessThanOrEqual(0);
        if (path === '/') expect((await signature(page)).length).toBeGreaterThan(0);
        for (const piece of await page.locator('.wall-piece').all()) {
            await expect(piece).toHaveAttribute('aria-hidden', 'true');
            await expect(piece).toHaveCSS('pointer-events', 'none');
        }
    });
}

test('a new visit paints a new wall', async ({ page }) => {
    await page.goto('/');
    await ready(page);
    const first = [...(await signature(page)), ...(await positions(page))];
    let differs = false;
    // Random, so two visits could in principle match; three in a row won't.
    for (let i = 0; i < 3 && !differs; i++) {
        await page.reload();
        await ready(page);
        differs =
            JSON.stringify([...(await signature(page)), ...(await positions(page))]) !==
            JSON.stringify(first);
    }
    expect(differs).toBe(true);
});

test('a layout change while pieces are still going up never leaves one over content (R41)', async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    // The first piece is up, so the rest are planned on this layout and waiting to be added.
    await page.locator('[data-wall-piece]').first().waitFor({ state: 'attached', timeout: 15000 });
    await page.evaluate(() => {
        // Keep "scrolling" for a while: wall.ts adds no piece mid-scroll, so the rest keep waiting.
        const t = setInterval(() => dispatchEvent(new Event('scroll')), 50);
        setTimeout(() => clearInterval(t), 1500);
        // Then the layout changes under them: wildstyle headings and larger text.
        const root = document.documentElement;
        root.setAttribute('data-title-style', 'wild');
        root.setAttribute('data-accessibility-large', '');
    });
    // The resize settles (250 ms debounce), then any re-placement finishes.
    await page.waitForTimeout(800);
    await ready(page);
    expect(await contentHits(page)).toEqual([]);
});

test('a heading-style switch keeps the wall; a new theme re-rolls it', async ({ page }) => {
    // A fixed first seed: whether a piece that the new titles cover finds room elsewhere (and so
    // stays the same piece, or swaps for one that fits, R52) depends on the visit's random wall.
    // Pinned, the test is the same every run. The theme's re-roll still draws a fresh seed.
    await page.addInitScript(() => {
        const draw = crypto.getRandomValues.bind(crypto) as (a: Uint32Array) => Uint32Array;
        let first = true;
        crypto.getRandomValues = ((a: Uint32Array) => {
            if (first && a instanceof Uint32Array && a.length === 1) {
                first = false;
                a[0] = 0x5eed;
                return a;
            }
            return draw(a);
        }) as typeof crypto.getRandomValues;
    });
    await page.goto('/');
    await ready(page);
    // A late layout change at load (fonts, images) can still move a piece: let it settle first.
    await page.waitForTimeout(800);
    await ready(page);
    const before = await signature(page);
    await page.evaluate(() => document.documentElement.setAttribute('data-title-style', 'wild'));
    // The resize settles (250 ms debounce), then a piece that content now covers is placed again,
    // in idle slices: wait for that, not a fixed time (a busy machine takes longer).
    await page.waitForTimeout(800);
    await ready(page);
    expect((await signature(page)).sort()).toEqual([...before].sort());
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'sunset'));
    await expect
        .poll(async () => JSON.stringify(await signature(page)), { timeout: 10000 })
        .not.toBe(JSON.stringify(before));
});

test('pieces spray on once, when first scrolled into view', async ({ page }) => {
    await page.goto('/');
    await ready(page);
    // Pin the piece by position (once it sprays it is no longer .is-waiting).
    const i = await page.$$eval('.wall-piece', (els) =>
        els.findLastIndex((e) => e.classList.contains('is-waiting')),
    );
    test.skip(i < 0, 'every piece landed on the first screen this visit');
    const below = page.locator('.wall-piece').nth(i);
    await expect(below).toHaveCSS('opacity', '0');
    await below.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect(below).toHaveClass(/is-sprayed/);
    await expect
        .poll(() => below.evaluate((el) => +getComputedStyle(el).opacity))
        .toBeGreaterThan(0.2);
});

test('reduced motion: pieces are simply there; hide-wall mode never loads them', async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await ready(page);
    expect(await page.locator('.wall-piece.is-waiting, .wall-piece.is-sprayed').count()).toBe(0);
    await page.evaluate(() => document.documentElement.setAttribute('data-accessibility-wall', ''));
    await expect(page.locator('.wall-piece').first()).toBeHidden();

    await page.addInitScript(() => localStorage.setItem('sl-accessibility', '{"wall":true}'));
    const loaded: string[] = [];
    page.on('request', (r) => r.url().endsWith('/wall.js') && loaded.push(r.url()));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    expect(loaded).toEqual([]);
});
