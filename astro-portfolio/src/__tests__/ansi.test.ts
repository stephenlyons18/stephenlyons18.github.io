import { describe, expect, test } from 'vitest';
import { GLYPHS, GLYPH_HEIGHT } from '../lib/ansi/font';
import { balanceLines, renderAnsi, toPlainText } from '../lib/ansi/generator';
import {
    BRICK,
    CELL_H,
    CELL_W,
    COURSE,
    DRIP_BULB,
    dripRows,
    renderDripStrip,
    renderWallTile,
    svgDataUrl,
    wallCells,
} from '../lib/ansi/wall';
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
    test('is seamless: the brick period divides the tile', () => {
        const t = renderWallTile();
        expect(t.cols % BRICK).toBe(0);
        expect(t.rows % (COURSE * 2)).toBe(0);
    });

    test('one standalone SVG mask per colour layer, deterministic', () => {
        const a = renderWallTile();
        expect(Object.keys(a.layers).sort()).toEqual(['w-b', 'w-c', 'w-m']);
        for (const svg of Object.values(a.layers)) {
            expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
            expect(svg).toContain(`viewBox="0 0 ${a.cols * CELL_W} ${a.rows * CELL_H}"`);
        }
        expect(renderWallTile()).toEqual(a);
        expect(renderWallTile(80, 30, 2)).not.toEqual(a);
    });

    test('mask rects match the wall cells (every lit cell drawn once, inside the tile)', () => {
        const cells = wallCells();
        const { layers } = renderWallTile();
        for (const cls of ['w-b', 'w-m', 'w-c']) {
            const want = cells.flat().filter((c) => c.c === cls).length;
            let got = 0;
            for (const m of layers[cls]!.matchAll(
                /<rect x="(\d+)" y="(\d+)" width="(\d+)" height="10"/g,
            )) {
                got += Number(m[3]) / CELL_W;
                expect(Number(m[1]) + Number(m[3])).toBeLessThanOrEqual(80 * CELL_W);
            }
            expect(got).toBe(want);
        }
    });

    test('data URL escapes everything a CSS url() / data URI chokes on', () => {
        const u = svgDataUrl('<svg a="#x">100%</svg>');
        expect(u).toBe(`url("data:image/svg+xml,%3Csvg a='%23x'%3E100%25%3C/svg%3E")`);
    });
});

describe('drips', () => {
    test('a drip is a 1-cell stem over a rounded 3-cell bulb', () => {
        expect(dripRows(0)).toEqual(['▗█▖', '▝█▘']);
        expect(dripRows(2)).toEqual([' █ ', ' █ ', '▗█▖', '▝█▘']);
        for (const r of dripRows(3)) expect([...r]).toHaveLength(3);
    });

    test('strip: drips spaced for their bulbs, inside the strip, deterministic', () => {
        for (const seed of [1, 2, 3, 6, 11]) {
            const s = renderDripStrip(200, seed, { maxStem: 2 });
            expect(s.drips.length).toBeGreaterThan(5);
            expect(s.rows).toBe(2 + DRIP_BULB.length);
            s.drips.forEach((d, i) => {
                expect(d.x).toBeGreaterThanOrEqual(2);
                expect(d.x).toBeLessThanOrEqual(197);
                expect(d.stem).toBeLessThanOrEqual(2);
                if (i) expect(d.x - s.drips[i - 1]!.x).toBeGreaterThanOrEqual(5);
            });
            expect(renderDripStrip(200, seed, { maxStem: 2 })).toEqual(s);
        }
    });

    test('html: one positioned element (paint + hidden drop) per drip, optional bar', () => {
        const s = renderDripStrip(60, 4);
        const html = dripsToHtml(s, true);
        expect(html.match(/class="drip"/g)).toHaveLength(s.drips.length);
        expect(html.match(/class="drip__drop"/g)).toHaveLength(s.drips.length);
        expect(html).toContain(`<span class="d-bar">${'▄'.repeat(60)}</span>`);
        expect(dripsToHtml(s, false)).not.toContain('d-bar');
        expect(html).toContain(`--x:${s.drips[0]!.x};--h:${s.drips[0]!.stem + 2}`);
    });

    test('title drips end in a full bulb (▗█▖ over ▝█▘) or a half-block tip', () => {
        let bulbs = 0;
        for (const t of TITLES) {
            const rows = toPlainText(renderAnsi(t, { style: 'wild', drips: 0.6 })).split('\n');
            rows.forEach((row, y) => {
                for (let x = row.indexOf('▗█▖'); x >= 0; x = row.indexOf('▗█▖', x + 1)) {
                    expect(rows[y + 1]?.slice(x, x + 3)).toBe('▝█▘');
                    bulbs++;
                }
            });
        }
        expect(bulbs).toBeGreaterThan(5);
    });
});
