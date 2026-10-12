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
    /** Pixels between letters (default 1). 2 keeps extrusion from bridging letters in big pieces. */
    gap?: number;
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
    Required<Omit<AnsiOptions, 'style' | 'seed'>> & {
        outline: boolean;
        bounce: boolean;
        depth: number;
    }
> = {
    bubble: { drips: 0.18, dripMax: 4, overspray: 0.05, outline: true, bounce: false, depth: 2 },
    wild: { drips: 0.3, dripMax: 5, overspray: 0.08, outline: true, bounce: true, depth: 2 },
    block: { drips: 0.12, dripMax: 3, overspray: 0, outline: false, bounce: false, depth: 1 },
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
    const BOUNCE = d.bounce ? 1 : 0;
    const PAD = 1 + (d.outline ? 1 : 0); // pixel margin for outline (+1 for overspray)
    const gap = opts.gap ?? 1;

    // 1. Lay out glyphs into a pixel mask; letterOf[y][x] = letter index + 1, rowOf = glyph row.
    const glyphs = chars.map(glyphFor);
    const textW = glyphs.reduce((w, g) => w + g.w, 0) + gap * Math.max(0, glyphs.length - 1);
    const W = textW + PAD * 2 + d.depth;
    const H = GLYPH_HEIGHT + BOUNCE + PAD * 2 + d.depth;
    const letterOf = Array.from({ length: H }, () => new Int16Array(W));
    const rowOf = Array.from({ length: H }, () => new Int8Array(W).fill(-1));
    // Each letter's glyph box: the outline never paints inside one, so counters (the holes in
    // A, O, 4…) and slots stay dark and the letters stay readable at any size.
    const inBox = Array.from({ length: H }, () => new Uint8Array(W));

    let cx = PAD;
    glyphs.forEach((g, i) => {
        const dy = BOUNCE && chars[i] !== ' ' ? Math.round(rand() * BOUNCE) : 0;
        if (chars[i] !== ' ')
            for (let y = 0; y < GLYPH_HEIGHT; y++)
                for (let x = 0; x < g.w; x++) inBox[PAD + y + dy]![cx + x] = 1;
        for (let y = 0; y < GLYPH_HEIGHT; y++) {
            for (let x = 0; x < g.w; x++) {
                if (!g.rows[y]![x]) continue;
                letterOf[PAD + y + dy]![cx + x] = i + 1;
                rowOf[PAD + y + dy]![cx + x] = y;
            }
        }
        cx += g.w + gap;
    });

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
    const CH = H + dripMax + 1;
    const cells: Cell[][] = Array.from({ length: CH }, () =>
        Array.from({ length: CW }, () => ({ ch: ' ', c: '' })),
    );
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            let cell: Cell | null = null;
            const r = rowOf[y]![x]!;
            if (r >= 0) cell = { ch: r === GLYPH_HEIGHT - 1 ? '▓' : '█', c: `a-f${r}` };
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
    //     and extrusion, fading █ → ▓ → ▒ → ░ at the tip. Never two drips side by side.
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
                const cls = `a-f${GLYPH_HEIGHT - 1}`;
                for (let i = 1; i <= len + 1; i++) {
                    const yy = y + i;
                    if (yy >= CH) break;
                    // Stop if the drip would run into another letter's fill.
                    if (yy < H && isFill(x, yy)) break;
                    const left = len + 1 - i; // cells remaining after this one
                    const ch = left >= 3 ? '█' : left === 2 ? '▓' : left === 1 ? '▒' : '░';
                    cells[yy]![col] = { ch, c: i === 1 ? cls : 'a-dr' };
                }
            }
        }
    }

    // 5c. Overspray: sparse ░ / · in the blank halo right around the piece.
    if (sprayP > 0) {
        const near = (x: number, y: number) => {
            for (let dy = -1; dy <= 1; dy++)
                for (let dx = -2; dx <= 2; dx++) {
                    const c = cells[y + dy]?.[x + dx];
                    if (c && c.c && c.c !== 'a-os') return true;
                }
            return false;
        };
        for (let y = 0; y < CH; y++) {
            for (let x = 0; x < CW; x++) {
                if (cells[y]![x]!.c || !near(x, y) || rand() >= sprayP) continue;
                cells[y]![x] = { ch: rand() < 0.6 ? '░' : '·', c: 'a-os' };
            }
        }
    }

    // 6. Trim blank rows/columns and run-length encode.
    const blankRow = (row: Cell[]) => row.every((c) => !c.c);
    while (cells.length && blankRow(cells[cells.length - 1]!)) cells.pop();
    while (cells.length && blankRow(cells[0]!)) cells.shift();
    let minX = CW;
    for (const row of cells) {
        const i = row.findIndex((c) => c.c);
        if (i >= 0) minX = Math.min(minX, i);
    }
    const lines: Run[][] = cells.map((row) => {
        const trimmed = row.slice(minX);
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
