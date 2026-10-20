/**
 * What every piece renderer shares (R28): the class ids a piece is painted in, the Piece grid, the
 * seeded randomness, and trimming. piece.ts (wildstyle) and bubble.ts (bubble) both build on it.
 */
export type PieceStyle = 'wild' | 'bubble';

/** Class names, by id. 0 is empty. Order is paint-agnostic; it only names the grid values. */
export const PIECE_CLASSES = [
    '',
    'p-f0',
    'p-f1',
    'p-f2',
    'p-f3',
    'p-f4',
    'p-f5',
    'p-f6',
    'p-f7',
    'p-f8',
    'p-f9',
    'p-ik', // ink line + counters
    'p-ol', // outline
    'p-x1', // 3D near
    'p-x2', // 3D far
    'p-sh', // shine (bubble gloss, wild glint)
    'p-cu', // wild accent cut
    'p-dr', // drip
    'p-d1', // drip fade
    'p-d2', // drip tip
    'p-d3', // drip last fade (bubble's ░)
    'p-sp', // sparkle
    'p-os', // overspray
] as const;
export type PieceClass = (typeof PIECE_CLASSES)[number];
export const C = Object.fromEntries(PIECE_CLASSES.map((c, i) => [c, i])) as Record<
    PieceClass,
    number
>;
export const FILL0 = C['p-f0'];
export const BANDS = 10;
export const isFill = (v: number) => v >= FILL0 && v < FILL0 + BANDS;

export interface Piece {
    /** Width and height in units. */
    w: number;
    h: number;
    /** Row-major class ids (PIECE_CLASSES), w × h. */
    cells: Uint8Array;
    /** Which renderer drew it: CSS maps the classes to that style's colours. */
    style?: PieceStyle;
    /** A unit's width ÷ its height when drawn (default 1: square units). */
    aspect?: number;
}

// ─── Deterministic randomness ────────────────────────────────────────────────

export function hash(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
}
/** mulberry32: tiny, fast, good enough for art. */
export function rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Trim to the painted box, keeping an even height (two units per text row). */
export function trim(p: Piece): Piece {
    let x0 = p.w,
        y0 = p.h,
        x1 = -1,
        y1 = -1;
    for (let y = 0; y < p.h; y++)
        for (let x = 0; x < p.w; x++)
            if (p.cells[y * p.w + x]) {
                x0 = Math.min(x0, x);
                x1 = Math.max(x1, x);
                y0 = Math.min(y0, y);
                y1 = Math.max(y1, y);
            }
    if ((y1 - y0 + 1) % 2) y1++;
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
            const sy = y + y0;
            out[y * w + x] = sy < p.h ? p.cells[sy * p.w + x + x0]! : 0;
        }
    return { ...p, w, h, cells: out };
}
