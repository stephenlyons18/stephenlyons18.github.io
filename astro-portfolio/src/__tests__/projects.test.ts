import projects from '../data/projects';

describe('projects.ts data integrity', () => {
    test('every project has a non-empty id', () => {
        const bad = projects.filter(p => !p.id || p.id.trim() === '');
        expect(bad).toEqual([]);
    });

    test('every project has a non-empty title', () => {
        const bad = projects.filter(p => !p.title || p.title.trim() === '');
        expect(bad.map(p => p.id)).toEqual([]);
    });

    test('every project has at least one description', () => {
        const bad = projects.filter(p => !p.descriptions || p.descriptions.length === 0);
        expect(bad.map(p => p.id)).toEqual([]);
    });

    test('every project has at least one tech tag', () => {
        const bad = projects.filter(p => !p.tech || p.tech.length === 0);
        expect(bad.map(p => p.id)).toEqual([]);
    });

    test('project ids are unique', () => {
        const ids = projects.map(p => p.id);
        const seen = new Set<string>();
        const dupes: string[] = [];
        for (const id of ids) {
            if (seen.has(id)) dupes.push(id);
            seen.add(id);
        }
        expect(dupes).toEqual([]);
    });

    test('featured projects have required featured overrides', () => {
        const featured = projects.filter(p => p.featured);
        expect(featured.length).toBeGreaterThan(0);
        // All featured projects must have at least descriptions[0] or featuredDesc
        for (const p of featured) {
            const desc = p.featuredDesc ?? p.descriptions[0];
            expect(desc).toBeTruthy();
        }
    });

    test('project image paths start with /', () => {
        const bad: string[] = [];
        for (const p of projects) {
            for (const img of p.images ?? []) {
                if (!img.src.startsWith('/')) bad.push(`${p.id}: ${img.src}`);
            }
        }
        expect(bad).toEqual([]);
    });
});
