# Copilot Instructions

## ⚠️ Top priorities (read before doing anything else)

### 1. Mobile-first — HIGHEST PRIORITY

Every feature, layout change, and new component must work correctly on mobile before desktop is considered. The site is frequently viewed on small screens.

- Design for 320px–430px viewport widths first, then scale up.
- Touch targets must be ≥ 44×44 px.
- Avoid hover-only interactions — pair every hover state with a tap/focus equivalent.
- Test responsive breakpoints at 375px (iPhone SE), 390px (iPhone 14), 768px (tablet), and 1280px+ (desktop) for every UI change.
- Canvas animations (`matrix-canvas`, `SkillGraph`) must degrade gracefully on mobile — reduce particle counts, disable non-essential animation on `prefers-reduced-motion`, and never block the main thread.

### 2. Performance and efficiency

- Keep the site fast. It is statically deployed with minimal server infrastructure.
- Prefer static Astro components over hydrated React islands. Only add `client:load` when interactivity genuinely requires it.
- Images must be appropriately sized; avoid loading full-resolution images on mobile.
- Avoid large synchronous computations on the main thread — use `requestAnimationFrame`, `requestIdleCallback`, or Web Workers for heavy work (e.g. D3-force simulations).
- When writing algorithms, prefer O(n log n) or better; document complexity when it matters.
- Measure before optimising: use Lighthouse or browser DevTools Performance tab to validate claims.

### 3. Security — OWASP Top 10

Apply the OWASP Top 10 to all code changes:

| OWASP | Applied here |
|---|---|
| A01 Broken Access Control | N/A (static site, no auth) |
| A02 Cryptographic Failures | Never embed secrets; use HTTPS only; no sensitive data client-side |
| A03 Injection | Sanitize any dynamic content injected into the DOM; never use `innerHTML` with untrusted input |
| A04 Insecure Design | Validate all external inputs (form fields, URL params) before use |
| A05 Security Misconfiguration | Keep `Content-Security-Policy`, `X-Frame-Options`, and other security headers configured correctly |
| A06 Vulnerable Components | Keep dependencies up to date; review Dependabot alerts promptly |
| A07 Auth Failures | N/A (no auth) |
| A08 Software and Data Integrity | Verify third-party scripts; prefer subresource integrity (SRI) for CDN assets |
| A09 Logging Failures | Do not log sensitive data to the browser console in production |
| A10 SSRF | N/A (static site) |

Never commit secrets, tokens, or credentials. The `trufflehog.yml` workflow will catch them, but prevention is better.

---

## Repository layout

This repo has two layers:

- **Root** (`index.html`, `styles.css`, `main.js`, `terminal.js`) — legacy static site, kept for reference but no longer deployed.
- **`astro-portfolio/`** — the active site. All work should happen here. The build output goes to the `build` branch (not `gh-pages`), which GitHub Pages serves.

## Build commands

All commands run from `astro-portfolio/`:

```bash
npm run dev        # esbuild scripts → astro dev server
npm run build      # esbuild → astro build → postbuild.mjs (URL relativization)
npm run preview    # serve the dist/ output locally
```

There is no test suite.

### Prettier (formatting)

Prettier auto-formats on every successful deploy via CI. To run locally:

```bash
cd astro-portfolio
npm install --no-save prettier prettier-plugin-astro
npx prettier --write "src/**/*.{astro,ts,tsx,js,mjs,css}" "scripts/**/*.mjs"
```

Config: `tabWidth: 4`, `singleQuote: true`, `trailingComma: all`, `printWidth: 100`, Astro plugin enabled.

## Architecture

### Two bundled script files

`src/scripts/site.ts` and `src/scripts/terminal.ts` are compiled by **esbuild** (not Astro) into IIFE bundles at `public/scripts/`. They are loaded via `<script is:inline>` in `BaseLayout.astro` and run on every page. All other TypeScript lives in Astro/React components and is handled by Astro's bundler.

### React islands — minimal JS

Only three components are hydrated client-side with `client:load`:
- `ScrollProgress.tsx` — thin progress bar
- `ProjectGallery.tsx` — interactive project cards
- `SkillGraph.tsx` — D3-force skill graph (about page)

Everything else is pure static HTML. When adding interactivity, default to vanilla TS in `site.ts` or a new script; only reach for React when component complexity warrants it.

### Content data

All site content lives in typed TypeScript files:
- `src/data/projects.ts` — `Project[]` with `featured`, `featuredTitle`, `featuredDesc`, `featuredTech` overrides for the homepage grid
- `src/data/skills.ts` — `Skill[]` with `weight` (1–10, drives node radius) and `connections` (edges in the skill graph)

To add a project, add an entry to the `projects` array. Set `featured: true` to include it on the homepage.

### postbuild.mjs

After `astro build`, `scripts/postbuild.mjs` rewrites absolute paths in `dist/*.html` to relative paths so the site also opens correctly via `file://`. It patches `href`/`src` attributes and Astro island loader attributes (`component-url`, `renderer-url`, `before-hydration-url`).

### .nojekyll is critical

The `build` branch **must** contain `.nojekyll`. Without it, GitHub Pages runs Jekyll and silently strips the `_astro/` directory, removing all compiled CSS and JS. The deploy workflow enforces this and will abort if `.nojekyll` is not staged.

## CI/CD workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `deploy.yml` | Push/PR to `main`, manual | Builds in `astro-portfolio/`, deploys `dist/` to `build` branch via `git worktree`. PRs get a build check but no deploy. Rolls back `build` branch on failure. |
| `prettier.yml` | After successful deploy | Runs Prettier and commits any formatting changes back to `main` with `[skip ci]`. |
| `health-check.yml` | After successful deploy | Curls all pages on `stephenlyons.dev` and fails if any return unexpected status codes. |
| `trufflehog.yml` | Push/PR to `main` | Scans for accidentally committed secrets. |

## Key conventions

- **Theme system** — the terminal supports `green` / `cyan` / `amber` accent themes stored in `localStorage`. CSS custom properties drive the theme; when adding new styled elements use the existing `--accent` / `--accent-dim` variables.
- **`BaseLayout.astro`** wraps every page. It accepts `fixedFooter`, `fullFooter`, `showHeader`, and `showScrollProgress` props. Set `showScrollProgress={false}` on pages with no scrollable content to avoid loading the React + Motion bundle.
- **Terminal commands** are implemented in `src/scripts/terminal.ts` (Astro site) and `terminal.js` (legacy root). Add new commands to the Astro version only.
- **Images** go in `astro-portfolio/public/images/projects/` and are referenced with absolute paths like `/images/projects/foo.jpg` in `projects.ts` (postbuild relativizes them automatically).
- Node ≥ 22.12.0 is required (`engines` field in `package.json`).

## Documentation references

When working with any of the following technologies, fetch the relevant documentation page before implementing or debugging. Do not rely on training-data knowledge alone for API details — docs may have changed.

| Technology | Primary docs |
|---|---|
| Astro | https://docs.astro.build/en/getting-started/ |
| Astro components | https://docs.astro.build/en/basics/astro-components/ |
| Astro View Transitions | https://docs.astro.build/en/guides/view-transitions/ |
| Astro static output | https://docs.astro.build/en/guides/static-site-generation/ |
| Astro React integration | https://docs.astro.build/en/guides/integrations-guide/react/ |
| Astro client directives | https://docs.astro.build/en/reference/directives-reference/#client-directives |
| TypeScript | https://www.typescriptlang.org/docs/ |
| TypeScript handbook | https://www.typescriptlang.org/docs/handbook/intro.html |
| Motion (animation library) | https://motion.dev/docs |
| Motion React API | https://motion.dev/docs/react-quick-start |
| Motion `animate` (vanilla) | https://motion.dev/docs/animate |
| Tailwind CSS v4 | https://tailwindcss.com/docs/installation |
| Tailwind CSS — Vite plugin | https://tailwindcss.com/docs/installation/using-vite |
| D3-force | https://d3js.org/d3-force |
| D3-force simulation | https://d3js.org/d3-force/simulation |
| D3-force link/charge/center | https://d3js.org/d3-force/link |
| React 19 | https://react.dev/reference/react |
| React hooks | https://react.dev/reference/react/hooks |
| esbuild (script bundler) | https://esbuild.github.io/api/ |
| OWASP Top 10 | https://owasp.org/www-project-top-ten/ |
| MDN Web APIs (canvas, RAF, etc.) | https://developer.mozilla.org/en-US/docs/Web/API |

Fetch the specific sub-page most relevant to the task (e.g. `https://motion.dev/docs/animate` when working on animations, not the root docs URL).

## Output verification

After making changes, verify output using live browser connections wherever possible. Do not assume correctness from static code review alone.

### Local dev server

```bash
cd astro-portfolio
npm run dev    # starts on http://localhost:4321 by default
```

Use browser tools (DevTools → Console, Network, Elements, Lighthouse) to confirm:
- No JS errors in the console
- No failed network requests (404s, blocked resources)
- Layout renders correctly at 375px, 768px, and 1280px widths (use DevTools device toolbar)
- Animations run at ≥ 60 fps (Performance tab)
- Lighthouse scores: Performance ≥ 90, Accessibility ≥ 90, Best Practices ≥ 90

### Deployed site

The live site is at **https://stephenlyons.dev**. After a deploy merges to `main`, verify the deployed output directly:

```bash
# Quick endpoint smoke test (mirrors health-check.yml)
curl -I https://stephenlyons.dev
curl -I https://stephenlyons.dev/about
curl -I https://stephenlyons.dev/projects
curl -I https://stephenlyons.dev/contact
```

Use browser DevTools on `stephenlyons.dev` to confirm the deployed build matches expectations, especially for:
- `_astro/` CSS and JS bundles loading correctly (check Network tab)
- `.nojekyll` presence (confirm no Jekyll-stripped assets)
- Canvas elements initializing (Matrix rain, SkillGraph)
- React islands hydrating (`ProjectGallery`, `ScrollProgress`, `SkillGraph`)
