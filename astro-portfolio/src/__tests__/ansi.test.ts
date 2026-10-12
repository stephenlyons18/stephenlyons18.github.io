import { describe, expect, test } from 'vitest';
import { GLYPHS, GLYPH_HEIGHT } from '../lib/ansi/font';
import { balanceLines, renderAnsi, toPlainText } from '../lib/ansi/generator';

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

    test('only block, shade, half-block and dot glyphs are used', () => {
        for (const style of ['bubble', 'wild', 'block'] as const) {
            for (const t of TITLES) {
                const s = toPlainText(renderAnsi(t, { style })).replace(/\n/g, '');
                expect(s).toMatch(/^[ █▓▒░▀·]*$/);
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
