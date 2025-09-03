// Smooth page transitions for cybersec portfolio
class PageTransition {
  constructor() {
    this.init();
  }

  init() {
    // Add transition styles
    this.addTransitionStyles();
    
    // Handle all navigation links
    this.bindNavigationEvents();
    
    // Handle browser back/forward
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.url) {
        this.navigateToPage(e.state.url, false);
      }
    });

    // Set initial state
    history.replaceState({ url: window.location.href }, '', window.location.href);
  }

  addTransitionStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .page-fade-out {
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.3s ease-out, transform 0.3s ease-out;
      }
      
      .page-fade-in {
        opacity: 1;
        transform: translateY(0);
        transition: opacity 0.4s ease-in, transform 0.4s ease-in;
      }
      
      .terminal-transition {
        transform: scale(0.95);
        opacity: 0.7;
        transition: transform 0.3s ease, opacity 0.3s ease;
      }
    `;
    document.head.appendChild(style);
  }

  bindNavigationEvents() {
    // Bind all links that navigate between pages
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (link && this.isInternalLink(link.href)) {
        e.preventDefault();
        this.navigateToPage(link.href, true);
      }
    });
  }

  isInternalLink(href) {
    // Check if it's an internal navigation link
    const url = new URL(href, window.location.origin);
    const currentHost = window.location.hostname;
    const linkHost = url.hostname;
    
    // Only handle same-domain HTML pages
    return linkHost === currentHost && 
           (href.endsWith('.html') || 
            href === '/' || 
            href === window.location.origin + '/' ||
            href.includes('index.html') ||
            href.includes('about.html') ||
            href.includes('projects.html') ||
            href.includes('contact.html') ||
            href.includes('admin.html'));
  }

  async navigateToPage(url, addToHistory = true) {
    try {
      // Start fade out animation
      document.body.classList.add('page-fade-out');
      const terminal = document.getElementById('terminal-container');
      if (terminal) {
        terminal.classList.add('terminal-transition');
      }

      // Wait for fade out
      await this.wait(300);

      // Fetch new page content
      const response = await fetch(url);
      if (!response.ok) throw new Error('Page not found');
      
      const html = await response.text();
      const parser = new DOMParser();
      const newDoc = parser.parseFromString(html, 'text/html');

      // Update page content
      this.updatePageContent(newDoc);

      // Update URL and history
      if (addToHistory) {
        history.pushState({ url: url }, '', url);
      }

      // Update current page variable for terminal
      this.updateCurrentPage(url);

      // Wait a bit then fade in
      await this.wait(50);
      
      // Start fade in animation
      document.body.classList.remove('page-fade-out');
      document.body.classList.add('page-fade-in');
      
      if (terminal) {
        terminal.classList.remove('terminal-transition');
      }

      // Re-initialize terminal with new page context
      if (window.initTerminal) {
        window.initTerminal();
      }

      // Re-bind any page-specific events
      this.reinitializePageScripts(newDoc);

    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback to normal navigation
      window.location.href = url;
    }
  }

  updatePageContent(newDoc) {
    // Update title
    document.title = newDoc.title;

    // Update main content
    const currentMain = document.querySelector('main');
    const newMain = newDoc.querySelector('main');
    if (currentMain && newMain) {
      currentMain.innerHTML = newMain.innerHTML;
    }

    // Update header if it exists and is different
    const currentHeader = document.querySelector('header');
    const newHeader = newDoc.querySelector('header');
    if (currentHeader && newHeader) {
      currentHeader.innerHTML = newHeader.innerHTML;
    }

    // Update any page-specific elements
    const currentPageContainer = document.querySelector('.page-container');
    const newPageContainer = newDoc.querySelector('.page-container');
    if (currentPageContainer && newPageContainer) {
      currentPageContainer.innerHTML = newPageContainer.innerHTML;
    }
  }

  updateCurrentPage(url) {
    // Update the global currentPage variable for terminal
    if (window.currentPage !== undefined) {
      if (url.includes('about')) window.currentPage = 'about';
      else if (url.includes('projects')) window.currentPage = 'projects';
      else if (url.includes('contact')) window.currentPage = 'contact';
      else if (url.includes('admin')) window.currentPage = 'admin';
      else window.currentPage = 'index';
    }
  }

  reinitializePageScripts(newDoc) {
    // Look for page-specific scripts and re-execute them
    const scripts = newDoc.querySelectorAll('script');
    scripts.forEach(script => {
      if (script.textContent && !script.src) {
        // Only execute inline scripts that look page-specific
        if (script.textContent.includes('addEventListener') || 
            script.textContent.includes('getElementById') ||
            script.textContent.includes('querySelector')) {
          try {
            eval(script.textContent);
          } catch (e) {
            console.warn('Script execution error:', e);
          }
        }
      }
    });
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize page transitions when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PageTransition();
});

// Export for terminal navigation
window.navigateToPage = function(url) {
  if (window.pageTransition) {
    window.pageTransition.navigateToPage(url, true);
  } else {
    window.location.href = url;
  }
};
