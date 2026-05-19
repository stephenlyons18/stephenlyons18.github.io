/* ============================================================
   Interactive Terminal — Ctrl+K / ⌘+K (TypeScript)
   ============================================================ */

import projects from '../data/projects';

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

const PAGES: Record<string, string> = {
  home: '/',
  index: '/',
  about: '/about',
  projects: '/projects',
  contact: '/contact',
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
  theme: { desc: 'Switch accent color (green|cyan|amber)', fn: cmdTheme },
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
  div.className = 'terminal-line' + (cls ? ' terminal-line--' + cls : '');
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

function streamLines(
  lines: string[],
  cls: string,
  outputEl: HTMLElement,
  onDone?: () => void,
): void {
  if (streamTimer) clearTimeout(streamTimer);
  let i = 0;
  function nextLine(): void {
    if (i >= lines.length) { onDone?.(); return; }
    const text = lines[i]!;
    i++;
    if (text.length <= CHAR_LIMIT) {
      const div = document.createElement('div');
      div.className = 'terminal-line' + (cls ? ' terminal-line--' + cls : '');
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
      appendLine(outputEl, text, cls);
      streamTimer = setTimeout(nextLine, LINE_DELAY);
    }
  }
  nextLine();
}

// Popup-terminal wrappers
function printLine(text: string, cls?: string): void { appendLine(popupBody, text, cls); }
function printHTML(html: string): void { appendHTML(popupBody, html); }

void printLine; void printHTML; // silence unused warnings — kept for future convenience

// ── Build popup terminal DOM ──────────────────────────────

function buildTerminal(): void {
  overlay = document.createElement('div');
  overlay.className = 'terminal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Interactive terminal');

  overlay.innerHTML = `
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
  streamLines(getAsciiBanner(), 'accent', popupBody, () => {
    streamLines(WELCOME_MSG, 'dim', popupBody);
  });
}

// ── Visual-viewport helper (keeps terminal above software keyboard) ───────

function syncOverlayToViewport(): void {
  const vv = window.visualViewport;
  if (!vv || !isOpen) return;
  overlay.style.top    = vv.offsetTop  + 'px';
  overlay.style.left   = vv.offsetLeft + 'px';
  overlay.style.width  = vv.width      + 'px';
  overlay.style.height = vv.height     + 'px';
}

function resetOverlayViewport(): void {
  overlay.style.top    = '';
  overlay.style.left   = '';
  overlay.style.width  = '';
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
    '<span style="color:var(--accent);font-weight:600;">stephen@lyons:~$</span>&nbsp;' +
      escapeHTML(raw),
  );
  if (!raw) { onDone?.(); return; }
  history.push(raw);
  const parts = raw.split(/\s+/);
  const cmd = parts[0]!.toLowerCase();
  const args = parts.slice(1);
  if (COMMANDS[cmd]) {
    COMMANDS[cmd].fn(args, outputEl, onDone);
  } else {
    appendLine(outputEl, `Command not found: ${cmd}. Type "help" for available commands.`, 'dim');
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
    setTimeout(() => { window.location.href = file; }, 400);
  } else {
    appendLine(outputEl, `Page not found: ${target}. Use "ls pages" to see available pages.`, 'dim');
    onDone?.();
  }
}

function cmdSkills(_args: string[], outputEl: HTMLElement, onDone?: () => void): void {
  const categories = [
    { title: 'Languages', items: 'TypeScript, Python, JavaScript, HTML, CSS, Rust, PHP, Java, C++, C#' },
    { title: 'Frameworks & Tools', items: 'React.js, Next.js, React Native, Node.js, Docker, Git, Linux/UNIX' },
    {
      title: 'Security Tools',
      items: 'CrowdStrike, Netskope, Zscaler, Azure, Intune, GitHub Enterprise, SIEM, EDR, DLP',
    },
    { title: 'Cloud Platforms', items: 'AWS, Azure, Google Cloud, Firebase, Vercel' },
  ];
  const lines: string[] = [''];
  categories.forEach((cat) => {
    lines.push(`  ┌─ ${cat.title}`);
    lines.push(`  │  ${cat.items}`);
    lines.push('  └──────────────────────');
    lines.push('');
  });
  streamLines(lines, '', outputEl, onDone);
}

function cmdProjects(_args: string[], outputEl: HTMLElement, onDone?: () => void): void {
  appendLine(outputEl, '');
  let i = 0;
  function nextProject(): void {
    if (i >= projects.length) { appendLine(outputEl, ''); onDone?.(); return; }
    const p = projects[i]!;
    i++;
    // Clickable title — links to /projects#{id}
    appendHTML(
      outputEl,
      `  <span style="color:var(--accent);font-weight:600;">&gt;</span> ` +
        `<a href="/projects#${encodeURIComponent(p.id)}" ` +
        `style="color:var(--accent);text-decoration:underline;text-decoration-color:var(--accent-dim);" ` +
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
  const jobs = [
    {
      period: 'Aug 2023 – Present', role: 'Cybersecurity Engineer',
      org: 'Yamaha Motor Corporation, Cypress, CA',
      highlights: [
        'Manages on-prem and cloud security operations',
        'Implements DevSecOps practices using GitHub Actions & GitHub Enterprise',
        'Develops Infrastructure as Code solutions',
        'Oversees CrowdStrike, Netskope, Zscaler deployments',
        'Manages Azure infrastructure, groups, and Intune MDM',
        'Builds & maintains CI/CD pipelines with security checks',
        'Develops SIEM platforms for real-time threat detection',
      ],
    },
    {
      period: 'May 2022 – Aug 2022', role: 'Business Application Development Intern',
      org: 'Yamaha Motor Corporation, Cypress, CA',
      highlights: [
        'Designed testing methods for code and data quality',
        'Developed SAP programs using ABAP',
        'Utilized Python and React.js for business applications',
      ],
    },
    {
      period: 'Feb 2020 – Jul 2023', role: 'Web Developer',
      org: 'Associated Students Inc., Long Beach, CA',
      highlights: [
        'Led team of graduate student developers',
        'Improved websites with SEO and daily content updates',
        'Developed React.js quiz game during COVID-19',
      ],
    },
    {
      period: 'May 2021 – Jan 2022', role: 'Lead Security Engineer',
      org: 'Down (joindown.com), Remote',
      highlights: [
        'Coordinated Android & iOS testing for React Native app',
        'Developed Firebase security rules',
        'Tested application using Jest and Detox',
      ],
    },
  ];
  const lines: string[] = [''];
  jobs.forEach((j) => {
    lines.push(`  ╔══ ${j.period}`);
    lines.push(`  ║  ${j.role}`);
    lines.push(`  ║  ${j.org}`);
    j.highlights.forEach((h) => lines.push(`  ║  > ${h}`));
    lines.push('  ╚══════════════════════════════');
    lines.push('');
  });
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

function cmdTheme(args: string[], outputEl: HTMLElement, onDone?: () => void): void {
  const themes = ['green', 'cyan', 'amber'];
  const t = (args[0] || '').toLowerCase();
  if (!themes.includes(t)) {
    appendLine(outputEl, `Usage: theme <${themes.join('|')}>`, 'dim');
    appendLine(outputEl, `Current: ${document.documentElement.getAttribute('data-theme') || 'green'}`, 'dim');
    onDone?.();
    return;
  }
  if (t === 'green') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', t);
  }
  appendLine(outputEl, `Theme switched to ${t}.`, 'accent');
  try { localStorage.setItem('sl-theme', t); } catch { /* noop */ }
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
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00FF41';
    ctx.font = '15px JetBrains Mono, monospace';

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

  try {
    const saved = localStorage.getItem('sl-theme');
    if (saved && saved !== 'green') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch {
    /* noop */
  }

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
