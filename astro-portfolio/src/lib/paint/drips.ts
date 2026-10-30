/**
 * Drip physics for spray paint (R53). Pure: it moves runs on a Surface, paint.ts only draws them.
 *
 * The model is thin-film flow, simplified:
 * - A cell sags when its wet load passes the threshold (src/data/paint.ts DRIPS): the excess runs
 *   off into a drip in that column. Holding the can still keeps pushing paint past the threshold,
 *   and that excess feeds the run below (paint flows down its own channel), so a longer hold makes
 *   more runs, and longer, faster, fatter ones.
 * - A run's head moves at a terminal speed that grows with the paint it carries,
 *   v ≈ K·(vol − PIN)^⅔ (a film's speed goes as its thickness squared, and a bead's thickness as
 *   its volume^⅓). Below PIN, surface tension holds the bead and it creeps to a stop.
 * - The wall is rough: a smooth per-row factor slows the head at "catches" without ever stopping
 *   it dead, and the speed eases toward its target, so a run never stops and then lurches
 *   (ART_DIRECTION: spray paint running down a wall).
 * - Every row the head passes costs it paint (the stem it leaves behind). Runs never detach, fall
 *   or splat. Stopped runs keep their teardrop bead (▗█▖ / ▟█▙ / ▜█▛), sized by what's left.
 */
import type { Surface } from './surface';
import { BL, BR, FULL, TL, TR } from './spray';

/** Wet coats a stopped bead holds against gravity. */
export const PIN = 0.8;
/** Coats a run leaves behind per row of stem. */
export const STEM = 0.55;
/** Speed scale, cells per second. */
export const K = 4.5;
/** Fastest a head ever runs, cells per second (~130px/s). */
export const VMAX = 22;
/** Seconds for the speed to ease to its target (no jumps). */
export const EASE = 0.14;
/** Below this many cells per second a pinned bead has stopped. */
export const REST = 0.25;
/** Seconds a stopped run waits for more paint before it's left as it is. */
export const SETTLE = 1.5;
export const MAX_DRIPS = 160;
/** Most a bead can carry; past it the paint pools where it is (a run never goes on for ever). */
export const MAX_VOL = 9;

export interface Drip {
    x: number;
    /** The row the run started from (paint above it, down to here, feeds it). */
    top: number;
    /** Head position in rows (fractional), and the last row painted as stem. */
    y: number;
    row: number;
    vol: number;
    v: number;
    color: number;
    /** Seconds since it last moved. */
    still: number;
    seed: number;
    /** Bead dots it has put down: [x, y, bits] triples, so a moving head can take them back. */
    bead: number[];
}

/** Terminal speed for a bead of `vol` coats on smooth wall (cells/s). */
export const terminal = (vol: number) =>
    vol > PIN ? Math.min(VMAX, K * Math.pow(vol - PIN, 2 / 3) + 1.5) : 0;

/** Smooth wall roughness along a column: 0.55..1.1, continuous in y. */
export function roughness(seed: number, y: number): number {
    const h = (n: number) => {
        let t = Math.imul(seed ^ Math.imul(n, 0x9e3779b1), 0x85ebca6b);
        t ^= t >>> 13;
        t = Math.imul(t, 0xc2b2ae35);
        return ((t ^ (t >>> 16)) >>> 0) / 2 ** 32;
    };
    // Value noise over 3-row spans, smoothstepped: catches are gradual, never a step.
    const s = y / 3;
    const i = Math.floor(s);
    const f = s - i;
    const u = f * f * (3 - 2 * f);
    return 0.55 + 0.55 * (h(i) + (h(i + 1) - h(i)) * u);
}

/** The teardrop for a bead of `vol` at head row h: [dx, dy, bits] relative to (x, h). */
export function beadShape(vol: number, moved: boolean): [number, number, number][] {
    if (vol >= 2.4)
        return [
            [-1, -1, BR], // ▗
            [1, -1, BL], //  ▖
            [-1, 0, TR | BL | BR], // ▟
            [1, 0, TL | BL | BR], //  ▙
            [-1, 1, TL | TR | BR], // ▜
            [0, 1, FULL],
            [1, 1, TL | TR | BL], //  ▛
        ];
    if (vol >= 0.55)
        return [
            [-1, 0, BR], // ▗
            [1, 0, BL], //  ▖
            [-1, 1, TR], // ▝
            [0, 1, FULL],
            [1, 1, TL], //  ▘
        ];
    return moved ? [[0, 1, TL | TR]] : []; // ▀: a rounded end
}

export class Drips {
    readonly list: Drip[] = [];
    private seed = 1;
    constructor(readonly surface: Surface) {}

    /**
     * `excess` coats ran off cell (x, y): feed the run already draining this column (or the one
     * beside it), or start one here.
     */
    overflow(x: number, y: number, excess: number, color: number): void {
        let best: Drip | undefined;
        for (const d of this.list) {
            const dx = Math.abs(d.x - x);
            if (dx > 1 || y < d.top - 3 || y > d.row + 1) continue;
            if (!best || dx < Math.abs(best.x - x)) best = d;
            if (dx === 0) break;
        }
        if (!best && this.list.length >= MAX_DRIPS) {
            // Too many runs: the nearest one in the area takes it.
            for (const d of this.list)
                if (
                    !best ||
                    Math.abs(d.x - x) + Math.abs(d.row - y) <
                        Math.abs(best.x - x) + Math.abs(best.row - y)
                )
                    best = d;
        }
        if (best) {
            best.vol = Math.min(MAX_VOL, best.vol + excess);
            return;
        }
        this.list.push({
            x,
            top: y,
            y,
            row: y,
            vol: Math.min(MAX_VOL, excess),
            v: 0,
            color,
            still: 0,
            seed: (this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0),
            bead: [],
        });
    }

    /** Advance every run by dt seconds. Returns true while any is still moving or settling. */
    step(dt: number, now: number): boolean {
        const s = this.surface;
        dt = Math.min(dt, 0.05); // a long frame (tab switch) mustn't teleport heads
        for (let k = this.list.length - 1; k >= 0; k--) {
            const d = this.list[k]!;
            const target = terminal(d.vol) * roughness(d.seed, d.y);
            d.v += (target - d.v) * Math.min(1, dt / EASE);
            if (target === 0 && d.v < REST) d.v = 0;
            if (d.v > 0) {
                d.still = 0;
                d.y = Math.min(d.y + d.v * dt, s.rows - 1);
                const to = Math.floor(d.y);
                if (to > d.row) {
                    for (let r = d.row + 1; r <= to; r++) {
                        s.stem(d.x, r, d.color, now);
                        d.vol = Math.max(0, d.vol - STEM);
                    }
                    d.row = to;
                }
                // The bottom of the page: what's left runs off the edge, so the bead pins there
                // (and the run settles, rather than restarting every frame).
                if (d.y >= s.rows - 1) ((d.v = 0), (d.vol = Math.min(d.vol, PIN * 0.99)));
            } else d.still += dt;
            this.placeBead(d, now);
            if (d.still > SETTLE) this.list.splice(k, 1);
        }
        return this.list.length > 0;
    }

    /** Move the bead to the head, sized by what the run carries now. */
    private placeBead(d: Drip, now: number): void {
        const s = this.surface;
        const shape = beadShape(d.vol, d.row > d.top);
        const want: number[] = [];
        for (const [dx, dy, bits] of shape) want.push(d.x + dx, d.row + dy, bits);
        if (want.length === d.bead.length && want.every((v, i) => v === d.bead[i])) return;
        for (let i = 0; i < d.bead.length; i += 3)
            s.bead(d.bead[i]!, d.bead[i + 1]!, d.bead[i + 2]!, false, d.color, now);
        for (let i = 0; i < want.length; i += 3)
            s.bead(want[i]!, want[i + 1]!, want[i + 2]!, true, d.color, now);
        d.bead = want;
    }

    clear(): void {
        this.list.length = 0;
    }
}
