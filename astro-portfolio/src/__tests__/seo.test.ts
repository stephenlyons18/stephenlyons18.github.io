import { describe, expect, test } from 'vitest';
import { jobs } from '../data/experience';
import projects from '../data/projects';
import { ROUTES, SITE } from '../data/site';
import { skills } from '../data/skills';
import { ldJson, llmsFullTxt, llmsTxt, pageLd, robotsTxt, sitemapXml } from '../lib/seo';

const page = { path: '/projects/', title: 'Projects — Stephen Lyons', description: 'x' };

describe('JSON-LD', () => {
    test('every page: WebSite + Person + the page, linked by @id', () => {
        for (const r of ROUTES) {
            const ld = pageLd(r.kind, { ...page, path: r.path });
            const types = ld['@graph'].map((n) => n['@type']);
            expect(types.slice(0, 2)).toEqual(['WebSite', 'Person']);
            const p = ld['@graph'][2] as Record<string, unknown>;
            expect(p['url']).toBe(`${SITE.url}${r.path}`);
            expect(p['isPartOf']).toEqual({ '@id': `${SITE.url}/#website` });
        }
        expect(pageLd('about', page)['@graph'][2]!['@type']).toBe('ProfilePage');
        expect(pageLd('contact', page)['@graph'][2]!['@type']).toBe('ContactPage');
    });

    test('projects page lists every project as a CreativeWork', () => {
        const ld = pageLd('projects', page, { projects });
        const list = (
            ld['@graph'][2] as { mainEntity: { itemListElement: { item: { name: string } }[] } }
        ).mainEntity.itemListElement;
        expect(list.map((i) => i.item.name)).toEqual(projects.map((p) => p.title));
    });

    test('the person knows about every skill, and links out (sameAs)', () => {
        const person = pageLd('about', page, { skills })['@graph'][1] as {
            knowsAbout: string[];
            sameAs: string[];
        };
        expect(person.knowsAbout).toHaveLength(skills.length);
        expect(person.sameAs).toContain('https://github.com/stephenlyons18');
    });

    test('ldJson cannot close its <script> tag', () => {
        expect(ldJson({ a: '</script><script>alert(1)</script>' })).not.toContain('</script>');
    });
});

describe('llms.txt', () => {
    const txt = llmsTxt(projects, skills, jobs);
    test('llmstxt.org shape: H1, blockquote summary, H2 sections of links', () => {
        const lines = txt.split('\n');
        expect(lines[0]).toBe(`# ${SITE.name}`);
        expect(lines[2]).toMatch(/^> /);
        expect(txt).toMatch(/^## Pages$/m);
        expect(txt).toMatch(/^## Projects$/m);
    });
    test('links every route and every project', () => {
        for (const r of ROUTES) expect(txt).toContain(`](${SITE.url}${r.path})`);
        for (const p of projects)
            expect(txt).toContain(`[${p.title}](${SITE.url}/projects/#${p.id})`);
    });
    test('the full text carries every job, project and skill', () => {
        const full = llmsFullTxt(projects, skills, jobs);
        for (const j of jobs) expect(full).toContain(j.role);
        for (const p of projects) expect(full).toContain(`### ${p.title}`);
        for (const s of skills) expect(full).toContain(s.name);
    });
});

test('sitemap: one absolute <url> per route', () => {
    const xml = sitemapXml('2026-10-12');
    expect(xml.match(/<url>/g)).toHaveLength(ROUTES.length);
    for (const r of ROUTES) expect(xml).toContain(`<loc>${SITE.url}${r.path}</loc>`);
});

test('robots.txt allows everyone, names AI crawlers, points at the sitemap', () => {
    const r = robotsTxt();
    expect(r).not.toMatch(/Disallow/);
    for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'])
        expect(r).toContain(`User-agent: ${bot}\nAllow: /`);
    expect(r).toContain(`Sitemap: ${SITE.url}/sitemap.xml`);
});
