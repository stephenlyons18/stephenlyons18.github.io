// Navigation menu and scroll progress functionality
class Navigation {
  constructor() {
    this.init();
  }

  init() {
    this.createScrollProgress();
    this.createNavMenu();
    this.createTerminalHint();
    this.setupScrollListener();
    this.setupTerminalToggle();
    this.setCurrentPage();
  }

  createScrollProgress() {
    const progressBar = document.createElement('div');
    progressBar.className = 'scroll-progress';
    progressBar.id = 'scroll-progress';
    document.body.prepend(progressBar);
  }

  createTerminalHint() {
    const terminalHint = document.createElement('div');
    terminalHint.className = 'terminal-hint';
    terminalHint.innerHTML = `
      <span class="key-combo">Ctrl+K</span> to toggle terminal
    `;
    
    document.body.appendChild(terminalHint);
    
    // Make hint clickable
    terminalHint.addEventListener('click', () => {
      this.toggleTerminal();
    });
  }

  setupTerminalToggle() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        this.toggleTerminal();
      }
    });
  }

  toggleTerminal() {
    const terminal = document.getElementById('terminal-container');
    if (terminal) {
      terminal.classList.toggle('active');
      
      // Initialize terminal on first open
      if (terminal.classList.contains('active') && window.initTerminalManually) {
        window.initTerminalManually();
        // Focus on terminal input
        setTimeout(() => {
          const input = terminal.querySelector('.terminal-input');
          if (input) {
            input.focus();
          }
        }, 300);
      }
    }
  }

  createNavMenu() {
    const navMenu = document.createElement('nav');
    navMenu.className = 'nav-menu';
    navMenu.innerHTML = `
      <button class="menu-toggle" id="menu-toggle">
        <span>MENU</span>
      </button>
      <div class="menu-items" id="menu-items">
        <a href="index.html" data-page="index">Home</a>
        <a href="about.html" data-page="about">About</a>
        <a href="projects.html" data-page="projects">Projects</a>
        <a href="contact.html" data-page="contact">Contact</a>
        <a href="admin.html" data-page="admin">Admin</a>
      </div>
    `;

    document.body.appendChild(navMenu);

    // Add menu toggle functionality
    const menuToggle = document.getElementById('menu-toggle');
    const menuItems = document.getElementById('menu-items');

    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      navMenu.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!navMenu.contains(e.target)) {
        navMenu.classList.remove('active');
      }
    });

    // Handle navigation with smooth transitions
    const menuLinks = navMenu.querySelectorAll('a');
    menuLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const href = link.getAttribute('href');
        
        // Use page transition if available
        if (window.navigateToPage) {
          window.navigateToPage(href);
        } else {
          window.location.href = href;
        }
        
        navMenu.classList.remove('active');
      });
    });
  }

  setupScrollListener() {
    let ticking = false;

    const updateScrollProgress = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = (scrollTop / scrollHeight) * 100;
      
      const progressBar = document.getElementById('scroll-progress');
      if (progressBar) {
        progressBar.style.width = `${Math.min(scrollPercent, 100)}%`;
      }
      
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateScrollProgress);
        ticking = true;
      }
    });

    // Initial call
    updateScrollProgress();
  }

  setCurrentPage() {
    const currentPath = window.location.pathname;
    let currentPage = 'index';
    
    if (currentPath.includes('about')) currentPage = 'about';
    else if (currentPath.includes('projects')) currentPage = 'projects';
    else if (currentPath.includes('contact')) currentPage = 'contact';
    else if (currentPath.includes('admin')) currentPage = 'admin';
    
    // Highlight current page in menu
    setTimeout(() => {
      const menuLinks = document.querySelectorAll('.menu-items a');
      menuLinks.forEach(link => {
        link.classList.remove('current');
        if (link.getAttribute('data-page') === currentPage) {
          link.classList.add('current');
        }
      });
    }, 100);
  }
}

// Initialize navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new Navigation();
});

// Enhanced keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Alt + M to toggle menu
  if (e.altKey && e.key === 'm') {
    e.preventDefault();
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) {
      navMenu.classList.toggle('active');
    }
  }
  
  // Escape to close menu
  if (e.key === 'Escape') {
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) {
      navMenu.classList.remove('active');
    }
  }
});
