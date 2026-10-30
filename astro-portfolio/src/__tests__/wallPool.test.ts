import { describe, expect, test } from 'vitest';
import { hash } from '../lib/ansi/grid';
import { PIECE_CLASSES, pieceChars, pieceToSvg, renderPiece } from '../lib/ansi/piece';
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

    test('the leet r reaches both styles, bubble included (R40)', () => {
        // wallPool()'s options without `leet`: the same piece with a capital R.
        const capital = (style: 'bubble' | 'wild') =>
            pieceToSvg(
                renderPiece('r00t', {
                    style,
                    seed: hash('wall:r00t') % 1000,
                    overspray: 0,
                    sparkles: 1,
                    dripMax: 7,
                    slashedZero: true,
                    cloud: 3,
                }),
                { attrs: { focusable: 'false' } },
            );
        for (const style of ['bubble', 'wild'] as const) {
            const p = pool.find((x) => x.word === 'r00t' && x.style === style)!;
            expect(p.svg, style).not.toBe(capital(style));
        }
    });

    test('small enough to fetch once and cache (< 100 KB raw)', () => {
        expect(JSON.stringify(pool).length).toBeLessThan(100_000);
    });
});
