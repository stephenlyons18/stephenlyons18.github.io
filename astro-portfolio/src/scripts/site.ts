/* ============================================================
   Site Interactivity (TypeScript port of main.js)
   ============================================================ */

declare global {
    interface Window {
        openTerminal?: () => void;
    }
}

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
    const idle = (cb: () => void) =>
        'requestIdleCallback' in window
            ? (window as Window & typeof globalThis).requestIdleCallback(cb, { timeout: 2500 })
            : setTimeout(cb, 1200);
    idle(() => void loadTerminal());
}

// ── Scroll progress: CSS scroll-driven animation where supported; rAF fallback otherwise.
function initScrollProgress(): void {
    const bar = document.querySelector<HTMLElement>('.scroll-progress-bar');
    if (!bar || CSS.supports('animation-timeline: scroll()')) return;
    let ticking = false;
    const update = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
        ticking = false;
    };
    window.addEventListener(
        'scroll',
        () => {
            if (!ticking) requestAnimationFrame(update);
            ticking = true;
        },
        { passive: true },
    );
    update();
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
            setTimeout(createLine, line.delay || 100);
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
            setTimeout(() => typeChar(line), line.delay || 60);
        } else {
            lineIdx++;
            setTimeout(createLine, 300);
        }
    }

    setTimeout(createLine, 800);
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

function initGlitch(): void {
    document.querySelectorAll<HTMLElement>('.glitch').forEach((el) => {
        el.addEventListener('mouseenter', () => {
            el.style.animation = 'none';
            void el.offsetWidth;
            el.style.animation = 'glitch-skew 0.5s ease';
        });
    });
}

function initHeaderScroll(): void {
    const header = document.querySelector<HTMLElement>('.site-header');
    if (!header) return;
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                if (window.scrollY > 50) {
                    header.style.borderBottomColor = 'var(--ui-dim)';
                } else {
                    header.style.borderBottomColor = 'var(--border)';
                }
                ticking = false;
            });
            ticking = true;
        }
    });
}

function initBootSequence(): void {
    if (sessionStorage.getItem('sl-booted')) return;
    sessionStorage.setItem('sl-booted', '1');

    const overlay = document.createElement('div');
    overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 100000;
    background: #0A0A0A; display: flex;
    align-items: center; justify-content: center;
    flex-direction: column; font-family: 'JetBrains Mono', monospace;
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
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

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

function init(): void {
    initBootSequence();
    initActiveNav();
    initMobileNav();
    initReveal();
    initHeroTyping();
    initHeroTerminalInteractive();
    initGlitch();
    initHeaderScroll();
    initTerminalLoader();
    initScrollProgress();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
    init();
}

export {};
