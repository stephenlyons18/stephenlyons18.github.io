/**
 * Site identity and routes: the single source for canonical URLs, Open Graph, JSON-LD, the
 * sitemap, robots.txt and llms.txt. Pages pass their own title/description to BaseLayout.
 */
export const SITE = {
    url: 'https://stephenlyons.dev',
    name: 'Stephen Lyons',
    title: 'Stephen Lyons — Cybersecurity Engineer',
    jobTitle: 'Cybersecurity Engineer',
    worksFor: 'Yamaha Motor Corporation',
    location: 'Southern California',
    summary:
        'Cybersecurity Engineer at Yamaha Motor Corporation: DevSecOps, cloud security, SIEM engineering, endpoint protection and incident response.',
    sameAs: ['https://github.com/stephenlyons18', 'https://linkedin.com/in/stephen-lyons'],
    alumniOf: 'California State University, Long Beach',
    locale: 'en_US',
} as const;

export type PageKind = 'home' | 'about' | 'projects' | 'contact' | 'error';

export interface Route {
    path: string;
    name: string;
    kind: PageKind;
    /** One line for llms.txt. */
    blurb: string;
    priority: number;
}

/** Every indexable route (the 404 page is not one). Keep in sync with scripts/postbuild.mjs. */
export const ROUTES: Route[] = [
    {
        path: '/',
        name: 'Home',
        kind: 'home',
        priority: 1,
        blurb: 'Overview, featured projects and capabilities',
    },
    {
        path: '/about/',
        name: 'About',
        kind: 'about',
        priority: 0.9,
        blurb: 'Background, work history, education and an interactive skill graph',
    },
    {
        path: '/projects/',
        name: 'Projects',
        kind: 'projects',
        priority: 0.9,
        blurb: 'Security, hardware and full-stack projects with write-ups and photos',
    },
    {
        path: '/contact/',
        name: 'Contact',
        kind: 'contact',
        priority: 0.6,
        blurb: 'How to get in touch',
    },
];

export const absUrl = (path: string) => new URL(path, SITE.url).href;
