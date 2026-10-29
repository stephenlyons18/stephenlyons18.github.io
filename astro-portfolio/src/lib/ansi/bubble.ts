/**
 * Bubble pieces (R28): the look of the original title generator (R6/R7, what stephenlyons.dev shows),
 * on the half-block grid so it draws as one SVG path per class like every other piece.
 *
 *   text ─▶ font pixels (each 2 cells wide, 1 cell tall) with a slight lean and a 0–1 pixel bounce
 *        ─▶ per letter, last → first: its 1-pixel outline, then its fill (the first letter of a word
 *           ends up in front, the way bubble letters overlap), plus a dark seam where a letter's
 *           outline crosses the one behind it
 *        ─▶ 2-pixel 3D down-right ─▶ a glint per letter, thin drips, overspray ─▶ units
 *
 * The random draws (bounce, drips, overspray) are made in the same order as the original generator,
 * so with `overlap: 0` the letters, drips and mist land exactly where they did. Counters and slots
 * stay dark because neither outline nor 3D ever paints inside a glyph box. Colours are piece
 * classes; `[data-piece='bubble']` in global.css maps them to the 2-stop bubble ramp.
 */
import { GLYPH_HEIGHT, LIVE_GLYPHS, glyphFor } from './font';
import { C, hash, rng, trim, type Piece, type PieceClass } from './grid';

export interface BubbleOptions {
    /** Extra seed so two identical words can look different. */
    seed?: number;
    /** Drip probability per letter-bottom cell (0–1), and max drip length in cells. */
    drips?: number;
    dripMax?: number;
    /** Overspray density in the halo around the piece (0–1). */
    overspray?: number;
    /** Cells each letter tucks under the one before it (0 = the original spacing). */
    overlap?: number;
    /** A dark seam where a front letter lies over the letter behind it: 'outline' only cuts the back
     *  letter's outline; 'all' also its fill. Off by default (R34, user review: the dark border looked
     *  off in places; without it the overlap still reads, by the front letter's white outline). */
    seams?: false | 'outline' | 'all';
    /** Slashed zeros (leet wall words), instead of the original's plain 0. */
    slashedZero?: boolean;
    /** Where a letter's outline (and the 3D) may not go: 'box', the original's whole glyph box; or
     *  'hull', only what lies between its strokes along a row or a column, so its open sides get an
     *  outline. R33 uses 'box' (the original look: S, T, P keep their dark corners and undersides)
     *  except for the letters in HULL_LETTERS, which melt into their neighbours without it. */
    keepDark?: 'box' | 'hull';
}

const DEFAULTS: Required<BubbleOptions> = {
    seed: 0,
    drips: 0.3,
    dripMax: 5,
    overspray: 0.08,
    overlap: 1,
    seams: false,
    slashedZero: false,
    keepDark: 'box',
};
/** Letters that need their open sides outlined to read (R33, user review): the Y, whose stem
 *  otherwise melts into the letters beside it. Everything else keeps the original's dark box. */
const HULL_LETTERS = new Set(['Y']);
/** The original's moves: 1 pixel between letters, lean 1 pixel per 4 rows, bounce 0–1, 3D 2 deep. */
const GAP = 1;
const LEAN = 4;
const BOUNCE = 1;
const DEPTH = 2;
const PAD = 2;

/** A text cell: glyph + class (the original generator's model), plus who painted it. */
interface Cell {
    ch: string;
    c: PieceClass | '';
    /** 1-based letter index for fill and outline cells, else 0. */
    l: number;
}

export function renderBubble(text: string, opts: BubbleOptions = {}): Piece {
    const o = { ...DEFAULTS, ...opts };
    const rand = rng(hash(`wild:${text}`) ^ o.seed);
    const chars = [...text.toUpperCase()];
    const shiftOf = (row: number) => Math.floor((GLYPH_HEIGHT - 1 - row) / LEAN);

    // 1. Lay glyphs out in cell columns (a pixel is 2 cells), each letter's pixels and glyph box.
    interface Px {
        x: number; // cell column of the pixel's left half
        y: number;
        row: number;
    }
    const letters: { px: Px[]; box: Px[]; ch: string }[] = [];
    let cx = 0;
    chars.forEach((ch) => {
        const g = (o.slashedZero && ch === '0' ? null : LIVE_GLYPHS[ch]) ?? glyphFor(ch);
        const blank = ch === ' ';
        const dy = !blank ? Math.round(rand() * BOUNCE) : 0;
        if (!blank) {
            const px: Px[] = [];
            const box: Px[] = [];
            for (let y = 0; y < GLYPH_HEIGHT; y++)
                for (let x = 0; x < g.w; x++) {
                    const p = { x: cx + (x + shiftOf(y)) * 2, y: y + dy, row: y };
                    box.push(p);
                    if (g.rows[y]![x]) px.push(p);
                }
            letters.push({ px, box, ch });
            // The next letter of this word tucks under this one.
            cx += (g.w + GAP) * 2 - o.overlap;
        } else cx += (g.w + GAP) * 2 + o.overlap;
    });

    // 2. A cell canvas with room for the outline, 3D and drips (sized like the original's).
    const all = letters.flatMap((l) => l.box);
    const minX = Math.min(...all.map((p) => p.x));
    const minY = Math.min(...all.map((p) => p.y));
    const maxX = Math.max(...all.map((p) => p.x + 1));
    const maxY = Math.max(...all.map((p) => p.y));
    const CW = maxX - minX + 1 + (PAD * 2 + DEPTH) * 2;
    const H = maxY - minY + 1 + PAD * 2 + DEPTH;
    const CH = H + o.dripMax + 1;
    const ox = PAD * 2 - minX;
    const oy = PAD - minY;
    const grid = (): Uint8Array[] => Array.from({ length: CH }, () => new Uint8Array(CW));
    const at = (g: Uint8Array[], x: number, y: number) =>
        y >= 0 && y < CH && x >= 0 && x < CW ? g[y]![x]! : 0;
    // Per letter: its fill and glyph box. Any box: the 3D and notch clean-up stay out of all of them.
    const inBox = grid();
    const own = letters.map((l) => {
        const fill = grid();
        const box = grid();
        const row = new Map<number, number>();
        for (const p of l.box)
            for (const h of [0, 1])
                inBox[p.y + oy]![p.x + ox + h] = box[p.y + oy]![p.x + ox + h] = 1;
        for (const p of l.px)
            for (const h of [0, 1]) {
                fill[p.y + oy]![p.x + ox + h] = 1;
                row.set((p.y + oy) * CW + p.x + ox + h, p.row);
            }
        const hull = o.keepDark === 'hull' || HULL_LETTERS.has(l.ch);
        return { fill, box, row, dark: hull ? darkOf(fill, box) : box };
    });
    // Any letter's dark cells: the notch clean-up and the 3D stay out of them too.
    const inDark = grid();
    for (const l of own)
        for (let y = 0; y < CH; y++)
            for (let x = 0; x < CW; x++) if (l.dark[y]![x]) inDark[y]![x] = 1;

    // 3. Paint letters last → first, each as its outline then its fill, so every letter lies over the
    //    one after it: the first letter of a word in front, the bubble convention. The outline is a
    //    1-pixel ring of 4-neighbours (2 cells across, 1 down) kept out of the letter's own glyph box,
    //    so its counters and slots stay dark; over a letter behind, it paints on top.
    const fillOf = grid(); // visible fill: letter index (1-based)
    const olOf = grid(); // visible outline: letter index
    const rowOf = Array.from({ length: CH }, () => new Int8Array(CW).fill(-1));
    for (let i = letters.length; i >= 1; i--) {
        const { fill, dark, row } = own[i - 1]!;
        const mine = (x: number, y: number) => at(fill, x, y) === 1;
        for (let y = 0; y < CH; y++)
            for (let x = 0; x < CW; x++) {
                if (mine(x, y) || dark[y]![x]) continue;
                // One pixel out: within 2 cells sideways on the row, or the cell above/below.
                if (
                    mine(x - 1, y) ||
                    mine(x - 2, y) ||
                    mine(x + 1, y) ||
                    mine(x + 2, y) ||
                    mine(x, y - 1) ||
                    mine(x, y + 1)
                ) {
                    olOf[y]![x] = i;
                    fillOf[y]![x] = 0;
                }
            }
        for (let y = 0; y < CH; y++)
            for (let x = 0; x < CW; x++)
                if (fill[y]![x]) {
                    fillOf[y]![x] = i;
                    olOf[y]![x] = 0;
                    rowOf[y]![x] = row.get(y * CW + x)!;
                }
    }
    // Clean-up (as the original): close 1-pixel notches the lean leaves, outside the glyph boxes.
    // Per cell, so letters needn't sit on a shared pixel grid: sideways, a side is solid when the
    // next cell is, or when that one is blank and the cell after it is (the far half of a pixel).
    const solid = (x: number, y: number) => !!(at(fillOf, x, y) || at(olOf, x, y));
    const side = (x: number, y: number, d: number) =>
        solid(x + d, y) || (!solid(x + d, y) && solid(x + 2 * d, y));
    const ownerAt = (x: number, y: number) => at(olOf, x, y) || at(fillOf, x, y);
    const add: [number, number, number][] = [];
    for (let y = 0; y < CH; y++)
        for (let x = 0; x < CW; x++) {
            if (solid(x, y) || inDark[y]![x]) continue;
            const l = side(x, y, -1);
            const r = side(x, y, 1);
            const u = solid(x, y - 1);
            const d = solid(x, y + 1);
            if ((l && r) || (u && d) || +l + +r + +u + +d >= 3) {
                // Owned by the front-most neighbour.
                const n = [
                    ownerAt(x - 1, y) || ownerAt(x - 2, y),
                    ownerAt(x + 1, y) || ownerAt(x + 2, y),
                    ownerAt(x, y - 1),
                    ownerAt(x, y + 1),
                ].filter(Boolean);
                add.push([x, y, Math.min(...n)]);
            }
        }
    for (const [x, y, l] of add) olOf[y]![x] = l;

    // 4. 3D: the silhouette pushed down-right 1–2 pixels, outside every glyph box.
    const ext = grid();
    for (let k = DEPTH; k >= 1; k--)
        for (let y = 0; y < CH; y++)
            for (let x = 0; x < CW; x++)
                if (!solid(x, y) && !inDark[y]![x] && solid(x - 2 * k, y - k)) ext[y]![x] = k;

    // 5. Cells.
    const cells: Cell[][] = Array.from({ length: CH }, () =>
        Array.from({ length: CW }, () => ({ ch: ' ', c: '' as const, l: 0 })),
    );
    const band = (row: number): PieceClass => `p-f${row}` as PieceClass;
    for (let y = 0; y < CH; y++)
        for (let x = 0; x < CW; x++) {
            const f = fillOf[y]![x]!;
            if (f) {
                const r = rowOf[y]![x]!;
                cells[y]![x] = { ch: r === GLYPH_HEIGHT - 1 ? '▓' : '█', c: band(r), l: f };
            } else if (olOf[y]![x]) cells[y]![x] = { ch: '█', c: 'p-ol', l: olOf[y]![x]! };
            else if (ext[y]![x])
                cells[y]![x] =
                    ext[y]![x] === 1 ? { ch: '█', c: 'p-x1', l: 0 } : { ch: '▓', c: 'p-x2', l: 0 };
        }

    // 5a. Glints: half a cell of white at the top-left of each letter's first row.
    const glinted = new Set<number>();
    for (let y = 0; y < CH; y++)
        for (let x = 0; x < CW; x++) {
            const l = fillOf[y]![x]!;
            if (!l || glinted.has(l) || rowOf[y]![x] !== 0) continue;
            glinted.add(l);
            if (fillOf[y]![x + 1] !== l) continue; // that corner is under the letter in front
            cells[y]![x + 1] = { ch: '▀', c: 'p-sh', l };
        }

    // 5b. Drips: thin 1-cell runs from true letter bottoms (not the underside of a bar over a
    //     counter), fading █ ▓ ▒ ░, never two side by side; they stop at another letter's fill.
    let lastDrip = -3;
    const isFillCell = (x: number, y: number) => !!at(fillOf, x, y);
    for (let p = 0; p * 2 < CW; p++)
        for (let y = 0; y < H; y++)
            for (const half of [0, 1]) {
                const col = p * 2 + half;
                if (!isFillCell(col, y) || isFillCell(col, y + 1) || at(inBox, col, y + 1))
                    continue;
                if (col - lastDrip < 3 || rand() >= o.drips) continue;
                lastDrip = col;
                const len = 1 + Math.floor(rand() * o.dripMax);
                const first = band(rowOf[y]![col]!);
                for (let i = 1; i <= len + 1; i++) {
                    const yy = y + i;
                    if (yy >= CH) break;
                    if (isFillCell(col, yy)) break;
                    const left = len + 1 - i;
                    const ch = left >= 3 ? '█' : left === 2 ? '▓' : left === 1 ? '▒' : '░';
                    cells[yy]![col] = { ch, c: i === 1 ? first : 'p-dr', l: 0 };
                }
            }

    // 5c. Overspray: fine dots 2–3 cells out, never touching the piece.
    const painted = (x: number, y: number) => {
        const c = cells[y]?.[x];
        return !!c && !!c.c && c.c !== 'p-os';
    };
    const near = (x: number, y: number, rx: number, ry: number) => {
        for (let dy = -ry; dy <= ry; dy++)
            for (let dx = -rx; dx <= rx; dx++) if (painted(x + dx, y + dy)) return true;
        return false;
    };
    if (o.overspray > 0)
        for (let y = 0; y < CH; y++)
            for (let x = 0; x < CW; x++) {
                if (
                    cells[y]![x]!.c ||
                    near(x, y, 1, 0) ||
                    !near(x, y, 3, 1) ||
                    rand() >= o.overspray
                )
                    continue;
                cells[y]![x] = { ch: '·', c: 'p-os', l: 0 };
            }

    // 6. Cells → units (each cell is one unit wide and two tall). Shade glyphs become the drip
    //    fades; the bottom fill row's ▓ becomes its own band (p-f8); a glint is white over band 0.
    const W = CW;
    const UH = CH * 2;
    const units = new Uint8Array(W * UH);
    const owner = new Uint8Array(W * UH);
    const unit = (c: Cell): [PieceClass | '', PieceClass | ''] => {
        if (!c.c) return ['', ''];
        if (c.c === 'p-sh') return ['p-sh', 'p-f0'];
        if (c.c === 'p-os') return ['p-os', ''];
        const shade = c.ch === '▓' ? 1 : c.ch === '▒' ? 2 : c.ch === '░' ? 3 : 0;
        if (/^p-f\d$/.test(c.c)) {
            const v: PieceClass =
                shade === 0
                    ? c.c
                    : c.l
                      ? 'p-f8'
                      : shade === 1
                        ? 'p-d1'
                        : shade === 2
                          ? 'p-d2'
                          : 'p-d3';
            return [v, v];
        }
        if (c.c === 'p-dr') {
            const v = (['p-dr', 'p-d1', 'p-d2', 'p-d3'] as const)[shade]!;
            return [v, v];
        }
        return [c.c, c.c];
    };
    for (let y = 0; y < CH; y++)
        for (let x = 0; x < W; x++) {
            const [t, b] = unit(cells[y]![x]!);
            if (t) units[2 * y * W + x] = C[t];
            if (b) units[(2 * y + 1) * W + x] = C[b];
            owner[2 * y * W + x] = owner[(2 * y + 1) * W + x] = cells[y]![x]!.l;
        }

    // 7. Seams: one unit of ink where a front letter meets the outline of a letter behind it, so
    //    that outline visibly runs under the front one (fills are left whole: stems stay thick).
    if (o.seams) {
        const seam: number[] = [];
        for (let y = 0; y < UH; y++)
            for (let x = 0; x < W; x++) {
                const me = owner[y * W + x]!;
                if (!me) continue;
                for (const [dx, dy] of [
                    [1, 0],
                    [-1, 0],
                    [0, 1],
                    [0, -1],
                ] as const) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= W || ny >= UH) continue;
                    const them = owner[ny * W + nx]!;
                    const v = units[ny * W + nx]!;
                    if (them > me && (o.seams === 'all' || v === C['p-ol'])) seam.push(ny * W + nx);
                }
            }
        for (const i of seam) units[i] = C['p-ik'];
    }

    // Units are a cell wide and half a cell tall (0.6em × 0.5em), as the original's text cells were.
    return trim({ w: W, h: UH, cells: units, style: 'bubble', aspect: 1.2 });
}

/**
 * A letter's dark cells (R33): empty cells of its glyph box that lie between two of its strokes,
 * along the row (H, U, M, the Y's V) or along the column (C's mouth, E's and S's notches), plus any
 * hole. What's left of the box is open wall beside a stroke (the Y's and T's stem, the I's waist), so
 * it gets the outline and the letter reads at a glance; counters and notches stay dark, as before.
 */
function darkOf(fill: Uint8Array[], box: Uint8Array[]): Uint8Array[] {
    const H = fill.length;
    const W = fill[0]!.length;
    const dark = Array.from({ length: H }, () => new Uint8Array(W));
    const empty = (x: number, y: number) => box[y]![x] === 1 && !fill[y]![x];
    for (let y = 0; y < H; y++) {
        let first = -1;
        let last = -1;
        for (let x = 0; x < W; x++) if (fill[y]![x]) ((first = first < 0 ? x : first), (last = x));
        for (let x = first + 1; x < last; x++) if (empty(x, y)) dark[y]![x] = 1;
    }
    for (let x = 0; x < W; x++) {
        let first = -1;
        let last = -1;
        for (let y = 0; y < H; y++) if (fill[y]![x]) ((first = first < 0 ? y : first), (last = y));
        for (let y = first + 1; y < last; y++) if (empty(x, y)) dark[y]![x] = 1;
    }
    return dark;
}
