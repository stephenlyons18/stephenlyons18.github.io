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

/** A theme's wall colours: bricks (`--ui`), mortar (`--ui-3`) and chips (`--ui-2`), as #rrggbb. */
export interface WallColors {
    b: string;
    m: string;
    c: string;
}

/**
 * The wall's palette per terminal theme (global.css [data-theme] slots; a unit test keeps the two
 * in step). The tile is baked per theme because a tiled bitmap costs almost nothing to raster,
 * where the old theme-coloured CSS masks were re-rasterised for every tile that scrolled in (R22).
 */
export const WALL_THEMES: Record<string, WallColors> = {
    wildstyle: { b: '#3cc4ff', m: '#4cc38a', c: '#36e2c6' },
    bubble: { b: '#36e2c6', m: '#4cc38a', c: '#3cc4ff' },
    ansi: { b: '#93a6dc', m: '#8fb7ff', c: '#4d9dff' },
    sunset: { b: '#ff7a3d', m: '#36e2c6', c: '#ffd23f' },
    green: { b: '#00ff41', m: '#00ff41', c: '#00bfff' },
};

/** Paint strength: a texture, never a pattern you read. Mortar is fainter than brick. */
export const WALL_ALPHA = { b: 0.07, m: 0.042, c: 0.07 } as const;

export interface WallPixels {
    width: number;
    height: number;
    /** RGBA, row-major: one pixel per dither dot (a cell is CELL_W × CELL_H of them). */
    data: Uint8Array;
}

/**
 * The wall as a seamless RGBA tile: each shade glyph becomes its 2 × 2 dither in the cell's colour
 * at WALL_ALPHA, everything else transparent. Encoded to PNG at build (/art/wall-<theme>.png) and
 * tiled down the page with `image-rendering: pixelated`.
 */
export function wallPixels(colors: WallColors, cols = 80, rows = 30, seed = 9): WallPixels {
    const grid = wallCells(cols, rows, seed);
    const width = cols * CELL_W;
    const height = rows * CELL_H;
    const data = new Uint8Array(width * height * 4);
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
            const cell = grid[Math.floor(py / CELL_H)]![Math.floor(px / CELL_W)]!;
            const key = cell.c.slice(2) as keyof WallColors; // 'w-b' → 'b'
            if (!cell.c || !DITHER[cell.ch]!.some(([x, y]) => x === px % 2 && y === py % 2))
                continue;
            const i = (py * width + px) * 4;
            data.set([...rgb(colors[key]), Math.round(WALL_ALPHA[key] * 255)], i);
        }
    }
    return { width, height, data };
}

/**
 * A paint drip, 3 cells wide and centred on its middle cell: a 1-cell stem, then a teardrop built
 * from quadrant blocks. In half-cell pixels the drop is 2-4-4-6-6-4 wide: it tapers in gently from
 * the stem and swells to a rounded bottom, so it reads as a hanging drop of paint, not a ball.
 * (Strips only: dividers and cards. Title drips stay thin `█▓▒░` runs, see generator.ts.)
 *
 *      █      stem (× stem)
 *     ▗█▖     neck
 *     ▟█▙     swelling
 *     ▜█▛     rounded bottom
 */
export const DRIP_BULB = ['▗█▖', '▟█▙', '▜█▛'] as const;

export function dripRows(stem: number): string[] {
    return [...Array.from({ length: stem }, () => ' █ '), ...DRIP_BULB];
}

function shuffle<T>(a: T[], rand: () => number): T[] {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
}

/** Drips in a strip are split into this many runs; each run animates as one compositor layer. */
export const DRIP_RUNS = 4;

export interface DripStrip {
    cols: number;
    /** Rows below the bar the tallest drip can reach (stem + bulb). */
    rows: number;
    /** Drips by centre column; each hangs `stem` cells, then the bulb. `run`: its animation group. */
    drips: { x: number; stem: number; run: number }[];
}

/**
 * Where drips hang along a strip `cols` cells wide: never closer than `minGap` cells (bulbs are 3
 * wide), never at the very ends, stems between `minStem` and `maxStem`. Neighbours go to different
 * runs, so each run is spread along the whole strip. Deterministic per seed. Used by the divider
 * (under a sprayed bar) and by cards (off their bottom edge).
 */
export function renderDripStrip(
    cols = 120,
    seed = 1,
    { maxStem = 2, minStem = 0, density = 0.16, minGap = 5 } = {},
): DripStrip {
    const rand = rng(seed * 7919 + cols);
    const drips: DripStrip['drips'] = [];
    let deck: number[] = [];
    let last = -minGap;
    for (let x = 2; x < cols - 2; x++) {
        if (x - last < minGap || rand() > density) continue;
        last = x;
        const stem = minStem + Math.floor(rand() * (maxStem - minStem + 1));
        // Runs are dealt in shuffled rounds of DRIP_RUNS, so each run spreads along the strip and
        // a drip never shares a run with its neighbour.
        if (!deck.length) {
            const prev = drips.at(-1)?.run;
            do deck = shuffle([...Array(DRIP_RUNS).keys()], rand);
            while (deck[0] === prev);
        }
        const run = deck.shift()!;
        drips.push({ x, stem, run });
    }
    return { cols, rows: maxStem + DRIP_BULB.length, drips };
}
