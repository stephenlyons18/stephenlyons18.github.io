/* ============================================================
   Interactive Terminal — Ctrl+K / ⌘+K (TypeScript)
   ============================================================ */

import projects from '../data/projects';
import { jobs } from '../data/experience';
import { CATEGORY_META, skills, type SkillCategory } from '../data/skills';
import { ROUTES } from '../data/site';
import {
    DEFAULT_THEME,
    DEFAULT_TITLE_STYLE,
    THEMES,
    THEME_KEY,
    TITLE_STYLES,
    TITLE_STYLE_KEY,
    findTheme,
    findTitleStyle,
} from '../data/themes';
import { renderDripStrip } from '../lib/ansi/wall';
import { dripsToHtml } from '../lib/ansi/html';

declare global {
    interface Window {
        openTerminal?: () => void;
        /** Execute a command with output directed to a custom element (hero terminal). */
        runInElement?: (raw: string, outputEl: HTMLElement, onDone?: () => void) => void;
    }
}

interface CommandDef {
    desc: string;
    fn: (args: string[], outputEl: HTMLElement, onDone?: () => void) => void;
}

// Full banner — desktop only
const ASCII_BANNER_FULL = [
    '  ███████╗████████╗███████╗██████╗ ██╗  ██╗███████╗███╗   ██╗',
    '  ██╔════╝╚══██╔══╝██╔════╝██╔══██╗██║  ██║██╔════╝████╗  ██║',
    '  ███████╗   ██║   █████╗  ██████╔╝███████║█████╗  ██╔██╗ ██║',
    '  ╚════██║   ██║   ██╔══╝  ██╔═══╝ ██╔══██║██╔══╝  ██║╚██╗██║',
    '  ███████║   ██║   ███████╗██║     ██║  ██║███████╗██║ ╚████║',
    '  ╚══════╝   ╚═╝   ╚══════╝╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝',
    '',
    '  ██╗  ██╗   ██╗ ██████╗ ███╗   ██╗███████╗',
    '  ██║  ╚██╗ ██╔╝██╔═══██╗████╗  ██║██╔════╝',
    '  ██║   ╚████╔╝ ██║   ██║██╔██╗ ██║███████╗',
    '  ██║    ╚██╔╝  ██║   ██║██║╚██╗██║╚════██║',
    '  ███████╗██║   ╚██████╔╝██║ ╚████║███████║',
    '  ╚══════╝╚═╝    ╚═════╝ ╚═╝  ╚═══╝╚══════╝',
];

// Compact banner — used on mobile where the full banner overflows
const ASCII_BANNER_COMPACT = [
    '',
    '  ╔═══════════════╗',
    '  ║   [ S L ]     ║',
    '  ╚═══════════════╝',
    '',
];

function getAsciiBanner(): string[] {
    return window.innerWidth < 768 ? ASCII_BANNER_COMPACT : ASCII_BANNER_FULL;
}

const WELCOME_MSG = [
    '',
    '  Cybersecurity Engineer // v1.0.0',
    '  Type "help" for available commands.',
    '',
];

/** cd/goto targets, from the one route list (clean directory URLs: /about/, never index.html). */
const PAGES: Record<string, string> = {
    ...Object.fromEntries(ROUTES.map((r) => [r.name.toLowerCase(), r.path])),
    index: '/',
};

let history: string[] = [];
let historyIdx = -1;
let overlay: HTMLDivElement;
let popupBody: HTMLDivElement;
let inputEl: HTMLInputElement;
let isOpen = false;
let streamTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

const COMMANDS: Record<string, CommandDef> = {
    help: { desc: 'List all available commands', fn: cmdHelp },
    whoami: { desc: 'Print a short bio', fn: cmdWhoami },
    ls: { desc: 'List pages (usage: ls pages)', fn: cmdLs },
    cd: { desc: 'Navigate to a page (usage: cd <page>)', fn: cmdCd },
    goto: { desc: 'Navigate to a page (alias for cd)', fn: cmdCd },
    skills: { desc: 'Display skills matrix', fn: cmdSkills },
    projects: { desc: 'List all projects', fn: cmdProjects },
    experience: { desc: 'Print work history timeline', fn: cmdExperience },
    education: { desc: 'Print education details', fn: cmdEducation },
    contact: { desc: 'Display contact information', fn: cmdContact },
    clear: { desc: 'Clear terminal screen', fn: cmdClear },
    exit: { desc: 'Close the terminal', fn: cmdExit },
    close: { desc: 'Close the terminal (alias)', fn: cmdExit },
    theme: { desc: 'Colours: burner|mint|defcon|sunset|phosphor', fn: cmdTheme },
    style: { desc: 'Heading letters: bubble|wildstyle', fn: cmdStyle },
    matrix: { desc: 'Trigger Matrix rain easter egg', fn: cmdMatrix },
    sudo: { desc: '???', fn: cmdSudo },
};

// ── Helpers ────────────────────────────────────────────────

function escapeHTML(str: string): string {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function scrollEl(el: HTMLElement): void {
    el.scrollTop = el.scrollHeight;
}

function appendLine(outputEl: HTMLElement, text: string, cls?: string): void {
    const div = document.createElement('div');
    div.className = lineClass(cls ?? '');
    div.textContent = text;
    outputEl.appendChild(div);
    scrollEl(outputEl);
}

function appendHTML(outputEl: HTMLElement, html: string): void {
    const div = document.createElement('div');
    div.className = 'terminal-line';
    div.innerHTML = html;
    outputEl.appendChild(div);
    scrollEl(outputEl);
}

/** Stream lines with per-character typewriter on short lines, instant on long. */
const CHAR_DELAY = 12;
const LINE_DELAY = 28;
const CHAR_LIMIT = 60;

/** Class for a line: a terminal-line modifier ('accent', 'dim'), or an ANSI art class ('a-f3'). */
function lineClass(cls: string): string {
    if (!cls) return 'terminal-line';
    return cls.startsWith('a-') ? `terminal-line ${cls}` : `terminal-line terminal-line--${cls}`;
}

function streamLines(
    lines: string[],
    cls: string | ((index: number) => string),
    outputEl: HTMLElement,
    onDone?: () => void,
): void {
    const clsAt = typeof cls === 'function' ? cls : () => cls;
    if (streamTimer) clearTimeout(streamTimer);
    // Reduced motion (OS or accessibility menu): print everything at once instead of typing it out.
    if (document.documentElement.hasAttribute('data-reduce-motion')) {
        lines.forEach((text, n) => appendLine(outputEl, text, clsAt(n)));
        onDone?.();
        return;
    }
    let i = 0;
    function nextLine(): void {
        if (i >= lines.length) {
            onDone?.();
            return;
        }
        const text = lines[i]!;
        i++;
        if (text.length <= CHAR_LIMIT) {
            const div = document.createElement('div');
            div.className = lineClass(clsAt(i - 1));
            outputEl.appendChild(div);
            let c = 0;
            function nextChar(): void {
                if (c < text.length) {
                    div.textContent = text.slice(0, ++c);
                    scrollEl(outputEl);
                    streamTimer = setTimeout(nextChar, CHAR_DELAY);
                } else {
                    streamTimer = setTimeout(nextLine, LINE_DELAY);
                }
            }
            nextChar();
        } else {
            appendLine(outputEl, text, clsAt(i - 1));
            streamTimer = setTimeout(nextLine, LINE_DELAY);
        }
    }
    nextLine();
}

// Popup-terminal wrappers
function printLine(text: string, cls?: string): void {
    appendLine(popupBody, text, cls);
}
function printHTML(html: string): void {
    appendHTML(popupBody, html);
}

void printLine;
void printHTML; // silence unused warnings — kept for future convenience

// ── Build popup terminal DOM ──────────────────────────────

/** Paint running off the window frame's bottom edge: the same strip as card drips (7px cells,
 *  clipped to the window's width), poured once when the terminal opens (global.css .term-drips).
 *  Seeded, so it's the same on every open. Never over the terminal's text. */
const DRIP_COLS = 220;
const termDrips = (): string => {
    const strip = renderDripStrip(DRIP_COLS, 31, { maxStem: 5, minStem: 1, density: 0.09 });
    return `<div class="drips term-drips" data-drips aria-hidden="true" style="--rows:${strip.rows}"><pre class="ansi" style="--cols:${DRIP_COLS}">${dripsToHtml(strip, false)}</pre></div>`;
};

function buildTerminal(): void {
    overlay = document.createElement('div');
    overlay.className = 'terminal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Interactive terminal');

    overlay.innerHTML = `
    <div class="terminal-wrap">
    <div class="terminal-panel">
      <div class="terminal-bar">
        <div class="terminal-bar__dots">
          <span class="terminal-bar__dot terminal-bar__dot--red" title="Close" tabindex="0" role="button" aria-label="Close terminal"></span>
          <span class="terminal-bar__dot terminal-bar__dot--yellow"></span>
          <span class="terminal-bar__dot terminal-bar__dot--green"></span>
        </div>
        <span class="terminal-bar__title">stephen@lyons:~$</span>
      </div>
      <div class="terminal-body" id="terminal-body"></div>
      <div style="padding: 0 1.25rem 1rem; display: flex; align-items: center;">
        <span class="terminal-prompt">stephen@lyons:~$&nbsp;</span>
        <input class="terminal-input" id="terminal-input" type="text" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Terminal input">
      </div>
    </div>
    ${termDrips()}
    </div>
  `;

    document.body.appendChild(overlay);

    popupBody = overlay.querySelector<HTMLDivElement>('#terminal-body')!;
    inputEl = overlay.querySelector<HTMLInputElement>('#terminal-input')!;

    const redDot = overlay.querySelector<HTMLElement>('.terminal-bar__dot--red')!;
    const yellowDot = overlay.querySelector<HTMLElement>('.terminal-bar__dot--yellow')!;
    const greenDot = overlay.querySelector<HTMLElement>('.terminal-bar__dot--green')!;
    redDot.addEventListener('click', closeTerminal);
    yellowDot.addEventListener('click', closeTerminal);
    greenDot.addEventListener('click', closeTerminal);
    redDot.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') closeTerminal();
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeTerminal();
    });

    const panel = overlay.querySelector<HTMLElement>('.terminal-panel');
    panel?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.terminal-bar__dot, button, a, input, textarea')) return;
        const sel = window.getSelection();
        if (sel && sel.toString().length > 0) return;
        inputEl.focus({ preventScroll: true });
    });

    inputEl.addEventListener('keydown', handleKeydown);

    // Stream banner then welcome on open
    // Banner in the title-art gradient: each 6-row word runs top → bottom colour.
    streamLines(
        getAsciiBanner(),
        (i) => `a-f${Math.round(((i % 7) * 7) / 5) % 8}`,
        popupBody,
        () => {
            streamLines(WELCOME_MSG, 'dim', popupBody);
        },
    );
}

// ── Visual-viewport helper (keeps terminal above software keyboard) ───────

function syncOverlayToViewport(): void {
    const vv = window.visualViewport;
    if (!vv || !isOpen) return;
    overlay.style.top = vv.offsetTop + 'px';
    overlay.style.left = vv.offsetLeft + 'px';
    overlay.style.width = vv.width + 'px';
    overlay.style.height = vv.height + 'px';
}

function resetOverlayViewport(): void {
    overlay.style.top = '';
    overlay.style.left = '';
    overlay.style.width = '';
    overlay.style.height = '';
}

function openTerminal(): void {
    if (isOpen) return;
    isOpen = true;
    overlay.classList.add('active');
    inputEl.value = '';
    syncOverlayToViewport();
    requestAnimationFrame(() => inputEl.focus({ preventScroll: true }));
}

function closeTerminal(): void {
    if (!isOpen) return;
    isOpen = false;
    overlay.classList.remove('active');
    resetOverlayViewport();
    if (streamTimer) clearTimeout(streamTimer);
}

function toggleTerminal(): void {
    if (isOpen) closeTerminal();
    else openTerminal();
}

// ── Shared command dispatcher ─────────────────────────────

function dispatchCommand(raw: string, outputEl: HTMLElement, onDone?: () => void): void {
    appendHTML(
        outputEl,
        '<span style="color:var(--ui);font-weight:600;">stephen@lyons:~$</span>&nbsp;' +
            escapeHTML(raw),
    );
    if (!raw) {
        onDone?.();
        return;
    }
    history.push(raw);
    const parts = raw.split(/\s+/);
    const cmd = parts[0]!.toLowerCase();
    const args = parts.slice(1);
    if (COMMANDS[cmd]) {
        COMMANDS[cmd].fn(args, outputEl, onDone);
    } else {
        appendLine(
            outputEl,
            `Command not found: ${cmd}. Type "help" for available commands.`,
            'dim',
        );
        onDone?.();
    }
}

// ── Keyboard handler ─────────────────────────────────────

function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Tab') {
        e.preventDefault();
        tabComplete();
        return;
    }
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (history.length === 0) return;
        if (historyIdx < history.length - 1) historyIdx++;
        inputEl.value = history[history.length - 1 - historyIdx]!;
        return;
    }
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIdx > 0) {
            historyIdx--;
            inputEl.value = history[history.length - 1 - historyIdx]!;
        } else {
            historyIdx = -1;
            inputEl.value = '';
        }
        return;
    }
    if (e.key === 'Enter') {
        e.preventDefault();
        const raw = inputEl.value.trim();
        inputEl.value = '';
        historyIdx = -1;
        dispatchCommand(raw, popupBody);
    }
}

function tabComplete(): void {
    const val = inputEl.value.toLowerCase();
    if (!val) return;
    const matches = Object.keys(COMMANDS).filter((c) => c.startsWith(val));
    if (matches.length === 1) {
        inputEl.value = matches[0]! + ' ';
    } else if (matches.length > 1) {
        appendLine(popupBody, '  ' + matches.join('  '), 'dim');
    }
}

// ── Commands ─────────────────────────────────────────────

function cmdHelp(_args: string[], outputEl: HTMLElement, onDone?: () => void): void {
    const lines = [
        '',
        'Available commands:',
        '',
        ...Object.entries(COMMANDS)
            .filter(([name]) => name !== 'close')
            .map(([name, c]) => `  ${name.padEnd(14)} ${c.desc}`),
        '',
        'Tip: use Tab for auto-completion, ↑/↓ for history.',
        '',
    ];
    streamLines(lines, '', outputEl, onDone);
}

function cmdWhoami(_args: string[], outputEl: HTMLElement, onDone?: () => void): void {
    const lines = [
        '',
        '  Stephen Lyons',
        '  Cybersecurity Engineer @ Yamaha Motor Corporation',
        '',
        '  B.S. Computer Science — Cal State Long Beach',
        '  Minor in Cyber Security Applications',
        '',
        '  Specializing in DevSecOps, Cloud Security, SIEM Engineering,',
        '  Endpoint Security, and Infrastructure as Code.',
        '',
        '  Building secure systems that scale.',
        '',
    ];
    streamLines(lines, '', outputEl, onDone);
}

function cmdLs(args: string[], outputEl: HTMLElement, onDone?: () => void): void {
    if (args[0] === 'pages' || args.length === 0) {
        const lines = [
            '',
            '  Pages:',
            ...Object.entries(PAGES)
                .filter(([name]) => name !== 'index')
                .map(([name, path]) => `    ${name.padEnd(12)} → ${path}`),
            '',
        ];
        streamLines(lines, '', outputEl, onDone);
    } else {
        appendLine(outputEl, `ls: cannot access '${args[0]}': No such directory`, 'dim');
        onDone?.();
    }
}

function cmdCd(args: string[], outputEl: HTMLElement, onDone?: () => void): void {
    const target = (args[0] || '').toLowerCase();
    if (!target) {
        appendLine(outputEl, 'Usage: cd <page>  (e.g., cd about)', 'dim');
        onDone?.();
        return;
    }
    const file = PAGES[target];
    if (file) {
        appendLine(outputEl, `Navigating to ${target}...`, 'accent');
        setTimeout(() => {
            window.location.href = file;
        }, 400);
    } else {
        appendLine(
            outputEl,
            `Page not found: ${target}. Use "ls pages" to see available pages.`,
            'dim',
        );
        onDone?.();
    }
}

function cmdSkills(_args: string[], outputEl: HTMLElement, onDone?: () => void): void {
    // Generated from skills.ts so the terminal never drifts from the graph.
    const lines: string[] = [''];
    for (const cat of Object.keys(CATEGORY_META) as SkillCategory[]) {
        const names = skills
            .filter((s) => s.category === cat)
            .sort((a, b) => b.weight - a.weight)
            .map((s) => s.name);
        lines.push(`  ┌─ ${CATEGORY_META[cat].label}`);
        lines.push(...wrapList(names, 56).map((l) => `  │  ${l}`));
        lines.push('  └──────────────────────');
        lines.push('');
    }
    lines.push('  Tip: the About page has the interactive skill graph — cd about');
    lines.push('');
    streamLines(lines, '', outputEl, onDone);
}

/** Greedy-wrap a comma list to `width` characters per line. */
function wrapList(items: string[], width: number): string[] {
    const out: string[] = [];
    let line = '';
    for (const it of items) {
        const next = line ? `${line}, ${it}` : it;
        if (next.length > width && line) {
            out.push(line + ',');
            line = it;
        } else line = next;
    }
    if (line) out.push(line);
    return out;
}

function cmdProjects(_args: string[], outputEl: HTMLElement, onDone?: () => void): void {
    appendLine(outputEl, '');
    let i = 0;
    function nextProject(): void {
        if (i >= projects.length) {
            appendLine(outputEl, '');
            onDone?.();
            return;
        }
        const p = projects[i]!;
        i++;
        // Clickable title — links to /projects#{id}
        appendHTML(
            outputEl,
            `  <span style="color:var(--ui);font-weight:600;">&gt;</span> ` +
                `<a href="/projects/#${encodeURIComponent(p.id)}" ` +
                `style="color:var(--ui);text-decoration:underline;text-decoration-color:var(--ui-dim);" ` +
                `title="View on projects page">${escapeHTML(p.title)}</a>`,
        );
        appendLine(outputEl, `    ${p.descriptions[0]}`);
        appendLine(outputEl, `    Tech: ${p.tech.join(', ')}`, 'dim');
        if (p.date) appendLine(outputEl, `    ${p.date}`, 'dim');
        appendLine(outputEl, '');
        streamTimer = setTimeout(nextProject, LINE_DELAY * 3);
    }
    nextProject();
}

function cmdExperience(_args: string[], outputEl: HTMLElement, onDone?: () => void): void {
    // Generated from experience.ts (same source as the About timeline).
    const lines: string[] = [''];
    for (const j of jobs) {
        lines.push(`  ╔══ ${j.date}`);
        lines.push(`  ║  ${j.role}`);
        lines.push(`  ║  ${j.org}`);
        for (const d of j.details.slice(0, 4)) lines.push(`  ║  > ${d}`);
        lines.push('  ╚══════════════════════════════');
        lines.push('');
    }
    streamLines(lines, '', outputEl, onDone);
}

function cmdEducation(_args: string[], outputEl: HTMLElement, onDone?: () => void): void {
    const lines = [
        '',
        '  ┌─────────────────────────────────────────────────┐',
        '  │  California State University, Long Beach        │',
        '  │  B.S. Computer Science — Aug 2019 – May 2023   │',
        '  │  Minor: Cyber Security Applications             │',
        '  └─────────────────────────────────────────────────┘',
        '',
        '  Relevant Courses:',
        '    • Algorithms       • Data Structures',
        '    • Computer Security I & II',
        '    • Networks & Network Security',
        '    • Machine Learning  • AI  • Digital Forensics',
        '',
        '  Activities:',
        '    • CSULB ACM (Webmaster)',
        '    • CSULB Cybersecurity Club',
        '    • BeachHacks 2023',
        '',
    ];
    streamLines(lines, '', outputEl, onDone);
}

function cmdContact(_args: string[], outputEl: HTMLElement, onDone?: () => void): void {
    const lines = [
        '',
        '  ┌─ Contact Info',
        '  │',
        '  │  Email    stephen.lyons18@gmail.com',
        '  │  Website  stephenlyons.dev',
        '  │  Location Southern California',
        '  │',
        '  │  GitHub   github.com/stephenlyons18',
        '  │  LinkedIn linkedin.com/in/stephen-lyons',
        '  │',
        '  └──────────────────────',
        '',
    ];
    streamLines(lines, '', outputEl, onDone);
}

function cmdClear(_args: string[], outputEl: HTMLElement): void {
    outputEl.innerHTML = '';
}

function cmdExit(_args: string[], _outputEl: HTMLElement): void {
    closeTerminal();
}

/** Themes (src/data/themes.ts): by id, menu label or alias. Same attribute and key as the accessibility menu. */
function cmdTheme(args: string[], outputEl: HTMLElement, onDone?: () => void): void {
    const t = args[0] ? findTheme(args[0]) : undefined;
    if (!t) {
        const current = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
        const lines = [
            '',
            '  Usage: theme <name>',
            '',
            ...THEMES.map(
                (th) =>
                    `  ${th.id === current ? '▶' : ' '} ${th.label.toLowerCase().padEnd(10)} ${th.desc}`,
            ),
            '',
        ];
        streamLines(lines, 'dim', outputEl, onDone);
        return;
    }
    if (t.id === DEFAULT_THEME) document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t.id);
    appendLine(outputEl, `Theme switched to ${t.label}.`, 'accent');
    try {
        localStorage.setItem(THEME_KEY, t.id);
    } catch {
        /* noop */
    }
    onDone?.();
}

/** Heading letter style (bubble | wildstyle): the same attribute and key as the accessibility menu. */
function cmdStyle(args: string[], outputEl: HTMLElement, onDone?: () => void): void {
    const s = args[0] ? findTitleStyle(args[0]) : undefined;
    const root = document.documentElement;
    if (!s) {
        const current = root.getAttribute('data-title-style') || DEFAULT_TITLE_STYLE;
        const lines = [
            '',
            '  Usage: style <name>',
            '',
            ...TITLE_STYLES.map(
                (st) =>
                    `  ${st.id === current ? '▶' : ' '} ${st.label.toLowerCase().padEnd(10)} ${st.desc}`,
            ),
            '',
        ];
        streamLines(lines, 'dim', outputEl, onDone);
        return;
    }
    if (s === 'wild') root.setAttribute('data-title-style', 'wild');
    else root.removeAttribute('data-title-style');
    const label = TITLE_STYLES.find((st) => st.id === s)!.label;
    appendLine(outputEl, `Headings now in ${label}.`, 'accent');
    try {
        if (s === 'wild') localStorage.setItem(TITLE_STYLE_KEY, 'wild');
        else localStorage.removeItem(TITLE_STYLE_KEY);
    } catch {
        /* noop */
    }
    onDone?.();
}

function cmdMatrix(_args: string[], outputEl: HTMLElement, onDone?: () => void): void {
    appendLine(outputEl, 'Initiating Matrix rain sequence...', 'accent');
    triggerMatrixEasterEgg();
    onDone?.();
}

function cmdSudo(_args: string[], outputEl: HTMLElement, onDone?: () => void): void {
    const responses = [
        'Nice try. 😏',
        'Access denied. This incident will be reported.',
        'You are not in the sudoers file. This incident has been reported to Santa.',
        'sudo: I appreciate the ambition, but no.',
        'Error 403: You thought. 🤨',
        'Permission denied. Stephen is the only admin here.',
    ];
    appendLine(outputEl, responses[Math.floor(Math.random() * responses.length)]!, 'accent');
    onDone?.();
}

function triggerMatrixEasterEgg(): void {
    let canvas = document.getElementById('matrix-easter-egg') as HTMLCanvasElement | null;
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'matrix-easter-egg';
        document.body.appendChild(canvas);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.classList.add('active');

    const cols = Math.floor(canvas.width / 18);
    const drops = Array(cols).fill(1) as number[];
    const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()ァカサタナハマヤラワ';

    let frame = 0;
    const maxFrames = 180;

    function draw(): void {
        if (!ctx || !canvas) return;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle =
            getComputedStyle(document.documentElement).getPropertyValue('--ui').trim() || '#00FF41';
        ctx.font = "15px 'Departure Mono', monospace";

        for (let i = 0; i < drops.length; i++) {
            const char = chars[Math.floor(Math.random() * chars.length)]!;
            ctx.fillText(char, i * 18, drops[i]! * 18);
            if (drops[i]! * 18 > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i] = drops[i]! + 1;
        }
        frame++;
        if (frame < maxFrames) {
            requestAnimationFrame(draw);
        } else {
            canvas.classList.remove('active');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    draw();
}

function init(): void {
    if (initialized) return;
    initialized = true;

    buildTerminal();

    // Keep the overlay pinned above the software keyboard on mobile
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncOverlayToViewport);
        window.visualViewport.addEventListener('scroll', syncOverlayToViewport);
    }

    // The saved theme is applied before first paint by the inline script in BaseLayout.astro.

    window.openTerminal = openTerminal;
    window.runInElement = dispatchCommand;
}

document.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (initialized) toggleTerminal();
        return;
    }
    if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        closeTerminal();
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
    init();
}

export {};
