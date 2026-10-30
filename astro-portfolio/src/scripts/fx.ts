/* ============================================================
   fx.ts: interactive motion, lazy-loaded by site.ts only when motion is allowed. Built on
   Motion's mini animate (WAAPI, so it runs on the compositor with no rAF loop) plus its spring
   generator. ~5 KB gzipped.

   - Drips (AnsiDrips.astro) are pure CSS: on hover/focus a strip's runs slide out as a few
     compositor layers (global.css .drip-run). Here: divider drips below the fold are tucked into
     their bar until they scroll into view, then run out. Touch screens have no hover, so the card
     or divider scrolling through the middle of the screen gets its hover state (.is-focus).
   - Cards tilt toward the pointer and squash on press (CSS springs, global.css .card.is-live).
   - [data-drag] art can be grabbed and flung; it snaps home on a Motion spring.
   Everything stops the moment reduced motion turns on.
   ============================================================ */
import { animate } from 'motion/mini';
import { spring } from 'motion';

type Controls = ReturnType<typeof animate>;

const root = document.documentElement;
const calm = () => root.hasAttribute('data-reduce-motion');
const running = new Set<Controls>();
let stopped = false;

function track(c: Controls): Controls {
    running.add(c);
    c.then(() => running.delete(c));
    return c;
}

// ── Drips ────────────────────────────────────────────────────────────────────
/**
 * Touch screens have no hover, so what's in focus animates instead of what's tapped: the card or
 * divider crossing the middle band of the screen gets its hover state (.is-focus: lift, skin, drips
 * pouring) as it arrives, and lets go as it leaves. The band is the middle 30% of the viewport.
 */
const FOCUS_BAND = '-35% 0px -35% 0px';

function initDrips() {
    // Dividers below the fold start tucked into their bar; they run out once seen.
    const io = new IntersectionObserver(
        (entries) => {
            for (const e of entries) {
                if (!e.isIntersecting) continue;
                io.unobserve(e.target);
                // Next frame, so the tucked state has been painted and the run-out transitions.
                requestAnimationFrame(() => e.target.classList.remove('is-tucked'));
            }
        },
        { rootMargin: '0px 0px -10% 0px' },
    );
    for (const d of document.querySelectorAll<HTMLElement>('.ansi-divider')) {
        if (d.getBoundingClientRect().top > innerHeight) {
            d.classList.add('is-tucked');
            io.observe(d);
        }
    }
    if (matchMedia('(hover: none)').matches) {
        const focus = new IntersectionObserver(
            (entries) => {
                for (const e of entries)
                    e.target.classList.toggle('is-focus', e.isIntersecting && !stopped);
            },
            { rootMargin: FOCUS_BAND },
        );
        for (const el of document.querySelectorAll('.card, .ansi-divider')) focus.observe(el);
    }
}

// ── Cards: tilt toward the pointer, squash on press ──────────────────────────
const TILT = { x: 5, y: 7 }; // max degrees: enough to feel, small enough to keep text crisp
/** Wider cards (the project write-ups) only lift: a big slab tilting looks wrong and costs GPU. */
const TILT_MAX_W = 760;

function initCards() {
    // A card's box is read once per hover (and again after a scroll), never per pointer move.
    let scrolled = 0;
    addEventListener('scroll', () => scrolled++, { passive: true });
    for (const card of document.querySelectorAll<HTMLElement>('.card')) {
        let settle = 0;
        let box: DOMRect | null = null;
        let seen = -1;
        let last = '';
        const set = (rx: number, ry: number) => {
            // A tenth of a degree is below what the eye (or the spring) can tell apart.
            const key = `${rx.toFixed(1)},${ry.toFixed(1)}`;
            if (key === last) return;
            last = key;
            card.style.setProperty('--rx', `${rx.toFixed(1)}deg`);
            card.style.setProperty('--ry', `${ry.toFixed(1)}deg`);
        };
        card.addEventListener('pointermove', (e) => {
            if (e.pointerType !== 'mouse' || stopped) return;
            if (!box || seen !== scrolled) {
                box = card.getBoundingClientRect();
                seen = scrolled;
            }
            // Wide cards only lift (plain :hover), so they never enter tilt mode at all.
            if (box.width > TILT_MAX_W) return;
            clearTimeout(settle);
            if (!card.classList.contains('is-live')) {
                card.classList.remove('is-settling');
                card.classList.add('is-live');
            }
            const px = (e.clientX - box.left) / box.width - 0.5;
            const py = (e.clientY - box.top) / box.height - 0.5;
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
            box = null;
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
            if (
                root.hasAttribute('data-accessibility-plain') &&
                el.querySelector('.ansi-title__text')
            )
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
    initDrips();
    initCards();
    initDrag();

    // Reduced motion switched on (accessibility menu): stop at once and leave everything still. Switched
    // off again: carry on.
    new MutationObserver(() => {
        if (!calm()) {
            stopped = false;
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
        for (const el of document.querySelectorAll('.is-tucked, .is-focus'))
            el.classList.remove('is-tucked', 'is-focus');
    }).observe(root, { attributes: true, attributeFilter: ['data-reduce-motion'] });
}

if (!calm()) start();
