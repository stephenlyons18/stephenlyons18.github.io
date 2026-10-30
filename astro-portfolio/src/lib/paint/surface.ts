/**
 * The paint surface (R53): a grid of cells over the whole page, stored in horizontal chunks that
 * only exist where there is paint. Pure data, no DOM: paint.ts draws whatever `update()` reports.
 *
 * Per cell: coverage (coats, shown as ░ ▒ ▓ █), wet paint (what can still run), a colour index, drip
 * bead dots, and when it was last painted. Wet paint dries on its own, worked out lazily from that
 * time, so drying costs nothing per frame. Unkept paint holds for HOLD seconds and then steps down
 * the shade ramp, █ ▓ ▒ ░ and gone, over FADE seconds: an ANSI dissolve rather than an alpha fade.
 */
import { FULL, LEVEL_MASK, levelOf } from './spray';

export const CHUNK_ROWS = 64;
/** Seconds unkept paint stays put before fading, then seconds to fade out. */
export const HOLD = 1.4;
export const FADE = 1.2;
/** Seconds for wet paint to dry to 1/e. */
export const DRY = 1.6;
/** Coverage never builds past this (thick paint looks the same, it just runs). */
const MAX_COVER = 1.5;

export class Chunk {
    readonly cover: Float32Array;
    readonly wet: Float32Array;
    readonly time: Float32Array;
    readonly color: Uint8Array;
    readonly bead: Uint8Array;
    /** The mask last reported to the renderer. */
    readonly shown: Uint8Array;
    /** Box of cells holding paint (inclusive), and the box changed since the last update. */
    px0 = Infinity;
    px1 = -1;
    py0 = Infinity;
    py1 = -1;
    dx0 = Infinity;
    dx1 = -1;
    dy0 = Infinity;
    dy1 = -1;
    constructor(
        readonly index: number,
        readonly cols: number,
    ) {
        const n = cols * CHUNK_ROWS;
        this.cover = new Float32Array(n);
        this.wet = new Float32Array(n);
        this.time = new Float32Array(n);
        this.color = new Uint8Array(n);
        this.bead = new Uint8Array(n);
        this.shown = new Uint8Array(n);
    }
    get empty(): boolean {
        return this.px1 < 0;
    }
    touch(x: number, y: number): void {
        if (x < this.px0) this.px0 = x;
        if (x > this.px1) this.px1 = x;
        if (y < this.py0) this.py0 = y;
        if (y > this.py1) this.py1 = y;
        if (x < this.dx0) this.dx0 = x;
        if (x > this.dx1) this.dx1 = x;
        if (y < this.dy0) this.dy0 = y;
        if (y > this.dy1) this.dy1 = y;
    }
}

/** Called for every cell whose visible dots changed: chunk, column, row within the chunk. */
export type DrawCell = (chunk: Chunk, x: number, y: number, mask: number, color: number) => void;

/** How much of unkept paint still shows at `age` seconds (1 → 0). */
export const fadeAt = (age: number) => (age < HOLD ? 1 : Math.max(0, 1 - (age - HOLD) / FADE));

export class Surface {
    readonly chunks = new Map<number, Chunk>();
    /** Colour per index; 0 is "no paint". */
    readonly palette: string[] = [''];
    /** Unkept paint fades; kept paint stays. */
    fading = true;
    constructor(
        public cols: number,
        public rows: number,
    ) {}

    colorIndex(hex: string): number {
        const i = this.palette.indexOf(hex, 1);
        if (i > 0) return i;
        // 255 colours a visit is plenty; past that the newest replaces the last slot.
        if (this.palette.length < 256) return this.palette.push(hex) - 1;
        this.palette[255] = hex;
        return 255;
    }

    inside(x: number, y: number): boolean {
        return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
    }

    chunk(y: number, create = false): Chunk | undefined {
        const i = Math.floor(y / CHUNK_ROWS);
        let c = this.chunks.get(i);
        if (!c && create) this.chunks.set(i, (c = new Chunk(i, this.cols)));
        return c;
    }

    /**
     * Spray onto a cell: `cover` coats of visible paint and `wet` coats of wet load. Returns the
     * cell's wet load after this pass (what Drips compares with its threshold).
     */
    deposit(x: number, y: number, cover: number, wet: number, color: number, now: number): number {
        if (!this.inside(x, y)) return 0;
        const c = this.chunk(y, true)!;
        const ly = y - c.index * CHUNK_ROWS;
        const i = ly * this.cols + x;
        const age = now - c.time[i]!;
        // A different colour over thin paint takes the cell; over thick paint it has to build up.
        if (c.color[i] !== color && (c.cover[i]! < 0.5 || cover > c.cover[i]! * 0.25)) {
            c.color[i] = color;
            c.cover[i] = c.cover[i]! * 0.5;
        }
        // Unkept paint that had started to fade comes back from what still shows.
        if (this.fading) c.cover[i] = c.cover[i]! * fadeAt(age);
        c.cover[i] = Math.min(MAX_COVER, c.cover[i]! + cover);
        const w = c.wet[i]! * Math.exp(-age / DRY) + wet;
        c.wet[i] = w;
        c.time[i] = now;
        c.touch(x, ly);
        return w;
    }

    /** Set a cell's wet load (paint over the threshold has run off into a drip). */
    setWet(x: number, y: number, wet: number): void {
        const c = this.chunk(y);
        if (c && this.inside(x, y)) c.wet[(y - c.index * CHUNK_ROWS) * this.cols + x] = wet;
    }

    /** A drip passing through: the cell goes solid in the drip's colour. */
    stem(x: number, y: number, color: number, now: number): void {
        if (!this.inside(x, y)) return;
        const c = this.chunk(y, true)!;
        const ly = y - c.index * CHUNK_ROWS;
        const i = ly * this.cols + x;
        c.color[i] = color;
        c.cover[i] = Math.max(1, c.cover[i]! * (this.fading ? fadeAt(now - c.time[i]!) : 1));
        c.time[i] = now;
        c.touch(x, ly);
    }

    /** Add (or with `on` false, remove) bead dots on a cell. */
    bead(x: number, y: number, bits: number, on: boolean, color: number, now: number): void {
        if (!this.inside(x, y)) return;
        const c = this.chunk(y, on);
        if (!c) return;
        const ly = y - c.index * CHUNK_ROWS;
        const i = ly * this.cols + x;
        if (on) {
            c.bead[i] = c.bead[i]! | bits;
            if (c.cover[i]! < 0.125) c.color[i] = color;
            c.time[i] = now;
        } else c.bead[i] = c.bead[i]! & ~bits;
        c.touch(x, ly);
    }

    /** The dots a cell shows now. */
    maskOf(c: Chunk, i: number, now: number): number {
        const f = this.fading ? fadeAt(now - c.time[i]!) : 1;
        const m = LEVEL_MASK[levelOf(Math.min(1, c.cover[i]!) * f)]!;
        // Beads go with the paint: they drop out at the last shade.
        return f > 0.35 ? (m | c.bead[i]!) & FULL : m;
    }

    /**
     * Report every cell whose dots changed since the last call (the changed box, plus, while
     * paint fades, all paint). Faded cells are cleared and empty chunks dropped (`onDrop`).
     * Returns true while any paint is still on its way out, i.e. another frame is needed.
     */
    update(now: number, draw: DrawCell, onDrop?: (c: Chunk) => void): boolean {
        let busy = false;
        const W = this.cols;
        for (const c of this.chunks.values()) {
            const all = this.fading && !c.empty;
            const x0 = all ? Math.min(c.px0, c.dx0) : c.dx0;
            const x1 = all ? Math.max(c.px1, c.dx1) : c.dx1;
            const y0 = all ? Math.min(c.py0, c.dy0) : c.dy0;
            const y1 = all ? Math.max(c.py1, c.dy1) : c.dy1;
            c.dx0 = c.dy0 = Infinity;
            c.dx1 = c.dy1 = -1;
            if (x1 < 0) continue;
            // Re-measure the painted box as we go (cells clear when they fade out).
            let nx0 = Infinity,
                nx1 = -1,
                ny0 = Infinity,
                ny1 = -1;
            if (!all) ((nx0 = c.px0), (nx1 = c.px1), (ny0 = c.py0), (ny1 = c.py1));
            for (let y = y0; y <= y1; y++)
                for (let x = x0, i = y * W + x0; x <= x1; x++, i++) {
                    const m = this.maskOf(c, i, now);
                    if (m !== c.shown[i]) {
                        c.shown[i] = m;
                        draw(c, x, y, m, c.color[i]!);
                    }
                    if (!this.fading) continue;
                    if (now - c.time[i]! >= HOLD + FADE) {
                        c.cover[i] = c.wet[i] = c.bead[i] = c.color[i] = 0;
                    } else if (c.cover[i]! > 0 || c.bead[i]) {
                        busy = true;
                        if (x < nx0) nx0 = x;
                        if (x > nx1) nx1 = x;
                        if (y < ny0) ny0 = y;
                        if (y > ny1) ny1 = y;
                    }
                }
            if (all) ((c.px0 = nx0), (c.px1 = nx1), (c.py0 = ny0), (c.py1 = ny1));
            if (c.empty) {
                this.chunks.delete(c.index);
                onDrop?.(c);
            }
        }
        return busy;
    }

    /** Switch between fading and kept paint without a jump: what shows now is what stays (or fades). */
    setFading(on: boolean, now: number): void {
        if (on === this.fading) return;
        for (const c of this.chunks.values())
            for (let y = c.py0; y <= c.py1; y++)
                for (let x = c.px0, i = y * this.cols + x; x <= c.px1; x++, i++) {
                    if (!on) c.cover[i] = c.cover[i]! * fadeAt(now - c.time[i]!);
                    c.time[i] = now;
                    c.touch(x, y);
                }
        this.fading = on;
    }

    /** Wipe everything; `onDrop` gets each chunk so its canvas can go. */
    clear(onDrop?: (c: Chunk) => void): void {
        for (const c of this.chunks.values()) onDrop?.(c);
        this.chunks.clear();
    }

    /**
     * Kept paint as bytes: per painted cell x (u16), y (u16), shade level (u8), colour (u8),
     * bead dots (u8). Only the visible shade is kept (a reload has nothing wet left to run).
     */
    serialize(now: number): { palette: string[]; data: Uint8Array } {
        const cells: number[] = [];
        for (const c of this.chunks.values())
            for (let y = c.py0; y <= c.py1; y++)
                for (let x = c.px0, i = y * this.cols + x; x <= c.px1; x++, i++) {
                    const f = this.fading ? fadeAt(now - c.time[i]!) : 1;
                    const level = levelOf(Math.min(1, c.cover[i]!) * f);
                    if (!level && !c.bead[i]) continue;
                    cells.push(x, c.index * CHUNK_ROWS + y, level, c.color[i]!, c.bead[i]!);
                }
        const data = new Uint8Array((cells.length / 5) * 7);
        const v = new DataView(data.buffer);
        for (let k = 0, o = 0; k < cells.length; k += 5, o += 7) {
            v.setUint16(o, cells[k]!);
            v.setUint16(o + 2, cells[k + 1]!);
            v.setUint8(o + 4, cells[k + 2]!);
            v.setUint8(o + 5, cells[k + 3]!);
            v.setUint8(o + 6, cells[k + 4]!);
        }
        return { palette: [...this.palette], data };
    }

    /** Paint back what `serialize` wrote, `scale` = old cell size ÷ new (a different screen). */
    load(palette: string[], data: Uint8Array, now: number, scale = 1): void {
        const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
        for (let o = 0; o + 7 <= data.length; o += 7) {
            const hex = palette[v.getUint8(o + 5)];
            if (!hex) continue;
            const color = this.colorIndex(hex);
            const level = v.getUint8(o + 4);
            const bits = v.getUint8(o + 6);
            const x0 = Math.floor(v.getUint16(o) * scale);
            const y0 = Math.floor(v.getUint16(o + 2) * scale);
            const n = Math.max(1, Math.round(scale));
            for (let y = y0; y < y0 + n; y++)
                for (let x = x0; x < x0 + n; x++) {
                    if (!this.inside(x, y)) continue;
                    if (level) this.deposit(x, y, level / 4, 0, color, now);
                    if (bits && scale === 1) this.bead(x, y, bits, true, color, now);
                }
        }
    }
}
