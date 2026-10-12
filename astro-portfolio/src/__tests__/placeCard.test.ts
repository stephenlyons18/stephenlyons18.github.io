import { describe, expect, test } from 'vitest';
import { placeCard } from '../lib/placeCard';

const bounds = { x: 0, y: 0, w: 800, h: 600 };
const card = { w: 200, h: 100 };

describe('placeCard', () => {
    test('centres above the anchor when there is room', () => {
        const p = placeCard({ x: 390, y: 300, w: 20, h: 20 }, card, bounds);
        expect(p).toEqual({ left: 300, top: 192, side: 'above' });
    });

    test('flips below when the anchor is near the top', () => {
        const p = placeCard({ x: 390, y: 20, w: 20, h: 20 }, card, bounds);
        expect(p.side).toBe('below');
        expect(p.top).toBe(48);
    });

    test('flips above when preferring below near the bottom', () => {
        const p = placeCard({ x: 390, y: 560, w: 20, h: 20 }, card, bounds, { prefer: 'below' });
        expect(p.side).toBe('above');
        expect(p.top + card.h).toBeLessThanOrEqual(560);
    });

    test('slides horizontally to stay inside the left and right edges', () => {
        expect(placeCard({ x: 0, y: 300, w: 10, h: 10 }, card, bounds).left).toBe(8);
        expect(placeCard({ x: 795, y: 300, w: 10, h: 10 }, card, bounds).left).toBe(800 - 8 - 200);
    });

    test('never covers the anchor when one side fits', () => {
        for (let y = 0; y <= 580; y += 20) {
            const a = { x: 400, y, w: 20, h: 20 };
            const p = placeCard(a, card, bounds);
            const overlaps = p.top < a.y + a.h && p.top + card.h > a.y;
            expect(overlaps, `anchor y=${y}`).toBe(false);
        }
    });

    test('respects offset bounds (e.g. a scrolled container)', () => {
        const p = placeCard({ x: 1000, y: 1000, w: 20, h: 20 }, card, {
            x: 900,
            y: 800,
            w: 400,
            h: 400,
        });
        expect(p.left).toBeGreaterThanOrEqual(908);
        expect(p.left + card.w).toBeLessThanOrEqual(1292);
        expect(p.top).toBeGreaterThanOrEqual(808);
    });
});
