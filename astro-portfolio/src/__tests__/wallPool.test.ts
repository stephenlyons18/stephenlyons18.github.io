import { describe, expect, test } from 'vitest';
import { PIECE_CLASSES, pieceChars } from '../lib/ansi/piece';
import { WALL_WORDS, wallPool } from '../lib/ansi/wallPool';

describe('wall pool (src/lib/ansi/wallPool.ts)', () => {
    const pool = wallPool();

    test('every word in both styles, deterministic', () => {
        expect(pool.map((p) => `${p.word}|${p.style}`).sort()).toEqual(
            WALL_WORDS.flatMap((w) => [`${w}|bubble`, `${w}|wild`]).sort(),
        );
        expect(wallPool()).toEqual(pool);
    });

    test('each piece is a themeable SVG with a sane drawn ratio, and no mist (bytes)', () => {
        for (const p of pool) {
            expect(p.svg, p.word).toMatch(new RegExp(`^<svg [^>]*data-piece="${p.style}"`));
            expect(p.ratio, p.word).toBeGreaterThan(0.6);
            expect(p.ratio, p.word).toBeLessThan(6);
            for (const [, c] of p.svg.matchAll(/class="([\w-]+)"/g))
                expect(PIECE_CLASSES as readonly string[], c).toContain(c);
            expect(p.svg).not.toContain('p-os');
        }
    });

    test('the wall gets the title lettering fixes (R38): no bubble seams, caps except leet', () => {
        // R34: bubble pieces carry no dark overlap seams (ink is wildstyle's).
        for (const p of pool.filter((x) => x.style === 'bubble'))
            expect(p.svg, p.word).not.toContain('p-ik');
        // R36: only the leet word keeps its lowercase r; everything else is drawn in caps.
        for (const w of WALL_WORDS)
            expect(pieceChars(w, true).join(''), w).toBe(w === 'r00t' ? 'r00T' : w.toUpperCase());
    });

    test('small enough to fetch once and cache (< 100 KB raw)', () => {
        expect(JSON.stringify(pool).length).toBeLessThan(100_000);
    });
});
