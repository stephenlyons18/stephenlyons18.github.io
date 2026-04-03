/* ============================================================
   Main.js — Site Interactivity
   Stephen Lyons — Cybersecurity Portfolio
   ============================================================ */

(function () {
  'use strict';

  /* ---------- Matrix Rain Background Canvas ---------- */
  function initMatrixBackground() {
    const canvas = document.getElementById('matrix-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const fontSize = 14;
    const cols = Math.floor(canvas.width / fontSize);
    const drops = Array.from({ length: cols }, () => Math.random() * -100);
    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF';

    function draw() {
      ctx.fillStyle = 'rgba(10, 10, 10, 0.04)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const accent = getComputedStyle(document.documentElement)
        .getPropertyValue('--accent')
        .trim() || '#00FF41';
      ctx.fillStyle = accent;
      ctx.font = `${fontSize}px JetBrains Mono, monospace`;

      for (let i = 0; i < drops.length; i++) {
        if (drops[i] * fontSize > 0) {
          const char = chars[Math.floor(Math.random() * chars.length)];
          ctx.globalAlpha = 0.15 + Math.random() * 0.1;
          ctx.fillText(char, i * fontSize, drops[i] * fontSize);
        }
        drops[i]++;
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.99) {
          drops[i] = 0;
        }
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    }
    draw();
  }

  /* ---------- Scroll Reveal ---------- */
  function initReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!els.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    els.forEach((el) => observer.observe(el));
  }

  /* ---------- Active Nav Link ---------- */
  function initActiveNav() {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach((a) => {
      const href = a.getAttribute('href');
      if (href === page || (page === '' && href === 'index.html')) {
        a.classList.add('active');
      }
    });
  }

  /* ---------- Mobile Nav Toggle ---------- */
  function initMobileNav() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.nav-links');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', () => {
      toggle.classList.toggle('open');
      nav.classList.toggle('open');
    });

    // Close on link click
    nav.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        toggle.classList.remove('open');
        nav.classList.remove('open');
      });
    });
  }

  /* ---------- Terminal Hint Button ---------- */
  function initTerminalHint() {
    const btn = document.querySelector('.nav-terminal-hint');
    if (btn && typeof window.openTerminal === 'function') {
      btn.addEventListener('click', () => window.openTerminal());
    }
  }

  /* ---------- Hero Typing Animation ---------- */
  function initHeroTyping() {
    const el = document.getElementById('hero-typed');
    if (!el) return;

    const lines = [
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
    let currentEl = null;

    function createLine() {
      if (lineIdx >= lines.length) {
        // Add blinking cursor at end
        const cursor = document.createElement('span');
        cursor.className = 'typed-cursor';
        el.appendChild(cursor);
        return;
      }

      const line = lines[lineIdx];
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
        currentEl.textContent = line.output;
        lineIdx++;
        setTimeout(createLine, line.delay || 100);
      }
    }

    function typeChar(line) {
      if (charIdx < line.text.length) {
        currentEl.textContent += line.text[charIdx];
        charIdx++;
        setTimeout(() => typeChar(line), line.delay || 60);
      } else {
        lineIdx++;
        setTimeout(createLine, 300);
      }
    }

    // Start after a small delay to simulate boot
    setTimeout(createLine, 800);
  }

  /* ---------- Glitch Effect on Hover ---------- */
  function initGlitch() {
    document.querySelectorAll('.glitch').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        el.style.animation = 'none';
        void el.offsetWidth; // force reflow
        el.style.animation = 'glitch-skew 0.5s ease';
      });
    });
  }

  /* ---------- Header scroll effect ---------- */
  function initHeaderScroll() {
    const header = document.querySelector('.site-header');
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

  /* ---------- Boot sequence (brief flash on first load) ---------- */
  function initBootSequence() {
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

    const container = overlay.querySelector('#boot-lines');
    let i = 0;

    function showLine() {
      if (i >= lines.length) {
        setTimeout(() => {
          overlay.style.opacity = '0';
          setTimeout(() => overlay.remove(), 500);
        }, 400);
        return;
      }
      const p = document.createElement('div');
      p.textContent = lines[i];
      p.style.marginBottom = '0.3rem';
      container.appendChild(p);
      i++;
      setTimeout(showLine, 120 + Math.random() * 80);
    }
    showLine();
  }

  /* ---------- Init ---------- */
  function init() {
    initBootSequence();
    initMatrixBackground();
    initReveal();
    initActiveNav();
    initMobileNav();
    initHeroTyping();
    initGlitch();
    initHeaderScroll();

    // Terminal hint needs a tick to let terminal.js register
    setTimeout(initTerminalHint, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
