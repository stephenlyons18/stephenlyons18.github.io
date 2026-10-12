import { describe, expect, test } from 'vitest';
import {
    countOverlaps,
    fitScale,
    footprint,
    relaxOverlaps,
    type LayoutNode,
} from '../lib/graphLayout';

const node = (x: number, y: number, labelHalfW = 30, r = 10): LayoutNode => ({
    x,
    y,
    r,
    labelHalfW,
});

describe('footprint', () => {
    test('covers circle above and label below; label width does not scale', () => {
        const f1 = footprint(node(100, 100), 13, 1);
        const f2 = footprint(node(100, 100), 13, 2);
        expect(f1).toEqual({ x0: 70, x1: 130, y0: 90, y1: 126 });
        expect(f2.x1 - f2.x0).toBe(60); // label half-width 30 > circle 20 → still 60 wide
        expect(f2.y0).toBe(180); // circle top scales
    });
});

describe('countOverlaps', () => {
    test('counts intersecting label boxes', () => {
        expect(countOverlaps([node(0, 0), node(50, 0)], 13)).toBe(1);
        expect(countOverlaps([node(0, 0), node(100, 0)], 13)).toBe(0);
        expect(countOverlaps([node(0, 0), node(0, 60)], 13)).toBe(0);
    });
});

describe('fitScale', () => {
    test('accounts for fixed-size labels when shrinking', () => {
        const nodes = [node(0, 0, 80), node(1000, 600, 80)];
        const { scale, box } = fitScale(nodes, 13, 800, 600, { pad: 20 });
        expect(box.x1 - box.x0).toBeLessThanOrEqual(760);
        expect(box.y1 - box.y0).toBeLessThanOrEqual(560);
        // A naive fit that ignored labels would pick (760 / 1000) = 0.76 and clip the labels.
        expect(scale).toBeLessThan(0.76);
    });
    test('never zooms in past maxScale', () => {
        expect(fitScale([node(0, 0), node(10, 10)], 13, 800, 600).scale).toBe(1.25);
    });
});

describe('relaxOverlaps', () => {
    test('untangles a pile of overlapping labels inside the bounds', () => {
        const nodes = Array.from({ length: 20 }, (_, i) =>
            node(200 + (i % 5) * 8, 200 + Math.floor(i / 5) * 6),
        );
        expect(countOverlaps(nodes, 13)).toBeGreaterThan(10);
        const left = relaxOverlaps(nodes, 13, 600, 500);
        expect(left).toBe(0);
        for (const n of nodes) {
            const f = footprint(n, 13);
            expect(f.x0).toBeGreaterThanOrEqual(0);
            expect(f.x1).toBeLessThanOrEqual(600);
            expect(f.y0).toBeGreaterThanOrEqual(0);
            expect(f.y1).toBeLessThanOrEqual(500);
        }
    });
    test('keeps nodes out of the avoid box', () => {
        const nodes = [node(570, 30), node(560, 60)];
        relaxOverlaps(nodes, 13, 600, 500, { avoid: { x0: 536, y0: 0, x1: 600, y1: 140 } });
        for (const n of nodes) {
            const f = footprint(n, 13);
            const inside = f.x1 > 537 && f.y0 < 139; // soft force: allow 1px
            expect(inside).toBe(false);
        }
    });
});
