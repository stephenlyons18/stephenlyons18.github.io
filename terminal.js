/* ============================================================
   Interactive Terminal — Ctrl+K / ⌘+K
   Stephen Lyons — Cybersecurity Portfolio
   ============================================================ */

(function () {
  'use strict';

  /* ---------- ASCII Art & Data ---------- */
  const ASCII_BANNER = [
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

  const WELCOME_MSG = [
    '',
    '  Cybersecurity Engineer // v1.0.0',
    '  Type "help" for available commands.',
    '',
  ];

  const COMMANDS = {
    help: {
      desc: 'List all available commands',
      fn: cmdHelp,
    },
    whoami: {
      desc: 'Print a short bio',
      fn: cmdWhoami,
    },
    ls: {
      desc: 'List pages (usage: ls pages)',
      fn: cmdLs,
    },
    cd: {
      desc: 'Navigate to a page (usage: cd <page>)',
      fn: cmdCd,
    },
    goto: {
      desc: 'Navigate to a page (alias for cd)',
      fn: cmdCd,
    },
    skills: {
      desc: 'Display skills matrix',
      fn: cmdSkills,
    },
    projects: {
      desc: 'List all projects',
      fn: cmdProjects,
    },
    experience: {
      desc: 'Print work history timeline',
      fn: cmdExperience,
    },
    education: {
      desc: 'Print education details',
      fn: cmdEducation,
    },
    contact: {
      desc: 'Display contact information',
      fn: cmdContact,
    },
    clear: {
      desc: 'Clear terminal screen',
      fn: cmdClear,
    },
    exit: {
      desc: 'Close the terminal',
      fn: cmdExit,
    },
    close: {
      desc: 'Close the terminal (alias)',
      fn: cmdExit,
    },
    theme: {
      desc: 'Switch accent color (green|cyan|amber)',
      fn: cmdTheme,
    },
    matrix: {
      desc: 'Trigger Matrix rain easter egg',
      fn: cmdMatrix,
    },
    sudo: {
      desc: '???',
      fn: cmdSudo,
    },
  };

  const PAGES = {
    home: 'index.html',
    index: 'index.html',
    about: 'about.html',
    projects: 'projects.html',
    devsecops: 'devsecops.html',
    contact: 'contact.html',
  };

  /* ---------- State ---------- */
  let history = [];
  let historyIdx = -1;
  let overlay, panel, body, inputEl, promptEl;
  let isOpen = false;
  let typeTimer = null;

  /* ---------- Build DOM ---------- */
  function buildTerminal() {
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
          <span class="terminal-prompt">stephen@lyons:~$</span>
          <input class="terminal-input" id="terminal-input" type="text" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Terminal input">
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    body = overlay.querySelector('#terminal-body');
    inputEl = overlay.querySelector('#terminal-input');
    promptEl = overlay.querySelector('.terminal-prompt');
    panel = overlay.querySelector('.terminal-panel');

    // Close via red dot
    overlay.querySelector('.terminal-bar__dot--red').addEventListener('click', closeTerminal);
    overlay.querySelector('.terminal-bar__dot--red').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') closeTerminal();
    });

    // Close clicking backdrop
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeTerminal();
    });

    // Input handling
    inputEl.addEventListener('keydown', handleKeydown);

    // Print welcome
    printBanner();
  }

  /* ---------- Open / Close ---------- */
  function openTerminal() {
    if (isOpen) return;
    isOpen = true;
    overlay.classList.add('active');
    inputEl.value = '';
    inputEl.focus();
  }

  function closeTerminal() {
    if (!isOpen) return;
    isOpen = false;
    overlay.classList.remove('active');
    clearTimeout(typeTimer);
  }

  function toggleTerminal() {
    isOpen ? closeTerminal() : openTerminal();
  }

  /* ---------- Print Helpers ---------- */
  function printLine(text, cls) {
    const div = document.createElement('div');
    div.className = 'terminal-line' + (cls ? ' terminal-line--' + cls : '');
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  function printHTML(html) {
    const div = document.createElement('div');
    div.className = 'terminal-line';
    div.innerHTML = html;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  function printLines(lines, cls) {
    lines.forEach((l) => printLine(l, cls));
  }

  function printBanner() {
    ASCII_BANNER.forEach((l) => printLine(l, 'accent'));
    WELCOME_MSG.forEach((l) => printLine(l, 'dim'));
  }

  /** Typewriter effect — prints lines one-by-one with a delay */
  function typeLines(lines, cls, delay, cb) {
    let i = 0;
    function next() {
      if (i >= lines.length) {
        if (cb) cb();
        return;
      }
      printLine(lines[i], cls);
      i++;
      typeTimer = setTimeout(next, delay || 30);
    }
    next();
  }

  /* ---------- Input Handling ---------- */
  function handleKeydown(e) {
    // Tab completion
    if (e.key === 'Tab') {
      e.preventDefault();
      tabComplete();
      return;
    }

    // History
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      if (historyIdx < history.length - 1) historyIdx++;
      inputEl.value = history[history.length - 1 - historyIdx];
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx > 0) {
        historyIdx--;
        inputEl.value = history[history.length - 1 - historyIdx];
      } else {
        historyIdx = -1;
        inputEl.value = '';
      }
      return;
    }

    // Submit
    if (e.key === 'Enter') {
      e.preventDefault();
      const raw = inputEl.value.trim();
      inputEl.value = '';
      historyIdx = -1;

      // Echo command
      printHTML(
        '<span style="color:var(--accent);font-weight:600;">stephen@lyons:~$</span> ' +
          escapeHTML(raw)
      );

      if (!raw) return;

      history.push(raw);

      const parts = raw.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      if (COMMANDS[cmd]) {
        COMMANDS[cmd].fn(args);
      } else {
        printLine(`Command not found: ${cmd}. Type "help" for available commands.`, 'dim');
      }
    }
  }

  function tabComplete() {
    const val = inputEl.value.toLowerCase();
    if (!val) return;
    const matches = Object.keys(COMMANDS).filter((c) => c.startsWith(val));
    if (matches.length === 1) {
      inputEl.value = matches[0] + ' ';
    } else if (matches.length > 1) {
      printLine('  ' + matches.join('  '), 'dim');
    }
  }

  function escapeHTML(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  /* ---------- Commands ---------- */
  function cmdHelp() {
    printLine('');
    printLine('Available commands:', 'accent');
    printLine('');
    Object.entries(COMMANDS).forEach(([name, c]) => {
      if (name === 'close') return; // skip alias
      const pad = name.padEnd(14);
      printLine(`  ${pad} ${c.desc}`, '');
    });
    printLine('');
    printLine('Tip: use Tab for auto-completion, ↑/↓ for history.', 'dim');
    printLine('');
  }

  function cmdWhoami() {
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
    typeLines(lines, '', 25);
  }

  function cmdLs(args) {
    if (args[0] === 'pages' || args.length === 0) {
      printLine('');
      printLine('  Pages:', 'accent');
      Object.entries(PAGES).forEach(([name, file]) => {
        if (name === 'index') return;
        printLine(`    ${name.padEnd(12)} → ${file}`);
      });
      printLine('');
    } else {
      printLine(`ls: cannot access '${args[0]}': No such directory`, 'dim');
    }
  }

  function cmdCd(args) {
    const target = (args[0] || '').toLowerCase();
    if (!target) {
      printLine('Usage: cd <page>  (e.g., cd about)', 'dim');
      return;
    }
    const file = PAGES[target];
    if (file) {
      printLine(`Navigating to ${target}...`, 'accent');
      setTimeout(() => {
        window.location.href = file;
      }, 400);
    } else {
      printLine(`Page not found: ${target}. Use "ls pages" to see available pages.`, 'dim');
    }
  }

  function cmdSkills() {
    const categories = [
      {
        title: 'Languages',
        items: 'TypeScript, Python, JavaScript, HTML5, CSS, Rust, PHP, Java, C++, C#',
      },
      {
        title: 'Frameworks & Tools',
        items: 'React.js, Next.js, React Native, Node.js, Docker, Git, Linux/UNIX, Unity, Adobe Suite',
      },
      {
        title: 'Security Tools',
        items: 'CrowdStrike, Netskope, Zscaler, Azure, Intune, Infrastrcture as Code, GitHub Enterprise, SIEM, EDR, DLP',
      },
      {
        title: 'Cloud Platforms',
        items: 'AWS, Azure, Google Cloud, Firebase, Vercel',
      },
    ];
    printLine('');
    categories.forEach((cat) => {
      printLine(`  ┌─ ${cat.title}`, 'accent');
      printLine(`  │  ${cat.items}`);
      printLine('  └──────────────────────');
      printLine('');
    });
  }

  function cmdProjects() {
    const projects = [
      {
        name: 'Thumbo.app',
        desc: 'Stadium & fan entertainment platform — chatting, trivia, polls',
        tech: 'Next.js, TypeScript, TailwindCSS, Firebase, AWS',
      },
      {
        name: 'FooDood',
        desc: 'Food-finding swiper mobile app with personalized dish recommendations',
        tech: 'React Native, Expo, Next.js, Google Cloud, Firebase',
      },
      {
        name: 'Portfolio Site',
        desc: 'This very site — terminal-themed cybersecurity portfolio',
        tech: 'HTML, CSS, Vanilla JS, GitHub Actions',
      },
    ];
    printLine('');
    projects.forEach((p) => {
      printLine(`  > ${p.name}`, 'accent');
      printLine(`    ${p.desc}`);
      printLine(`    Tech: ${p.tech}`, 'dim');
      printLine('');
    });
  }

  function cmdExperience() {
    const jobs = [
      {
        period: 'Aug 2023 – Present',
        role: 'Cybersecurity Engineer',
        org: 'Yamaha Motor Corporation, Cypress, CA',
        highlights: [
          'Manages on-prem and cloud security operations',
          'Implements DevSecOps practices using GitHub Actions & GitHub Enterprise',
          'Develops infrastructure as code using Infrastrcture as Code',
          'Oversees CrowdStrike, Netskope, Zscaler deployments',
          'Manages Azure infrastructure, groups, and Intune MDM',
          'Builds & maintains CI/CD pipelines with security checks',
          'Develops SIEM platforms for real-time threat detection',
        ],
      },
      {
        period: 'May 2022 – Aug 2022',
        role: 'Business Application Development Intern',
        org: 'Yamaha Motor Corporation, Cypress, CA',
        highlights: [
          'Designed testing methods for code and data quality',
          'Developed SAP programs using ABAP',
          'Utilized Python and React.js for business applications',
        ],
      },
      {
        period: 'Feb 2020 – May 2022 & Oct 2022 – Jul 2023',
        role: 'Web Developer',
        org: 'Associated Students Inc., Long Beach, CA',
        highlights: [
          'Led team of graduate student developers',
          'Improved websites with SEO and daily content updates',
          'Developed React.js quiz game during COVID-19',
        ],
      },
      {
        period: 'May 2021 – Jan 2022',
        role: 'Lead Security Engineer',
        org: 'Down (joindown.com), Remote',
        highlights: [
          'Coordinated Android & iOS testing for React Native app',
          'Developed Firebase security rules',
          'Tested application using Jest and Detox',
        ],
      },
      {
        period: 'Jul 2018 – Jun 2019',
        role: 'Intern / Laser Technician',
        org: 'M.R. Mold and Engineering, Brea, CA',
        highlights: [
          'Founded internship program',
          'Produced laser-engraved products',
          'Developed QC software for precision parts',
        ],
      },
    ];

    printLine('');
    jobs.forEach((j) => {
      printLine(`  ╔══ ${j.period}`, 'dim');
      printLine(`  ║  ${j.role}`, 'accent');
      printLine(`  ║  ${j.org}`);
      j.highlights.forEach((h) => printLine(`  ║  > ${h}`, 'dim'));
      printLine('  ╚══════════════════════════════');
      printLine('');
    });
  }

  function cmdEducation() {
    printLine('');
    printLine('  ┌─────────────────────────────────────────────────┐', 'accent');
    printLine('  │  California State University, Long Beach        │', 'accent');
    printLine('  │  B.S. Computer Science — Aug 2019 – May 2023   │', '');
    printLine('  │  Minor: Cyber Security Applications             │', '');
    printLine('  └─────────────────────────────────────────────────┘', 'accent');
    printLine('');
    printLine('  Relevant Courses:', 'accent');
    const courses = [
      'Algorithms', 'Data Structures', 'Computer Security I & II',
      'Networks & Network Security', 'Machine Learning',
      'Cybersecurity in Business', 'Artificial Intelligence',
      'Digital Forensics', 'OOP', 'Software Engineering', 'Databases',
    ];
    courses.forEach((c) => printLine(`    • ${c}`));
    printLine('');
    printLine('  Activities:', 'accent');
    const activities = [
      'CSULB ACM (Webmaster)', 'CSULB Cybersecurity Club',
      'CSULB Jiu Jitsu Club', 'CSULB Snow and Ski Club', 'BeachHacks 2023',
    ];
    activities.forEach((a) => printLine(`    • ${a}`));
    printLine('');
  }

  function cmdContact() {
    printLine('');
    printLine('  ┌─ Contact Info', 'accent');
    printLine('  │');
    printLine('  │  Email     stephen.lyons18@gmail.com');
    printLine('  │  Website   stephenlyons.dev');
    printLine('  │  Location  Southern California');
    printLine('  │');
    printLine('  │  GitHub   github.com/stephenlyons18');
    printLine('  │  LinkedIn linkedin.com/in/stephen-lyons');
    printLine('  │');
    printLine('  └──────────────────────');
    printLine('');
  }

  function cmdClear() {
    body.innerHTML = '';
  }

  function cmdExit() {
    closeTerminal();
  }

  function cmdTheme(args) {
    const themes = ['green', 'cyan', 'amber'];
    const t = (args[0] || '').toLowerCase();
    if (!themes.includes(t)) {
      printLine(`Usage: theme <${themes.join('|')}>`, 'dim');
      printLine(`Current theme: ${document.documentElement.getAttribute('data-theme') || 'green'}`, 'dim');
      return;
    }
    if (t === 'green') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', t);
    }
    printLine(`Theme switched to ${t}.`, 'accent');
    // Persist
    try { localStorage.setItem('sl-theme', t); } catch (e) { /* noop */ }
  }

  function cmdMatrix() {
    printLine('Initiating Matrix rain sequence...', 'accent');
    triggerMatrixEasterEgg();
  }

  function cmdSudo() {
    const responses = [
      'Nice try. 😏',
      'Access denied. This incident will be reported.',
      'You are not in the sudoers file. This incident has been reported to Santa.',
      'sudo: I appreciate the ambition, but no.',
      'Error 403: You thought. 🤨',
      'Permission denied. Stephen is the only admin here.',
    ];
    printLine(responses[Math.floor(Math.random() * responses.length)], 'accent');
  }

  /* ---------- Matrix Rain Easter Egg ---------- */
  function triggerMatrixEasterEgg() {
    let canvas = document.getElementById('matrix-easter-egg');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'matrix-easter-egg';
      document.body.appendChild(canvas);
    }
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.classList.add('active');

    const cols = Math.floor(canvas.width / 18);
    const drops = Array(cols).fill(1);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()ァカサタナハマヤラワ';

    let frame = 0;
    const maxFrames = 180; // ~3 seconds at 60fps

    function draw() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00FF41';
      ctx.font = '15px JetBrains Mono, monospace';

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * 18, drops[i] * 18);
        if (drops[i] * 18 > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
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

  /* ---------- Global Keybinding ---------- */
  document.addEventListener('keydown', (e) => {
    // Ctrl+K or Cmd+K
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      toggleTerminal();
      return;
    }
    // Esc to close
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      closeTerminal();
    }
  });

  /* ---------- Init ---------- */
  function init() {
    buildTerminal();

    // Restore theme
    try {
      const saved = localStorage.getItem('sl-theme');
      if (saved && saved !== 'green') {
        document.documentElement.setAttribute('data-theme', saved);
      }
    } catch (e) { /* noop */ }

    // Expose open function for nav hint button
    window.openTerminal = openTerminal;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
