import { skills } from '../data/skills';

const skillNames = new Set(skills.map(s => s.name));

describe('skills.ts data integrity', () => {
    test('no skill has a self-connection', () => {
        const selfRefs: string[] = [];
        for (const skill of skills) {
            if (skill.connections?.includes(skill.name)) {
                selfRefs.push(skill.name);
            }
        }
        expect(selfRefs).toEqual([]);
    });

    test('no skill has duplicate connections', () => {
        const duplicates: Record<string, string[]> = {};
        for (const skill of skills) {
            if (!skill.connections) continue;
            const seen = new Set<string>();
            const dupes: string[] = [];
            for (const c of skill.connections) {
                if (seen.has(c)) dupes.push(c);
                seen.add(c);
            }
            if (dupes.length > 0) duplicates[skill.name] = dupes;
        }
        expect(duplicates).toEqual({});
    });

    test('every connection name references a real skill', () => {
        const unknown: Record<string, string[]> = {};
        for (const skill of skills) {
            if (!skill.connections) continue;
            const bad = skill.connections.filter(c => !skillNames.has(c));
            if (bad.length > 0) unknown[skill.name] = bad;
        }
        expect(unknown).toEqual({});
    });

    test('all connections are bidirectional', () => {
        const missing: Array<{ from: string; to: string }> = [];
        for (const skill of skills) {
            if (!skill.connections) continue;
            for (const conn of skill.connections) {
                const other = skills.find(s => s.name === conn);
                if (!other) continue; // caught by previous test
                if (!other.connections?.includes(skill.name)) {
                    missing.push({ from: skill.name, to: conn });
                }
            }
        }
        expect(missing).toEqual([]);
    });

    test('each skill has weight between 1 and 10', () => {
        const bad = skills.filter(s => s.weight < 1 || s.weight > 10);
        expect(bad.map(s => s.name)).toEqual([]);
    });
});
