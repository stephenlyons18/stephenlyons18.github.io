import { describe, expect, test } from 'vitest';
import { GLYPHS, GLYPH_HEIGHT } from '../lib/ansi/font';
import { renderBubble } from '../lib/ansi/bubble';
import { hash } from '../lib/ansi/grid';
import {
    PIECE_CLASSES,
    balanceLines,
    pieceToSvg,
    pieceToText,
    renderPiece,
    type Piece,
} from '../lib/ansi/piece';
import {
    BRICK,
    CELL_H,
    CELL_W,
    COURSE,
    DRIP_BULB,
    DRIP_RUNS,
    dripRows,
    renderDripStrip,
    WALL_ALPHA,
    WALL_THEMES,
    wallCells,
    wallPixels,
} from '../lib/ansi/wall';
import { readFileSync } from 'node:fs';
import { dripsToHtml } from '../lib/ansi/html';

const TITLES = [
    'Stephen Lyons',
    'About',
    'Projects',
    'Contact',
    '404',
    'Skill Graph',
    'Work History',
];

describe('ansi font', () => {
    test('every glyph is GLYPH_HEIGHT rows of equal width', () => {
        for (const [ch, g] of Object.entries(GLYPHS)) {
            expect(g.rows.length, ch).toBe(GLYPH_HEIGHT);
            for (const r of g.rows) expect(r.length, ch).toBe(g.w);
        }
    });
    test('covers A–Z and 0–9', () => {
        for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
            expect(GLYPHS[ch], ch).toBeDefined();
    });
});

const cls = (p: Piece, x: number, y: number) => PIECE_CLASSES[p.cells[y * p.w + x]!]!;
const count = (p: Piece, c: string) => [...p.cells].filter((v) => PIECE_CLASSES[v] === c).length;
const isFill = (c: string) => /^p-f\d$/.test(c);

describe('renderPiece', () => {
    test('is deterministic, and the seed changes it', { timeout: 30000 }, () => {
        for (const style of ['wild', 'bubble'] as const)
            for (const t of TITLES) {
                expect(renderPiece(t, { style })).toEqual(renderPiece(t, { style }));
                expect(pieceToText(renderPiece(t, { style, seed: 1 }))).not.toBe(
                    pieceToText(renderPiece(t, { style, seed: 2 })),
                );
            }
    });

    test('wildstyle: every fill unit is wrapped: ink touches fill, outline wraps ink, nothing fill touches the wall', () => {
        for (const style of ['wild'] as const)
            for (const t of TITLES) {
                const p = renderPiece(t, { style, drips: 0, sparkles: 0, overspray: 0 });
                for (let y = 0; y < p.h; y++)
                    for (let x = 0; x < p.w; x++) {
                        if (!isFill(cls(p, x, y))) continue;
                        // A fill unit's 4 neighbours are fill, highlights, ink or outline — never
                        // bare wall: the letter is always closed by its ink line.
                        for (const [dx, dy] of [
                            [1, 0],
                            [-1, 0],
                            [0, 1],
                            [0, -1],
                        ]) {
                            const n = cls(p, x + dx!, y + dy!) ?? '';
                            expect(n, `${style} ${t} @${x},${y}`).not.toBe('');
                        }
                    }
            }
    });

    test('wildstyle counters stay dark: the O, A, 4… holes are ink, never fill or outline', () => {
        const p = renderPiece('O', {
            style: 'wild',
            drips: 0,
            sparkles: 0,
            overspray: 0,
            shine: false,
            splits: false,
            cloud: 0,
        });
        const mid = Math.floor(p.h / 2) - 2;
        const row = Array.from({ length: p.w }, (_, x) => cls(p, x, mid));
        // Across the middle of an O: outline, ink, fill, ink (the counter), fill, ink, outline.
        const runs = row
            .filter((c, i) => c && c !== row[i - 1])
            .filter((c) => !c.startsWith('p-x'));
        expect(runs.slice(0, 7).map((c) => (isFill(c) ? 'f' : c))).toEqual([
            'p-ol',
            'p-ik',
            'f',
            'p-ik',
            'f',
            'p-ik',
            'p-ol',
        ]);
    });

    test('has the parts of a piece: outline, ink, 3D, highlights, drips', () => {
        for (const style of ['wild', 'bubble'] as const) {
            const p = renderPiece('Stephen Lyons', { style, drips: 0.6 });
            for (const c of ['p-ol', 'p-ik', 'p-x1', 'p-sh', 'p-dr'])
                expect(count(p, c), `${style} ${c}`).toBeGreaterThan(0);
        }
        expect(
            count(renderPiece('Projects', { style: 'wild', splits: false }), 'p-cu'),
        ).toBeGreaterThan(0);
    });

    test('wildstyle v3: splits, a swoosh, striped 3D and a backdrop cloud', () => {
        const p = renderPiece('Stephen Lyons', { style: 'wild' });
        const flat = renderPiece('Stephen Lyons', {
            style: 'wild',
            splits: false,
            swoosh: false,
            cloud: 0,
        });
        // Splits: a second tone (the ramp's foot) below a dark break, on most letters.
        expect(count(p, 'p-f8')).toBeGreaterThan(count(flat, 'p-f8'));
        expect(count(p, 'p-ik')).toBeGreaterThan(count(flat, 'p-ik'));
        // The cloud sits behind: never between a letter's fill and its outline, and it surrounds
        // the piece (some on every side).
        expect(count(p, 'p-bg')).toBeGreaterThan(200);
        const rows = Array.from({ length: p.h }, (_, y) =>
            Array.from({ length: p.w }, (_, x) => cls(p, x, y)),
        );
        const q = Math.floor(p.h / 4);
        expect(rows.slice(0, q).some((r) => r.includes('p-bg'))).toBe(true);
        expect(rows.slice(-q).some((r) => r.includes('p-bg'))).toBe(true);
        for (let y = 0; y < p.h; y++)
            for (let x = 0; x < p.w; x++)
                if (isFill(cls(p, x, y)))
                    for (const [dx, dy] of [
                        [1, 0],
                        [-1, 0],
                        [0, 1],
                        [0, -1],
                    ])
                        expect(cls(p, x + dx!, y + dy!)).not.toBe('p-bg');
        // Striped 3D: both steps alternate in depth.
        expect(count(p, 'p-x1')).toBeGreaterThan(0);
        expect(count(p, 'p-x2')).toBeGreaterThan(0);
        // The swoosh reaches out left of the first letter.
        expect(p.w).toBeGreaterThan(flat.w);
    });

    test('drips are thin (1u) runs that hang below a fill and fade at the tip', () => {
        const p = renderPiece('About', { style: 'wild', drips: 1, dripMax: 8 });
        for (let y = 0; y < p.h; y++)
            for (let x = 0; x < p.w; x++) {
                const c = cls(p, x, y);
                if (c !== 'p-d2') continue;
                // Walk up the drip to a fill; never two drips side by side.
                let yy = y;
                while (/^p-d[r12]$/.test(cls(p, x, yy - 1)!)) yy--;
                expect(isFill(cls(p, x, yy - 1)!), `drip @${x},${y}`).toBe(true);
                expect(cls(p, x - 1, y)).not.toMatch(/^p-d/);
                expect(cls(p, x + 1, y)).not.toMatch(/^p-d/);
            }
    });

    test('height is a whole number of text rows, and page titles fit a phone', () => {
        for (const t of TITLES) {
            const p = renderPiece(t);
            expect(p.h % 2).toBe(0);
            expect(pieceToText(p).split('\n').length).toBe(p.h / 2);
        }
        // ≤ 140u keeps one-word page titles at ≥ 2.2px per unit (≈36px-tall letters) at 320px.
        for (const style of ['wild', 'bubble'] as const)
            for (const t of ['About', 'Projects', 'Contact', '404'])
                expect(renderPiece(t, { style }).w, `${style} ${t}`).toBeLessThanOrEqual(140);
    });

    test('text view uses only half and full blocks', () => {
        expect(pieceToText(renderPiece('SL', { style: 'bubble' }))).toMatch(/^[ ▀▄█\n]*$/);
    });
});

describe('bubble pieces (the original title look, R28)', () => {
    const at = (p: Piece, y: number) => Array.from({ length: p.w }, (_, x) => cls(p, x, y));
    const runs = (row: string[]) =>
        row.filter((c, i) => c !== row[i - 1]).map((c) => (isFill(c) ? 'f' : c));

    test('locked: the titles render exactly as reviewed (a change here is a visible change)', () => {
        // Checked unit for unit against the R6/R7 generator (overlap 0, no seams: identical apart
        // from a front letter's outline now covering the next letter at a lean/bounce junction).
        const want: Record<string, [number, number, number]> = {
            'Stephen Lyons': [175, 34, 2019228348],
            About: [74, 36, 3160936062],
            Projects: [115, 34, 105108163],
            Contact: [100, 36, 2849827036],
            '404': [46, 36, 2912872422],
        };
        for (const [t, [w, h, sum]] of Object.entries(want)) {
            const p = renderPiece(t, { style: 'bubble' });
            expect([p.w, p.h, hash(String.fromCharCode(...p.cells))], t).toEqual([w, h, sum]);
        }
    });

    test('each letter lies over the next: its outline, a dark seam, then the letter behind', () => {
        const p = renderBubble('HH', { drips: 0, overspray: 0 });
        // A row through the crossbar: front H's fill → its outline → seam → back H's fill.
        const rows = Array.from({ length: p.h }, (_, y) => runs(at(p, y)).join(' '));
        expect(rows.some((r) => r.includes('f p-ol p-ik f'))).toBe(true);
        expect(rows.some((r) => r.includes('f p-ik p-ol f'))).toBe(false);
    });

    test('words never overlap across a space; counters are bare wall, not outline', () => {
        expect(count(renderBubble('H H', { drips: 0, overspray: 0 }), 'p-ik')).toBe(0);
        const o = renderBubble('O', { drips: 0, overspray: 0 });
        const mid = runs(at(o, Math.floor(o.h / 2) - 2)).filter((c) => !c.startsWith('p-x'));
        expect(mid.slice(0, 5)).toEqual(['p-ol', 'f', '', 'f', 'p-ol']);
    });

    test('drawn on the original 0.6em × 0.5em cells: units stretch to the drawn ratio', () => {
        const p = renderPiece('SL', { style: 'bubble' });
        expect(p.aspect).toBe(1.2);
        const svg = pieceToSvg(p, { attrs: { style: '--w:9' } });
        expect(svg).toContain('data-piece="bubble"');
        expect(svg).toContain('preserveAspectRatio="none"');
        expect(svg).toContain(`style="--w:9;aspect-ratio:${+(p.w * 1.2).toFixed(2)}/${p.h}"`);
    });

    test('headings keep the original 0; leet wall words can slash it', () => {
        const plain = pieceToText(renderBubble('0', { drips: 0, overspray: 0 }));
        const slashed = pieceToText(
            renderBubble('0', { drips: 0, overspray: 0, slashedZero: true }),
        );
        expect(plain).not.toBe(slashed);
    });
});

describe('pieceToSvg', () => {
    const p = renderPiece('SL', { style: 'bubble' });
    test('one path per class on a unit viewBox, themeable by class', () => {
        const svg = pieceToSvg(p, { attrs: { 'aria-hidden': 'true' } });
        expect(svg).toMatch(
            new RegExp(`^<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.w} ${p.h}"`),
        );
        expect(svg).toContain('shape-rendering="crispEdges"');
        expect(svg).toContain('aria-hidden="true"');
        const classes = [...svg.matchAll(/class="(p-[a-z0-9]+)"/g)].map((m) => m[1]);
        expect(new Set(classes).size).toBe(classes.length);
        expect(classes).toContain('p-ol');
    });
    test('painted in order, the paths reproduce every opaque unit exactly', () => {
        for (const piece of [p, renderPiece('Stephen Lyons', { style: 'wild' })]) {
            const svg = pieceToSvg(piece);
            const got = new Array<string>(piece.w * piece.h).fill('');
            for (const [, c, d] of svg.matchAll(/<path class="(p-[a-z0-9]+)" d="([^"]*)"/g)) {
                if (c === 'p-os') continue; // mist dots, not cells
                let x = 0;
                let y = 0;
                for (const [, op, a, b, w, h] of d!.matchAll(
                    /([Mm])(-?[\d.]+) (-?[\d.]+)h([\d.]+)v([\d.]+)h-[\d.]+z/g,
                )) {
                    [x, y] = op === 'M' ? [+a!, +b!] : [x + +a!, y + +b!];
                    for (let yy = y; yy < y + +h!; yy++)
                        for (let xx = x; xx < x + +w!; xx++) got[yy * piece.w + xx] = c!;
                }
            }
            for (let i = 0; i < got.length; i++) {
                const want = PIECE_CLASSES[piece.cells[i]!]!;
                if (['p-os', 'p-d1', 'p-d2', 'p-d3', ''].includes(want)) continue;
                expect(got[i], `unit ${i % piece.w},${Math.floor(i / piece.w)}`).toBe(want);
            }
        }
        expect(pieceToSvg(p, { colors: { 'p-ol': '#fff' } })).not.toContain('class=');
    });
});

describe('wall tile', () => {
    const tile = wallPixels(WALL_THEMES['wildstyle']!);

    test('is seamless: the brick period divides the tile', () => {
        expect(80 % BRICK).toBe(0);
        expect(30 % (COURSE * 2)).toBe(0);
        expect([tile.width, tile.height]).toEqual([80 * CELL_W, 30 * CELL_H]);
        expect(tile.data.length).toBe(tile.width * tile.height * 4);
    });

    test('deterministic, and the seed changes it', () => {
        expect(wallPixels(WALL_THEMES['wildstyle']!)).toEqual(tile);
        expect(wallPixels(WALL_THEMES['wildstyle']!, 80, 30, 2).data).not.toEqual(tile.data);
    });

    test('each cell lights its glyph’s dither, in its layer colour at the wall strength', () => {
        const cells = wallCells();
        const dots: Record<string, number> = { '░': 1, '▒': 2, '▓': 3 };
        const lit = (cx: number, cy: number) => {
            let n = 0;
            for (let y = cy * CELL_H; y < (cy + 1) * CELL_H; y++)
                for (let x = cx * CELL_W; x < (cx + 1) * CELL_W; x++)
                    if (tile.data[(y * tile.width + x) * 4 + 3]) n++;
            return n;
        };
        for (const [cy, cx] of [
            [0, 0],
            [2, 9],
            [7, 33],
            [29, 79],
        ] as const) {
            const c = cells[cy]![cx]!;
            expect(lit(cx, cy)).toBe(c.c ? (dots[c.ch]! * CELL_W * CELL_H) / 4 : 0);
        }
        const firstBrick = tile.data.slice(0, 4);
        expect([...firstBrick]).toEqual([0x3c, 0xc4, 0xff, Math.round(WALL_ALPHA.b * 255)]);
    });

    test('WALL_THEMES matches the theme tokens in global.css (b = --ui, m = --ui-3, c = --ui-2)', () => {
        const css = readFileSync(new URL('../styles/global.css', import.meta.url), 'utf8');
        const tokens = (sel: string) =>
            Object.fromEntries(
                [
                    ...css
                        .slice(css.indexOf(sel))
                        .split('}')[0]!
                        .matchAll(/(--[\w-]+):\s*([^;]+);/g),
                ].map((m) => [m[1]!, m[2]!.trim()]),
            );
        // The spray cans live in :root; the default theme's slots in `:root, [data-theme='wildstyle']`.
        const root = { ...tokens(':root {'), ...tokens(":root,\n[data-theme='wildstyle'] {") };
        const hex = (v: string, theme: Record<string, string>): string => {
            const ref = /^var\((--[\w-]+)\)$/.exec(v);
            return ref ? hex(theme[ref[1]!] ?? root[ref[1]!]!, theme) : v.toLowerCase();
        };
        for (const [name, want] of Object.entries(WALL_THEMES)) {
            const theme =
                name === 'wildstyle' ? root : { ...root, ...tokens(`[data-theme='${name}'] {`) };
            expect(
                {
                    b: hex(theme['--ui']!, theme),
                    m: hex(theme['--ui-3']!, theme),
                    c: hex(theme['--ui-2']!, theme),
                },
                name,
            ).toEqual(want);
        }
    });
});

describe('drips', () => {
    test('a drip is a 1-cell stem over a 3-cell teardrop', () => {
        expect(dripRows(0)).toEqual(['▗█▖', '▟█▙', '▜█▛']);
        expect(dripRows(2)).toEqual([' █ ', ' █ ', '▗█▖', '▟█▙', '▜█▛']);
        for (const r of dripRows(3)) expect([...r]).toHaveLength(3);
    });

    test('strip: drips spaced for their bulbs, inside the strip, deterministic', () => {
        for (const seed of [1, 2, 3, 6, 11]) {
            const s = renderDripStrip(200, seed, { maxStem: 6, minStem: 2 });
            expect(s.drips.length).toBeGreaterThan(5);
            expect(s.rows).toBe(6 + DRIP_BULB.length);
            s.drips.forEach((d, i) => {
                expect(d.x).toBeGreaterThanOrEqual(2);
                expect(d.x).toBeLessThanOrEqual(197);
                expect(d.stem).toBeGreaterThanOrEqual(2);
                expect(d.stem).toBeLessThanOrEqual(6);
                if (i) expect(d.x - s.drips[i - 1]!.x).toBeGreaterThanOrEqual(5);
            });
            expect(renderDripStrip(200, seed, { maxStem: 6, minStem: 2 })).toEqual(s);
        }
    });

    test('runs: neighbours never share a run, and every run spans the strip', () => {
        const s = renderDripStrip(280, 31, { maxStem: 4, minStem: 1, density: 0.08 });
        s.drips.forEach((d, i) => {
            expect(d.run).toBeGreaterThanOrEqual(0);
            expect(d.run).toBeLessThan(DRIP_RUNS);
            if (i) expect(d.run).not.toBe(s.drips[i - 1]!.run);
        });
        for (let k = 0; k < DRIP_RUNS; k++) {
            const xs = s.drips.filter((d) => d.run === k).map((d) => d.x);
            expect(Math.max(...xs) - Math.min(...xs), `run ${k}`).toBeGreaterThan(280 / 3);
        }
    });

    test('html: one layer per run holding its drips, inside one clip, optional bar', () => {
        const s = renderDripStrip(60, 4);
        const html = dripsToHtml(s, true);
        const runs = new Set(s.drips.map((d) => d.run));
        expect(html.match(/class="drip-run"/g)).toHaveLength(runs.size);
        expect(html.match(/class="drip"/g)).toHaveLength(s.drips.length);
        expect(html.match(/class="drips__clip"/g)).toHaveLength(1);
        expect(html).toContain(`<span class="d-bar">${'▄'.repeat(60)}</span>`);
        expect(dripsToHtml(s, false)).not.toContain('d-bar');
        const d0 = s.drips[0]!;
        expect(html).toContain(`--x:${d0.x};--h:${d0.stem + 3}">`);
        // No falling drops: paint runs down the wall, it never detaches or splats.
        expect(html).not.toMatch(/drop/);
    });

    test('the teardrop tapers in from the stem and swells to a rounded bottom', () => {
        // Half-cell pixel widths per half-row: each glyph → [top, bottom] lit halves of its cell.
        const width = (row: string, top: boolean) =>
            [...row].reduce((n, ch) => {
                const t: Record<string, [number, number]> = {
                    ' ': [0, 0],
                    '█': [2, 2],
                    '▗': [0, 1],
                    '▖': [0, 1],
                    '▟': [1, 2],
                    '▙': [1, 2],
                    '▜': [2, 1],
                    '▛': [2, 1],
                    '▝': [1, 0],
                    '▘': [1, 0],
                };
                return n + t[ch]![top ? 0 : 1];
            }, 0);
        const profile = DRIP_BULB.flatMap((r) => [width(r, true), width(r, false)]);
        expect(profile).toEqual([2, 4, 4, 6, 6, 4]);
    });
});
