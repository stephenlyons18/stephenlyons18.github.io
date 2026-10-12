/* ============================================================
   Site Interactivity (TypeScript port of main.js)
   ============================================================ */

declare global {
    interface Window {
        openTerminal?: () => void;
    }
}

/** Reduced motion: the OS setting or the a11y menu (BaseLayout's head script sets the attribute). */
const motionOff = () => document.documentElement.hasAttribute('data-reduce-motion');

interface HeroLine {
    prompt?: string;
    text?: string;
    output?: string;
    delay?: number;
}

function initActiveNav(): void {
    // Astro routes don't have .html — match by pathname
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    document.querySelectorAll<HTMLAnchorElement>('.nav-links a').forEach((a) => {
        const href = a.getAttribute('href') || '';
        const norm = href.replace(/\/$/, '') || '/';
        if (norm === path) a.classList.add('active');
        else a.classList.remove('active');
    });
}

function initMobileNav(): void {
    const toggle = document.querySelector<HTMLButtonElement>('.nav-toggle');
    const nav = document.querySelector<HTMLElement>('.nav-links');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', () => {
        toggle.classList.toggle('open');
        nav.classList.toggle('open');
    });

    nav.querySelectorAll<HTMLAnchorElement>('a').forEach((a) => {
        a.addEventListener('click', () => {
            toggle.classList.remove('open');
            nav.classList.remove('open');
        });
    });
}

// ── Terminal: loaded lazily so its bundle (command engine + site data) never blocks first paint.
// URL is derived from this script's own src, so it works under postbuild's relative paths too.
const TERMINAL_SRC = (document.currentScript as HTMLScriptElement | null)?.src.replace(
    /site\.js(\?.*)?$/,
    'terminal.js',
);
let terminalLoading: Promise<void> | null = null;
function loadTerminal(): Promise<void> {
    if (window.openTerminal) return Promise.resolve();
    if (!terminalLoading && TERMINAL_SRC) {
        terminalLoading = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = TERMINAL_SRC;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('terminal failed to load'));
            document.head.appendChild(s);
        });
    }
    return terminalLoading ?? Promise.resolve();
}

// fx.js (interactive motion, Motion: card tilt, draggable art, drip taps) — only on pages with
// something to animate,
// only when motion is allowed, on idle.
const FX_SRC = TERMINAL_SRC?.replace(/terminal\.js$/, 'fx.js');
let fxLoaded = false;
function initFx(): void {
    if (!FX_SRC || !document.querySelector('[data-drips], .card, [data-drag]')) return;
    const load = () => {
        if (fxLoaded || motionOff()) return;
        fxLoaded = true;
        const s = document.createElement('script');
        s.src = FX_SRC;
        document.head.appendChild(s);
    };
    idle(load);
    // Reduced motion turned off from the a11y menu later on: load it then.
    new MutationObserver(load).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-reduce-motion'],
    });
}

const idle = (cb: () => void) =>
    'requestIdleCallback' in window
        ? (window as Window & typeof globalThis).requestIdleCallback(cb, { timeout: 2000 })
        : setTimeout(cb, 1200);

function initTerminalLoader(): void {
    // Every [data-open-terminal] button (the 404 page has two), loading on demand.
    document
        .querySelectorAll<HTMLElement>('[data-open-terminal]')
        .forEach((btn) =>
            btn.addEventListener('click', () => loadTerminal().then(() => window.openTerminal?.())),
        );
    // Ctrl+K / ⌘K before the bundle arrives: load it, then open. (terminal.ts owns the shortcut
    // once it's loaded; this listener stands down then.)
    document.addEventListener('keydown', (e) => {
        if (window.openTerminal || !(e.ctrlKey || e.metaKey) || e.key !== 'k') return;
        e.preventDefault();
        loadTerminal().then(() => window.openTerminal?.());
    });
    idle(() => void loadTerminal());
}

// ── Scroll progress (a pixel strip across the top) and the touch scrubber (a grip on the right
// edge). Both are positioned by CSS scroll-driven animations where supported, which run off the
// main thread; this rAF fallback only runs while scrolling, elsewhere.
const scrollTimeline = () => CSS.supports('animation-timeline: scroll()');
const scrollMax = () => document.documentElement.scrollHeight - window.innerHeight;
const progress = () => {
    const max = scrollMax();
    return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
};
function onScrollFrame(cb: () => void): void {
    let ticking = false;
    window.addEventListener(
        'scroll',
        () => {
            if (!ticking) requestAnimationFrame(() => ((ticking = false), cb()));
            ticking = true;
        },
        { passive: true },
    );
    cb();
}

function initScrollProgress(): void {
    const bar = document.querySelector<HTMLElement>('.scroll-progress');
    const fill = bar?.firstElementChild as HTMLElement | null;
    if (!bar || !fill || scrollTimeline()) return;
    onScrollFrame(() => {
        const p = progress();
        bar.style.transform = `translateX(${(p - 1) * 100}%)`;
        fill.style.transform = `translateX(${(1 - p) * 100}%)`;
    });
}

/**
 * Touch screens have no scrollbar to grab, so long pages get one: a grip on the right edge that
 * shows while the page scrolls (or is touched) and drags the page directly, like a phone's fast
 * scroller. Decorative to assistive tech (the page scrolls normally); never on mouse devices.
 */
function initScrubber(): void {
    const rail = document.querySelector<HTMLElement>('.scrub');
    const thumb = rail?.firstElementChild as HTMLElement | null;
    if (!rail || !thumb || !matchMedia('(pointer: coarse)').matches) return;
    let hide = 0;
    let drag: { from: number; top: number; span: number } | null = null;
    let want = -1;
    const show = () => {
        // Only worth it on pages a few screens long.
        if (scrollMax() < window.innerHeight * 1.5) return;
        rail.classList.add('is-on');
        clearTimeout(hide);
        if (!drag) hide = window.setTimeout(() => rail.classList.remove('is-on'), 1500);
    };
    window.addEventListener('scroll', show, { passive: true });
    if (!scrollTimeline())
        onScrollFrame(() => {
            if (!drag)
                thumb.style.transform = `translateY(${progress() * rail.clientHeight - progress() * thumb.offsetHeight}px)`;
        });
    thumb.addEventListener('pointerdown', (e) => {
        const r = rail.getBoundingClientRect();
        const t = thumb.getBoundingClientRect();
        drag = { from: e.clientY - t.top, top: r.top, span: r.height - t.height };
        thumb.setPointerCapture(e.pointerId);
        rail.classList.add('is-on', 'is-drag');
        clearTimeout(hide);
        e.preventDefault();
    });
    thumb.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const p = Math.min(1, Math.max(0, (e.clientY - drag.top - drag.from) / drag.span));
        if (want < 0)
            requestAnimationFrame(() => {
                // Instant, even though the page uses smooth scrolling: the grip follows the finger.
                window.scrollTo({ top: want * scrollMax(), behavior: 'instant' });
                if (!scrollTimeline())
                    thumb.style.transform = `translateY(${want * (rail.clientHeight - thumb.offsetHeight)}px)`;
                want = -1;
            });
        want = p;
    });
    const end = () => {
        if (!drag) return;
        drag = null;
        rail.classList.remove('is-drag');
        show();
    };
    thumb.addEventListener('pointerup', end);
    thumb.addEventListener('pointercancel', end);
}

function initHeroTyping(): void {
    const el = document.getElementById('hero-typed');
    if (!el) return;
    if (el.dataset['typed'] === '1') return;
    el.dataset['typed'] = '1';
    el.innerHTML = '';

    const lines: HeroLine[] = [
        { prompt: 'stephen@lyons:~$ ', text: 'whoami', delay: 80 },
        { output: 'Stephen Lyons — Cybersecurity Engineer', delay: 30 },
        { output: '', delay: 200 },
        { prompt: 'stephen@lyons:~$ ', text: 'cat mission.txt', delay: 70 },
        {
            output: 'Building secure, resilient systems at Yamaha Motor Corp.',
            delay: 30,
        },
        {
            output: 'Specializing in DevSecOps, Cloud Security & Threat Detection.',
            delay: 30,
        },
        { output: '', delay: 200 },
        { prompt: 'stephen@lyons:~$ ', text: 'ls skills/', delay: 70 },
        {
            output: 'terraform/   ansible/   crowdstrike/   netskope/   zscaler/',
            delay: 30,
        },
        {
            output: 'python/      siem/      aws/           azure/      intune/',
            delay: 30,
        },
    ];

    let lineIdx = 0;
    let charIdx = 0;
    let currentEl: HTMLElement | null = null;

    function createLine(): void {
        if (!el) return;
        if (lineIdx >= lines.length) {
            const cursor = document.createElement('span');
            cursor.className = 'typed-cursor';
            el.appendChild(cursor);
            return;
        }

        const line = lines[lineIdx]!;
        const div = document.createElement('div');

        if (line.prompt) {
            const promptSpan = document.createElement('span');
            promptSpan.className = 'hero-prompt';
            promptSpan.textContent = line.prompt;
            div.appendChild(promptSpan);

            const cmdSpan = document.createElement('span');
            cmdSpan.className = 'hero-command';
            div.appendChild(cmdSpan);
            currentEl = cmdSpan;
        } else {
            div.className = 'hero-output';
            currentEl = div;
        }

        el.appendChild(div);
        requestAnimationFrame(() => {
            el!.scrollTop = el!.scrollHeight;
        });
        charIdx = 0;

        if (line.text) {
            typeChar(line);
        } else if (line.output !== undefined) {
            currentEl!.textContent = line.output;
            requestAnimationFrame(() => {
                el!.scrollTop = el!.scrollHeight;
            });
            lineIdx++;
            setTimeout(createLine, motionOff() ? 0 : line.delay || 100);
        }
    }

    function typeChar(line: HeroLine): void {
        if (!line.text) return;
        if (charIdx < line.text.length) {
            currentEl!.textContent = (currentEl!.textContent || '') + line.text[charIdx];
            requestAnimationFrame(() => {
                el!.scrollTop = el!.scrollHeight;
            });
            charIdx++;
            setTimeout(() => typeChar(line), motionOff() ? 0 : line.delay || 60);
        } else {
            lineIdx++;
            setTimeout(createLine, motionOff() ? 0 : 300);
        }
    }

    setTimeout(createLine, motionOff() ? 0 : 800);
}

function initHeroTerminalInteractive(): void {
    const heroTerminal = document.querySelector<HTMLElement>('.hero-terminal');
    const heroBody = document.getElementById('hero-typed');
    if (!heroTerminal || !heroBody) return;

    // Wait until the intro animation inserts the cursor, then activate
    const observer = new MutationObserver(() => {
        const cursor = heroBody.querySelector('.typed-cursor');
        if (!cursor) return;
        observer.disconnect();

        // Remove blinking cursor — we'll replace with an input row
        cursor.remove();
        // Make container accessible for interaction
        heroTerminal.removeAttribute('role');
        heroTerminal.removeAttribute('aria-label');

        // Input row — appended to heroTerminal (parent), NOT inside scrollable heroBody,
        // so it's always visible at the bottom of the widget regardless of scroll position.
        const row = document.createElement('div');
        row.className = 'hero-terminal__input-row';
        row.innerHTML =
            '<span class="hero-prompt">stephen@lyons:~$ </span>' +
            '<input class="hero-terminal__input" type="text" autocomplete="off" ' +
            'autocorrect="off" autocapitalize="off" spellcheck="false" ' +
            'aria-label="Terminal input" placeholder="type a command…" />';
        heroTerminal.appendChild(row);

        const input = row.querySelector<HTMLInputElement>('.hero-terminal__input')!;
        const heroHistory: string[] = [];
        let heroHistIdx = -1;

        input.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (heroHistIdx < heroHistory.length - 1) heroHistIdx++;
                input.value = heroHistory[heroHistory.length - 1 - heroHistIdx] ?? '';
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (heroHistIdx > 0) {
                    heroHistIdx--;
                    input.value = heroHistory[heroHistory.length - 1 - heroHistIdx] ?? '';
                } else {
                    heroHistIdx = -1;
                    input.value = '';
                }
                return;
            }
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const raw = input.value.trim();
            input.value = '';
            heroHistIdx = -1;
            if (!raw) return;
            heroHistory.push(raw);

            // Echo the command into the scrollable body
            const echo = document.createElement('div');
            echo.innerHTML =
                '<span class="hero-prompt">stephen@lyons:~$ </span>' +
                '<span class="hero-command">' +
                raw.replace(/</g, '&lt;').replace(/>/g, '&gt;') +
                '</span>';
            heroBody.appendChild(echo);

            // Dispatch via shared terminal engine (loaded by terminal.js)
            // Shared command engine from terminal.js (lazy-loaded; usually ready long before the
            // intro finishes typing).
            const outputAnchor = document.createElement('div');
            heroBody.appendChild(outputAnchor);
            loadTerminal()
                .then(() =>
                    window.runInElement?.(raw, outputAnchor, () => {
                        requestAnimationFrame(() => {
                            heroBody.scrollTop = heroBody.scrollHeight;
                        });
                        input.focus();
                    }),
                )
                .catch(() => {
                    outputAnchor.className = 'hero-output';
                    outputAnchor.style.color = 'var(--text-muted)';
                    outputAnchor.textContent = 'Terminal engine failed to load — try reloading.';
                });
            requestAnimationFrame(() => {
                heroBody.scrollTop = heroBody.scrollHeight;
            });
        });

        // Auto-scroll whenever new content is appended to heroBody
        const scrollObserver = new MutationObserver(() => {
            requestAnimationFrame(() => {
                heroBody.scrollTop = heroBody.scrollHeight;
            });
        });
        scrollObserver.observe(heroBody, { childList: true, subtree: true, characterData: true });

        // Focus input on click of the terminal widget
        heroTerminal.addEventListener('click', () => input.focus());
    });

    observer.observe(heroBody, { childList: true, subtree: true });
}

// (Title glitch: pure CSS, .glitch:hover. It used to restart from JS with a forced reflow on every
// mouseenter, which stalled scrolling over cards.)

function initHeaderScroll(): void {
    const header = document.querySelector<HTMLElement>('.site-header');
    if (!header) return;
    // One class flip when crossing the threshold, not a style write on every scroll frame.
    let past: boolean | null = null;
    const update = () => {
        const now = window.scrollY > 50;
        if (now !== past) header.classList.toggle('is-scrolled', (past = now));
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
}

function initBootSequence(): void {
    if (sessionStorage.getItem('sl-booted')) return;
    sessionStorage.setItem('sl-booted', '1');

    const overlay = document.createElement('div');
    overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 100000;
    background: #0A0A0A; display: flex;
    align-items: center; justify-content: center;
    flex-direction: column; font-family: var(--font-body);
    color: var(--ui, #3cc4ff); font-size: 0.85rem;
    transition: opacity 0.5s ease;
  `;

    const lines = [
        'BIOS v3.14.15 ... OK',
        'Loading kernel modules ...',
        'Mounting /dev/portfolio ...',
        'Initializing security protocols ...',
        'stephen@lyons:~$ startx',
        '',
        'Welcome, Stephen Lyons.',
    ];

    overlay.innerHTML = '<div id="boot-lines" style="max-width:600px;padding:2rem;"></div>';
    document.body.appendChild(overlay);

    const container = overlay.querySelector<HTMLDivElement>('#boot-lines')!;
    let i = 0;

    function showLine(): void {
        if (i >= lines.length) {
            setTimeout(() => {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 500);
            }, 400);
            return;
        }
        const p = document.createElement('div');
        p.textContent = lines[i]!;
        p.style.marginBottom = '0.3rem';
        container.appendChild(p);
        i++;
        setTimeout(showLine, 120 + Math.random() * 80);
    }
    showLine();
}

function initReveal(): void {
    // Skip if the browser doesn't support IntersectionObserver (very old browsers)
    // or if the user prefers reduced motion (CSS already handles that case).
    if (!('IntersectionObserver' in window)) return;
    if (motionOff()) return;

    // Signal to CSS that JS-driven reveal is active (hides elements until observed)
    document.body.classList.add('js-reveal-ready');

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    (entry.target as HTMLElement).classList.add('revealed');
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    );

    document.querySelectorAll<HTMLElement>('.reveal').forEach((el) => {
        observer.observe(el);
    });
}

// ── Accessibility menu (Header.astro) ────────────────────────────────────────
// Each switch mirrors a data-a11y-<key> attribute on <html>, persisted as JSON in localStorage.
// "motion" also drives data-reduce-motion, which stays on regardless when the OS asks for it.
const A11Y_KEY = 'sl-a11y';

function initA11yMenu(): void {
    const menu = document.getElementById('a11y-menu');
    if (!menu) return;
    const root = document.documentElement;
    const switches = [...menu.querySelectorAll<HTMLInputElement>('input[data-a11y]')];
    const osCalm = matchMedia('(prefers-reduced-motion: reduce)');

    const save = () => {
        const prefs: Record<string, boolean> = {};
        for (const s of switches) if (s.checked && !s.disabled) prefs[s.dataset['a11y']!] = true;
        try {
            localStorage.setItem(A11Y_KEY, JSON.stringify(prefs));
        } catch {
            /* private mode: the choice still applies to this page */
        }
    };
    const apply = (key: string, on: boolean) => {
        root.toggleAttribute(`data-a11y-${key}`, on);
        if (key === 'motion') root.toggleAttribute('data-reduce-motion', on || osCalm.matches);
    };
    const sync = () => {
        for (const s of switches) {
            const key = s.dataset['a11y']!;
            const forced = key === 'motion' && osCalm.matches;
            s.checked = forced || root.hasAttribute(`data-a11y-${key}`);
            s.disabled = forced;
            const hint = menu.querySelector<HTMLElement>(`[data-hint="${key}"]`);
            if (hint && key === 'motion')
                hint.textContent = forced
                    ? 'On: your device asks for less motion'
                    : 'Stop animations and transitions';
        }
    };

    for (const s of switches)
        s.addEventListener('change', () => {
            apply(s.dataset['a11y']!, s.checked);
            save();
        });
    menu.querySelector('[data-a11y-reset]')?.addEventListener('click', () => {
        for (const s of switches) apply(s.dataset['a11y']!, false);
        try {
            localStorage.removeItem(A11Y_KEY);
        } catch {
            /* ignore */
        }
        sync();
    });
    osCalm.addEventListener('change', () => {
        root.toggleAttribute(
            'data-reduce-motion',
            osCalm.matches || root.hasAttribute('data-a11y-motion'),
        );
        sync();
    });
    sync();
}

function init(): void {
    initA11yMenu();
    initBootSequence();
    initActiveNav();
    initMobileNav();
    initReveal();
    initHeroTyping();
    initHeroTerminalInteractive();
    initHeaderScroll();
    initTerminalLoader();
    initFx();
    initScrollProgress();
    initScrubber();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
    init();
}

export {};
