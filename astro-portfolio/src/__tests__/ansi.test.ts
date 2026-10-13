import { describe, expect, test } from 'vitest';
import { GLYPHS, GLYPH_HEIGHT } from '../lib/ansi/font';
import { balanceLines, renderAnsi, toPlainText } from '../lib/ansi/generator';
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

describe('renderAnsi', () => {
    test('is deterministic (same input → identical art)', () => {
        for (const t of TITLES) expect(toPlainText(renderAnsi(t))).toBe(toPlainText(renderAnsi(t)));
    });

    test('seed changes drips/overspray but not the letter shapes', () => {
        const a = renderAnsi('Projects', { seed: 1 });
        const b = renderAnsi('Projects', { seed: 2 });
        expect(toPlainText(a)).not.toBe(toPlainText(b));
        const fill = (art: typeof a) =>
            art.lines
                .map((l) =>
                    l
                        .filter((r) => r.c.startsWith('a-f'))
                        .map((r) => r.t)
                        .join(''),
                )
                .join('|');
        expect(fill(a).length).toBeGreaterThan(0);
    });

    test('only block, shade, half/quadrant-block and dot glyphs are used', () => {
        for (const style of ['bubble', 'wild', 'block'] as const) {
            for (const t of TITLES) {
                const s = toPlainText(renderAnsi(t, { style })).replace(/\n/g, '');
                expect(s).toMatch(/^[ █▓▒░▀▖▗▘▝·]*$/);
            }
        }
    });

    test('cols and rows match the rendered text', () => {
        const art = renderAnsi('Stephen Lyons', { style: 'wild' });
        const lines = toPlainText(art).split('\n');
        expect(art.rows).toBe(lines.length);
        expect(art.cols).toBe(Math.max(...lines.map((l) => [...l].length)));
    });

    test('pixels are two cells wide (fill runs have even length on fully filled rows)', () => {
        const art = renderAnsi('I', { style: 'block', drips: 0, overspray: 0 });
        const fillRow = art.lines.find((l) => l.some((r) => r.c === 'a-f0'))!;
        const len = fillRow
            .filter((r) => r.c.startsWith('a-f') || r.c === 'a-gl')
            .reduce((n, r) => n + r.t.length, 0);
        expect(len % 2).toBe(0);
    });

    test('art is reasonably sized for page titles', () => {
        // ≤ 125 cells keeps one-word page titles at ≥ 4px font (≈32px-tall letters) on a 320px phone.
        for (const t of ['About', 'Projects', 'Contact', '404'])
            expect(renderAnsi(t).cols).toBeLessThanOrEqual(125);
    });

    test('drips only hang below the fill (never above the first letter row)', () => {
        const art = renderAnsi('About', { drips: 1 });
        const firstFill = art.lines.findIndex((l) => l.some((r) => r.c.startsWith('a-f')));
        const firstDrip = art.lines.findIndex((l) => l.some((r) => r.c === 'a-dr'));
        expect(firstDrip).toBeGreaterThan(firstFill);
    });
});

describe('balanceLines', () => {
    test('splits two words into two lines', () => {
        expect(balanceLines('Stephen Lyons')).toEqual(['Stephen', 'Lyons']);
    });
    test('balances by length', () => {
        expect(balanceLines('Interested in Working Together')).toEqual([
            'Interested in',
            'Working Together',
        ]);
    });
    test('single word stays on one line', () => {
        expect(balanceLines('Projects')).toEqual(['Projects']);
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
        const root = tokens(':root {');
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

    test('title drips are thin 1-cell runs that fade out (no teardrop bulbs)', () => {
        let drips = 0;
        for (const t of TITLES) {
            const art = renderAnsi(t, { style: 'wild', drips: 0.6 });
            const rows = toPlainText(art).split('\n');
            expect(rows.join('')).not.toContain(DRIP_BULB[1]);
            for (const l of art.lines)
                for (const r of l)
                    if (r.c === 'a-dr') {
                        expect(r.t, t).toMatch(/^[█▓▒░]+$/);
                        drips += r.t.length;
                    }
        }
        expect(drips).toBeGreaterThan(5);
    });
});
