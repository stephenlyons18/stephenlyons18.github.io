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

/**
 * Running-bond brick wall: bricks of `▓` (w-b), mortar of `░` (w-m), with weathering — chipped
 * cells (`▒`, w-c) and the odd missing chunk — so it reads as an old wall, not a pattern.
 */
export function renderWall(cols = 160, rows = 60, seed = 9): AnsiArt {
    const rand = rng(seed);
    const BRICK = 10; // cells per brick incl. mortar column
    const COURSE = 3; // rows per course incl. mortar row
    const grid = Array.from({ length: rows }, (_, y) =>
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
    return encode(grid);
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
