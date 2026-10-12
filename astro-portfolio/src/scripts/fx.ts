/* ============================================================
   fx.ts: paint-drip physics, lazy-loaded by site.ts only when motion is allowed.
   Built on Motion's mini animate (WAAPI, so every animation runs on the compositor, with no
   rAF loop) plus its spring generator. ~5 KB gzipped.

   Drips (AnsiDrips.astro) hang still in the static HTML. Here they:
   - run out of their bar/edge with a springy overshoot the first time they scroll into view;
   - now and then swell a drop that stretches, detaches, falls under gravity and splats;
   - release a drop when poked: pointer over a divider (swipe across it to make it rain) or
     hovering/focusing a card.
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

function start() {
    stopped = false;
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
