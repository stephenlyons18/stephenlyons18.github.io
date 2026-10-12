/**
 * Build-time ANSI textures: the brick wall behind every page and the paint-drip divider.
 * Same contract as generator.ts — pure, deterministic, output is run-length-encoded class runs.
 */
import type { AnsiArt, Run } from './generator';

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

function encode(grid: { ch: string; c: string }[][]): AnsiArt {
    const lines: Run[][] = grid.map((row) => {
        const runs: Run[] = [];
        for (const cell of row) {
            const last = runs[runs.length - 1];
            if (last && last.c === cell.c) last.t += cell.ch;
            else runs.push({ c: cell.c, t: cell.ch });
        }
        // Drop trailing blanks.
        while (runs.length && !runs[runs.length - 1]!.c && !runs[runs.length - 1]!.t.trim())
            runs.pop();
        return runs;
    });
    return { lines, cols: grid[0]?.length ?? 0, rows: grid.length };
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

/** A sprayed bar (`▄`) with thin drips hanging off it, fading `▓ → ▒ → ░`. */
export function renderDivider(cols = 120, seed = 1, maxDrip = 3): AnsiArt {
    const rand = rng(seed * 7919 + cols);
    const rows = maxDrip + 1;
    const grid = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({ ch: ' ', c: '' })),
    );
    for (let x = 0; x < cols; x++) grid[0]![x] = { ch: '▄', c: 'd-bar' };
    let last = -4;
    for (let x = 1; x < cols - 1; x++) {
        if (x - last < 4 || rand() > 0.16) continue;
        last = x;
        const len = 1 + Math.floor(rand() * maxDrip);
        for (let i = 1; i <= len; i++) {
            const left = len - i;
            grid[i]![x] = { ch: left >= 2 ? '▓' : left === 1 ? '▒' : '░', c: 'd-drip' };
        }
    }
    return encode(grid);
}
