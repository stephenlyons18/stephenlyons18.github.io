# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**stephenlyons.dev**: Stephen Lyons' personal cybersecurity portfolio. A static **Astro 7** site with one
**React 19** island (the **d3-force** skill graph; nothing else needs React) and two
vanilla-TS bundles (site interactivity + a working in-browser **terminal**). Deployed to GitHub Pages from the
`build` branch. The look is **ANSI/ASCII art crossed with NY/SF/LA graffiti** (wildstyle, bubble letters,
pixel drips, 3D block shading) layered over a terminal that still really works.

All site code lives in `astro-portfolio/`. `old-html/` is the frozen pre-Astro site, kept for reference. Never
edit it and never port new work into it.

One developer (**stephenlyons18**), any number of agents. There are no lock files, no "players" and no
hand-offs. The board and PRs are the coordination layer.

## Docs, in precedence order

| Source                                        | Authority                                                                                                                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/ART_DIRECTION.md`                       | **The look.** Palette, glyph rules, reference pieces, and what art may never do. Outranks any prose here about style.                                                        |
| The [portfolio board][board] + its PRs        | **The work list.** One card per work item; the card body (draft) or PR body is its spec. See *Tracking work*.                                                                |
| `CLAUDE.md` (this file)                       | How to work: workflow, toolchain, testing bar, non-negotiables.                                                                                                              |
| `.github/copilot-instructions.md`             | A pointer back here for Copilot. Keep it short; if it disagrees with this file, this file wins and you fix the pointer.                                                     |
| `README.md`                                   | Public-facing overview. Update it when commands, pages or features change.                                                                                                   |

[board]: https://github.com/users/stephenlyons18/projects/2

## Branches

- `main`: release. A push to `main` builds and deploys to the `build` branch (GitHub Pages serves `build`).
- `dev`: integration. Default base for normal work.
- `revamp`: the current **epic branch** (art-direction overhaul, cut from `dev`). While it exists, work-item
  branches are cut from `revamp` and PR into `revamp`. When the epic is done, `revamp` PRs into `dev`.
- Work-item branches: `<feat|fix|chore|docs|perf|test>/R<n>-<slug>`, one per board item (or a tight cluster).

## Tracking work: the board, PRs, and (security-only) issues

The repo is **public**, so development is not tracked in public issues. Instead:

- **Work items are draft items on the private board.** Their titles keep ids (`R7 — …`) so branches, commits and
  PRs stay greppable. New ids: `tools/board.sh next-id`.
- **A PR fulfils an item.** When the PR opens, `tools/board.sh link R<n> <pr#>` adds the PR to the board (In
  review), copies Priority/Size, and archives the draft. From then on the **PR is the card**, so put the spec and the
  verified/inferred report in its body.
- **Repo issues are only for security findings**: Dependabot / code scanning / secret scanning / `pnpm audit` /
  anything with a vulnerability angle. Label `security`, then `tools/board.sh add-issue <#>`. Fixing PRs say `Fixes #N`.
  Closing keywords only fire on the default branch (`main`), so **close the issue by hand** (`gh issue close
  <#> -c "Fixed in #PR"`) when the fixing PR merges into `revamp`/`dev`.
- Dependabot PRs land on the board by themselves. Supersede them with a real upgrade PR and close them with a comment.

| Column      | Means                                                                              |
| ----------- | ---------------------------------------------------------------------------------- |
| Backlog     | Needs a decision (title says so), blocked, or not scoped yet.                      |
| Ready       | Scoped and unblocked; take it.                                                     |
| In progress | A branch exists; the item's `> **State …` line says what's done and what's left.   |
| In review   | PR open (waiting on local checks, CI for PRs into `main`, or the user's sign-off). |
| Done        | Merged into the epic/integration branch.                                           |

`tools/board.sh` wraps every gh call (needs `gh auth refresh -s project`): `list [column]`, `show <item>`,
`new <column> <P0|P1|P2> <XS..XL> <title> [body-file]`, `move`, `state <item> <column> <text>`, `link`,
`add-issue`, `next-id`. `<item>` is an id (`R7`), `#<n>` for a PR/issue, or a `PVTI_…` id. It spends one small
GraphQL query per call, so don't loop it. If gh hits a rate limit, keep coding and do the card moves after
`gh api rate_limit` resets.

**Session start:** `tools/board.sh list`, then take the item the user names (otherwise the top **Ready** P0).
`tools/board.sh show R<n>` and read the whole body. Then `git switch -c <type>/R<n>-<slug> origin/revamp` (or
`origin/dev` once the epic has merged), `git push -u origin HEAD`, and `tools/board.sh state R<n> "In progress"
"<plan>"`.

**During:** found more work? `tools/board.sh new Backlog …`. Don't grow the branch silently. Keep the State
line true when you stop mid-item.

**Finishing:** meet *Done means* (bottom), push, then `gh pr create --base revamp` with the board id in the
title, the spec, and a **Verified by running / Inferred** report with screenshots or videos attached (never
committed). Then `tools/board.sh link R<n> <pr#>`. Once the bar is met locally, merge your own PR:
`gh pr merge <#> --merge --delete-branch`, then `tools/board.sh move '#<pr>' Done`. **Exception:** visual /
art-direction PRs wait for the user's sign-off on the screenshots unless the user said to go ahead.

**CI runs only on PRs into `main`** (the release gate), and deploy builds once per merge to `main`. PRs into
`dev`/`revamp` trigger no Actions, which saves the user's minutes. Your local run of the full bar *is* the check
for them, so paste its results into the PR's report. Never add `dev`/`revamp`/push triggers back to a workflow
that builds or tests.

## Toolchain

Node ≥ 22.12 (CI uses 22; newer works locally), **pnpm** (version pinned by `packageManager`; use `corepack
enable` or a matching global pnpm), `gh` with `repo`, `workflow` and `project` scopes. Never use npm or yarn
here, and never commit a `package-lock.json`. Install scripts are allow-listed in `pnpm-workspace.yaml`
(`onlyBuiltDependencies`), which also holds security `overrides`. Each override says why; drop it once the
parent ships the fix.

Playwright needs Chromium: `pnpm exec playwright install chromium`. On a Linux/WSL box without sudo, Chromium
can fail with `libnspr4.so`/`libnss3.so` missing. Unpack those `.deb`s to a local dir and export
`LD_LIBRARY_PATH`. Keep the machine-specific path in your memory file, not here.

## Commands and the testing bar (all from `astro-portfolio/`)

All of these are cheap, so run them. Don't hand back unverified work.

```bash
pnpm install --frozen-lockfile  # ~5s
pnpm test           # Vitest unit tests, <1s. Data integrity + build-time art generators.
pnpm build          # ~4s. esbuild scripts → astro build → postbuild.mjs (path relativisation)
pnpm e2e            # Playwright vs the built site, 3 device projects (desktop/laptop/mobile). Build first.
pnpm format         # Prettier (config: .prettierrc.json). CI runs format:check.
pnpm shots          # full-page screenshots of every page + interaction videos, 3 devices → test-results/
pnpm dev            # http://localhost:4321
pnpm preview        # serve dist/
```

- **Unit tests** (`src/**/*.test.ts`) cover every data file in `src/data/` and every pure generator in
  `src/lib/`. Add tests for any new data file or generator.
- **E2E** (`e2e/*.spec.ts`) runs at desktop 1920×1080, laptop 1366×768 and mobile 390×844 (touch). It covers: no console errors or failed requests, no horizontal overflow, nav and mobile menu,
  terminal, and skill-graph hover/tap cards anchored to their element. A UI change isn't done until it passes at
  all three.
- **See it, don't assume it.** For any visual change, run `pnpm shots` (or take targeted screenshots) at all
  three viewports, plus a short video for interactions or animation, and look at them before saying it works.
  Media never goes on a code branch (`test-results/` is ignored). To embed it in a PR, downscale it (JPEG ≤ 1000px
  wide, H.264 MP4) and commit it to the orphan **`pr-media`** branch under `R<n>/`, then reference
  `https://github.com/stephenlyons18/stephenlyons18.github.io/blob/pr-media/R<n>/<file>?raw=true`. That branch
  is never merged.
- **Suites:** `smoke` (load, console, overflow, art fits its box), `skill-graph` (card anchoring, 0 label
  overlaps), `terminal`, `ux` (axe WCAG 2.2 AA, nav, mobile menu, keyboard, reduced motion, no idle rAF),
  `budget` (bytes per page by kind vs `e2e/budget.json`, plus LCP/CLS/blocking time on a throttled phone) and
  `perf` (scroll frame timing).
  - The last two run after the functional tests, in the `budget-*` and then `perf-*` projects, so they measure
    the site rather than other tests' CPU.
  - Raising a budget needs a reason in the PR; lower it when a PR wins bytes back.
- **Measure feel with numbers:** frame-interval p95 from rAF during scroll and graph interaction, JS bytes per
  page from `dist/`, and Lighthouse for LCP/a11y. Quote before/after in perf PRs.

## Architecture

- `src/layouts/BaseLayout.astro` wraps every page (`fixedFooter`, `fullFooter`, `showHeader`,
  `showScrollProgress` props). Pages: `index`, `about`, `projects`, `contact`, `404`.
- `src/scripts/site.ts`, `terminal.ts` and `fx.ts` are bundled by **esbuild** (not Astro) into IIFEs at
  `public/scripts/` (generated, git-ignored).
  - Only `site.js` is in the page (`<script is:inline defer>`).
  - It loads `terminal.js` on idle or first use.
  - It loads `fx.js` (Motion's `motion/mini` + `spring`: drip physics and interactive motion) on idle, only on
    pages with `[data-drips]` and never under reduced motion. Animation code goes in `fx.ts`, compositor-only
    (transform/opacity), and stops under `data-reduce-motion`.
  `terminal.ts` exposes `window.openTerminal` and `window.runInElement` (the hero terminal reuses the same
  command engine). New commands go in `terminal.ts` only.
- **React islands** only where interaction warrants it: `SkillGraph.tsx` (about, `client:visible`) is the
  only one. The project lightbox is a native `<dialog>` (`Lightbox.astro`). Everything else is static HTML. Reach for vanilla TS or
  CSS before adding an island, and never hydrate on every page.
- **Content is typed data**, one source per concept: `src/data/projects.ts`, `src/data/skills.ts` (weight 1–10
  → node radius; `connections` must be **bidirectional**, which tests enforce), and job history. Pages, the
  terminal and the graph all read from these, so never hand-copy content into a second place.
- **Build-time art** lives in `src/lib/` (pure TS, unit-tested). It is rendered by Astro components into
  static, `aria-hidden` text with a real text equivalent, so art costs zero runtime JS.
- `scripts/postbuild.mjs` rewrites absolute URLs in `dist/*.html` to relative ones so `dist/` also works over
  `file://`. New top-level routes must be added to its `DIR_ROUTES`.
- **`.nojekyll` must reach the `build` branch**, or GitHub Pages strips `_astro/` (all CSS/JS). `deploy.yml`
  enforces it; never remove that check or `include-hidden-files: true`.

| Workflow           | Trigger                        | Does                                                                         |
| ------------------ | ------------------------------ | ---------------------------------------------------------------------------- |
| `ci.yml`           | PRs to main (site/workflow changes) | audit (critical fails), unit tests, format check, build, e2e ×3 devices; pnpm + Chromium cached |
| `deploy.yml`       | push to main, manual           | build → `build` branch via git worktree; rolls back on failure               |
| `prettier.yml`     | after a successful deploy      | formats `main` and commits `[skip ci]`                                       |
| `health-check.yml` | after a successful deploy      | curls every page on stephenlyons.dev                                         |
| `trufflehog.yml`   | after a successful deploy      | secret scan of `main` and `build` history                                    |

Workflow rules: pin third-party actions to a **SHA with a version comment**; set `permissions:` least-privilege;
**never expand `${{ github.event.* }}` (or any untrusted value) inside `run:`**. Pass it through `env:`.

## Non-negotiables

- **Mobile-first, every device smooth.** Design at 320–430px first. Touch targets ≥ 44px. Every hover has a
  tap/focus equivalent. No horizontal scroll at any width (e2e checks this). Canvas work degrades on small
  screens.
- **Art enhances, never obstructs.** ANSI/graffiti art never sits behind body copy, never blocks navigation or
  focus, never moves under the pointer, and is `aria-hidden` with a real text equivalent (an `sr-only` heading
  for every art title). Body text meets **WCAG AA**. Animation is opt-in, subtle, and off under
  `prefers-reduced-motion`. Full rules: `docs/ART_DIRECTION.md`.
- **Performance is budgeted, not vibes.** Static first; JS only where it earns its place. No framework JS on pages
  that don't need it. Nothing may run a rAF loop forever: pause when the tab is hidden, when offscreen, and under
  reduced motion. No per-frame `getComputedStyle`/allocation in draw loops. Self-hosted fonts with `preload`, no
  render-blocking third-party CSS. Responsive images from `astro:assets`.
- **Floating cards anchor to what they describe.** Tooltips and hover cards track their anchor (every frame for
  canvas nodes, on scroll/resize for DOM), are clamped to the viewport, and flip instead of overflowing.
- **Theme via tokens.** Colours come from the CSS custom properties in `global.css`:
  - `--ui*` for site elements and `--accent` for the sparing pink;
  - `--title-*`, `--spray-*`, `--bg-*`, `--text-*`;
  - fonts from `--font-display`/`--font-body`/`--font-art`.

  The terminal `theme` command switches them (persisted in `localStorage`). Never hard-code a palette colour
  or font in a component. Canvas code reads tokens once per theme change, not per frame.
- **The accessibility menu is a contract.** The header popover sets `data-a11y-<key>` on `<html>` (plain,
  motion, font, large, contrast, wall), persisted in `localStorage` (`sl-a11y`) and re-applied before first
  paint.
  - `data-reduce-motion` is the single motion switch, set by the OS preference or the menu. JS checks that
    attribute, never `matchMedia` alone. Every new animation must stop under it.
  - Every new art heading must keep its real heading (`AnsiTitle` does this) so **Plain headings** works.
  - `a11y-menu.spec` checks each mode with axe.
- **Terminal UX:** `scrollTop = scrollHeight` goes inside `requestAnimationFrame`; use a `MutationObserver` for
  streamed output. Escape every user-supplied string before it touches `innerHTML`.

## Never publish

The repo, PRs, issues, board cards and the site are public or shareable. Never write in any of them:
- Claude/agent session URLs (no `Claude-Session:` trailers or session links in PR footers);
- tokens, passwords or keys;
- local machine paths or usernames;
- anything else not needed to understand the change.

Commits end with only the `Co-Authored-By:` line. Grep a PR body for `claude.ai/code/session` before posting it.

## Security (OWASP Top 10, applied to a static site)

- **A03 Injection:** never `innerHTML` untrusted input (the terminal echoes user commands, so escape them). Build
  DOM with `textContent` wherever possible.
- **A05 Misconfiguration / A08 Integrity:** least-privilege workflow tokens, SHA-pinned actions, no `${{ }}` in
  `run:`, no third-party runtime scripts or CDN CSS (fonts are self-hosted).
- **A06 Vulnerable components:** `pnpm audit --audit-level high` before every PR. New advisories become a
  `security` issue on the board.
- **A02/A09:** no secrets in the repo (TruffleHog scans history), no `console.log` of anything sensitive in
  production. The contact form only builds a `mailto:`. Keep it that way, and don't add a third-party form backend
  without asking.

## Internet and docs

Astro 7, Vite 8, Tailwind 4, React 19.3, Motion, Vitest 5 and Playwright 1.64 all move fast and may post-date
your training data. **Before using an unfamiliar API or config key, fetch the docs or run a 10-second
experiment.** Don't assert library behaviour from memory. Prefer the specific sub-page:

| Tech                              | Docs                                                                    |
| --------------------------------- | ----------------------------------------------------------------------- |
| Astro (components, assets, islands) | https://docs.astro.build/en/reference/directives-reference/ · https://docs.astro.build/en/guides/images/ |
| Tailwind CSS v4                   | https://tailwindcss.com/docs                                            |
| d3-force                          | https://d3js.org/d3-force/simulation                                    |
| React 19                          | https://react.dev/reference/react                                       |
| Motion                            | https://motion.dev/docs/react-quick-start                               |
| CSS scroll-driven animations      | https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline     |
| Vitest / Playwright               | https://vitest.dev/guide/ · https://playwright.dev/docs/test-configuration |
| pnpm settings                     | https://pnpm.io/settings                                                |
| GitHub Actions security           | https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions |
| OWASP Top 10                      | https://owasp.org/www-project-top-ten/                                  |

For art references beyond `docs/ART_DIRECTION.md`, search the web for ANSI art (16colo.rs packs) and graffiti
technique (wildstyle, bubble letters, drips) and record anything you adopt in that doc. The terminalart.club
`tac` Claude plugin renders **animated** cell art. It is not installed, and running it needs the user's explicit
OK, with the planned use written down first.

## When the road forks, ask

If two readings of a task would produce materially different work (art direction, palette, content wording, a
data change, which tool name a job used, scope), **stop and ask one concrete question with the options**. Don't
pick silently and don't build both. Art passes are expensive to throw away: show a sample (screenshots at 3
viewports) before applying a new look site-wide. If the user is away, do the parts that don't depend on the answer,
leave the item in Backlog with `needs decision` in its State line, and say so.

**Done means:** `pnpm test`, `pnpm build`, `pnpm e2e` and `pnpm format:check` are green; screenshots or video at
all three viewports for anything visual; `pnpm audit --audit-level high` reviewed; `README.md`/this file updated
if a command, convention or page changed; a PR into `revamp` (or `dev`) naming its board id with a report that
separates **what you verified by running** from **what you inferred**; the board card linked and moved; any
fixed security issue closed by hand.
