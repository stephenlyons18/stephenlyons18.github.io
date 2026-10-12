import { describe, expect, test } from 'vitest';
import { jobs, JOBS_BY_SKILL } from '../data/experience';
import { skills } from '../data/skills';

const skillNames = new Set(skills.map((s) => s.name));

describe('experience.ts data integrity', () => {
    test('job ids are unique slugs', () => {
        const ids = jobs.map((j) => j.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    });

    test('every job has a role, org, date and at least one detail', () => {
        for (const j of jobs) {
            expect(j.role.trim(), j.id).not.toBe('');
            expect(j.org.trim(), j.id).not.toBe('');
            expect(j.shortOrg.trim(), j.id).not.toBe('');
            expect(j.date.trim(), j.id).not.toBe('');
            expect(j.details.length, j.id).toBeGreaterThan(0);
        }
    });

    test('every job skill is a real skill in skills.ts', () => {
        const unknown = jobs.flatMap((j) =>
            j.skills.filter((s) => !skillNames.has(s)).map((s) => `${j.id}: ${s}`),
        );
        expect(unknown).toEqual([]);
    });

    test('no duplicate skills within a job', () => {
        for (const j of jobs) expect(new Set(j.skills).size, j.id).toBe(j.skills.length);
    });

    test('JOBS_BY_SKILL is the exact inverse of job.skills', () => {
        for (const j of jobs) for (const s of j.skills) expect(JOBS_BY_SKILL.get(s)).toContain(j);
        for (const [s, js] of JOBS_BY_SKILL) for (const j of js) expect(j.skills).toContain(s);
    });

    test('jobs are not graph nodes', () => {
        const jobLike = skills.filter((s) => jobs.some((j) => s.name.includes(j.role)));
        expect(jobLike.map((s) => s.name)).toEqual([]);
    });
});
