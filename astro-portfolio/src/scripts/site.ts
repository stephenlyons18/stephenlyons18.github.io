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

let matrixRafId = 0;

function initMatrixBackground(): void {
  const canvas = document.getElementById('matrix-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  function resize(): void {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const fontSize = 14;
  const cols = Math.floor(canvas.width / fontSize);
  const drops: number[] = Array.from({ length: cols }, () => Math.random() * -100);
  const chars =
    'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF';

  function draw(): void {
    if (!ctx || !canvas) return;
    ctx.fillStyle = 'rgba(10, 10, 10, 0.04)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const accent =
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00FF41';
    ctx.fillStyle = accent;
    ctx.font = `${fontSize}px JetBrains Mono, monospace`;

    for (let i = 0; i < drops.length; i++) {
      if (drops[i]! * fontSize > 0) {
        const char = chars[Math.floor(Math.random() * chars.length)]!;
        ctx.globalAlpha = 0.15 + Math.random() * 0.1;
        ctx.fillText(char, i * fontSize, drops[i]! * fontSize);
      }
      drops[i] = drops[i]! + 1;
      if (drops[i]! * fontSize > canvas.height && Math.random() > 0.99) {
        drops[i] = 0;
      }
    }
    ctx.globalAlpha = 1;
    matrixRafId = requestAnimationFrame(draw);
  }
  cancelAnimationFrame(matrixRafId);
  draw();
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

function initTerminalHint(): void {
  const btn = document.querySelector<HTMLButtonElement>('[data-open-terminal]');
  if (btn && typeof window.openTerminal === 'function') {
    btn.addEventListener('click', () => window.openTerminal && window.openTerminal());
  }
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
      output: 'Infrastrcture as Code/  crowdstrike/  netskope/  github-enterprise/  azure/',
      delay: 30,
    },
    {
      output: 'python/     siem/        aws/       zscaler/             intune/',
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
    charIdx = 0;

    if (line.text) {
      typeChar(line);
    } else if (line.output !== undefined) {
      currentEl!.textContent = line.output;
      lineIdx++;
      setTimeout(createLine, line.delay || 100);
    }
  }

  function typeChar(line: HeroLine): void {
    if (!line.text) return;
    if (charIdx < line.text.length) {
      currentEl!.textContent = (currentEl!.textContent || '') + line.text[charIdx];
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
        if (heroHistIdx > 0) { heroHistIdx--; input.value = heroHistory[heroHistory.length - 1 - heroHistIdx] ?? ''; }
        else { heroHistIdx = -1; input.value = ''; }
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
        '<span class="hero-command">' + raw.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>';
      heroBody.appendChild(echo);

      // Dispatch via shared terminal engine (loaded by terminal.js)
      if (typeof window.runInElement === 'function') {
        const outputAnchor = document.createElement('div');
        heroBody.appendChild(outputAnchor);
        window.runInElement(raw, outputAnchor, () => {
          heroBody.scrollTop = heroBody.scrollHeight;
          input.focus();
        });
      } else {
        const err = document.createElement('div');
        err.className = 'hero-output';
        err.style.color = 'var(--text-muted)';
        err.textContent = 'Terminal engine not loaded yet — try again in a moment.';
        heroBody.appendChild(err);
      }
      heroBody.scrollTop = heroBody.scrollHeight;
    });

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
          header.style.borderBottomColor = 'var(--accent-dim)';
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
    color: var(--accent, #00FF41); font-size: 0.85rem;
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
  initMatrixBackground();
  initActiveNav();
  initMobileNav();
  initReveal();
  initHeroTyping();
  initHeroTerminalInteractive();
  initGlitch();
  initHeaderScroll();
  setTimeout(initTerminalHint, 100);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

export {};
