/**
 * ANSI graffiti pieces, v2 (R25): pure and deterministic. Wildstyle is drawn here; bubble pieces
 * (R28, the original generator's look) come from bubble.ts through the same renderPiece().
 *
 * Everything happens on a half-block grid: one unit (u) is one monospace cell wide and half a cell
 * tall (an ANSI ▀/▄ half), so units are square and a font pixel is 2 × 2 u. That resolution is what
 * lets every letter carry a thin, complete outline:
 *
 *   text ─▶ font pixels at 2× ─▶ wildstyle moves (chamfers, lean, blades, an arrow) ─▶ per letter, back to front: fill → 1u dark ink line (counters and slots
 *        go dark, so letters stay readable) → 1u white outline that wraps the letter
 *        ─▶ 3D extrusion behind the whole piece ─▶ thin drips, sparkles, overspray
 *        ─▶ a grid of class ids (pieceToSvg draws it as one path per class)
 *
 * Later letters are painted over earlier ones, so in wildstyle (letters overlapping) each front
 * letter's outline bites into the one behind it: the interlocking look. Colours are classes
 * (`p-f0`…`p-f9` fill bands, `p-ik` ink, `p-ol` outline, …), so CSS theme tokens recolour every
 * piece. Rules: docs/ART_DIRECTION.md.
 */
import { renderBubble } from './bubble';
import { GLYPHS, GLYPH_HEIGHT, glyphFor } from './font';
import {
    BANDS,
    C,
    FILL0,
    PIECE_CLASSES,
    hash,
    isFill,
    rng,
    trim,
    type Piece,
    type PieceClass,
    type PieceStyle,
} from './grid';

export { PIECE_CLASSES, type Piece, type PieceClass, type PieceStyle } from './grid';

export interface PieceOptions {
    style?: PieceStyle;
    /** Extra seed so two identical words can look different. */
    seed?: number;
    /** Units between letters' fills. Negative or small values make letters overlap (wildstyle). */
    gap?: number;
    /** Italic lean: one unit right per `lean` rows going up (0 = upright). */
    lean?: number;
    /** Max vertical stagger per letter, in units. */
    bounce?: number;
    /** Probability per letter of a blade (a tapered spike off a top or bottom corner). */
    blades?: number;
    /** An arrow flaring off the last letter. */
    arrow?: boolean;
    /** Drip probability per letter-bottom column (0–1), and max drip length in units. */
    drips?: number;
    dripMax?: number;
    /** 4-point sparkles placed around the piece. */
    sparkles?: number;
    /** 3D extrusion depth in units (down-right). */
    depth?: number;
    /** Overspray density in the halo around the piece (0–1). */
    overspray?: number;
    /** Highlight strokes: a bevel shine and "cuts" (diagonal accent stripes). */
    shine?: boolean;
    /** Wildstyle v3 (R29): a dark break line across each letter, the fill beyond it running the
     *  ramp the other way (two-tone splits, as in the reference burners). */
    splits?: boolean;
    /** A long tapered swoosh off the first letter's foot, back under the piece. */
    swoosh?: boolean;
    /** A backdrop cloud with bubbles behind the piece (units of spread; 0 = none). */
    cloud?: number;
    /** Leet spelling: keep the lowercase letters the font draws (the r of r00t). Off by default, so
     *  titles are all caps whatever their casing (R36). */
    leet?: boolean;
    /** Bubble only: slashed zeros (leet wall words) instead of the original's plain 0. */
    slashedZero?: boolean;
}

const DEFAULTS: Required<PieceOptions> = {
    style: 'wild',
    seed: 0,
    gap: 0,
    lean: 6,
    bounce: 2,
    blades: 0.35,
    arrow: true,
    drips: 0.22,
    dripMax: 9,
    sparkles: 3,
    depth: 5,
    overspray: 0.06,
    shine: true,
    splits: true,
    swoosh: true,
    cloud: 5,
    leet: false,
    slashedZero: true,
};

// ─── Small bitmap helpers (a Mask is a w × h grid of 0/1) ───────────────────

interface Mask {
    w: number;
    h: number;
    d: Uint8Array;
}
const mask = (w: number, h: number): Mask => ({ w, h, d: new Uint8Array(w * h) });
const at = (m: Mask, x: number, y: number) =>
    x >= 0 && y >= 0 && x < m.w && y < m.h ? m.d[y * m.w + x]! : 0;
const set = (m: Mask, x: number, y: number, v = 1) => {
    if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.d[y * m.w + x] = v;
};
const N4 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
] as const;
const N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

/** Cells next to `m` (by the given neighbourhood) that aren't in it. */
function ring(m: Mask, nb: readonly (readonly [number, number])[]): Mask {
    const r = mask(m.w, m.h);
    for (let y = 0; y < m.h; y++)
        for (let x = 0; x < m.w; x++)
            if (!at(m, x, y) && nb.some(([dx, dy]) => at(m, x + dx, y + dy))) set(r, x, y);
    return r;
}
const union = (a: Mask, b: Mask): Mask => {
    const r = mask(a.w, a.h);
    for (let i = 0; i < r.d.length; i++) r.d[i] = a.d[i]! | b.d[i]!;
    return r;
};

/** Holes: empty cells not reachable from the border without crossing `m` (counters of A, O, 4…). */
function holes(m: Mask): Mask {
    const seen = mask(m.w, m.h);
    const stack: [number, number][] = [];
    for (let x = 0; x < m.w; x++) stack.push([x, 0], [x, m.h - 1]);
    for (let y = 0; y < m.h; y++) stack.push([0, y], [m.w - 1, y]);
    while (stack.length) {
        const [x, y] = stack.pop()!;
        if (x < 0 || y < 0 || x >= m.w || y >= m.h || at(seen, x, y) || at(m, x, y)) continue;
        set(seen, x, y);
        for (const [dx, dy] of N4) stack.push([x + dx, y + dy]);
    }
    const r = mask(m.w, m.h);
    for (let i = 0; i < r.d.length; i++) r.d[i] = !m.d[i] && !seen.d[i] ? 1 : 0;
    return r;
}

/**
 * Remove convex corner units: a filled cell whose two orthogonal outward neighbours (e.g. up and
 * left) are both empty. `corners` picks which of the four corner kinds are cut.
 */
function cutCorners(m: Mask, corners: ('tl' | 'tr' | 'bl' | 'br')[]): Mask {
    const r: Mask = { ...m, d: m.d.slice() };
    const dirs = { tl: [-1, -1], tr: [1, -1], bl: [-1, 1], br: [1, 1] } as const;
    for (let y = 0; y < m.h; y++)
        for (let x = 0; x < m.w; x++) {
            if (!at(m, x, y)) continue;
            for (const k of corners) {
                const [dx, dy] = dirs[k];
                if (!at(m, x + dx, y) && !at(m, x, y + dy) && !at(m, x + dx, y + dy))
                    set(r, x, y, 0);
            }
        }
    return r;
}

// ─── Letters ─────────────────────────────────────────────────────────────────

/** Padding around each letter's local grid: room for a blade (≤ 7u), its ink and outline. */
const PAD = 11;
const LETTER_H = GLYPH_HEIGHT * 2;

interface Letter {
    /** Fill mask in local coordinates (PAD around the glyph box). */
    fill: Mask;
    /** Local x/y of the glyph box's top-left in the piece. */
    ox: number;
    oy: number;
    /** Glyph width in units (for advancing). */
    gw: number;
}

function buildLetter(
    ch: string,
    o: Required<PieceOptions>,
    rand: () => number,
    first: boolean,
    last: boolean,
) {
    const g = glyphFor(ch);
    const gw = g.w * 2;
    let m = mask(gw + PAD * 2 + 8, LETTER_H + PAD * 2);
    for (let y = 0; y < GLYPH_HEIGHT; y++)
        for (let x = 0; x < g.w; x++)
            if (g.rows[y]![x])
                for (const [dx, dy] of [
                    [0, 0],
                    [1, 0],
                    [0, 1],
                    [1, 1],
                ] as const)
                    set(m, PAD + x * 2 + dx, PAD + y * 2 + dy);
    if (ch === ' ') return { fill: m, gw };

    {
        // Wildstyle: sharp, angular cuts on the leading corners only (top-left and bottom-right),
        // which with the lean makes every letter look like it's moving. One pass: a deeper cut turns
        // P, R and B into A at phone size.
        m = cutCorners(m, ['tl', 'br']);
        // Blades: a tapered flare off the top-right (up and out), or off the first letter's
        // bottom-left (the start flare, down and back): 4u thick where it leaves the letter, 1u at
        // the tip, so it reads as part of the letter and gets its own ink and outline. Never on the
        // arrow letter, and never a low blade mid-word (it turns N into M).
        if (!(last && o.arrow) && rand() < (first ? Math.max(o.blades, 0.6) : o.blades)) {
            const up = !first || rand() < 0.4;
            const row = up ? PAD : PAD + LETTER_H - 1;
            const xs = [...Array(m.w).keys()].filter((x) => at(m, x, row));
            if (xs.length) {
                const x0 = up ? Math.max(...xs) : Math.min(...xs);
                const len = 5 + Math.floor(rand() * 3);
                const sx = up ? 1 : -1;
                const sy = up ? -1 : 1;
                for (let k = 1; k <= len; k++) {
                    const t = Math.max(1, Math.round(4 * (1 - k / (len + 1))));
                    for (let j = 0; j < t; j++) set(m, x0 + sx * (k - j), row + sy * k);
                }
            }
        }
        if (first && o.swoosh) {
            // The swoosh: off the foot of the first letter, back and out to the left, tapering
            // from 3u to a 1u point and dipping as it goes (the long extensions of MUSTER/SHAPER).
            const row = PAD + LETTER_H - 1;
            const xs = [...Array(m.w).keys()].filter((x) => at(m, x, row));
            if (xs.length) {
                const x0 = Math.min(...xs) + 2;
                const len = 9;
                for (let k = 0; k <= len; k++) {
                    const t = Math.max(1, Math.round(3 * (1 - k / (len + 1))));
                    const dip = Math.floor((k * k) / 40);
                    for (let j = 0; j < t; j++) set(m, x0 - k, row - j + dip);
                }
            }
        }
        if (last && o.arrow) {
            // An arrow off the right side at mid-height: a short shaft, then a head.
            let right = 0;
            for (let x = 0; x < m.w; x++)
                for (let y = PAD; y < PAD + LETTER_H; y++)
                    if (at(m, x, y)) right = Math.max(right, x);
            const cy = PAD + Math.floor(LETTER_H / 2) - 1;
            for (let x = right + 1; x <= right + 3; x++) (set(m, x, cy), set(m, x, cy + 1));
            for (let k = 0; k < 5; k++)
                for (let y = cy - 4 + k; y <= cy + 5 - k; y++) set(m, right + 4 + k, y);
        }
    }
    // Lean: one unit right per `lean` rows going up (applied in the letter, so blades lean too).
    if (o.lean) {
        const l = mask(m.w, m.h);
        for (let y = 0; y < m.h; y++) {
            const s = Math.floor((m.h - 1 - y) / o.lean) - Math.floor((PAD - 1) / o.lean);
            for (let x = 0; x < m.w; x++) if (at(m, x, y)) set(l, x + s, y);
        }
        m = l;
    }
    return { fill: m, gw };
}

/** The letters a piece draws: all caps, except, for leet words, the lowercase ones the font has. */
export function pieceChars(text: string, leet = false): string[] {
    return [...text].map((c) => (leet && c !== c.toUpperCase() && GLYPHS[c] ? c : c.toUpperCase()));
}

// ─── The piece ───────────────────────────────────────────────────────────────

export function renderPiece(text: string, opts: PieceOptions = {}): Piece {
    const style = opts.style ?? 'wild';
    if (style === 'bubble') {
        // The original generator's options, where given (its drips are counted in cells).
        const { seed, drips, dripMax, overspray, slashedZero } = opts;
        return renderBubble(text, {
            ...(seed !== undefined && { seed }),
            ...(drips !== undefined && { drips }),
            ...(dripMax !== undefined && { dripMax: Math.ceil(dripMax / 2) }),
            ...(overspray !== undefined && { overspray }),
            ...(slashedZero !== undefined && { slashedZero }),
        });
    }
    const o: Required<PieceOptions> = { ...DEFAULTS, ...opts, style };
    const rand = rng(hash(`v2:${style}:${text}`) ^ o.seed);
    const chars = pieceChars(text, o.leet);
    const firstIdx = chars.findIndex((c) => c !== ' ');
    const lastIdx = chars.findLastIndex((c) => c !== ' ');

    // 1. Lay letters out left to right (glyph box + gap), each with its own vertical stagger.
    const letters: Letter[] = [];
    let cx = 0;
    chars.forEach((ch, i) => {
        const { fill, gw } = buildLetter(ch, o, rand, i === firstIdx, i === lastIdx);
        const dy = ch === ' ' ? 0 : Math.round(rand() * o.bounce);
        if (ch !== ' ') letters.push({ fill, ox: cx - PAD, oy: dy - PAD, gw });
        cx += gw + (ch === ' ' ? 0 : o.gap) + (ch === ' ' ? 0 : 0);
    });

    // 2. A canvas big enough for every letter's padded grid, the extrusion and the drips.
    const minX = Math.min(...letters.map((l) => l.ox));
    const minY = Math.min(...letters.map((l) => l.oy));
    const maxX = Math.max(...letters.map((l) => l.ox + l.fill.w));
    const maxY = Math.max(...letters.map((l) => l.oy + l.fill.h));
    // Margin round the letters for the backdrop cloud and its bubbles.
    const M = o.cloud ? o.cloud + 3 : 0;
    const W = maxX - minX + o.depth + 2 + 2 * M;
    const H = maxY - minY + o.depth + o.dripMax + 2 + 2 * M;
    const cells = new Uint8Array(W * H);
    const get = (x: number, y: number) =>
        x >= 0 && y >= 0 && x < W && y < H ? cells[y * W + x]! : 0;
    const put = (x: number, y: number, v: number) => {
        if (x >= 0 && y >= 0 && x < W && y < H) cells[y * W + x] = v;
    };

    // 3. Letters back to front: outline, ink, fill (+ highlights). A later letter paints over an
    //    earlier one, outline first, so its outline cuts into the letter behind.
    letters.forEach((l, li) => {
        const f = l.fill;
        const ink = union(ring(f, N8), holes(f));
        const body = union(f, ink);
        const ol = ring(body, N8);
        const ox = l.ox - minX + M;
        const oy = l.oy - minY + M;
        // Fill gradient bands by height in the glyph box (blades/arrow take the nearest band).
        const band = (y: number) =>
            Math.min(BANDS - 1, Math.max(0, Math.floor(((y - PAD) / LETTER_H) * BANDS)));
        for (let y = 0; y < f.h; y++)
            for (let x = 0; x < f.w; x++) {
                const gx = ox + x;
                const gy = oy + y;
                if (at(ol, x, y)) put(gx, gy, C['p-ol']);
                else if (at(ink, x, y)) put(gx, gy, C['p-ik']);
                else if (at(f, x, y)) put(gx, gy, FILL0 + band(y));
            }
        if (o.splits) {
            // A break: a 1u dark line across the letter's lower third (below the H, A and E bars), leaning one way or the
            // other letter by letter; below it the letter is one solid second tone (the ramp's foot),
            // so it reads as two segments (SENK, TALE, MUSTER). Only where the letter is at least 3u thick
            // across the line, so thin strokes and blades never break into crumbs.
            const slope = li % 2 ? 0.34 : -0.34;
            let sx = 0;
            let n = 0;
            for (let y = PAD; y < PAD + LETTER_H; y++)
                for (let x = 0; x < f.w; x++) if (at(f, x, y)) ((sx += x), n++);
            const cxl = sx / Math.max(1, n);
            const base = PAD + Math.round(LETTER_H * 0.72) + (li % 2);
            for (let x = 0; x < f.w; x++) {
                const yl = base + Math.round((x - cxl) * slope);
                if (!(at(f, x, yl - 1) && at(f, x, yl) && at(f, x, yl + 1))) continue;
                put(ox + x, oy + yl, C['p-ik']);
                for (let y = yl + 1; y < f.h && at(f, x, y); y++)
                    put(ox + x, oy + y, FILL0 + BANDS - 2);
            }
        }
        if (!o.shine) return;
        {
            // Shine: a highlight stroke one unit inside the letter's top edge (a bevel catching the
            // light), on its left half. Cut: on every other letter, a 2u diagonal accent band
            // through the lower half, as in a burner's colour splits.
            for (let x = 0; x < f.w; x++) {
                if (!(at(f, x, PAD + 1) && at(f, x, PAD) && at(f, x, PAD + 2))) continue;
                if (x - PAD > l.gw / 2 + 2) break;
                put(ox + x, oy + PAD + 1, C['p-sh']);
            }
            // A highlight dot under the bevel, near the letter's top-left (spray shine).
            for (let x = 0; x < f.w; x++)
                if (at(f, x, PAD + 3) && at(f, x + 1, PAD + 3) && at(f, x, PAD + 4)) {
                    put(ox + x + 1, oy + PAD + 3, C['p-sh']);
                    break;
                }
            if (!o.splits && li % 2 === 0) {
                // The band runs up-right (x + y constant) through the letter's lower middle.
                let sx = 0;
                let n = 0;
                for (let y = PAD; y < PAD + LETTER_H; y++)
                    for (let x = 0; x < f.w; x++) if (at(f, x, y)) ((sx += x), n++);
                const s0 = Math.round(sx / Math.max(1, n) + PAD + LETTER_H * 0.7) + (li % 4) - 1;
                for (let y = PAD + LETTER_H / 2; y < PAD + LETTER_H - 1; y++)
                    for (let x = 0; x < f.w; x++) {
                        const inside = at(f, x - 1, y) && at(f, x + 1, y) && at(f, x, y + 1);
                        if (inside && (x + y === s0 || x + y === s0 + 1))
                            put(ox + x, oy + y, C['p-cu']);
                    }
            }
        }
    });

    // 4. 3D extrusion behind the whole piece: its silhouette pushed down-right, near half lighter.
    const solid = (x: number, y: number) => {
        const v = get(x, y);
        return v !== 0 && v !== C['p-x1'] && v !== C['p-x2'];
    };
    const ext: [number, number, number][] = [];
    for (let k = 1; k <= o.depth; k++)
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                if (!get(x, y) && solid(x - k, y - k))
                    // Striped, two units per band, as in a stepped block 3D (SHAPER).
                    ext.push([x, y, Math.floor((k - 1) / 2) % 2 ? C['p-x2'] : C['p-x1']]);
    for (const [x, y, v] of ext) if (!get(x, y)) put(x, y, v);

    // 5. Drips: thin (1u) runs from letter bottoms, down through ink, outline and 3D, fading at the
    //    tip. Never two side by side, and they stop at another letter's fill.
    let lastDrip = -4;
    for (let x = 0; x < W; x++) {
        for (let y = 0; y < H - 1; y++) {
            const v = get(x, y);
            if (!isFill(v) || isFill(get(x, y + 1)) || v < FILL0 + BANDS / 2) continue;
            if (x - lastDrip < 4 || rand() >= o.drips) continue;
            lastDrip = x;
            const len = 3 + Math.floor(rand() * (o.dripMax - 2));
            for (let i = 1; i <= len; i++) {
                if (isFill(get(x, y + i)) || y + i >= H) break;
                const left = len - i;
                put(x, y + i, left >= 2 ? C['p-dr'] : left === 1 ? C['p-d1'] : C['p-d2']);
            }
        }
    }

    // 6. Sparkles: small 4-point stars in clear space near the piece's corners and top edge.
    // A 4-point star: long vertical arms, shorter horizontal ones, an open centre glint.
    const STAR = [
        [0, -3],
        [0, -2],
        [0, -1],
        [-2, 0],
        [-1, 0],
        [1, 0],
        [2, 0],
        [0, 1],
        [0, 2],
        [0, 3],
    ];
    const clear = (x: number, y: number) => {
        for (let dy = -3; dy <= 3; dy++)
            for (let dx = -3; dx <= 3; dx++) if (get(x + dx, y + dy)) return false;
        return x > 2 && y > 2 && x < W - 3 && y < H - 3;
    };
    let placed = 0;
    for (let t = 0; t < 400 && placed < o.sparkles; t++) {
        // Bias to the top-right and bottom-left, where graffiti stars usually sit.
        const corner = placed % 2 === 0;
        const x = Math.floor(corner ? W * (0.55 + rand() * 0.45) : rand() * W * 0.45);
        const y = Math.floor(corner ? rand() * H * 0.45 : H * (0.45 + rand() * 0.4));
        if (!clear(x, y)) continue;
        // Only near the piece (within 6u of something), so stars belong to it.
        let near = false;
        for (let dy = -6; dy <= 6 && !near; dy++)
            for (let dx = -6; dx <= 6 && !near; dx++) if (solid(x + dx, y + dy)) near = true;
        if (!near) continue;
        for (const [dx, dy] of STAR) put(x + dx!, y + dy!, C['p-sp']);
        placed++;
    }

    // 6b. Backdrop cloud: a soft-edged blob a few units round the whole piece, its edge scalloped,
    //     with bubbles spraying off it, behind everything (MUSTER, SHAPER): depth for the piece.
    if (o.cloud > 0) {
        // Distance to the piece, by a two-pass chamfer transform (3 straight, 4 diagonal ≈ 3√2):
        // linear in the canvas, so it is cheap enough to run in the browser for the wall (R32).
        const INF = 1 << 14;
        const dist = new Uint16Array(W * H);
        for (let i = 0; i < W * H; i++) dist[i] = cells[i] ? 0 : INF;
        const relax = (i: number, j: number, c: number) => {
            if (dist[j]! + c < dist[i]!) dist[i] = dist[j]! + c;
        };
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++) {
                const i = y * W + x;
                if (x > 0) relax(i, i - 1, 3);
                if (y > 0) {
                    relax(i, i - W, 3);
                    if (x > 0) relax(i, i - W - 1, 4);
                    if (x < W - 1) relax(i, i - W + 1, 4);
                }
            }
        for (let y = H - 1; y >= 0; y--)
            for (let x = W - 1; x >= 0; x--) {
                const i = y * W + x;
                if (x < W - 1) relax(i, i + 1, 3);
                if (y < H - 1) {
                    relax(i, i + W, 3);
                    if (x < W - 1) relax(i, i + W + 1, 4);
                    if (x > 0) relax(i, i + W - 1, 4);
                }
            }
        const ph = [rand() * 6.28, rand() * 6.28, rand() * 6.28];
        const r = (x: number) =>
            o.cloud *
            (0.55 +
                0.25 * Math.sin(x / 5 + ph[0]!) +
                0.15 * Math.sin(x / 2.3 + ph[1]!) +
                0.05 * Math.sin(x / 1.1 + ph[2]!));
        const cloud: number[] = [];
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++) {
                const i = y * W + x;
                if (!cells[i] && dist[i]! <= 3 * r(x)) cloud.push(i);
            }
        for (const i of cloud) cells[i] = C['p-bg'];
        // Bubbles: small discs just off the cloud's edge.
        const disc = (cx: number, cy: number, rad: number) => {
            for (let dy = -rad; dy <= rad; dy++)
                for (let dx = -rad; dx <= rad; dx++)
                    if (dx * dx + dy * dy <= rad * rad + rad && !get(cx + dx, cy + dy))
                        put(cx + dx, cy + dy, C['p-bg']);
        };
        let made = 0;
        for (let t = 0; t < 600 && made < Math.max(4, Math.round(W / 18)); t++) {
            const x = 2 + Math.floor(rand() * (W - 4));
            const y = 2 + Math.floor(rand() * (H - 4));
            const rad = 1 + Math.floor(rand() * 2);
            let near = false;
            let far = true;
            for (let dy = -rad - 3; dy <= rad + 3; dy++)
                for (let dx = -rad - 3; dx <= rad + 3; dx++) {
                    const v = get(x + dx, y + dy);
                    if (v === C['p-bg']) near = true;
                    if (v && v !== C['p-bg'] && Math.abs(dx) <= rad + 1 && Math.abs(dy) <= rad + 1)
                        far = false;
                }
            if (!near || !far || get(x, y)) continue;
            disc(x, y, rad);
            made++;
        }
    }

    // 7. Overspray: single-unit mist 2–3u out from the piece, never touching it.
    if (o.overspray > 0) {
        const mist: [number, number][] = [];
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++) {
                if (get(x, y)) continue;
                let d1 = false;
                let d3 = false;
                for (let dy = -3; dy <= 3; dy++)
                    for (let dx = -3; dx <= 3; dx++) {
                        if (!get(x + dx, y + dy)) continue;
                        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) d1 = true;
                        d3 = true;
                    }
                if (!d1 && d3 && rand() < o.overspray) mist.push([x, y]);
            }
        for (const [x, y] of mist) put(x, y, C['p-os']);
    }

    // 8. Trim to the painted box.
    return trim({ w: W, h: H, cells, style: 'wild' });
}

// ─── Output ──────────────────────────────────────────────────────────────────

export interface PieceSvgOptions {
    /** Class → colour: draw with fills instead of classes (the OG image, outside the page's CSS). */
    colors?: Partial<Record<PieceClass, string>>;
    /** Extra attributes on the <svg> (e.g. class, aria-hidden). */
    attrs?: Record<string, string>;
}

/**
 * The piece as an inline SVG: one <path> per class, built from rectangles (runs merged across rows),
 * on a viewBox of one unit per half-cell. `shape-rendering: crispEdges` keeps it pixel-hard at any
 * size. Static, aria-hidden by the caller; themeable by class.
 */
const OS = C['p-os'];

/**
 * Paint order for pieceToSvg, back to front. Opaque classes painted later may be covered by an earlier
 * class's path (they paint over it anyway), so thin rings like the outline collapse into one solid
 * silhouette and the SVG stays small. Translucent ones (drip fades, mist) are never covered.
 */
const ORDER: PieceClass[] = [
    'p-bg',
    'p-x2',
    'p-x1',
    'p-ol',
    'p-ik',
    'p-f0',
    'p-f1',
    'p-f2',
    'p-f3',
    'p-f4',
    'p-f5',
    'p-f6',
    'p-f7',
    'p-f8',
    'p-f9',
    'p-cu',
    'p-sh',
    'p-dr',
    'p-sp',
    'p-d1',
    'p-d2',
    'p-d3',
    'p-os',
];
// p-f8 is opaque in wildstyle but a ▓ shade in bubble pieces: never paint another class under it.
const TRANSLUCENT = new Set<PieceClass>(['p-f8', 'p-d1', 'p-d2', 'p-d3', 'p-os']);

export function pieceToSvg(p: Piece, opts: PieceSvgOptions = {}): string {
    const rank = new Int8Array(PIECE_CLASSES.length).fill(-1);
    ORDER.forEach((c, i) => (rank[C[c]] = i));
    // Rects per class as [x, y, w, h]; serialised with relative moves (after `z` the pen is back at
    // the rect's start, so the next rect is a short `m dx dy`).
    const d: Record<number, [number, number, number, number][]> = {};
    for (const cls of ORDER) {
        const v = C[cls];
        const r = rank[v]!;
        // must: this class's own cells. may: opaque cells painted later, which hide whatever is under.
        const must = (i: number) => p.cells[i] === v;
        const may = (i: number) => {
            const c = p.cells[i]!;
            return (
                c === v ||
                (v !== OS && c !== 0 && rank[c]! > r && !TRANSLUCENT.has(PIECE_CLASSES[c]!))
            );
        };
        const used = new Uint8Array(p.w * p.h);
        for (let y = 0; y < p.h; y++) {
            let x = 0;
            while (x < p.w) {
                const i0 = y * p.w + x;
                if (!must(i0) || used[i0]) {
                    x++;
                    continue;
                }
                // Extend left and right over may-cells, so the run is as long as it can be.
                let a = x;
                while (a > 0 && may(y * p.w + a - 1) && !used[y * p.w + a - 1]) a--;
                let b = x + 1;
                while (b < p.w && may(y * p.w + b) && !used[y * p.w + b]) b++;
                const n = b - a;
                // Grow the run down while the next row can take the same span.
                let rows = 1;
                const fits = (yy: number) => {
                    for (let k = a; k < b; k++)
                        if (!may(yy * p.w + k) || used[yy * p.w + k]) return false;
                    return true;
                };
                while (y + rows < p.h && fits(y + rows)) rows++;
                for (let rr = 0; rr < rows; rr++)
                    used.fill(1, (y + rr) * p.w + a, (y + rr) * p.w + b);
                if (v === OS)
                    // Overspray is mist, not pixels: a small dot in each unit (the `·` of ANSI art).
                    for (let rr = 0; rr < rows; rr++)
                        for (let k = 0; k < n; k++)
                            (d[v] ??= []).push([a + k + 0.35, y + rr + 0.35, 0.3, 0.3]);
                else (d[v] ??= []).push([a, y, n, rows]);
                x = b;
            }
        }
    }
    // Non-square units (bubble's 0.6em × 0.5em cells) stretch the unit viewBox to the drawn ratio.
    const a = p.aspect ?? 1;
    const ratio = a === 1 ? null : `aspect-ratio:${+(p.w * a).toFixed(2)}/${p.h}`;
    const style = [opts.attrs?.['style'], ratio].filter(Boolean).join(';');
    const attrs = Object.entries({
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: `0 0 ${p.w} ${p.h}`,
        'shape-rendering': 'crispEdges',
        ...(p.style && { 'data-piece': p.style }),
        ...(ratio && { preserveAspectRatio: 'none' }),
        ...opts.attrs,
        ...(style && { style }),
    })
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
    const paths = ORDER.filter((c) => d[C[c]])
        .map((cls) => {
            let px = 0;
            let py = 0;
            // Almost every coordinate is a whole unit: skip the rounding for those (it was most of
            // the cost of drawing a piece, which matters when wall.ts draws them in the browser).
            const num = (n: number) =>
                Number.isInteger(n) ? String(n) : String(+n.toFixed(2)).replace(/^(-?)0\./, '$1.');
            const parts = d[C[cls]]!.map(([x, y, w, h], i) => {
                const m = i ? `m${num(x - px)} ${num(y - py)}` : `M${num(x)} ${num(y)}`;
                [px, py] = [x, y];
                return `${m}h${num(w)}v${num(h)}h-${num(w)}z`;
            });
            const paint = opts.colors
                ? opts.colors[cls]
                    ? `fill="${opts.colors[cls]}"`
                    : ''
                : `class="${cls}"`;
            return paint ? `<path ${paint} d="${parts.join('')}"/>` : '';
        })
        .join('');
    return `<svg ${attrs}>${paths}</svg>`;
}

/** The piece as half-block text (▀ ▄ █), one text row per two units: tests, debugging. */
export function pieceToText(p: Piece): string {
    const rows: string[] = [];
    for (let y = 0; y < p.h; y += 2) {
        let s = '';
        for (let x = 0; x < p.w; x++) {
            const t = p.cells[y * p.w + x]!;
            const b = y + 1 < p.h ? p.cells[(y + 1) * p.w + x]! : 0;
            s += t && b ? '█' : t ? '▀' : b ? '▄' : ' ';
        }
        rows.push(s.trimEnd());
    }
    return rows.join('\n');
}

/** Units → text rows/cols, for sizing: a unit is one cell wide and half a cell tall. */
export const pieceCols = (p: Piece) => p.w;
export const pieceRows = (p: Piece) => p.h / 2;

/**
 * Split text into `lines` lines, balancing their lengths (the longest line as short as possible),
 * for the stacked variants on narrow screens: "STEPHEN LYONS" → "STEPHEN" / "LYONS". Words are
 * never broken; fewer words than lines gives one word per line.
 */
export function balanceLines(text: string, lines = 2): string[] {
    const words = text.trim().split(/\s+/);
    const k = Math.min(lines, words.length);
    if (k < 2) return [words.join(' ')];
    let best: string[] = [];
    let bestScore = Infinity;
    const walk = (start: number, left: number, acc: string[]) => {
        if (left === 1) {
            const all = [...acc, words.slice(start).join(' ')];
            const score = Math.max(...all.map((l) => l.length));
            if (score < bestScore) ((bestScore = score), (best = all));
            return;
        }
        for (let i = start + 1; i <= words.length - left + 1; i++)
            walk(i, left - 1, [...acc, words.slice(start, i).join(' ')]);
    };
    walk(0, k, []);
    return best;
}
