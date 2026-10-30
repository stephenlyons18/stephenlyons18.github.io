/* ============================================================
   paint.ts: spray paint over the page (R53). Lazy: site.ts loads it on first use (the corner kit,
   its menu, or the P key), or on idle when this page has kept paint. Never under reduced motion.

   - Paint mode is off until switched on (the corner can, the menu, or P). Off, the site and its
     cursor behave exactly as they do without it. On, a capture layer under the header takes the
     pointer: one pointer sprays, and on touch two fingers scroll.
   - In paint mode the mouse cursor is a dotted pixel ring the size of the spray, hollow so fresh
     paint shows through it. Shift + wheel resizes it; that listener is only bound while Shift is
     down in paint mode, so plain scrolling never waits on JS.
   - The grid, shades, fading and drips are pure (src/lib/paint/); this file draws the cells they
     report into chunk canvases, one 3px dither dot per canvas pixel, scaled up crisp.
   - One rAF loop, only while something is moving: a held can, a running drip, or paint fading out.
     It stops by itself when the page is still (ux.spec: no idle rAF).
   ============================================================ */

import {
    CAPS,
    DRIPS,
    PAINT_ART_KEY,
    PAINT_KEY,
    PAINT_TIP_KEY,
    PAINT_TOKENS,
    SIZE,
    readSettings,
    type CapId,
    type DripsId,
} from '../data/paint';
import { rng } from '../lib/ansi/grid';
import { Drips } from '../lib/paint/drips';
import {
    BL,
    BR,
    CAP_PROFILES,
    COVER_GAIN,
    TL,
    TR,
    cssToHex,
    hexToPixel,
    normalizeHex,
    stamp,
} from '../lib/paint/spray';
import { CHUNK_ROWS, Surface, type Chunk } from '../lib/paint/surface';

declare global {
    interface Window {
        slPaint?: { toggle: (on?: boolean) => void };
    }
}

const root = document.documentElement;
const motionOff = () => root.hasAttribute('data-reduce-motion');
const store = {
    get: (s: Storage, k: string) => {
        try {
            return s.getItem(k);
        } catch {
            return null;
        }
    },
    set: (s: Storage, k: string, v: string | null) => {
        try {
            if (v === null) s.removeItem(k);
            else s.setItem(k, v);
        } catch {
            /* private mode or full: this page still works */
        }
    },
};

let settings = readSettings(store.get(localStorage, PAINT_KEY));
const saveSettings = () => store.set(localStorage, PAINT_KEY, JSON.stringify(settings));
let customHex = settings.color.startsWith('#') ? settings.color : '#ff3d9a';
const threshold = () => DRIPS.find((d) => d.id === settings.drips)!.threshold;

// ── Colour: a theme token (resolved once per theme change, never per frame) or a custom hex ──
let colorHex = '#22c7ff';
function resolveColor(): void {
    colorHex = settings.color.startsWith('--')
        ? (cssToHex(getComputedStyle(root).getPropertyValue(settings.color)) ?? colorHex)
        : settings.color;
    root.style.setProperty('--paint-color', colorHex);
    drawRing();
    drawPreview();
}

// ── The surface: a document-sized layer of chunk canvases ────────────────────────────────────
let layer: HTMLDivElement | null = null;
let surface = new Surface(0, 0);
let drips = new Drips(surface);
surface.fading = !settings.keep;
/** CSS px per cell (two dither dots), snapped so a dot is whole device pixels. */
let cell = 6;
let layerX = 0;
let layerY = 0;
const rnd = rng((Math.random() * 2 ** 32) >>> 0);

interface Tile {
    cv: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    img: ImageData;
    px: Uint32Array;
    w: number;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}
const tiles = new Map<number, Tile>();
const pixels: number[] = [];
const pixelHex: string[] = [];

function ensureLayer(): void {
    if (layer) return;
    layer = document.createElement('div');
    layer.className = 'paint-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
    measure();
    // The body changes height as content loads or the window resizes: re-grid, keeping the paint.
    let queued = false;
    new ResizeObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => ((queued = false), measure()));
    }).observe(layer);
}

function measure(): void {
    if (!layer) return;
    const dpr = window.devicePixelRatio || 1;
    const next = (2 * Math.max(1, Math.round(3 * dpr))) / dpr;
    const r = layer.getBoundingClientRect();
    layerX = r.left + window.scrollX;
    layerY = r.top + window.scrollY;
    const cols = Math.floor(r.width / next);
    const rows = Math.floor(r.height / next);
    if (cols === surface.cols && rows === surface.rows && next === cell) return;
    const now = performance.now() / 1000;
    const had = surface.chunks.size ? surface.serialize(now) : null;
    const scale = cell / next;
    const fading = surface.fading;
    for (const i of [...tiles.keys()]) dropTile(i);
    cell = next;
    surface = new Surface(cols, rows);
    surface.fading = fading;
    drips = new Drips(surface);
    if (had) surface.load(had.palette, had.data, now, scale);
    wake();
}

function tileFor(c: Chunk): Tile {
    let t = tiles.get(c.index);
    if (t) return t;
    const rowsIn = Math.min(CHUNK_ROWS, surface.rows - c.index * CHUNK_ROWS);
    const cv = document.createElement('canvas');
    cv.width = surface.cols * 2;
    cv.height = rowsIn * 2;
    cv.style.cssText = `top:${c.index * CHUNK_ROWS * cell}px;width:${surface.cols * cell}px;height:${rowsIn * cell}px`;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(cv.width, cv.height);
    t = {
        cv,
        ctx,
        img,
        px: new Uint32Array(img.data.buffer),
        w: cv.width,
        x0: Infinity,
        y0: Infinity,
        x1: -1,
        y1: -1,
    };
    layer!.appendChild(cv);
    tiles.set(c.index, t);
    return t;
}

function dropTile(index: number): void {
    tiles.get(index)?.cv.remove();
    tiles.delete(index);
}

function pixelOf(i: number): number {
    const hex = surface.palette[i]!;
    if (pixelHex[i] !== hex) ((pixelHex[i] = hex), (pixels[i] = hexToPixel(hex)));
    return pixels[i]!;
}

function drawCell(c: Chunk, x: number, y: number, mask: number, color: number): void {
    const t = tileFor(c);
    const p = mask ? pixelOf(color) : 0;
    const o = y * 2 * t.w + x * 2;
    t.px[o] = mask & TL ? p : 0;
    t.px[o + 1] = mask & TR ? p : 0;
    t.px[o + t.w] = mask & BL ? p : 0;
    t.px[o + t.w + 1] = mask & BR ? p : 0;
    if (x * 2 < t.x0) t.x0 = x * 2;
    if (x * 2 + 1 > t.x1) t.x1 = x * 2 + 1;
    if (y * 2 < t.y0) t.y0 = y * 2;
    if (y * 2 + 1 > t.y1) t.y1 = y * 2 + 1;
}

function flush(): void {
    for (const t of tiles.values()) {
        if (t.x1 < 0) continue;
        t.ctx.putImageData(t.img, 0, 0, t.x0, t.y0, t.x1 - t.x0 + 1, t.y1 - t.y0 + 1);
        t.x0 = t.y0 = Infinity;
        t.x1 = t.y1 = -1;
    }
}

// ── The loop: only while something moves ────────────────────────────────────────────────────
let raf = 0;
let last = 0;
function wake(): void {
    if (!raf) raf = requestAnimationFrame(frame);
}
function frame(ms: number): void {
    raf = 0;
    const now = ms / 1000;
    const dt = last ? Math.min(0.05, Math.max(0, now - last)) : 1 / 60;
    last = now;
    if (stroke) sprayFrame(dt, now);
    const running = drips.step(dt, now);
    const fading = surface.update(now, drawCell, (c) => dropTile(c.index));
    flush();
    if (stroke || running || fading) wake();
    else last = 0;
}

// ── Spraying ─────────────────────────────────────────────────────────────────────────────────
interface Stroke {
    id: number;
    x: number;
    y: number;
    pts: number[];
}
let stroke: Stroke | null = null;

/** Client point → cell coordinates (fractional). */
const toCell = (cx: number, cy: number): [number, number] => [
    (cx + window.scrollX - layerX) / cell,
    (cy + window.scrollY - layerY) / cell,
];

function sprayAt(cx: number, cy: number, dt: number, now: number, color: number): void {
    const cap = CAP_PROFILES[settings.cap];
    const th = threshold();
    const x0 = Math.floor(cx);
    const y0 = Math.floor(cy);
    stamp(cap, settings.size, rnd, (dx, dy, w) => {
        const x = x0 + dx;
        const y = y0 + dy;
        const flow = cap.flow * dt * w;
        const wet = surface.deposit(x, y, cap.pen ? w : flow * COVER_GAIN, flow, color, now);
        if (wet > th) {
            surface.setWet(x, y, th);
            drips.overflow(x, y, wet - th, color);
        }
    });
}

/**
 * One frame of spray along the pointer's path since the last frame. Spray is laid down by time,
 * not distance: a slow pass leaves a thick coat, a fast one a thin speckle, and holding still
 * keeps building until it runs.
 */
function sprayFrame(dt: number, now: number): void {
    const s = stroke!;
    const color = surface.colorIndex(colorHex);
    const path = [s.x, s.y, ...s.pts];
    s.pts.length = 0;
    s.x = path[path.length - 2]!;
    s.y = path[path.length - 1]!;
    const cells: number[] = [];
    for (let i = 0; i < path.length; i += 2) cells.push(...toCell(path[i]!, path[i + 1]!));
    let total = 0;
    for (let i = 2; i < cells.length; i += 2)
        total += Math.hypot(cells[i]! - cells[i - 2]!, cells[i + 1]! - cells[i - 1]!);
    if (total < 0.01) {
        sprayAt(cells[0]!, cells[1]!, dt, now, color);
        return;
    }
    const stepLen = Math.max(0.5, settings.size * 0.4);
    for (let i = 2; i < cells.length; i += 2) {
        const [ax, ay, bx, by] = [cells[i - 2]!, cells[i - 1]!, cells[i]!, cells[i + 1]!];
        const len = Math.hypot(bx - ax, by - ay);
        if (len < 0.001) continue;
        const n = Math.ceil(len / stepLen);
        const share = (dt * (len / total)) / n;
        for (let k = 1; k <= n; k++)
            sprayAt(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n, share, now, color);
    }
}

// ── Paint mode and the capture layer ────────────────────────────────────────────────────────
let on = false;
const capture = document.createElement('div');
capture.className = 'paint-capture';
capture.hidden = true;
capture.setAttribute('aria-hidden', 'true');
document.body.appendChild(capture);

const kit = document.querySelector<HTMLElement>('[data-paint-kit]');
const can = kit?.querySelector<HTMLButtonElement>('[data-paint-toggle]');
const menu = document.getElementById('paint-menu');
const toastEl = kit?.querySelector<HTMLElement>('[data-paint-toast]');
const onSwitch = menu?.querySelector<HTMLInputElement>('[data-paint-on]');
let usedTouch = matchMedia('(pointer: coarse)').matches;

let toastTimer = 0;
function toast(msg: string): void {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('is-on'), 3800);
}

function setOn(v: boolean): void {
    if (v && motionOff()) return;
    on = v;
    if (v) ensureLayer();
    else endStroke();
    capture.hidden = !v;
    if (!v) bindWheel(false);
    showRing();
    can?.setAttribute('aria-pressed', String(v));
    if (onSwitch) onSwitch.checked = v;
    toast(
        v
            ? usedTouch
                ? 'Paint on: one finger sprays, two fingers scroll. Tap the can to stop.'
                : 'Paint on: drag to spray. P or Esc to stop.'
            : 'Paint off.',
    );
}

const pointers = new Map<number, [number, number]>();
let pan: number | null = null;
const mid = () => {
    let y = 0;
    for (const p of pointers.values()) y += p[1];
    return y / pointers.size;
};

capture.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    usedTouch = e.pointerType === 'touch';
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    capture.setPointerCapture(e.pointerId);
    if (pointers.size === 1) {
        stroke = { id: e.pointerId, x: e.clientX, y: e.clientY, pts: [] };
        ring.classList.add('is-spraying');
        if (e.pointerType !== 'touch') showTip();
        wake();
    } else {
        // A second finger: this is a scroll, not paint.
        endStroke();
        pan = mid();
    }
    e.preventDefault();
});
capture.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pan !== null) {
        const m = mid();
        // Instant: the page uses smooth scrolling, but this follows the fingers.
        window.scrollTo({ top: window.scrollY - (m - pan), behavior: 'instant' });
        pan = m;
        return;
    }
    if (!stroke || e.pointerId !== stroke.id) return;
    const events = 'getCoalescedEvents' in e ? e.getCoalescedEvents() : [];
    for (const c of events.length ? events : [e]) stroke.pts.push(c.clientX, c.clientY);
});
const lift = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (stroke?.id === e.pointerId) endStroke();
    if (pointers.size < 2) pan = null;
};
capture.addEventListener('pointerup', lift);
capture.addEventListener('pointercancel', lift);
capture.addEventListener('contextmenu', (e) => e.preventDefault());

function endStroke(): void {
    stroke = null;
    ring.classList.remove('is-spraying');
}

// ── The spray cursor ─────────────────────────────────────────────────────────────────────────
const ring = document.createElement('div');
ring.className = 'spray-ring';
ring.hidden = true;
ring.setAttribute('aria-hidden', 'true');
ring.innerHTML =
    '<svg class="spray-ring__art" shape-rendering="crispEdges"></svg>' +
    '<p class="spray-ring__tip" hidden><kbd>Shift</kbd> + scroll to resize</p>';
document.body.appendChild(ring);
const ringArt = ring.firstElementChild as SVGSVGElement;
const tip = ring.lastElementChild as HTMLElement;
let ringKey = '';
/** The pointer is over the paint surface (the capture layer), the only place the ring shows. */
let overSurface = false;

/**
 * The ring, in dither dots: the spray's reach as a dotted outline, nothing inside, so fresh paint
 * shows through it. Dots run paint colour, ink, gap, so it reads on any colour
 * (including its own paint).
 */
function drawRing(): void {
    const square = CAP_PROFILES[settings.cap].square;
    const R = Math.max(1.5, (square ? settings.size - 0.5 : settings.size) * 2);
    const key = `${R}|${square}|${colorHex}|${cell}`;
    if (key === ringKey) return;
    ringKey = key;
    const dot = cell / 2;
    const n = Math.ceil(R) + 1;
    let paint = '';
    let ink = '';
    for (let y = -n; y <= n; y++)
        for (let x = -n; x <= n; x++) {
            const d = square ? Math.max(Math.abs(x), Math.abs(y)) : Math.hypot(x, y);
            if (Math.abs(d - R) >= 0.5) continue;
            // paint, ink, gap: dotted, and readable on the wall, on paint, and on its own colour.
            const k = (((x + y) % 3) + 3) % 3;
            if (k === 0) paint += `M${x - 0.5} ${y - 0.5}h1v1h-1z`;
            else if (k === 1) ink += `M${x - 0.5} ${y - 0.5}h1v1h-1z`;
        }
    const size = (2 * n + 1) * dot;
    ringArt.setAttribute('viewBox', `${-n - 0.5} ${-n - 0.5} ${2 * n + 1} ${2 * n + 1}`);
    ringArt.setAttribute('width', String(size));
    ringArt.setAttribute('height', String(size));
    ringArt.innerHTML =
        `<path d="${ink}" style="fill:var(--title-ink)"/>` +
        `<path d="${paint}" style="fill:${colorHex}"/>`;
    ring.style.setProperty('--ring-r', `${size / 2}px`);
}

// Mouse and pen only, and only in paint mode over the page: everywhere else the normal cursor.
const showRing = () => (ring.hidden = !(on && (overSurface || stroke) && !motionOff()));
window.addEventListener(
    'pointermove',
    (e) => {
        if (e.pointerType === 'touch') return void (ring.hidden = true);
        ring.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`;
        showRing();
    },
    { passive: true },
);
document.addEventListener(
    'pointerover',
    (e) => {
        if (e.pointerType === 'touch') return;
        overSurface = e.target === capture;
        showRing();
    },
    { passive: true },
);
document.addEventListener('mouseout', (e) => {
    if (!e.relatedTarget) ((overSurface = false), showRing());
});

// ── Size: the menu slider, [ and ], and Shift + wheel ──────────────────────────────────────
function setSize(n: number): void {
    const v = Math.min(SIZE.max, Math.max(SIZE.min, Math.round(n)));
    if (v === settings.size) return;
    settings.size = v;
    saveSettings();
    drawRing();
    syncMenu();
}

let tipDone = store.get(localStorage, PAINT_TIP_KEY) === '1';
function showTip(): void {
    if (!tipDone) tip.hidden = false;
}

/** Something under the pointer that scrolls sideways keeps Shift + wheel. */
function scrollsSideways(t: EventTarget | null): boolean {
    for (
        let el = t instanceof Element ? t : null;
        el && el !== document.body;
        el = el.parentElement
    ) {
        if (el.scrollWidth <= el.clientWidth) continue;
        if (/auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
    }
    return false;
}

let wheelAcc = 0;
function onWheel(e: WheelEvent): void {
    if (!on || !e.shiftKey || e.ctrlKey || e.metaKey || scrollsSideways(e.target)) return;
    e.preventDefault();
    let d = e.deltaY || e.deltaX; // browsers differ in which one Shift turns the wheel into
    if (e.deltaMode === 1) d *= 16;
    else if (e.deltaMode === 2) d *= 400;
    wheelAcc += d;
    while (Math.abs(wheelAcc) >= 60) {
        setSize(settings.size + (wheelAcc < 0 ? 1 : -1)); // wheel up grows it
        wheelAcc -= Math.sign(wheelAcc) * 60;
        if (!tipDone) {
            tipDone = true;
            tip.hidden = true;
            store.set(localStorage, PAINT_TIP_KEY, '1');
        }
    }
}
let wheelBound = false;
const bindWheel = (v: boolean) => {
    if (v === wheelBound) return;
    wheelBound = v;
    wheelAcc = 0;
    if (v) window.addEventListener('wheel', onWheel, { passive: false });
    else window.removeEventListener('wheel', onWheel);
};

const typing = (t: EventTarget | null) =>
    t instanceof Element && !!t.closest('input, textarea, select, [contenteditable]');

document.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') return bindWheel(on);
    if (motionOff() || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    if (document.querySelector('.terminal-overlay.active')) return;
    if (e.key === 'p' || e.key === 'P') setOn(!on);
    else if (e.key === 'Escape' && on && !document.querySelector(':popover-open')) setOn(false);
    else if (e.key === '[') setSize(settings.size - 1);
    else if (e.key === ']') setSize(settings.size + 1);
});
document.addEventListener('keyup', (e) => e.key === 'Shift' && bindWheel(false));
window.addEventListener('blur', () => bindWheel(false));

// ── The menu ─────────────────────────────────────────────────────────────────────────────────
const q = <T extends Element>(sel: string) => menu?.querySelector<T>(sel) ?? null;
const radios = (name: string) => [
    ...(menu?.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`) ?? []),
];
const wheel = q<HTMLInputElement>('[data-paint-wheel]');
const hex = q<HTMLInputElement>('[data-paint-hex]');
const sizeInput = q<HTMLInputElement>('[data-paint-size]');
const sizeOut = q<HTMLOutputElement>('[data-paint-size-value]');
const keep = q<HTMLInputElement>('[data-paint-keep]');
const keepHint = q<HTMLElement>('[data-paint-keep-hint]');
const customTile = q<HTMLElement>('[data-paint-custom-tile]');

function syncMenu(): void {
    for (const r of radios('paint-color'))
        r.checked = settings.color.startsWith('#')
            ? r.value === 'custom'
            : r.value === settings.color;
    for (const r of radios('paint-cap')) r.checked = r.value === settings.cap;
    for (const r of radios('paint-drips')) r.checked = r.value === settings.drips;
    if (wheel) wheel.value = customHex;
    if (hex && document.activeElement !== hex) hex.value = customHex;
    customTile?.style.setProperty('--sw', customHex);
    if (sizeInput) sizeInput.value = String(settings.size);
    if (sizeOut) sizeOut.textContent = String(settings.size);
    if (keep) keep.checked = settings.keep;
    if (keepHint)
        keepHint.textContent = settings.keep
            ? 'On: paint stays on this page until you clear it or reload'
            : 'Off: paint fades a moment after it lands';
    if (onSwitch) onSwitch.checked = on;
}

function apply(): void {
    saveSettings();
    resolveColor();
    syncMenu();
}

const setCustom = (h: string) => {
    customHex = h;
    settings.color = h;
    apply();
};

for (const r of radios('paint-color'))
    r.addEventListener('change', () => {
        if (!r.checked) return;
        settings.color = r.value === 'custom' ? customHex : r.value;
        apply();
    });
wheel?.addEventListener('input', () => setCustom(wheel.value));
hex?.addEventListener('input', () => {
    const h = normalizeHex(hex.value);
    hex.setAttribute('aria-invalid', String(!h));
    if (h) setCustom(h);
});
hex?.addEventListener('blur', () => ((hex.value = customHex), hex.removeAttribute('aria-invalid')));
for (const r of radios('paint-cap'))
    r.addEventListener('change', () => {
        if (r.checked && CAPS.some((c) => c.id === r.value)) settings.cap = r.value as CapId;
        apply();
    });
for (const r of radios('paint-drips'))
    r.addEventListener('change', () => {
        if (r.checked && DRIPS.some((d) => d.id === r.value)) settings.drips = r.value as DripsId;
        apply();
    });
sizeInput?.addEventListener('input', () => setSize(Number(sizeInput.value)));
keep?.addEventListener('change', () => {
    settings.keep = keep.checked;
    surface.setFading(!keep.checked, performance.now() / 1000);
    if (!keep.checked) store.set(sessionStorage, artKey, null);
    wake();
    apply();
});
onSwitch?.addEventListener('change', () => setOn(onSwitch.checked));
q('[data-paint-clear]')?.addEventListener('click', () => {
    drips.clear();
    surface.clear((c) => dropTile(c.index));
    store.set(sessionStorage, artKey, null);
    toast('Paint cleared.');
});
can?.addEventListener('click', () => setOn(!on));

// The menu's test patch: the same caps and shades, a short wave of spray at up to size 6.
const previewCv = q<HTMLCanvasElement>('[data-paint-preview]');
function drawPreview(): void {
    if (!previewCv || !menu?.matches(':popover-open')) return;
    const W = previewCv.width / 2;
    const H = previewCv.height / 2;
    const s = new Surface(W, H);
    s.fading = false;
    const col = s.colorIndex(colorHex);
    const cap = CAP_PROFILES[settings.cap];
    const size = Math.min(settings.size, 5);
    const r = rng(7);
    for (let x = size + 1; x < W - size - 1; x += 0.5) {
        const y = H / 2 + Math.sin(x / 7) * (H / 2 - size - 1) * 0.6;
        stamp(cap, size, r, (dx, dy, w) =>
            s.deposit(Math.floor(x) + dx, Math.floor(y) + dy, cap.pen ? w : w * 0.06, 0, col, 0),
        );
    }
    const ctx = previewCv.getContext('2d')!;
    const img = ctx.createImageData(previewCv.width, previewCv.height);
    const px = new Uint32Array(img.data.buffer);
    const p = hexToPixel(colorHex);
    s.update(0, (_c, x, y, m) => {
        const o = y * 2 * previewCv.width + x * 2;
        if (m & TL) px[o] = p;
        if (m & TR) px[o + 1] = p;
        if (m & BL) px[o + previewCv.width] = p;
        if (m & BR) px[o + previewCv.width + 1] = p;
    });
    ctx.putImageData(img, 0, 0);
}
menu?.addEventListener('toggle', () => {
    syncMenu();
    drawPreview();
});
// Changing anything in the menu redraws the patch (apply → resolveColor → drawPreview).
menu?.addEventListener('input', () => drawPreview());

// ── Kept paint: per page, for this visit (sessionStorage); a reload starts clean ──────────────
const artKey = PAINT_ART_KEY + location.pathname;
const navType = (
    performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
)?.type;
if (navType === 'reload')
    try {
        for (const k of Object.keys(sessionStorage))
            if (k.startsWith(PAINT_ART_KEY)) sessionStorage.removeItem(k);
    } catch {
        /* ignore */
    }

function saveArt(): void {
    if (!settings.keep || !surface.chunks.size) return store.set(sessionStorage, artKey, null);
    const { palette, data } = surface.serialize(performance.now() / 1000);
    let bin = '';
    for (let i = 0; i < data.length; i += 0x8000)
        bin += String.fromCharCode(...data.subarray(i, i + 0x8000));
    store.set(sessionStorage, artKey, JSON.stringify({ cell, palette, data: btoa(bin) }));
}
function loadArt(): void {
    const raw = store.get(sessionStorage, artKey);
    if (!raw || !settings.keep) return;
    try {
        const v = JSON.parse(raw) as { cell: number; palette: string[]; data: string };
        const data = Uint8Array.from(atob(v.data), (c) => c.charCodeAt(0));
        ensureLayer();
        surface.load(v.palette, data, performance.now() / 1000, v.cell / cell);
        wake();
    } catch {
        store.set(sessionStorage, artKey, null);
    }
}
window.addEventListener('pagehide', saveArt);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') (saveArt(), endStroke());
});

// ── Theme and motion ─────────────────────────────────────────────────────────────────────────
new MutationObserver((records) => {
    if (records.some((r) => r.attributeName === 'data-theme')) resolveColor();
    if (motionOff()) {
        // Motion turned off: paint goes away entirely (the kit is hidden by CSS too).
        if (on) setOn(false);
        drips.clear();
        surface.clear((c) => dropTile(c.index));
        ring.hidden = true;
    }
}).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-reduce-motion'] });

// The palette tokens must exist (a typo would paint black): fall back to the first.
if (settings.color.startsWith('--') && !PAINT_TOKENS.some((t) => t.token === settings.color))
    settings.color = PAINT_TOKENS[0]!.token;

resolveColor();
syncMenu();
loadArt();
window.slPaint = { toggle: (v?: boolean) => setOn(v ?? !on) };
