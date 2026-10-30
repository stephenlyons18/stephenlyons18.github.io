import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { CAPS, DRIPS, PAINT_DEFAULTS, PAINT_TOKENS, SIZE, readSettings } from '../data/paint';
import {
    CAP_PROFILES,
    LEVEL_MASK,
    capExtent,
    capIconCells,
    cellsToSvg,
    cssToHex,
    hexToPixel,
    levelOf,
    normalizeHex,
    stamp,
} from '../lib/paint/spray';
import { CHUNK_ROWS, FADE, HOLD, Surface, fadeAt } from '../lib/paint/surface';
import { Drips, PIN, beadShape, roughness, terminal } from '../lib/paint/drips';
import { rng } from '../lib/ansi/grid';

const css = readFileSync(new URL('../styles/global.css', import.meta.url), 'utf8');

describe('paint data', () => {
    test('ids are unique and the defaults are valid options', () => {
        for (const list of [CAPS.map((c) => c.id), DRIPS.map((d) => d.id)])
            expect(new Set(list).size).toBe(list.length);
        expect(CAPS.map((c) => c.id)).toContain(PAINT_DEFAULTS.cap);
        expect(DRIPS.map((d) => d.id)).toContain(PAINT_DEFAULTS.drips);
        expect(PAINT_TOKENS[0]!.token).toBe(PAINT_DEFAULTS.color);
        expect(PAINT_DEFAULTS.size).toBeGreaterThanOrEqual(SIZE.min);
        expect(PAINT_DEFAULTS.size).toBeLessThanOrEqual(SIZE.max);
        // Small by default, fading by default (user direction).
        expect(PAINT_DEFAULTS.size).toBeLessThanOrEqual(4);
        expect(PAINT_DEFAULTS.keep).toBe(false);
    });

    test('every cap has a profile, every colour token exists in global.css', () => {
        for (const c of CAPS) expect(CAP_PROFILES[c.id]).toBeDefined();
        for (const t of PAINT_TOKENS) expect(css).toContain(`${t.token}:`);
    });

    test('drip thresholds get runnier down the list', () => {
        const t = DRIPS.map((d) => d.threshold);
        expect(t[0]).toBe(Infinity);
        for (let i = 1; i < t.length; i++) expect(t[i]!).toBeLessThan(t[i - 1]!);
    });

    test('readSettings falls back per field and clamps', () => {
        expect(readSettings(null)).toEqual(PAINT_DEFAULTS);
        expect(readSettings('not json')).toEqual(PAINT_DEFAULTS);
        const s = readSettings(
            JSON.stringify({ color: '#FF00aa', cap: 'nope', size: 99, drips: 'lots', keep: 1 }),
        );
        expect(s).toEqual({ ...PAINT_DEFAULTS, color: '#FF00aa', size: SIZE.max, drips: 'lots' });
        expect(readSettings(JSON.stringify({ color: 'red', size: -3 })).size).toBe(SIZE.min);
        expect(readSettings(JSON.stringify({ color: 'red' })).color).toBe(PAINT_DEFAULTS.color);
        expect(readSettings(JSON.stringify({ color: '--accent' })).color).toBe('--accent');
    });
});

describe('spray', () => {
    test('shade levels are the wall dither: 0–4 dots', () => {
        expect(LEVEL_MASK.map((m) => m.toString(2).replace(/0/g, '').length)).toEqual([
            0, 1, 2, 3, 4,
        ]);
        expect([0, 0.2, 0.5, 0.7, 1, 3].map(levelOf)).toEqual([0, 1, 2, 3, 4, 4]);
    });

    test('stamps go bottom row first and stay inside their reach', () => {
        for (const c of CAPS) {
            const cap = CAP_PROFILES[c.id];
            const R = capExtent(cap, 5);
            let last = Infinity;
            stamp(cap, 5, rng(1), (dx, dy) => {
                expect(dy).toBeLessThanOrEqual(last);
                last = dy;
                expect(Math.abs(dx)).toBeLessThanOrEqual(R);
                expect(Math.abs(dy)).toBeLessThanOrEqual(R);
            });
        }
    });

    test('the soft cap is densest in the middle; the block pen is solid and square', () => {
        const cov = new Map<string, number>();
        const r = rng(7);
        for (let i = 0; i < 200; i++)
            stamp(CAP_PROFILES.soft, 6, r, (dx, dy, w) =>
                cov.set(`${dx},${dy}`, (cov.get(`${dx},${dy}`) ?? 0) + w),
            );
        expect(cov.get('0,0')!).toBeGreaterThan(cov.get('6,0') ?? 0);
        expect(cov.get('0,0')!).toBeGreaterThan(3 * (cov.get('0,6') ?? 0));
        const block: string[] = [];
        stamp(
            CAP_PROFILES.block,
            2,
            r,
            (dx, dy, w) => (expect(w).toBe(1), block.push(`${dx},${dy}`)),
        );
        expect(block).toHaveLength(9);
        let one = 0;
        stamp(CAP_PROFILES.block, 1, r, () => one++);
        expect(one).toBe(1);
    });

    test('colours: hex parsing, computed CSS, pixels', () => {
        expect(normalizeHex('#ABC')).toBe('#aabbcc');
        expect(normalizeHex('3cc4ff')).toBe('#3cc4ff');
        expect(normalizeHex('#12345')).toBeNull();
        expect(normalizeHex('red')).toBeNull();
        expect(cssToHex('rgb(60, 196, 255)')).toBe('#3cc4ff');
        expect(cssToHex(' #FF3D9A')).toBe('#ff3d9a');
        expect(cssToHex('color(srgb 1 0 0)')).toBeNull();
        // Little-endian RGBA: R in the low byte, opaque.
        expect(hexToPixel('#112233')).toBe(0xff332211);
    });

    test('cap icons are drawn at build time, deterministic, inside their grid', () => {
        for (const c of CAPS) {
            const a = capIconCells(c.id);
            expect(a.length).toBeGreaterThan(0);
            expect(capIconCells(c.id)).toEqual(a);
            for (const [x, y, l] of a) {
                expect(x).toBeGreaterThanOrEqual(0);
                expect(y).toBeLessThan(11);
                expect(l).toBeGreaterThan(0);
            }
            expect(cellsToSvg(a, 11)).toMatch(/^<svg[^>]*aria-hidden="true"/);
        }
    });
});

const draws = (s: Surface, now: number) => {
    const out: [number, number, number][] = [];
    s.update(now, (c, x, y, m) => out.push([x, c.index * CHUNK_ROWS + y, m]));
    return out;
};

describe('surface', () => {
    test('paint builds up from ░ to █, and only changed cells are redrawn', () => {
        const s = new Surface(10, 10);
        const red = s.colorIndex('#ff0000');
        s.deposit(2, 3, 0.3, 0, red, 0);
        expect(draws(s, 0)).toEqual([[2, 3, LEVEL_MASK[1]]]);
        expect(draws(s, 0.01)).toEqual([]);
        s.deposit(2, 3, 1, 0, red, 0.02);
        expect(draws(s, 0.02)).toEqual([[2, 3, 15]]);
    });

    test('unkept paint holds, then steps down the ramp and is gone (chunk dropped)', () => {
        const s = new Surface(4, 200);
        s.deposit(1, 150, 1, 0, s.colorIndex('#00ff00'), 0);
        draws(s, 0);
        expect(draws(s, HOLD * 0.9)).toEqual([]);
        const seen = new Set<number>();
        for (let t = HOLD; t <= HOLD + FADE + 0.1; t += 0.05)
            for (const d of draws(s, t)) seen.add(d[2]);
        expect([...seen]).toEqual([LEVEL_MASK[3], LEVEL_MASK[2], LEVEL_MASK[1], 0]);
        expect(s.chunks.size).toBe(0);
        expect(fadeAt(0)).toBe(1);
        expect(fadeAt(HOLD + FADE)).toBeCloseTo(0);
    });

    test('kept paint stays; switching keeps what shows', () => {
        const s = new Surface(4, 4);
        s.fading = false;
        s.deposit(0, 0, 1, 0, s.colorIndex('#000001'), 0);
        draws(s, 0);
        expect(draws(s, 100)).toEqual([]);
        s.setFading(true, 100);
        expect(draws(s, 100 + HOLD + FADE + 1).at(-1)).toEqual([0, 0, 0]);
    });

    test('wet paint dries on its own between passes', () => {
        const s = new Surface(2, 2);
        const c = s.colorIndex('#123456');
        expect(s.deposit(0, 0, 1, 1, c, 0)).toBeCloseTo(1);
        expect(s.deposit(0, 0, 1, 1, c, 0.01)).toBeGreaterThan(1.9);
        expect(s.deposit(0, 0, 0, 0, c, 10)).toBeLessThan(0.01);
    });

    test('out of bounds paint is ignored', () => {
        const s = new Surface(3, 3);
        s.deposit(-1, 0, 1, 0, 1, 0);
        s.deposit(3, 0, 1, 0, 1, 0);
        s.deposit(0, 3, 1, 0, 1, 0);
        expect(s.chunks.size).toBe(0);
    });

    test('kept paint survives a save and load', () => {
        const a = new Surface(20, 140);
        a.fading = false;
        a.deposit(5, 130, 1, 0, a.colorIndex('#abcdef'), 0);
        a.deposit(6, 2, 0.5, 0, a.colorIndex('#010203'), 0);
        a.bead(5, 131, 3, true, 1, 0);
        const { palette, data } = a.serialize(0);
        const b = new Surface(20, 140);
        b.fading = false;
        b.load(palette, data, 0);
        expect(draws(b, 0).sort()).toEqual(draws(a, 0).sort());
        // On a screen with half-size cells, a cell covers 2 × 2.
        const c = new Surface(40, 280);
        c.fading = false;
        c.load(palette, data, 0, 2);
        expect(draws(c, 0).filter((d) => d[2])).toHaveLength(8);
    });
});

/** Hold the can still over one cell for `secs`, as paint.ts does each frame. */
function hold(secs: number, threshold = 2.4, size = 3) {
    const s = new Surface(40, 400);
    const drips = new Drips(s);
    const col = s.colorIndex('#ff00ff');
    const r = rng(3);
    const cap = CAP_PROFILES.soft;
    let t = 0;
    const dt = 1 / 60;
    for (; t < secs; t += dt) {
        stamp(cap, size, r, (dx, dy, w) => {
            const x = 20 + dx;
            const y = 20 + dy;
            const wet = s.deposit(x, y, cap.flow * dt * w, cap.flow * dt * w, col, t);
            if (wet > threshold) {
                s.setWet(x, y, threshold);
                drips.overflow(x, y, wet - threshold, col);
            }
        });
        drips.step(dt, t);
    }
    // Let every run finish.
    let longest = 0;
    const speeds: number[][] = drips.list.map(() => []);
    for (let i = 0; i < 60 * 30 && drips.step(dt, (t += dt)); i++)
        drips.list.forEach((d, k) => {
            speeds[k]?.push(d.v);
            longest = Math.max(longest, d.row - 20);
        });
    let lowest = 20;
    for (const c of s.chunks.values()) lowest = Math.max(lowest, c.index * CHUNK_ROWS + c.py1);
    return { runs: drips, lowest, speeds };
}

describe('drips', () => {
    test('a quick pass never drips; holding still does', () => {
        expect(hold(0.15).lowest).toBeLessThan(24);
        expect(hold(1.5).lowest).toBeGreaterThan(26);
    });

    test('a longer hold runs further, and lots runs further than some', () => {
        const short = hold(1).lowest;
        const long = hold(2.5).lowest;
        expect(long).toBeGreaterThan(short);
        expect(hold(1, 1.3).lowest).toBeGreaterThan(short);
    });

    test('speed eases: it never jumps, and it only stops after slowing to a creep', () => {
        const { speeds } = hold(2);
        for (const run of speeds)
            for (let i = 1; i < run.length; i++) {
                const [a, b] = [run[i - 1]!, run[i]!];
                if (b === 0) expect(a).toBeLessThan(0.3);
                expect(Math.abs(b - a)).toBeLessThan(6);
            }
    });

    test('terminal speed grows with paint and is zero for a pinned bead', () => {
        expect(terminal(PIN)).toBe(0);
        expect(terminal(1)).toBeGreaterThan(0);
        expect(terminal(4)).toBeGreaterThan(terminal(2));
    });

    test('wall roughness slows, never stops, and is continuous', () => {
        for (let y = 0; y < 50; y += 0.1) {
            const r = roughness(42, y);
            expect(r).toBeGreaterThanOrEqual(0.55);
            expect(r).toBeLessThanOrEqual(1.1);
            expect(Math.abs(roughness(42, y + 0.01) - r)).toBeLessThan(0.02);
        }
    });

    test('beads grow with the paint left: none, rounded end, small, teardrop', () => {
        expect(beadShape(0.2, false)).toEqual([]);
        expect(beadShape(0.2, true)).toHaveLength(1);
        expect(beadShape(PIN, true)).toHaveLength(5);
        expect(beadShape(3, true)).toHaveLength(7);
    });
});

describe('cap icon svg', () => {
    test('runs with relative moves draw exactly the lit dots', () => {
        // ▒ at (0,0) lights dots (0,0) and (1,1); █ at (1,0) lights a 2×2 block.
        const svg = cellsToSvg(
            [
                [0, 0, 2],
                [1, 0, 4],
            ],
            2,
        );
        const d = /d="([^"]+)"/.exec(svg)![1]!;
        // Replay the path: every run is "m dx dy h w v1 h-w z".
        const lit = new Set<string>();
        let x = 0;
        let y = 0;
        for (const [, dx, dy, w] of d.matchAll(/[Mm](-?\d+) (-?\d+)h(\d+)v1h-\d+z/g)) {
            x += Number(dx);
            y += Number(dy);
            for (let i = 0; i < Number(w); i++) lit.add(`${x + i},${y}`);
        }
        expect([...lit].sort()).toEqual(['0,0', '1,1', '2,0', '2,1', '3,0', '3,1'].sort());
    });
});
