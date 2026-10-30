/**
 * Spray paint (R53), the pure parts: cap profiles, the shade ramp as 2 × 2 dithers, colours.
 *
 * Paint lives on a grid of square cells. A cell holds `coverage` (coats: 1 = solid), shown in the
 * wall's ANSI shades: ░ ▒ ▓ █ as 1–4 lit dots of a 2 × 2 dither (the same dots the wall's tile
 * bakes, src/lib/ansi/wall.ts). Drip beads add quadrant blocks (▗ ▖ ▟ ▙ ▜ ▛) as explicit dot masks.
 */
import type { CapId } from '../../data/paint';

/** Dot bits in a cell's 2 × 2 mask. */
export const TL = 1;
export const TR = 2;
export const BL = 4;
export const BR = 8;
export const FULL = 15;

/** Shade level (0 none, ░ ▒ ▓ █) → lit dots, matching the wall's dither. */
export const LEVEL_MASK = [0, TL, TL | BR, TL | TR | BR, FULL] as const;
export const LEVEL_GLYPH = [' ', '░', '▒', '▓', '█'] as const;

/** Coverage → shade level. Thresholds sit halfway between the ramp's 0/¼/½/¾/1. */
export function levelOf(coverage: number): number {
    if (coverage < 0.125) return 0;
    if (coverage < 0.375) return 1;
    if (coverage < 0.625) return 2;
    if (coverage < 0.875) return 3;
    return 4;
}

/**
 * Visible coats per wet coat. Spray covers faster than it soaks: a normal-speed pass reads as a
 * solid stroke, while the wet load (what drips) builds at the slower `flow`.
 */
export const COVER_GAIN = 2.5;

export interface Cap {
    /** Coats per second at the centre while the button is held. */
    flow: number;
    /** How far the stamp reaches, × the radius (overspray past the ring). */
    reach: number;
    /** Square instead of round (Chebyshev distance). */
    square?: boolean;
    /** A pen: each pass lays coverage directly instead of building up over time. */
    pen?: boolean;
    /** Paint per cell at distance d (0 centre, 1 the ring) for one pass; `rnd` is 0..1. */
    profile(d: number, rnd: () => number): number;
}

export const CAP_PROFILES: Record<CapId, Cap> = {
    // A round cone of droplets: dense core, a speckled falloff past the ring.
    soft: {
        flow: 5,
        reach: 1.3,
        profile: (d, rnd) => Math.exp(-d * d * 2.2) * (0.35 + 1.3 * rnd()),
    },
    // Even coverage across the ring, then a quick fade.
    fat: {
        flow: 4,
        reach: 1.2,
        profile: (d, rnd) => (d < 0.8 ? 1 : Math.max(0, (1.2 - d) / 0.4)) * (0.6 + 0.8 * rnd()),
    },
    // Tight and hard: half the radius, steep falloff, almost no overspray.
    skinny: {
        flow: 7,
        reach: 0.7,
        profile: (d, rnd) => (d < 0.7 ? Math.exp(-d * d * 7) * (0.7 + 0.6 * rnd()) : 0),
    },
    // Sparse heavy flecks: few cells, lots of paint each (they're what runs first).
    splatter: {
        flow: 5,
        reach: 1.5,
        profile: (d, rnd) => (rnd() < 0.07 * (1.1 - d * 0.6) ? 6 + 6 * rnd() : 0),
    },
    // A pixel pen: every cell of the square goes solid at once.
    block: { flow: 6, reach: 1, square: true, pen: true, profile: () => 1 },
};

/** The radius a cap actually reaches in cells (Block's size 1 is one cell, size 2 is 3 × 3). */
export function capExtent(cap: Cap, size: number): number {
    return cap.square ? size - 1 : Math.max(1, Math.ceil(size * cap.reach));
}

/**
 * One pass of the cap at a cell: calls `fn(dx, dy, w)` for every cell it touches, **bottom row
 * first** (paint runs from the bottom of a blob, so drips start there; see Drips.overflow).
 */
export function stamp(
    cap: Cap,
    size: number,
    rnd: () => number,
    fn: (dx: number, dy: number, w: number) => void,
): void {
    const R = capExtent(cap, size);
    for (let dy = R; dy >= -R; dy--)
        for (let dx = -R; dx <= R; dx++) {
            const d = cap.square
                ? Math.max(Math.abs(dx), Math.abs(dy)) / Math.max(1, size)
                : Math.hypot(dx, dy) / size;
            if (!cap.square && d > cap.reach) continue;
            const w = cap.profile(d, rnd);
            if (w > 0) fn(dx, dy, w);
        }
}

/** `#rgb` / `#rrggbb` (any case, `#` optional) → `#rrggbb`, or null. */
export function normalizeHex(input: string): string | null {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
    if (!m) return null;
    const h = m[1]!.toLowerCase();
    return '#' + (h.length === 3 ? [...h].map((c) => c + c).join('') : h);
}

/** A CSS colour as computed (`rgb(…)`, `#hex`) → `#rrggbb`, or null. */
export function cssToHex(css: string): string | null {
    const hex = normalizeHex(css);
    if (hex) return hex;
    const m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(css.trim());
    if (!m) return null;
    return '#' + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('');
}

/** `#rrggbb` → one little-endian RGBA pixel (what a Uint32Array over ImageData holds). */
export function hexToPixel(hex: string): number {
    const n = parseInt(hex.slice(1), 16);
    return ((0xff << 24) | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
}

/**
 * A cap's icon for the menu, drawn at build time: one pass at a small size, deterministic,
 * as `[x, y, level]` cells on a size × size grid.
 */
export function capIconCells(id: CapId, grid = 11): [number, number, number][] {
    const cap = CAP_PROFILES[id];
    const c = (grid - 1) / 2;
    let s = 0x9e3779b9;
    const rnd = () => (s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0) / 2 ** 32;
    const cov = new Float32Array(grid * grid);
    const size = id === 'skinny' ? 6 : id === 'block' ? 3 : 4;
    // Three passes build a soft cap up the way holding the button does; the pen needs one.
    for (let pass = 0; pass < (cap.pen ? 1 : 3); pass++)
        stamp(cap, size, rnd, (dx, dy, w) => {
            const x = c + dx;
            const y = c + dy;
            if (x < 0 || y < 0 || x >= grid || y >= grid) return;
            cov[y * grid + x]! += cap.pen ? w : Math.min(1, w * 0.45);
        });
    const out: [number, number, number][] = [];
    for (let y = 0; y < grid; y++)
        for (let x = 0; x < grid; x++) {
            const l = levelOf(Math.min(1, cov[y * grid + x]!));
            if (l) out.push([x, y, l]);
        }
    return out;
}

/**
 * Cells → an inline SVG of dither dots (2 per cell each way), crisp, coloured by currentColor. Dots
 * are merged into horizontal runs and written with relative moves, so an icon is a few hundred
 * bytes, not one command per dot.
 */
export function cellsToSvg(cells: [number, number, number][], grid: number, cls = ''): string {
    const n = grid * 2;
    const lit = new Uint8Array(n * n);
    for (const [x, y, l] of cells) {
        const m = LEVEL_MASK[l]!;
        if (m & TL) lit[y * 2 * n + x * 2] = 1;
        if (m & TR) lit[y * 2 * n + x * 2 + 1] = 1;
        if (m & BL) lit[(y * 2 + 1) * n + x * 2] = 1;
        if (m & BR) lit[(y * 2 + 1) * n + x * 2 + 1] = 1;
    }
    let d = '';
    let px = 0;
    let py = 0;
    for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
            if (!lit[y * n + x] || (x > 0 && lit[y * n + x - 1])) continue;
            let w = 1;
            while (x + w < n && lit[y * n + x + w]) w++;
            // After z the pen is back at the run's start, so the next move is relative to it.
            d += `${d ? 'm' : 'M'}${x - px} ${y - py}h${w}v1h-${w}z`;
            px = x;
            py = y;
        }
    return `<svg class="${cls}" viewBox="0 0 ${n} ${n}" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path fill="currentColor" d="${d}"/></svg>`;
}
