// Vanilla JS Terminal Emulator for Cyberpunk Portfolio
const terminal = document.getElementById('terminal');
let history = [];
let historyIndex = 0;
let currentPage = 'index';
let commands = ['ls', 'cat', 'cd', 'whoami', 'help', 'clear', 'pwd', 'tree', 'exit', 'sudo', 'ssh', 'nmap'];
let pages = ['index', 'about', 'projects', 'contact', 'admin'];
let prompt = 'user@cybersec-portfolio:~$ ';
let typingSpeed = 18;

function typeWriter(text, callback) {
  let i = 0;
  function type() {
    if (i < text.length) {
      terminal.innerHTML += text.charAt(i);
      i++;
      setTimeout(type, typingSpeed);
    } else {
      terminal.innerHTML += '\n';
      if (callback) callback();
    }
  }
  type();
}

function printOutput(text) {
  typeWriter(text, () => showPrompt());
}

function showPrompt() {
  terminal.innerHTML += `<span class='terminal-prompt'>${prompt}</span><input class='terminal-input' autofocus />`;
  const input = terminal.querySelector('.terminal-input:last-of-type');
  input.focus();
  input.addEventListener('keydown', handleInput);
}

function handleInput(e) {
  const input = e.target;
  if (e.key === 'Enter') {
    let cmd = input.value.trim();
    history.push(cmd);
    historyIndex = history.length;
    terminal.innerHTML += cmd + '\n';
    input.remove();
    runCommand(cmd);
  } else if (e.key === 'ArrowUp') {
    if (historyIndex > 0) {
      historyIndex--;
      input.value = history[historyIndex] || '';
    }
  } else if (e.key === 'ArrowDown') {
    if (historyIndex < history.length - 1) {
      historyIndex++;
      input.value = history[historyIndex] || '';
    } else {
      input.value = '';
    }
  } else if (e.key === 'Tab') {
    e.preventDefault();
    let val = input.value;
    let matches = commands.concat(pages).filter(c => c.startsWith(val));
    if (matches.length === 1) {
      input.value = matches[0] + ' ';
    } else if (matches.length > 1) {
      printOutput(matches.join('  '));
    }
  }
}

function runCommand(cmd) {
  let args = cmd.split(' ');
  switch (args[0]) {
    case 'ls':
      printOutput(pages.join('  '));
      break;
    case 'cat':
    case 'cd':
      if (args[1] && pages.includes(args[1])) {
        const targetUrl = args[1] === 'index' ? 'index.html' : args[1] + '.html';
        // Use smooth transition if available, otherwise fallback to direct navigation
        if (window.navigateToPage) {
          window.navigateToPage(targetUrl);
        } else {
          window.location.href = targetUrl;
        }
        printOutput('Navigating to ' + args[1] + '...');
      } else {
        printOutput('Usage: ' + args[0] + ' [page]\nAvailable pages: ' + pages.join(', '));
      }
      break;
    case 'whoami':
      printOutput('Stephen Lyons\nCyber Security Operations Engineer @ Yamaha Motor Corporation\nLocation: Cypress, California\nSpecialties: AWS Security, SIEM Engineering, DevSecOps, Incident Response\nClearance: DevSecOps Automation Specialist\nTenure: 2+ years in cybersecurity operations');
      break;
    case 'help':
      printOutput('Available commands:\n' +
                  'ls          - list available pages\n' +
                  'cat [page]  - navigate to page\n' +
                  'cd [page]   - change directory/navigate\n' +
                  'whoami      - display user info\n' +
                  'pwd         - show current location\n' +
                  'tree        - display site structure\n' +
                  'clear       - clear terminal\n' +
                  'exit        - minimize terminal\n' +
                  'sudo        - attempt privilege escalation\n' +
                  'ssh         - attempt remote connection\n' +
                  'nmap        - network scan\n' +
                  'history     - show command history');
      break;
    case 'clear':
      terminal.innerHTML = '';
      showPrompt();
      return;
    case 'pwd':
      printOutput('/var/www/cybersec-portfolio/' + currentPage + '.html');
      break;
    case 'tree':
      printOutput('cybersec-portfolio/\n' +
                  '├── index.html\n' +
                  '├── about.html\n' +
                  '├── projects.html\n' +
                  '├── contact.html\n' +
                  '├── admin.html (restricted)\n' +
                  '├── assets/\n' +
                  '│   ├── css/\n' +
                  '│   ├── js/\n' +
                  '│   └── img/\n' +
                  '└── errors/\n' +
                  '    ├── 404.html\n' +
                  '    ├── 403.html\n' +
                  '    └── 500.html');
      break;
    case 'exit':
      document.getElementById('terminal-container').classList.add('terminal-hidden');
      printOutput('Terminal minimized. Refresh page to restore.');
      break;
    case 'history':
      if (history.length > 0) {
        printOutput('Command history:\n' + history.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n'));
      } else {
        printOutput('No command history available.');
      }
      break;
    case 'sudo':
      printOutput('sudo: Permission denied\n[SECURITY ALERT] Unauthorized privilege escalation attempt logged\nIncident ID: SEC-' + Date.now());
      break;
    case 'ssh':
      printOutput('ssh: Attempting connection to remote host...\nConnection timeout after 30 seconds\nssh: connect to host failed: No route to host');
      break;
    case 'nmap':
      printOutput('Starting Nmap 7.94 ( https://nmap.org ) at ' + new Date().toLocaleString() + '\n' +
                  'Nmap scan report for cybersec-portfolio.local (127.0.0.1)\n' +
                  'Host is up (0.00024s latency).\n' +
                  'Not shown: 997 filtered ports\n' +
                  'PORT    STATE SERVICE\n' +
                  '22/tcp  open  ssh\n' +
                  '80/tcp  open  http\n' +
                  '443/tcp open  https\n\n' +
                  'Nmap done: 1 IP address (1 host up) scanned in 2.45 seconds');
      break;
    case 'hack':
      printOutput('Initializing hacking protocol...\n[████████████████████████] 100%\n\nJust kidding! This is a portfolio site, not a hacking tool. 😉');
      break;
    default:
      printOutput('Command not found: ' + cmd + '\nType "help" for available commands.');
  }
}

// Initialize terminal and set current page
function initTerminal() {
  // Detect current page from URL
  const path = window.location.pathname;
  if (path.includes('about')) currentPage = 'about';
  else if (path.includes('projects')) currentPage = 'projects';
  else if (path.includes('contact')) currentPage = 'contact';
  else if (path.includes('admin')) currentPage = 'admin';
  else currentPage = 'index';
  
  // Show welcome message
  terminal.innerHTML = `<div class="terminal-output">Welcome to Stephen Lyons'  Terminal Interface v2.1.7</div>
<div class="terminal-output">Current location: /${currentPage}.html</div>
<div class="terminal-output">Type "help" for available commands</div>
<div class="terminal-output">Security status: <span class="neon-green">SECURE</span></div>
<div class="terminal-output">Environment: <span class="neon-blue">Yamaha Motor Corporation</span></div>\n`;
  
  showPrompt();
}

// Initialize terminal when manually activated
window.initTerminalManually = initTerminal;

// Easter egg: Konami code
let konami = [38,38,40,40,37,39,37,39,66,65];
let konamiIndex = 0;
document.addEventListener('keydown', function(e) {
  if (e.keyCode === konami[konamiIndex]) {
    konamiIndex++;
    if (konamiIndex === konami.length) {
      printOutput('Easter Egg: You found the Konami code!');
      konamiIndex = 0;
    }
  } else {
    konamiIndex = 0;
  }
});
