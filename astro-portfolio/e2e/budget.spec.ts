import { readFileSync } from 'node:fs';

import { expect, test, type Page } from './fixtures';

import { PAGES } from './pages';

// Page-weight and load-time budgets. Runs in the budget-* projects (after the functional tests, see
// playwright.config.ts). Budgets live in e2e/budget.json, in KB of *uncompressed* bytes (GitHub
// Pages gzips on the wire, so real transfers are ~3–4× smaller); raise one only with a reason
// in the PR.

type Kind = 'js' | 'css' | 'font' | 'img' | 'html' | 'data' | 'other';
interface Budget {
    /** Per page, per device project: max KB of each kind, loaded after a full scroll. */
    pages: Record<string, Partial<Record<Kind, number>>>;
    /** Pages that must ship no framework (React) JS at all. */
    noFramework: string[];
    load: { lcpMs: number; cls: number; tbtMs: number };
}
const BUDGET: Budget = JSON.parse(readFileSync(new URL('./budget.json', import.meta.url), 'utf8'));

test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => sessionStorage.setItem('sl-booted', '1'));
});

function kindOf(url: string, initiator: string): Kind {
    const path = new URL(url).pathname;
    if (/\.m?js$/.test(path)) return 'js';
    if (/\.css$/.test(path)) return 'css';
    // Fetched data, e.g. the wall pieces pool (/art/wall-pieces.json, every visit).
    if (/\.json$/.test(path)) return 'data';
    if (/\.(woff2?|ttf|otf)$/.test(path)) return 'font';
    if (/\.(png|jpe?g|webp|avif|gif|svg)$/.test(path) || initiator === 'img') return 'img';
    if (initiator === 'navigation' || /\.html$|\/$/.test(path)) return 'html';
    return 'other';
}

/** Scroll to the bottom (so client:visible islands and lazy images load), then go idle. */
async function loadEverything(page: Page) {
    await page.evaluate(async () => {
        document.documentElement.style.scrollBehavior = 'auto';
        for (let y = 0; y < document.documentElement.scrollHeight; y += 400) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 30));
        }
        window.scrollTo(0, 0);
    });
    await page.waitForLoadState('networkidle');
    // site.js fetches the terminal on idle; count it — it's real JS every visitor downloads.
    await page.waitForTimeout(1500);
}

async function weigh(page: Page) {
    return page.evaluate(() => {
        const entries = [
            ...performance.getEntriesByType('navigation'),
            ...performance.getEntriesByType('resource'),
        ] as PerformanceResourceTiming[];
        return entries
            .filter((e) => e.name.startsWith(location.origin))
            .map((e) => ({ url: e.name, initiator: e.initiatorType, bytes: e.decodedBodySize }));
    });
}

for (const path of PAGES) {
    test(`page weight within budget: ${path}`, async ({ page }, info) => {
        const project = info.project.name.replace(/^budget-/, '');
        await page.goto(path);
        await loadEverything(page);
        const totals: Record<Kind, number> = {
            js: 0,
            css: 0,
            font: 0,
            img: 0,
            html: 0,
            data: 0,
            other: 0,
        };
        const files = await weigh(page);
        for (const f of files) totals[kindOf(f.url, f.initiator)] += f.bytes;
        const kb = Object.fromEntries(
            Object.entries(totals).map(([k, v]) => [k, Math.round(v / 102.4) / 10]),
        ) as Record<Kind, number>;
        info.annotations.push({
            type: 'weight',
            description: `${project} ${path}: ${Object.entries(kb)
                .map(([k, v]) => `${k} ${v}KB`)
                .join(', ')}`,
        });

        const budget = BUDGET.pages[path]!;
        for (const [k, max] of Object.entries(budget) as [Kind, number][]) {
            expect(kb[k], `${path} ${k} KB on ${project}`).toBeLessThanOrEqual(max);
        }
        if (BUDGET.noFramework.includes(path)) {
            const framework = files.filter((f) => /react|client\.[\w-]+\.js$/i.test(f.url));
            expect(
                framework.map((f) => f.url),
                `${path} loads no React`,
            ).toEqual([]);
        }
    });
}

test('pages load fast on a throttled phone-class device (LCP, CLS, blocking time)', async ({
    page,
}, info) => {
    test.skip(!/mobile/.test(info.project.name), 'throttled load is measured once, as a phone');
    const cdp = await page.context().newCDPSession(page);
    // ≈ Lighthouse's mobile profile: 4× CPU slowdown, 150ms RTT, 1.6 Mbps down.
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
    });
    await page.addInitScript(() => {
        const w = window as unknown as { __vitals: { lcp: number; cls: number; tbt: number } };
        w.__vitals = { lcp: 0, cls: 0, tbt: 0 };
        new PerformanceObserver((l) => {
            for (const e of l.getEntries()) w.__vitals.lcp = e.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((l) => {
            for (const e of l.getEntries() as (PerformanceEntry & {
                value: number;
                hadRecentInput: boolean;
            })[])
                if (!e.hadRecentInput) w.__vitals.cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver((l) => {
            for (const e of l.getEntries()) w.__vitals.tbt += Math.max(0, e.duration - 50);
        }).observe({ type: 'longtask', buffered: true });
    });

    const { lcpMs, cls, tbtMs } = BUDGET.load;
    // CI runners have no GPU and 2 shared vCPUs: record there, fail only on gross regressions.
    const slack = process.env.CI ? 2 : 1;
    for (const path of PAGES) {
        await page.goto(path, { waitUntil: 'load' });
        await page.waitForTimeout(1000);
        const v = await page.evaluate(
            () =>
                (window as unknown as { __vitals: { lcp: number; cls: number; tbt: number } })
                    .__vitals,
        );
        info.annotations.push({
            type: 'vitals',
            description: `${path}: LCP ${Math.round(v.lcp)}ms, CLS ${v.cls.toFixed(3)}, TBT ${Math.round(v.tbt)}ms`,
        });
        expect(v.lcp, `${path} LCP (ms)`).toBeLessThan(lcpMs * slack);
        expect(v.cls, `${path} CLS`).toBeLessThan(cls);
        expect(v.tbt, `${path} blocking time (ms)`).toBeLessThan(tbtMs * slack);
    }
});
