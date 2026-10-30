import { expect, test } from '@playwright/test';

import { PAGES } from './pages';

// Runs in the perf-* projects only, after every other project has finished (see
// playwright.config.ts), so the frame timings aren't measuring other tests' CPU load.

test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => sessionStorage.setItem('sl-booted', '1'));
});

test('scrolling every page stays smooth (median frame ≈ 16.7ms, no long drops)', async ({
    page,
}) => {
    for (const path of PAGES) {
        await page.goto(path);
        // Measure steady-state scrolling, not page load (fonts, hydration, the idle terminal fetch).
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        const p95 = await page.evaluate(async () => {
            const iv: number[] = [];
            let last = performance.now();
            let run = true;
            const tick = (t: number) => {
                iv.push(t - last);
                last = t;
                if (run) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
            for (let y = 0; y < document.documentElement.scrollHeight; y += 80) {
                window.scrollTo(0, y);
                await new Promise((r) => setTimeout(r, 16));
            }
            run = false;
            iv.sort((a, b) => a - b);
            return {
                p50: iv[Math.floor(iv.length * 0.5)]!,
                p95: iv[Math.floor(iv.length * 0.95)]!,
            };
        });
        // Locally (real GPU) this measures 16.7 / 16.7 ms. GitHub's 2-vCPU runners rasterise in
        // software, so in CI the numbers are recorded as annotations and only gross jank fails.
        test.info().annotations.push({
            type: 'frames',
            description: `${path}: median ${p95.p50.toFixed(1)}ms, p95 ${p95.p95.toFixed(1)}ms`,
        });
        const [maxP50, maxP95] = process.env.CI ? [50, 100] : [20, 34];
        expect(p95.p50, `${path} median frame (ms)`).toBeLessThan(maxP50);
        expect(p95.p95, `${path} frame p95 (ms)`).toBeLessThan(maxP95);
    }
});

test('card hover-tilt stays smooth (frame p95)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'tilt is a mouse effect');
    await page.goto('/projects/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500); // fx.js arrives on idle
    const card = page.locator('.card').first();
    const b = (await card.boundingBox())!;
    await page.evaluate(() => {
        const w = window as unknown as { __iv: number[]; __run: boolean };
        w.__iv = [];
        w.__run = true;
        let last = performance.now();
        const tick = (t: number) => {
            w.__iv.push(t - last);
            last = t;
            if (w.__run) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });
    for (let i = 0; i < 40; i++)
        await page.mouse.move(b.x + (b.width * i) / 40, b.y + 100 + (i % 7) * 20);
    const p95 = await page.evaluate(() => {
        const w = window as unknown as { __iv: number[]; __run: boolean };
        w.__run = false;
        const iv = w.__iv.slice(2).sort((a, c) => a - c);
        return iv[Math.floor(iv.length * 0.95)]!;
    });
    test.info().annotations.push({ type: 'frames', description: `tilt: p95 ${p95.toFixed(1)}ms` });
    expect(p95, 'tilt frame p95 (ms)').toBeLessThan(process.env.CI ? 100 : 34);
});

test('no idle layer bloat: content waiting to reveal is not pre-promoted', async ({
    page,
    context,
}) => {
    // Every composited layer is GPU tile memory; on a DPR-3 phone a dozen card-sized layers blew the
    // tile budget and stuttered scrolling (R22). At rest a page needs the document, the header,
    // the scroll UI and the paint kit, plus the odd overlap squash.
    const cdp = await context.newCDPSession(page);
    let layers: { drawsContent: boolean }[] = [];
    cdp.on('LayerTree.layerTreeDidChange', (e) => {
        if (e.layers) layers = e.layers;
    });
    for (const path of PAGES) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        // At rest: after the entrances and any drip pour (≤ 2.6 s) have finished.
        await page.waitForTimeout(3000);
        layers = [];
        await cdp.send('LayerTree.enable'); // per page: it doesn't survive a navigation
        // A paint-only nudge to get a layer-tree update (a scroll would move cards into the touch
        // focus band and start a pour, which isn't rest).
        await page.evaluate(() => {
            document.body.style.color = 'rgb(1, 2, 3)';
            requestAnimationFrame(() => (document.body.style.color = ''));
        });
        await expect.poll(() => layers.length).toBeGreaterThan(0);
        await cdp.send('LayerTree.disable');
        const drawn = layers.filter((l) => l.drawsContent).length;
        test.info().annotations.push({ type: 'layers', description: `${path}: ${drawn}` });
        // 13: the spray-paint kit (R53) is a fixed control on every page, so it is one small layer
        // (~110 × 52 px) of its own. The home page's random wall pieces put it near the old cap of 12.
        expect(drawn, `${path} composited layers at rest`).toBeLessThanOrEqual(13);
    }
});
