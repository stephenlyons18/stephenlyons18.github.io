import { expect, test } from '@playwright/test';

import { PAGES } from './pages';

// SEO + AI-search readiness. Runs once (desktop): it's about the HTML, not the device.
test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'device-independent'));

const ORIGIN = 'https://stephenlyons.dev';

test('every page: unique title + description, canonical, social card, valid JSON-LD', async ({
    page,
}) => {
    const titles = new Set<string>();
    for (const path of PAGES) {
        await page.goto(path);
        const meta = await page.evaluate(() => {
            const m = (sel: string) => document.querySelector(sel)?.getAttribute('content') ?? null;
            return {
                title: document.title,
                description: m('meta[name="description"]'),
                robots: m('meta[name="robots"]'),
                canonical:
                    document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
                ogTitle: m('meta[property="og:title"]'),
                ogImage: m('meta[property="og:image"]'),
                ogUrl: m('meta[property="og:url"]'),
                twitter: m('meta[name="twitter:card"]'),
                lang: document.documentElement.lang,
                h1: document.querySelectorAll('h1').length,
                levels: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(
                    (h) => +h.tagName[1]!,
                ),
                ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(
                    (s) => s.textContent ?? '',
                ),
            };
        });
        expect(titles.has(meta.title), `${path} title is unique`).toBe(false);
        titles.add(meta.title);
        expect(meta.title.length).toBeGreaterThan(5);
        expect(meta.title.length).toBeLessThanOrEqual(60);
        expect(meta.description!.length, `${path} description`).toBeGreaterThanOrEqual(50);
        expect(meta.description!.length, `${path} description`).toBeLessThanOrEqual(160);
        expect(meta.lang).toBe('en');
        expect(meta.h1, `${path} has one h1`).toBe(1);
        meta.levels.forEach((l, i) => {
            if (i) expect(l - meta.levels[i - 1]!, `${path} heading skip`).toBeLessThanOrEqual(1);
        });
        expect(meta.ogImage).toBe(`${ORIGIN}/og.png`);
        expect(meta.twitter).toBe('summary_large_image');
        expect(meta.ogTitle).toBe(meta.title);

        if (path === '/404.html') {
            expect(meta.robots).toMatch(/noindex/);
            expect(meta.canonical).toBeNull();
            expect(meta.ld).toEqual([]);
            continue;
        }
        expect(meta.robots).toMatch(/^index, follow/);
        expect(meta.canonical).toBe(`${ORIGIN}${path}`);
        expect(meta.ogUrl).toBe(meta.canonical);
        expect(meta.ld).toHaveLength(1);
        const ld = JSON.parse(meta.ld[0]!);
        expect(ld['@context']).toBe('https://schema.org');
        const types = ld['@graph'].map((n: { '@type': string }) => n['@type']);
        expect(types).toContain('WebSite');
        expect(types).toContain('Person');
    }
});

test('every page is well-formed: nothing between the doctype and <html>', async ({ request }) => {
    // A stray frontmatter fence (R54) once rendered a literal "---" there, which the browser
    // then showed as text at the top of the page.
    for (const path of PAGES) {
        const html = await (await request.get(path)).text();
        expect(html.slice(0, 40), path).toMatch(/^<!DOCTYPE html>\s*<html[\s>]/i);
    }
});

test('og.png is a 1200×630 PNG', async ({ request }) => {
    const res = await request.get('/og.png');
    expect(res.ok()).toBe(true);
    const buf = await res.body();
    expect(buf.subarray(1, 4).toString()).toBe('PNG');
    expect(buf.readUInt32BE(16)).toBe(1200);
    expect(buf.readUInt32BE(20)).toBe(630);
});

test('sitemap, robots.txt and llms.txt are served and agree with the routes', async ({
    request,
}) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(PAGES.filter((p) => p !== '/404.html').map((p) => `${ORIGIN}${p}`));
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
    const llms = await request.get('/llms.txt');
    expect(llms.ok()).toBe(true);
    expect(await llms.text()).toMatch(/^# Stephen Lyons\n\n> /);
    expect((await request.get('/llms-full.txt')).ok()).toBe(true);
});
