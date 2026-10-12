/* ============================================================
   fx.ts: drip physics and interactive motion, lazy-loaded by site.ts only when motion is allowed.
   Built on Motion's mini animate (WAAPI, so every animation runs on the compositor, with no
   rAF loop) plus its spring generator. ~5 KB gzipped.

   Drips (AnsiDrips.astro) hang still in the static HTML. Here they:
   - run out of their bar/edge with a springy overshoot the first time they scroll into view;
   - now and then swell a drop that stretches, detaches, falls under gravity and splats;
   - release a drop when poked: pointer over a divider (swipe across it to make it rain) or
     hovering/focusing a card.
   Cards tilt toward the pointer and squash on press (CSS springs, global.css .card.is-live), and
   [data-drag] art can be grabbed and flung; it snaps home on a Motion spring.
   Everything stops offscreen, in a hidden tab, and the moment reduced motion turns on.
   ============================================================ */
import { animate } from 'motion/mini';
import { spring } from 'motion';

type Controls = ReturnType<typeof animate>;

interface Drip {
    el: HTMLElement;
    paint: HTMLElement;
    drop: HTMLElement;
    busy: boolean;
    /** Centre x in viewport px, refreshed on poke. */
    cx: () => number;
}

interface Strip {
    root: HTMLElement;
    drips: Drip[];
    visible: boolean;
    grown: boolean;
    timer: number;
}

const root = document.documentElement;
const calm = () => root.hasAttribute('data-reduce-motion');
const running = new Set<Controls>();
const strips: Strip[] = [];
let stopped = false;

function track(c: Controls): Controls {
    running.add(c);
    c.then(() => running.delete(c));
    return c;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Paint slides out of the bar and overshoots a little, like a real run of paint. One Motion
 * spring, turned into a CSS `linear()` easing once, drives every drip as a plain CSS transition:
 * hundreds of drips cost a few style writes, not hundreds of animation objects.
 */
const GROW = String(spring(0.7, 0.45)); // "<duration>ms linear(…)"

function grow(d: Drip, delayMs: number) {
    d.paint.style.transition = `transform ${GROW} ${delayMs}ms`;
    d.paint.style.transform = 'translateY(0)';
}

/** A drop swells at the bulb, stretches, lets go, falls with gravity and splats. */
async function release(d: Drip) {
    if (d.busy || stopped) return;
    d.busy = true;
    const fall = rand(2.5, 4.5); // em, in the strip's own cell size: stays in the gap below
    // The bulb sags as the drop pulls away, then springs back.
    track(
        animate(
            d.paint,
            { transform: ['translateY(0)', 'translateY(0.35em)', 'translateY(0)'] },
            { duration: 0.9, ease: ['easeIn', 'easeOut'] },
        ),
    );
    try {
        await track(
            animate(
                d.drop,
                {
                    opacity: [0, 1, 1, 1, 0],
                    transform: [
                        'translate(0, 0) scale(0.5, 0.5)',
                        'translate(0, 0.2em) scale(1, 1)',
                        'translate(0, 0.55em) scale(0.85, 1.35)', // stretch before letting go
                        `translate(0, ${fall}em) scale(0.8, 1.5)`, // gravity: ease-in
                        `translate(0, ${fall + 0.2}em) scale(2, 0.3)`, // splat
                    ],
                },
                {
                    duration: 1.5,
                    times: [0, 0.3, 0.5, 0.88, 1],
                    ease: ['easeOut', 'easeInOut', [0.55, 0, 1, 0.45], 'easeOut'],
                },
            ),
        );
    } finally {
        d.drop.style.opacity = '0';
        d.busy = false;
    }
}

function schedule(s: Strip) {
    clearTimeout(s.timer);
    if (!s.visible || stopped || document.hidden) return;
    s.timer = window.setTimeout(
        () => {
            const idle = s.drips.filter((d) => !d.busy);
            const d = idle[Math.floor(Math.random() * idle.length)];
            if (d) void release(d);
            schedule(s);
        },
        rand(1800, 6000),
    );
}

function setup(rootEl: HTMLElement): Strip {
    const drips: Drip[] = [...rootEl.querySelectorAll<HTMLElement>('.drip')].map((el) => ({
        el,
        paint: el.querySelector<HTMLElement>('.drip__paint')!,
        drop: el.querySelector<HTMLElement>('.drip__drop')!,
        busy: false,
        cx: () => {
            const r = el.getBoundingClientRect();
            return r.left + r.width / 2;
        },
    }));
    const s: Strip = { root: rootEl, drips, visible: false, grown: false, timer: 0 };

    // Drips below the fold start "inside" the bar, so they can run out when they're seen.
    const r = rootEl.getBoundingClientRect();
    if (r.top > innerHeight || r.bottom < 0)
        for (const d of drips) d.paint.style.transform = 'translateY(-100%)';
    else s.grown = true;

    // Divider: whichever drip is under the pointer lets go (a swipe makes it rain). The strip
    // itself ignores pointers (art never blocks), so listen on its divider/card host.
    const host = rootEl.closest<HTMLElement>('.ansi-divider, .card') ?? rootEl;
    if (host.classList.contains('ansi-divider')) {
        const poke = (e: PointerEvent) => {
            const near = drips.find((d) => Math.abs(d.cx() - e.clientX) < 10);
            if (near) void release(near);
        };
        host.addEventListener('pointermove', poke);
        host.addEventListener('pointerdown', poke); // a tap on touch screens
    } else {
        // Card: hovering or focusing it shakes two or three drops loose.
        const poke = () => {
            const idle = drips.filter((d) => !d.busy && d.cx() > 0 && d.cx() < innerWidth);
            for (const d of idle.sort(() => Math.random() - 0.5).slice(0, 3)) void release(d);
        };
        host.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && poke());
        host.closest('a')?.addEventListener('focus', poke);
    }
    return s;
}

// ── Cards: tilt toward the pointer, squash on press ──────────────────────────
const TILT = { x: 5, y: 7 }; // max degrees: enough to feel, small enough to keep text crisp
/** Wider cards (the project write-ups) only lift: a big slab tilting looks wrong and costs GPU. */
const TILT_MAX_W = 760;

function initCards() {
    for (const card of document.querySelectorAll<HTMLElement>('.card')) {
        let settle = 0;
        const set = (rx: number, ry: number) => {
            card.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
            card.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
        };
        card.addEventListener('pointermove', (e) => {
            if (e.pointerType !== 'mouse' || stopped) return;
            clearTimeout(settle);
            card.classList.remove('is-settling');
            card.classList.add('is-live');
            const r = card.getBoundingClientRect();
            if (r.width > TILT_MAX_W) return set(0, 0);
            const px = (e.clientX - r.left) / r.width - 0.5;
            const py = (e.clientY - r.top) / r.height - 0.5;
            set(-py * TILT.x * 2, px * TILT.y * 2);
        });
        card.addEventListener('pointerdown', (e) => {
            if (!stopped)
                card.style.setProperty('--press', e.pointerType === 'mouse' ? '0.975' : '1');
        });
        const release = () => card.style.removeProperty('--press');
        card.addEventListener('pointerup', release);
        card.addEventListener('pointerleave', () => {
            release();
            if (!card.classList.contains('is-live')) return;
            // Swing back level with a bouncy spring, then hand control back to plain CSS.
            card.classList.replace('is-live', 'is-settling');
            set(0, 0);
            settle = window.setTimeout(() => card.classList.remove('is-settling'), 1100);
        });
    }
}

// ── Draggable art: grab, stretch against a rubber band, let go to snap home ──
function initDrag() {
    for (const el of document.querySelectorAll<HTMLElement>('[data-drag]')) {
        // data-drag="fine": mouse/pen only, so touch scrolling over big art is never hijacked.
        const fineOnly = el.dataset['drag'] === 'fine';
        if (fineOnly) el.style.touchAction = 'auto';
        let start: { x: number; y: number; id: number } | null = null;
        let back: Controls | null = null;
        const band = (d: number) => Math.sign(d) * 140 * (1 - 1 / (Math.abs(d) / 260 + 1));
        el.addEventListener('pointerdown', (e) => {
            if (stopped || (fineOnly && e.pointerType === 'touch') || e.button > 0) return;
            // Plain headings: the title is readable text now, so leave it selectable and still.
            if (root.hasAttribute('data-a11y-plain') && el.querySelector('.ansi-title__text'))
                return;
            back?.stop();
            start = { x: e.clientX, y: e.clientY, id: e.pointerId };
            el.setPointerCapture(e.pointerId);
            el.classList.add('is-dragging');
            e.preventDefault();
        });
        el.addEventListener('pointermove', (e) => {
            if (!start || e.pointerId !== start.id) return;
            const dx = band(e.clientX - start.x);
            const dy = band(e.clientY - start.y);
            el.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx * 0.06}deg)`;
        });
        const drop = (e: PointerEvent) => {
            if (!start || e.pointerId !== start.id) return;
            start = null;
            el.classList.remove('is-dragging');
            const from = el.style.transform || 'none';
            el.style.transform = '';
            back = track(
                animate(
                    el,
                    { transform: [from, 'translate(0px, 0px) rotate(0deg)'] },
                    { type: spring, stiffness: 380, damping: 11, mass: 0.9 },
                ),
            );
        };
        el.addEventListener('pointerup', drop);
        el.addEventListener('pointercancel', drop);
    }
}

function start() {
    stopped = false;
    initCards();
    initDrag();
    const io = new IntersectionObserver(
        (entries) => {
            for (const e of entries) {
                const s = strips.find((x) => x.root === e.target);
                if (!s) continue;
                s.visible = e.isIntersecting;
                if (s.visible && !s.grown) {
                    s.grown = true;
                    s.drips.forEach((d, i) => grow(d, i * 35));
                }
                schedule(s);
            }
        },
        { rootMargin: '0px 0px -8% 0px' },
    );
    for (const el of document.querySelectorAll<HTMLElement>('[data-drips]')) {
        const s = setup(el);
        strips.push(s);
        io.observe(el);
    }
    document.addEventListener('visibilitychange', () => strips.forEach(schedule));

    // Reduced motion switched on (a11y menu): stop at once and leave every drip hanging still.
    // Switched off again: carry on.
    new MutationObserver(() => {
        if (!calm()) {
            if (stopped) {
                stopped = false;
                strips.forEach(schedule);
            }
            return;
        }
        stopped = true;
        for (const c of running) c.stop();
        running.clear();
        for (const card of document.querySelectorAll<HTMLElement>('.card')) {
            card.classList.remove('is-live', 'is-settling');
            card.style.removeProperty('--press');
        }
        for (const el of document.querySelectorAll<HTMLElement>('[data-drag]'))
            el.style.transform = '';
        for (const s of strips) {
            clearTimeout(s.timer);
            for (const d of s.drips) {
                d.paint.style.transition = '';
                d.paint.style.transform = '';
                d.drop.style.opacity = '0';
                d.busy = false;
            }
        }
    }).observe(root, { attributes: true, attributeFilter: ['data-reduce-motion'] });
}

if (!calm()) start();
