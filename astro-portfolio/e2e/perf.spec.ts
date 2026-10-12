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
        // Alone this measures 16.7 / 16.7 ms; the margins absorb 4 parallel browsers sharing a CPU.
        expect(p95.p50, `${path} median frame (ms)`).toBeLessThan(20);
        expect(p95.p95, `${path} frame p95 (ms)`).toBeLessThan(34);
    }
});
