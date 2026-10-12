/**
 * Structured data and machine-readable summaries, built at compile time from the typed data.
 * Pure functions (unit-tested in src/__tests__/seo.test.ts).
 */
import type { Job } from '../data/experience';
import type { Project } from '../data/projects';
import type { Skill, SkillCategory } from '../data/skills';
import { ROUTES, SITE, absUrl, type PageKind } from '../data/site';

const PERSON_ID = `${SITE.url}/#person`;
const SITE_ID = `${SITE.url}/#website`;

export function personLd() {
    return {
        '@type': 'Person',
        '@id': PERSON_ID,
        name: SITE.name,
        url: absUrl('/'),
        jobTitle: SITE.jobTitle,
        worksFor: { '@type': 'Organization', name: SITE.worksFor },
        alumniOf: { '@type': 'CollegeOrUniversity', name: SITE.alumniOf },
        homeLocation: { '@type': 'Place', name: SITE.location },
        sameAs: [...SITE.sameAs],
    };
}

/**
 * The JSON-LD graph for one page: the site, its author, and the page itself typed by kind (a
 * ProfilePage on /about/, a CollectionPage listing the projects on /projects/, …).
 */
export function pageLd(
    kind: PageKind,
    page: { path: string; title: string; description: string },
    extra: { projects?: Project[]; skills?: Skill[] } = {},
) {
    const url = absUrl(page.path);
    const type =
        kind === 'about'
            ? 'ProfilePage'
            : kind === 'projects'
              ? 'CollectionPage'
              : kind === 'contact'
                ? 'ContactPage'
                : 'WebPage';
    const webPage: Record<string, unknown> = {
        '@type': type,
        '@id': `${url}#page`,
        url,
        name: page.title,
        description: page.description,
        isPartOf: { '@id': SITE_ID },
        inLanguage: 'en',
        ...(kind === 'about' || kind === 'home' ? { mainEntity: { '@id': PERSON_ID } } : {}),
        ...(kind !== 'home'
            ? {
                  breadcrumb: {
                      '@type': 'BreadcrumbList',
                      itemListElement: [
                          { '@type': 'ListItem', position: 1, name: 'Home', item: absUrl('/') },
                          { '@type': 'ListItem', position: 2, name: page.title, item: url },
                      ],
                  },
              }
            : {}),
    };
    if (kind === 'projects' && extra.projects)
        webPage['mainEntity'] = {
            '@type': 'ItemList',
            itemListElement: extra.projects.map((p, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                item: {
                    '@type': 'CreativeWork',
                    '@id': `${absUrl('/projects/')}#${p.id}`,
                    name: p.title,
                    url: `${absUrl('/projects/')}#${p.id}`,
                    description: p.descriptions[0],
                    keywords: p.tech.join(', '),
                    author: { '@id': PERSON_ID },
                    ...(p.links?.[0] ? { sameAs: p.links.map((l) => l.href) } : {}),
                },
            })),
        };
    const person = personLd();
    if (extra.skills) Object.assign(person, { knowsAbout: extra.skills.map((s) => s.name) });
    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'WebSite',
                '@id': SITE_ID,
                url: absUrl('/'),
                name: SITE.title,
                description: SITE.summary,
                inLanguage: 'en',
                publisher: { '@id': PERSON_ID },
            },
            person,
            webPage,
        ],
    };
}

/** JSON for a <script type="application/ld+json">: `<` escaped so the data can't close the tag. */
export const ldJson = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

const CATEGORY_LABEL: Record<SkillCategory, string> = {
    languages: 'Languages',
    frameworks: 'Frameworks',
    'security-tools': 'Security tools',
    'security-skills': 'Security skills',
    cloud: 'Cloud & infrastructure',
};

function skillsByCategory(skills: Skill[]) {
    const out = new Map<string, string[]>();
    for (const s of [...skills].sort((a, b) => b.weight - a.weight)) {
        const k = CATEGORY_LABEL[s.category];
        out.set(k, [...(out.get(k) ?? []), s.name]);
    }
    return out;
}

/** /llms.txt (llmstxt.org): a short, link-rich map of the site for language models. */
export function llmsTxt(projects: Project[], skills: Skill[], jobs: Job[]): string {
    const lines = [
        `# ${SITE.name}`,
        '',
        `> ${SITE.summary} Based in ${SITE.location}. B.S. Computer Science, ${SITE.alumniOf}.`,
        '',
        `Current role: ${jobs[0]!.role}, ${jobs[0]!.org}.`,
        `Top skills: ${[...skills]
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 12)
            .map((s) => s.name)
            .join(', ')}.`,
        '',
        '## Pages',
        '',
        ...ROUTES.map((r) => `- [${r.name}](${absUrl(r.path)}): ${r.blurb}`),
        '',
        '## Projects',
        '',
        ...projects.map(
            (p) =>
                `- [${p.title}](${absUrl('/projects/')}#${p.id}): ${p.featuredDesc ?? p.descriptions[0]}`,
        ),
        '',
        '## Optional',
        '',
        `- [Full text](${absUrl('/llms-full.txt')}): every project, job and skill in one Markdown file`,
        ...SITE.sameAs.map((u) => `- [${new URL(u).hostname}](${u})`),
        '',
    ];
    return lines.join('\n');
}

/** /llms-full.txt: the whole portfolio as one Markdown document. */
export function llmsFullTxt(projects: Project[], skills: Skill[], jobs: Job[]): string {
    const out = [
        `# ${SITE.name} — ${SITE.jobTitle}`,
        '',
        `> ${SITE.summary}`,
        '',
        `Site: ${absUrl('/')}`,
    ];
    out.push('', '## Experience', '');
    for (const j of jobs) {
        out.push(`### ${j.role} — ${j.org}`, '', `${j.date}`, '');
        for (const d of j.details) out.push(`- ${d}`);
        if (j.tech.length) out.push('', `Tools: ${j.tech.join(', ')}`);
        out.push('');
    }
    out.push('## Projects', '');
    for (const p of projects) {
        out.push(
            `### ${p.title}`,
            '',
            `${p.tag}${p.date ? ` · ${p.date}` : ''} · ${absUrl('/projects/')}#${p.id}`,
            '',
        );
        for (const d of p.descriptions) out.push(d, '');
        for (const s of p.sections ?? []) {
            out.push(`${s.heading}:`, '');
            for (const i of s.items) out.push(`- ${i}`);
            out.push('');
        }
        out.push(`Tech: ${p.tech.join(', ')}`);
        for (const l of p.links ?? []) out.push(`Link: ${l.href}`);
        out.push('');
    }
    out.push('## Skills', '');
    for (const [cat, names] of skillsByCategory(skills)) out.push(`- ${cat}: ${names.join(', ')}`);
    out.push('', '## Elsewhere', '', ...SITE.sameAs.map((u) => `- ${u}`), '');
    return out.join('\n');
}

export function sitemapXml(lastmod: string): string {
    const urls = ROUTES.map(
        (r) =>
            `  <url><loc>${absUrl(r.path)}</loc><lastmod>${lastmod}</lastmod><priority>${r.priority.toFixed(1)}</priority></url>`,
    );
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urls,
        '</urlset>',
        '',
    ].join('\n');
}

/** robots.txt: everything is public; search and AI crawlers are explicitly welcome. */
export function robotsTxt(): string {
    const ai = [
        'GPTBot',
        'OAI-SearchBot',
        'ChatGPT-User',
        'ClaudeBot',
        'Claude-User',
        'Claude-SearchBot',
        'PerplexityBot',
        'Google-Extended',
        'Applebot-Extended',
        'CCBot',
    ];
    return [
        'User-agent: *',
        'Allow: /',
        '',
        '# AI search and assistants are welcome to read and cite this portfolio.',
        ...ai.flatMap((a) => [`User-agent: ${a}`, 'Allow: /', '']),
        `Sitemap: ${absUrl('/sitemap.xml')}`,
        '',
    ].join('\n');
}
