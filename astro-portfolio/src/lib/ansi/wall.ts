/**
 * Build-time ANSI textures: the brick wall behind every page and the paint drips (dividers, cards).
 * Same contract as generator.ts: pure and deterministic.
 */

function rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Brick period: cells per brick (incl. mortar column) and rows per course (incl. mortar row). */
export const BRICK = 10;
export const COURSE = 3;

/**
 * Running-bond brick wall: bricks of `▓` (w-b), mortar of `░` (w-m), with weathering — chipped
 * cells (`▒`, w-c) and the odd missing chunk — so it reads as an old wall, not a pattern.
 * Tiles seamlessly when cols is a multiple of BRICK and rows of 2 × COURSE.
 */
export function wallCells(cols = 80, rows = 30, seed = 9): { ch: string; c: string }[][] {
    const rand = rng(seed);
    return Array.from({ length: rows }, (_, y) =>
        Array.from({ length: cols }, (_, x) => {
            const course = Math.floor(y / COURSE);
            const offset = course % 2 ? BRICK / 2 : 0;
            const mortar = y % COURSE === COURSE - 1 || (x + offset) % BRICK === BRICK - 1;
            if (mortar) return rand() < 0.15 ? { ch: ' ', c: '' } : { ch: '░', c: 'w-m' };
            const r = rand();
            if (r < 0.06) return { ch: '▒', c: 'w-c' };
            if (r < 0.075) return { ch: ' ', c: '' };
            return { ch: '▓', c: 'w-b' };
        }),
    );
}

/** Cell size in SVG units (0.6 aspect, like a monospace cell); 1 unit = one dither pixel. */
export const CELL_W = 6;
export const CELL_H = 10;

/** Shade glyph → 2×2 dither (pixels lit, as [x, y]): ░ 25%, ▒ 50%, ▓ 75%. */
const DITHER: Record<string, [number, number][]> = {
    '░': [[0, 0]],
    '▒': [
        [0, 0],
        [1, 1],
    ],
    '▓': [
        [0, 0],
        [1, 0],
        [1, 1],
    ],
};

export interface WallTile {
    cols: number;
    rows: number;
    /** One standalone SVG per colour layer (class → svg), used as CSS mask images. */
    layers: Record<string, string>;
}

/**
 * The wall as a seamless tile of SVG masks — one per colour class — so CSS can repeat it down the
 * whole page (it scrolls with the content) and colour it with theme tokens. Same cells as the text
 * version, drawn as run-length rects filled with the glyph's dither pattern; no font needed.
 */
export function renderWallTile(cols = 80, rows = 30, seed = 9): WallTile {
    const grid = wallCells(cols, rows, seed);
    const w = cols * CELL_W;
    const h = rows * CELL_H;
    const patterns = Object.entries(DITHER)
        .map(
            ([ch, px], i) =>
                `<pattern id="p${i}" width="2" height="2" patternUnits="userSpaceOnUse">${px
                    .map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1"/>`)
                    .join('')}</pattern>`,
        )
        .join('');
    const pid = Object.fromEntries(Object.keys(DITHER).map((ch, i) => [ch, `p${i}`]));
    const layers: Record<string, string> = {};
    for (const cls of ['w-b', 'w-m', 'w-c']) {
        const rects: string[] = [];
        grid.forEach((row, y) => {
            let x = 0;
            while (x < cols) {
                const cell = row[x]!;
                if (cell.c !== cls) {
                    x++;
                    continue;
                }
                let n = 1;
                while (x + n < cols && row[x + n]!.c === cls && row[x + n]!.ch === cell.ch) n++;
                rects.push(
                    `<rect x="${x * CELL_W}" y="${y * CELL_H}" width="${n * CELL_W}" height="${CELL_H}" fill="url(#${pid[cell.ch]})"/>`,
                );
                x += n;
            }
        });
        layers[cls] =
            `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges"><defs>${patterns}</defs>${rects.join('')}</svg>`;
    }
    return { cols, rows, layers };
}

/** An SVG string as a CSS `url()` value (percent-encoded just enough for a data URI). */
export function svgDataUrl(svg: string): string {
    return `url("data:image/svg+xml,${svg
        .replace(/"/g, "'")
        .replace(/%/g, '%25')
        .replace(/#/g, '%23')
        .replace(/</g, '%3C')
        .replace(/>/g, '%3E')}")`;
}

/**
 * A paint drip, 3 cells wide and centred on its middle cell: a 1-cell stem, then a rounded bulb
 * built from quadrant blocks, so the tip reads as a drop of paint rather than a cut-off bar.
 * In half-cell pixels the bulb is 2-4-4-2 wide: a chamfered oval.
 *
 *      █      stem (× stem)
 *     ▗█▖     shoulder
 *     ▝█▘     round bottom
 */
export const DRIP_BULB = ['▗█▖', '▝█▘'] as const;

export function dripRows(stem: number): string[] {
    return [...Array.from({ length: stem }, () => ' █ '), ...DRIP_BULB];
}

export interface DripStrip {
    cols: number;
    /** Rows below the bar the tallest drip can reach (stem + bulb). */
    rows: number;
    /** Drips by centre column; each hangs `stem` cells, then the 2-row bulb. */
    drips: { x: number; stem: number }[];
}

/**
 * Where drips hang along a strip `cols` cells wide: never closer than `minGap` cells (bulbs are 3
 * wide), never at the very ends. Deterministic per seed. Used by the divider (under a sprayed
 * bar) and by cards (off their bottom edge).
 */
export function renderDripStrip(
    cols = 120,
    seed = 1,
    { maxStem = 2, density = 0.16, minGap = 5 } = {},
): DripStrip {
    const rand = rng(seed * 7919 + cols);
    const drips: { x: number; stem: number }[] = [];
    let last = -minGap;
    for (let x = 2; x < cols - 2; x++) {
        if (x - last < minGap || rand() > density) continue;
        last = x;
        drips.push({ x, stem: Math.floor(rand() * (maxStem + 1)) });
    }
    return { cols, rows: maxStem + DRIP_BULB.length, drips };
}
