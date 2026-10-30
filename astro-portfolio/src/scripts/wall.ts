/* ============================================================
   wall.ts (R32): graffiti on the wall, different on every visit. Lazy-loaded by site.ts on idle,
   never under the accessibility menu's "Hide wall texture".

   Each page load draws a random seed. From it: which leet words get painted, in which style
   (bubble or wildstyle), which colour variant of the current theme, how big and how tilted. The
   pieces come from the titles' renderer (piece.ts), drawn at build time into one cached JSON pool,
   and are coloured by the same tokens.

   - Placed only in free wall: every piece of content (text lines, controls, cards, art, media) is
     measured once into an 8px occupancy grid with a summed-area table, so each try is O(1). Pieces
     keep a margin from content and from each other, inside one section each, so they move with it.
   - Depth: smaller pieces are further back (dimmer, behind); bigger ones nearer. All sit below the
     content (z-index -1) and never take the pointer.
   - Changes only when it should: a new page load or a new theme re-rolls; a heading-style switch or a
     layout change keeps the same pieces and only moves one if content now covers it (or it wasn't
     added yet: its spot was chosen on the old layout); a width change places the same pieces again.
   - Cheap: the pieces are drawn at build time (one cached JSON pool), so the browser only picks and
     places them, in idle slices: measuring is one slice, then tries while a slice has time, then one
     piece added per slice. Nothing runs per frame. Each piece sprays on once when first seen (CSS),
     or is simply there under reduced motion.
   ============================================================ */
import { rng } from '../lib/ansi/grid';
import type { WallPoolPiece } from '../lib/ansi/wallPool';

/** The pool of pieces, drawn at build time (/art/wall-pieces.json), next to this script's folder. */
const POOL_URL = (document.currentScript as HTMLScriptElement | null)?.src.replace(
    /scripts\/wall\.js(\?.*)?$/,
    'art/wall-pieces.json',
);
let pool: WallPoolPiece[] = [];
const VARIANTS = 6;
/** Occupancy grid cell (px), clearance from content and between pieces (px). */
const CELL = 8;
const CLEAR = 20;
const GAP = 28;
/** The fixed header's height (global.css --header-h). */
const HEADER = 64;

const root = document.documentElement;
const calm = () => root.hasAttribute('data-reduce-motion');
/** Run when the main thread is idle; the callback learns how long it has (ms). */
const idle = (cb: (left: () => number) => void) =>
    'requestIdleCallback' in window
        ? requestIdleCallback((d) => cb(() => d.timeRemaining()), { timeout: 3000 })
        : setTimeout(() => {
              const t = performance.now() + 12;
              cb(() => t - performance.now());
          }, 60);
/** Never add a piece mid-scroll: wait until the page has been still this long (ms). */
const STILL = 200;
let lastScroll = -Infinity;
addEventListener('scroll', () => (lastScroll = performance.now()), { passive: true });
/** Stop trying once this many plans in a row found no room (a phone has little free wall). */
const MAX_MISSES = 16;

interface Plan {
    /** Index into the pool (a word in one style). */
    piece: number;
    variant: number;
    seed: number;
    /** 0 (far, small) … 1 (near, big). */
    depth: number;
    tilt: number;
}
interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}
interface Placed {
    plan: Plan;
    /** On the page once committed. */
    el?: HTMLElement;
    /** Document-space box of the tilted piece, and the piece's own (untilted) size. */
    box: Rect;
    w: number;
    h: number;
    host: HTMLElement;
}

/** The random choices for one load, in order: more than will fit, so placement can skip some. */
function planFor(seed: number): Plan[] {
    const r = rng(seed);
    return Array.from({ length: 24 }, () => ({
        piece: Math.floor(r() * pool.length),
        variant: Math.floor(r() * VARIANTS),
        seed: Math.floor(r() * 1e9),
        depth: r(),
        tilt: (r() * 2 - 1) * 7,
    }));
}

const visible = (el: Element) => el.checkVisibility?.() ?? true;
const docRect = (r: DOMRect): Rect => ({
    x: r.left + scrollX,
    y: r.top + scrollY,
    w: r.width,
    h: r.height,
});

/** Everything a piece must keep clear of, in document space (one batch of layout reads). */
function obstacles(): Rect[] {
    const out: Rect[] = [];
    const sel =
        'a, button, input, textarea, select, label, .card, .hero-terminal, .ansi-title, .ansi-divider, canvas, img, video, iframe';
    for (const el of document.querySelectorAll(sel))
        if (visible(el) && !el.closest('.wall-piece'))
            out.push(docRect(el.getBoundingClientRect()));
    // Text, by its line boxes (a centred heading's element box spans the whole container).
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || !n.textContent!.trim() || el.closest('.wall-piece, .sr-only, script, style'))
            continue;
        if (!visible(el)) continue;
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) if (r.width && r.height) out.push(docRect(r));
    }
    return out.filter((r) => r.w > 0 && r.h > 0);
}

/** A grid of occupied cells as a summed-area table: is any cell in a rect taken? O(1). */
function occupancy(rects: Rect[], w: number, h: number) {
    const gw = Math.ceil(w / CELL) + 1;
    const gh = Math.ceil(h / CELL) + 1;
    const grid = new Uint8Array(gw * gh);
    for (const r of rects) {
        const x0 = Math.max(0, Math.floor((r.x - CLEAR) / CELL));
        const y0 = Math.max(0, Math.floor((r.y - CLEAR) / CELL));
        const x1 = Math.min(gw - 1, Math.ceil((r.x + r.w + CLEAR) / CELL));
        const y1 = Math.min(gh - 1, Math.ceil((r.y + r.h + CLEAR) / CELL));
        for (let y = y0; y <= y1; y++) grid.fill(1, y * gw + x0, y * gw + x1 + 1);
    }
    const sat = new Int32Array((gw + 1) * (gh + 1));
    for (let y = 0; y < gh; y++) {
        let row = 0;
        for (let x = 0; x < gw; x++) {
            row += grid[y * gw + x]!;
            sat[(y + 1) * (gw + 1) + x + 1] = sat[y * (gw + 1) + x + 1]! + row;
        }
    }
    return (r: Rect) => {
        const x0 = Math.max(0, Math.floor(r.x / CELL));
        const y0 = Math.max(0, Math.floor(r.y / CELL));
        const x1 = Math.min(gw, Math.ceil((r.x + r.w) / CELL));
        const y1 = Math.min(gh, Math.ceil((r.y + r.h) / CELL));
        if (x1 <= x0 || y1 <= y0) return true;
        const W = gw + 1;
        return sat[y1 * W + x1]! - sat[y0 * W + x1]! - sat[y1 * W + x0]! + sat[y0 * W + x0]! > 0;
    };
}

const overlaps = (a: Rect, b: Rect, pad = 0) =>
    a.x < b.x + b.w + pad &&
    b.x < a.x + a.w + pad &&
    a.y < b.y + b.h + pad &&
    b.y < a.y + a.h + pad;

let placed: Placed[] = [];
let generation = 0;
/** A placement still choosing spots, on the layout it measured first: what it was asked to keep. */
let planning: { keep: Placed[]; limit: number } | null = null;
/** Place as many of the plans as fit, then add them to the page. Everything runs in idle slices:
 *  measuring is one slice, then as many tries as each slice has time for, then one piece per slice. */
function place(plans: Plan[], keep: Placed[] = [], limit = Infinity) {
    const run = ++generation;
    planning = { keep, limit };
    // Set again once every piece of this placement is on the page (tests wait for it).
    root.toggleAttribute('data-wall-ready', false);
    idle(() => {
        if (run !== generation) return; // re-rolled meanwhile
        const hosts = [
            ...document.querySelectorAll<HTMLElement>('.hero, .section, .page-header, .error-page'),
        ]
            .filter((h) => visible(h) && getComputedStyle(h).position !== 'static')
            .map((el) => ({ el, box: docRect(el.getBoundingClientRect()) }));
        const docW = root.clientWidth;
        const docH = root.scrollHeight;
        const busy = occupancy(obstacles(), docW, docH);
        const phone = docW <= 768;
        // About one piece per screenful, a few more on wide screens with real margins.
        const target = Math.min(
            limit,
            Math.max(1, Math.min(phone ? 5 : 10, Math.round(docH / innerHeight) + (phone ? 0 : 2))),
        );
        const out: Placed[] = [...keep];
        const r = rng(plans.length ? plans[0]!.seed : 1);
        let i = 0;
        let misses = 0;
        const tryOne = () => {
            const plan = plans[i++]!;
            if (out.some((o) => o.plan === plan)) return;
            const { ratio } = pool[plan.piece]!;
            const full = phone ? 40 + plan.depth * 34 : 60 + plan.depth * 96;
            const t = (Math.abs(plan.tilt) * Math.PI) / 180;
            // Its own size first; then smaller (further back), where free wall is scarce (phones).
            for (const scale of [1, 0.75, 0.55]) {
                const h = full * scale;
                const w = h * ratio;
                const bw = w * Math.cos(t) + h * Math.sin(t);
                const bh = w * Math.sin(t) + h * Math.cos(t);
                for (let k = 0; k < 40; k++) {
                    // Below the fixed header's band at the top of the page.
                    const top = HEADER + CLEAR;
                    const box = {
                        x: 8 + r() * (docW - bw - 16),
                        y: top + r() * (docH - bh - top),
                        w: bw,
                        h: bh,
                    };
                    if (box.x < 8) break;
                    const host = hosts.find(
                        (hh) => hh.box.y <= box.y && box.y + box.h <= hh.box.y + hh.box.h,
                    );
                    if (!host || busy(box) || out.some((o) => overlaps(o.box, box, GAP))) continue;
                    out.push({ plan, box, w, h, host: host.el });
                    misses = 0;
                    return;
                }
            }
            misses++;
        };
        const step = (left: () => number) => {
            if (run !== generation) return;
            // At least one try per slice, more while the slice has time.
            do tryOne();
            while (i < plans.length && out.length < target && misses < MAX_MISSES && left() > 12);
            if (i < plans.length && out.length < target && misses < MAX_MISSES) idle(step);
            else {
                planning = null;
                commit(out, hosts, run);
            }
        };
        idle(step);
    });
}

/** Add the pieces to the page, one per idle slice, far (small) first so nearer ones paint over. */
function commit(out: Placed[], hosts: { el: HTMLElement; box: Rect }[], run: number) {
    const io = calm() ? null : sprayer();
    const todo = out.filter((p) => !p.el).sort((a, b) => a.plan.depth - b.plan.depth);
    placed = out;
    const next = () => {
        if (run !== generation) return;
        const wait = lastScroll + STILL - performance.now();
        if (wait > 0) {
            setTimeout(() => idle(next), wait);
            return;
        }
        const p = todo.shift();
        if (!p) {
            root.toggleAttribute('data-wall-ready', true);
            return;
        }
        const hb = hosts.find((h) => h.el === p.host)!.box;
        const el = document.createElement('div');
        el.className = `wall-piece wp-v${p.plan.variant}`;
        el.setAttribute('aria-hidden', 'true');
        el.dataset['wallPiece'] = '';
        const art = pool[p.plan.piece]!;
        el.dataset['word'] = art.word;
        el.dataset['style'] = art.style;
        el.dataset['variant'] = String(p.plan.variant);
        el.dataset['depth'] = p.plan.depth.toFixed(3);
        // The tilted box was placed; the piece is centred on it and rotated by CSS.
        const cx = p.box.x + p.box.w / 2 - hb.x;
        const cy = p.box.y + p.box.h / 2 - hb.y;
        el.style.cssText = `left:${(cx - p.w / 2).toFixed(1)}px;top:${(cy - p.h / 2).toFixed(1)}px;width:${p.w.toFixed(1)}px;height:${p.h.toFixed(1)}px;--tilt:${p.plan.tilt.toFixed(1)}deg;--o:${(0.3 + p.plan.depth * 0.32).toFixed(2)}`;
        // Our own build-time art (same origin): no user input reaches it.
        el.innerHTML = art.svg;
        if (io) {
            el.classList.add('is-waiting');
            io.observe(el);
        }
        // Nearer pieces after farther ones in the same section, so they paint on top.
        const after = [...p.host.querySelectorAll<HTMLElement>(':scope > .wall-piece')].find(
            (o) => +o.dataset['depth']! > p.plan.depth,
        );
        p.host.insertBefore(el, after ?? null);
        p.el = el;
        idle(next);
    };
    idle(next);
}

/** Sprayed on once, when first seen. */
function sprayer() {
    const io = new IntersectionObserver(
        (entries) => {
            for (const e of entries) {
                if (!e.isIntersecting) continue;
                io.unobserve(e.target);
                e.target.classList.replace('is-waiting', 'is-sprayed');
            }
        },
        { rootMargin: '0px 0px -8% 0px' },
    );
    return io;
}

function clear() {
    generation++;
    planning = null;
    for (const p of placed) p.el?.remove();
    placed = [];
}

let seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
let plans: Plan[] = [];
let width = root.clientWidth;

async function start() {
    if (!POOL_URL) return;
    try {
        pool = await (await fetch(POOL_URL)).json();
    } catch {
        return; // no pool, no pieces: the wall is decoration
    }
    if (!pool.length) return;
    plans = planFor(seed);
    place(plans);

    // A new theme: a new wall.
    new MutationObserver(() => {
        clear();
        seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
        plans = planFor(seed);
        place(plans);
    }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    // Layout changed (a heading style, larger text, a different width). A new width places the
    // same pieces again; otherwise only a piece that content now covers moves.
    let timer = 0;
    new ResizeObserver(() => {
        clearTimeout(timer);
        timer = window.setTimeout(() => {
            if (root.clientWidth !== width) {
                width = root.clientWidth;
                clear();
                place(plans);
                return;
            }
            // Still choosing spots on the old layout: choose again on this one.
            if (planning) {
                place(plans, planning.keep, planning.limit);
                return;
            }
            if (!placed.length) return;
            const busy = obstacles();
            // A piece that content now covers moves, and so does one not added yet (its spot was
            // chosen on the old layout). The rest stay, their boxes measured again for the new tries.
            const keep: Placed[] = [];
            for (const p of placed) {
                if (!p.el) continue;
                const b = docRect(p.el.getBoundingClientRect());
                if (busy.some((o) => overlaps(o, b, CLEAR / 2))) p.el.remove();
                else keep.push({ ...p, box: b });
            }
            if (keep.length === placed.length) return;
            // Never more pieces than before.
            const before = placed.length;
            placed = keep;
            place(plans, keep, before);
        }, 250);
    }).observe(document.body);
}

// After fonts and layout settle, so the measurements are the final ones.
const go = () => idle(() => start());
if (document.readyState === 'complete') document.fonts.ready.then(go);
else addEventListener('load', () => document.fonts.ready.then(go), { once: true });
