# Stephen Lyons — Cybersecurity Portfolio

A terminal-themed cybersecurity portfolio website built with pure HTML, CSS, and vanilla JavaScript. Features an interactive terminal overlay, Matrix rain backgrounds, CRT scanline effects, and GitHub Actions DevSecOps workflows.

**Live Site:** [stephenlyons.dev](https://stephenlyons.dev)

---

## Features

- **Terminal Aesthetic** — Dark backgrounds, phosphor green accents, scanline overlays, monospace typography, and CRT-inspired UI
- **Interactive Terminal (Ctrl+K)** — Fully functional in-browser terminal with 15+ commands, tab completion, command history, and theme switching
- **Matrix Rain** — Canvas-based animated matrix rain background
- **Boot Sequence** — Terminal boot animation on first page load
- **Responsive Design** — Mobile, tablet, and desktop with hamburger navigation
- **GitHub Actions CI/CD** — Secret scanning, code formatting, and broken link checking
- **Zero Build Tools** — Pure HTML/CSS/JS, deployable directly to GitHub Pages

---

## Pages

| Page | File | Description |
|------|------|-------------|
| Home | `index.html` | Hero terminal animation, featured projects, capabilities overview |
| About | `about.html` | Bio, skills matrix, work history timeline, education |
| Projects | `projects.html` | Detailed project showcase with tech stacks and links |
| DevSecOps | `devsecops.html` | GitHub Actions workflow documentation |
| Contact | `contact.html` | Contact form, social links, and professional profiles |
| 404 | `404.html` | Terminal-themed error page |

---

## Local Development

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- A local HTTP server (any of the options below)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/stephenlyons/portfolio.git
cd portfolio

# Option 1: Python (built-in)
python3 -m http.server 8000

# Option 2: Node.js
npx serve .

# Option 3: PHP
php -S localhost:8000

# Option 4: VS Code
# Install the "Live Server" extension and click "Go Live"
```

Then open [http://localhost:8000](http://localhost:8000) in your browser.

> **Note:** Opening `index.html` directly as a file (`file://`) will work for most features, but a local server is recommended for the best experience.

---

## Project Structure

```
portfolio/
├── index.html              # Homepage
├── about.html              # About page
├── projects.html           # Projects showcase
├── devsecops.html          # DevSecOps workflows
├── contact.html            # Contact page
├── 404.html                # 404 error page
├── styles.css              # Shared stylesheet (terminal theme)
├── terminal.js             # Interactive terminal module
├── main.js                 # Site interactivity & animations
├── README.md               # This file
└── .github/
    └── workflows/
        ├── secret-scanning.yml   # TruffleHog secret scanning
        ├── code-formatting.yml   # Prettier formatting check
        └── link-checker.yml      # Broken link detection
```

---

## Interactive Terminal

Press **Ctrl+K** (or **⌘+K** on Mac) from any page to open the interactive terminal.

### Available Commands

| Command | Description |
|---------|-------------|
| `help` | List all available commands |
| `whoami` | Print a short bio |
| `ls pages` | List all pages on the site |
| `cd <page>` / `goto <page>` | Navigate to a page |
| `skills` | Display skills matrix |
| `projects` | List all projects |
| `experience` | Print work history timeline |
| `education` | Print education details |
| `contact` | Display contact info |
| `clear` | Clear the terminal screen |
| `exit` / `close` | Close the terminal |
| `theme <green\|cyan\|amber>` | Switch accent color |
| `matrix` | Trigger Matrix rain easter egg |
| `sudo` | Nice try. |

### Features

- **Tab completion** for command names
- **Command history** navigation with ↑/↓ arrow keys
- **Blinking cursor** and typewriter output effect
- **Dismissible** via Escape key or clicking outside
- **Works on all pages** without page reload

---

## GitHub Actions Workflows

### 1. Secret Scanning (`.github/workflows/secret-scanning.yml`)

**Purpose:** Detect accidentally committed secrets (API keys, tokens, passwords) before they reach the main branch.

- **Tool:** [TruffleHog](https://github.com/trufflesecurity/trufflehog)
- **Triggers:** Push to `main`/`master`, all pull requests
- **Behavior:** Fails the pipeline on detected secrets and annotates PRs with findings

### 2. Code Formatting (`.github/workflows/code-formatting.yml`)

**Purpose:** Enforce consistent code style across HTML, CSS, and JavaScript.

- **Tool:** [Prettier](https://prettier.io/)
- **Triggers:** Pull requests modifying `.html`, `.css`, or `.js` files
- **Behavior:** Fails on formatting violations with a diff showing what to fix
- **Fix locally:** `npx prettier --write .`

### 3. Broken Link Checker (`.github/workflows/link-checker.yml`)

**Purpose:** Detect broken internal and external links across all HTML files.

- **Tool:** [lychee](https://github.com/lycheeverse/lychee)
- **Triggers:** Weekly (Mondays at 9 AM UTC), push to `main`
- **Behavior:** Creates a GitHub Issue with a report of broken links

---

## Enabling GitHub Advanced Security

For maximum protection, enable these features in your repository settings:

1. Go to **Settings → Code security and analysis**
2. Enable **Dependency graph** — vulnerability scanning for dependencies
3. Enable **Dependabot alerts** — notifications for vulnerable dependencies
4. Enable **Dependabot security updates** — automated fix PRs
5. Enable **Code scanning (CodeQL)** — static analysis of your codebase
6. Enable **Secret scanning** — native GitHub secret detection (complements TruffleHog)
7. Enable **Push protection** — blocks secrets at push time before they enter git history

---

## Deployment to GitHub Pages

### Automatic Deployment

1. Push this repository to GitHub
2. Go to **Settings → Pages**
3. Under **Source**, select **Deploy from a branch**
4. Select the `main` branch and `/ (root)` folder
5. Click **Save**
6. Your site will be live at `https://<username>.github.io/<repo>/`

### Custom Domain

1. In **Settings → Pages**, enter your custom domain (e.g., `stephenlyons.dev`)
2. Add the following DNS records with your domain provider:
   - `A` records pointing to GitHub Pages IPs:
     ```
     185.199.108.153
     185.199.109.153
     185.199.110.153
     185.199.111.153
     ```
   - `CNAME` record: `www` → `<username>.github.io`
3. Check **Enforce HTTPS**
4. Create a `CNAME` file in the repo root containing your domain:
   ```
   stephenlyons.dev
   ```

---

## Theme Switching

The site supports three accent color themes, switchable via the terminal command:

```
theme green   # Phosphor green (default)
theme cyan    # Electric cyan
theme amber   # Warm amber
```

The selected theme persists across page loads via `localStorage`.

---

## License

© 2026 Stephen Lyons. All rights reserved.
