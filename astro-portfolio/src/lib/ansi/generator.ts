/**
 * ANSI graffiti title generator — pure, deterministic, build-time only.
 *
 *   text ─▶ pixel mask (font.ts) ─▶ bubble outline (4-neighbour dilate, so corners round off)
 *        ─▶ 3D extrusion (shape shifted down-right, minus the shape)
 *        ─▶ cells (each pixel = 2 monospace cells, so pixels are ~square)
 *        ─▶ cell-space effects: paint drips under letter bottoms, one glint per letter, overspray
 *        ─▶ run-length-encoded lines of { cls, text }
 *
 * Colours are *classes*, not hex (`a-f0`…`a-f7` fill rows, `a-ol` outline, `a-x1`/`a-x2` extrusion,
 * `a-dr` drip, `a-gl` glint, `a-os` overspray), so CSS theme tokens recolour every piece without
 * re-rendering. See docs/ART_DIRECTION.md for the rules this encodes.
 */
import { GLYPH_HEIGHT, glyphFor } from './font';
import { DRIP_BULB } from './wall';

export type AnsiStyle = 'bubble' | 'wild' | 'block';

export interface AnsiOptions {
    style?: AnsiStyle;
    /** Extra seed so two identical words can look different. */
    seed?: number;
    /** Drip probability per letter-bottom cell (0–1). */
    drips?: number;
    /** Max drip length in cells. */
    dripMax?: number;
    /** Overspray density in the halo around the piece (0–1). */
    overspray?: number;
    /** Pixels between letters (default 1). 2 keeps extrusion from bridging letters in big pieces;
     *  0 or -1 interlocks them (wildstyle). */
    gap?: number;

    // ── Wildstyle moves (all optional; see the options sheet in docs/ART_DIRECTION.md) ──
    /** Vertical stagger amplitude in pixels (overrides the style's default). */
    bounce?: number;
    /** Italic lean: shift 1 pixel right every `lean` rows going up (0 = upright; 3 ≈ 20°). */
    lean?: number;
    /** An arrow flaring off the last letter. */
    arrows?: boolean;
    /** Probability that a letter grows a 1–2 pixel spike off its top edge. */
    spikes?: number;
    /** A glitch cut: a band of rows shifted sideways across the whole piece. */
    slice?: boolean;
    /** Reverse the fill gradient on every other letter (two-tone burner look). */
    alternate?: boolean;
}

export interface Run {
    /** CSS class ('' = blank) */
    c: string;
    t: string;
}

export interface AnsiArt {
    lines: Run[][];
    /** Width in monospace cells (longest line). */
    cols: number;
    rows: number;
}

const STYLE_DEFAULTS: Record<
    AnsiStyle,
    Required<Pick<AnsiOptions, 'drips' | 'dripMax' | 'overspray' | 'gap' | 'lean'>> & {
        outline: boolean;
        bounceAmp: number;
        depth: number;
    }
> = {
    bubble: {
        drips: 0.18,
        dripMax: 4,
        overspray: 0.05,
        gap: 1,
        lean: 0,
        outline: true,
        bounceAmp: 0,
        depth: 2,
    },
    wild: {
        drips: 0.3,
        dripMax: 5,
        overspray: 0.08,
        gap: 1,
        lean: 4,
        outline: true,
        bounceAmp: 1,
        depth: 2,
    },
    block: {
        drips: 0.12,
        dripMax: 3,
        overspray: 0,
        gap: 1,
        lean: 0,
        outline: false,
        bounceAmp: 0,
        depth: 1,
    },
};

// ─── Deterministic randomness ────────────────────────────────────────────────

function hash(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
}
/** mulberry32 — tiny, fast, good enough for art. */
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

// ─── Generator ───────────────────────────────────────────────────────────────

interface Cell {
    ch: string;
    c: string;
}

export function renderAnsi(text: string, opts: AnsiOptions = {}): AnsiArt {
    const style = opts.style ?? 'bubble';
    const d = STYLE_DEFAULTS[style];
    const dripP = opts.drips ?? d.drips;
    const dripMax = opts.dripMax ?? d.dripMax;
    const sprayP = opts.overspray ?? d.overspray;
    const rand = rng(hash(`${style}:${text}`) ^ (opts.seed ?? 0));

    const chars = [...text.toUpperCase()];
    const BOUNCE = opts.bounce ?? d.bounceAmp;
    const PAD = 1 + (d.outline ? 1 : 0); // pixel margin for outline (+1 for overspray)
    const gap = opts.gap ?? d.gap;
    // 'wild' leans by default (user pick: option B on the 2026-10-12 options sheet, eased from 3 to 4 so names stay legible at hero size).
    const lean = opts.lean ?? d.lean;
    const sliceBand = opts.slice ? [3, 4] : null; // glyph rows shifted by the glitch cut
    const SLICE_DX = 2;

    // 1. Lay out glyphs as a list of pixels in glyph space, apply the wildstyle moves, then
    //    rasterise. Each pixel keeps its glyph row (shading, glints) and its colour row
    //    (gradient; reversed on alternate letters).
    interface Px {
        x: number;
        y: number;
        letter: number;
        row: number;
        colorRow: number;
    }
    const pixels: Px[] = [];
    const boxes: { x: number; y: number }[] = [];
    const glyphs = chars.map(glyphFor);
    const ARROW = [
        '.......',
        '....#..',
        '....##.',
        '#######',
        '#######',
        '....##.',
        '....#..',
        '.......',
    ];
    const shiftOf = (row: number) =>
        (lean ? Math.floor((GLYPH_HEIGHT - 1 - row) / lean) : 0) +
        (sliceBand && row >= sliceBand[0]! && row <= sliceBand[1]! ? SLICE_DX : 0);

    let cx = 0;
    let lastLetter = 0;
    glyphs.forEach((g, i) => {
        const blank = chars[i] === ' ';
        const dy = BOUNCE && !blank ? Math.round(rand() * BOUNCE) : 0;
        const rev = !!opts.alternate && i % 2 === 1;
        if (!blank) {
            lastLetter = i + 1;
            for (let y = 0; y < GLYPH_HEIGHT; y++)
                for (let x = 0; x < g.w; x++) boxes.push({ x: cx + x + shiftOf(y), y: y + dy });
        }
        for (let y = 0; y < GLYPH_HEIGHT; y++) {
            for (let x = 0; x < g.w; x++) {
                if (!g.rows[y]![x]) continue;
                const colorRow = rev ? GLYPH_HEIGHT - 1 - y : y;
                pixels.push({ x: cx + x + shiftOf(y), y: y + dy, letter: i + 1, row: y, colorRow });
            }
        }
        // Spikes: a 1–2 pixel extension off a top-edge pixel (outlined like the letter).
        if (!blank && opts.spikes && rand() < opts.spikes) {
            const tops = [...Array(g.w).keys()].filter((x) => g.rows[0]![x]);
            if (tops.length) {
                const sx = tops[Math.floor(rand() * tops.length)]!;
                const len = 1 + Math.floor(rand() * 2);
                for (let k = 1; k <= len; k++)
                    pixels.push({
                        x: cx + sx + shiftOf(0) + (k > 1 ? 1 : 0),
                        y: dy - k,
                        letter: i + 1,
                        row: -1,
                        colorRow: 0,
                    });
            }
        }
        cx += g.w + gap;
    });
    if (opts.arrows && lastLetter) {
        const ax = cx - gap - 1; // overlap the last letter by one pixel so the arrow joins it
        ARROW.forEach((r, y) =>
            [...r].forEach((c, x) => {
                if (c === '#')
                    pixels.push({
                        x: ax + x + shiftOf(y),
                        y,
                        letter: lastLetter,
                        row: -1,
                        colorRow: Math.min(y + 2, GLYPH_HEIGHT - 1),
                    });
            }),
        );
    }

    // Rasterise into a padded grid.
    const all = [...pixels, ...boxes];
    const minX = Math.min(...all.map((p) => p.x));
    const minY = Math.min(...all.map((p) => p.y));
    const maxX = Math.max(...all.map((p) => p.x));
    const maxY = Math.max(...all.map((p) => p.y));
    const W = maxX - minX + 1 + PAD * 2 + d.depth;
    const H = maxY - minY + 1 + PAD * 2 + d.depth;
    const ox = PAD - minX;
    const oy = PAD - minY;
    const letterOf = Array.from({ length: H }, () => new Int16Array(W));
    const rowOf = Array.from({ length: H }, () => new Int8Array(W).fill(-2)); // -2 = empty, -1 = spike/arrow
    const colorOf = Array.from({ length: H }, () => new Int8Array(W));
    // Each letter's glyph box: the outline and extrusion never paint inside one, so counters (the
    // holes in A, O, 4…) and slots stay dark and the letters stay readable at any size.
    const inBox = Array.from({ length: H }, () => new Uint8Array(W));
    for (const b of boxes) inBox[b.y + oy]![b.x + ox] = 1;
    for (const p of pixels) {
        letterOf[p.y + oy]![p.x + ox] = p.letter;
        rowOf[p.y + oy]![p.x + ox] = p.row;
        colorOf[p.y + oy]![p.x + ox] = p.colorRow;
    }

    const isFill = (x: number, y: number) =>
        y >= 0 && y < H && x >= 0 && x < W && letterOf[y]![x]! > 0;

    // 2. Outline: 4-neighbour dilation minus the fill (diagonal notches round the corners off),
    //    outside every glyph box.
    const outline = Array.from({ length: H }, () => new Uint8Array(W));
    if (d.outline) {
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                if (isFill(x, y) || inBox[y]![x]) continue;
                if (isFill(x - 1, y) || isFill(x + 1, y) || isFill(x, y - 1) || isFill(x, y + 1))
                    outline[y]![x] = 1;
            }
        }
    }
    // 2b. Clean-up: close 1-pixel notches in the outline (the stair-steps a lean leaves behind) —
    //     any blank cell outside a glyph box that is boxed in by shape left+right, top+bottom, or on
    //     three of four sides becomes outline. One pass is enough at 8 rows.
    if (d.outline) {
        const solid = (x: number, y: number) =>
            y >= 0 && y < H && x >= 0 && x < W && (letterOf[y]![x]! > 0 || outline[y]![x] === 1);
        const add: [number, number][] = [];
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                if (solid(x, y) || inBox[y]![x]) continue;
                const l = solid(x - 1, y),
                    r = solid(x + 1, y),
                    u = solid(x, y - 1),
                    dn = solid(x, y + 1);
                if ((l && r) || (u && dn) || +l + +r + +u + +dn >= 3) add.push([x, y]);
            }
        }
        for (const [x, y] of add) outline[y]![x] = 1;
    }

    const inShape = (x: number, y: number) =>
        y >= 0 && y < H && x >= 0 && x < W && (letterOf[y]![x]! > 0 || outline[y]![x] === 1);

    // 3. Extrusion: the shape shifted down-right 1..depth pixels, wherever the shape isn't (and,
    //    like the outline, never inside a glyph box — counters stay dark and legible).
    const extrude = Array.from({ length: H }, () => new Uint8Array(W));
    for (let k = d.depth; k >= 1; k--) {
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                if (inShape(x, y) || inBox[y]![x]) continue;
                if (inShape(x - k, y - k)) extrude[y]![x] = k;
            }
        }
    }

    // 4. Pixels → cells (2 cells per pixel). Extra rows below for drips.
    const CW = W * 2;
    const CH = H + dripMax + 1 + DRIP_BULB.length;
    const cells: Cell[][] = Array.from({ length: CH }, () =>
        Array.from({ length: CW }, () => ({ ch: ' ', c: '' })),
    );
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            let cell: Cell | null = null;
            const r = rowOf[y]![x]!;
            if (r > -2)
                cell = { ch: r === GLYPH_HEIGHT - 1 ? '▓' : '█', c: `a-f${colorOf[y]![x]}` };
            else if (outline[y]![x]) cell = { ch: '█', c: 'a-ol' };
            else if (extrude[y]![x])
                cell = extrude[y]![x] === 1 ? { ch: '█', c: 'a-x1' } : { ch: '▓', c: 'a-x2' };
            if (!cell) continue;
            cells[y]![x * 2] = cell;
            cells[y]![x * 2 + 1] = { ...cell };
        }
    }

    // 5a. Glints: one half-block highlight at the top-left of each letter's first row.
    const glinted = new Set<number>();
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const l = letterOf[y]![x]!;
            if (l === 0 || glinted.has(l) || rowOf[y]![x] !== 0) continue;
            glinted.add(l);
            cells[y]![x * 2 + 1] = { ch: '▀', c: 'a-gl' };
        }
    }

    // 5b. Drips: thin (1-cell) runs hanging from the bottom edge of the fill, through the outline
    //     and extrusion, ending in a rounded bulb (▗█▖ over ▝█▘, see DRIP_BULB) where there is
    //     room for its shoulders, else a half-block tip. Never two drips side by side.
    const blank = (x: number, y: number) => y < CH && x >= 0 && x < CW && !cells[y]![x]!.c;
    let lastDrip = -3;
    for (let x = 0; x < W; x++) {
        for (let y = 0; y < H; y++) {
            // Only true letter bottoms — not the underside of a bar over a counter (inside the box).
            if (!isFill(x, y) || isFill(x, y + 1) || (y + 1 < H && inBox[y + 1]![x])) continue;
            for (const half of [0, 1]) {
                const col = x * 2 + half;
                if (col - lastDrip < 3 || rand() >= dripP) continue;
                lastDrip = col;
                const len = 1 + Math.floor(rand() * dripMax);
                const cls = `a-f${colorOf[y]![x]}`;
                let tip = y;
                for (let i = 1; i <= len; i++) {
                    const yy = y + i;
                    if (yy >= CH - DRIP_BULB.length) break;
                    // Stop if the drip would run into another letter's fill.
                    if (yy < H && isFill(x, yy)) break;
                    cells[yy]![col] = { ch: '█', c: i === 1 ? cls : 'a-dr' };
                    tip = yy;
                }
                if (tip === y) continue;
                const room = DRIP_BULB.every(
                    (_, k) => blank(col - 1, tip + 1 + k) && blank(col + 1, tip + 1 + k),
                );
                if (room && DRIP_BULB.every((_, k) => blank(col, tip + 1 + k))) {
                    DRIP_BULB.forEach((row, k) => {
                        [...row].forEach((ch, dx) => {
                            cells[tip + 1 + k]![col - 1 + dx] = { ch, c: 'a-dr' };
                        });
                    });
                } else if (blank(col, tip + 1)) {
                    cells[tip + 1]![col] = { ch: '▀', c: 'a-dr' };
                }
            }
        }
    }

    // 5c. Overspray: fine dots in a halo 2 cells out — never touching the outline, so it reads as
    //     spray mist rather than outline debris.
    if (sprayP > 0) {
        const painted = (x: number, y: number) => {
            const c = cells[y]?.[x];
            return !!c && !!c.c && c.c !== 'a-os';
        };
        const near = (x: number, y: number, rx: number, ry: number) => {
            for (let dy = -ry; dy <= ry; dy++)
                for (let dx = -rx; dx <= rx; dx++) if (painted(x + dx, y + dy)) return true;
            return false;
        };
        for (let y = 0; y < CH; y++) {
            for (let x = 0; x < CW; x++) {
                if (cells[y]![x]!.c || near(x, y, 1, 0) || !near(x, y, 3, 1) || rand() >= sprayP)
                    continue;
                cells[y]![x] = { ch: '·', c: 'a-os' };
            }
        }
    }

    // 6. Trim blank rows/columns and run-length encode.
    const blankRow = (row: Cell[]) => row.every((c) => !c.c);
    while (cells.length && blankRow(cells[cells.length - 1]!)) cells.pop();
    while (cells.length && blankRow(cells[0]!)) cells.shift();
    let trimX = CW;
    for (const row of cells) {
        const i = row.findIndex((c) => c.c);
        if (i >= 0) trimX = Math.min(trimX, i);
    }
    const lines: Run[][] = cells.map((row) => {
        const trimmed = row.slice(trimX);
        while (trimmed.length && !trimmed[trimmed.length - 1]!.c) trimmed.pop();
        const runs: Run[] = [];
        for (const cell of trimmed) {
            const last = runs[runs.length - 1];
            if (last && last.c === cell.c) last.t += cell.ch;
            else runs.push({ c: cell.c, t: cell.ch });
        }
        return runs;
    });
    const cols = Math.max(0, ...lines.map((l) => l.reduce((n, r) => n + [...r.t].length, 0)));
    return { lines, cols, rows: lines.length };
}

/** The art as plain text (tests, terminal output, debugging). */
export function toPlainText(art: AnsiArt): string {
    return art.lines.map((l) => l.map((r) => r.t).join('')).join('\n');
}

/**
 * Split text into at most `maxLines` lines, balancing their lengths — used for a stacked variant on
 * narrow screens ("STEPHEN LYONS" → "STEPHEN" / "LYONS").
 */
export function balanceLines(text: string, maxLines = 2): string[] {
    const words = text.trim().split(/\s+/);
    if (words.length < 2 || maxLines < 2) return [text.trim()];
    let best: string[] = [text.trim()];
    let bestScore = Infinity;
    for (let i = 1; i < words.length; i++) {
        const a = words.slice(0, i).join(' ');
        const b = words.slice(i).join(' ');
        const score = Math.max(a.length, b.length);
        if (score < bestScore) {
            bestScore = score;
            best = [a, b];
        }
    }
    return best;
}
