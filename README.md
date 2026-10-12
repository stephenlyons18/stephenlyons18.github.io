# stephenlyons.dev

Stephen Lyons' cybersecurity portfolio: a working in-browser terminal painted onto an **ANSI-art graffiti wall**.

**Live:** [stephenlyons.dev](https://stephenlyons.dev)

## Stack

- **Astro 7** static site (`astro-portfolio/`), deployed to GitHub Pages from the `build` branch
- A **React 19** island only where interaction needs it: the **d3-force** skill graph. The project lightbox is a native `<dialog>`
- Vanilla TypeScript (bundled with esbuild) for site interactivity and the terminal
- Build-time ANSI/ASCII art generators: block-letter titles with 3D shading and paint drips, zero runtime JS
- Pixel type, self-hosted and subset (~22 KB): **Press Start 2P** for display, **Departure Mono** for body. A tiny JetBrains Mono subset sets the art's cells
- An **accessibility menu** in the header (plain headings, reduce motion, readable font, larger text, high contrast, hide texture), applied before first paint
- Tests: **Vitest** (data integrity, generators) and **Playwright** (desktop, laptop, mobile)

## Pages

| Route       | What's there                                                                 |
| ----------- | ---------------------------------------------------------------------------- |
| `/`         | Hero piece, interactive terminal, featured projects, capabilities            |
| `/about`    | Bio, work history, interactive skill graph / list, education                 |
| `/projects` | Project write-ups with photo galleries                                       |
| `/contact`  | `mailto:` contact form and profiles                                          |
| `/404`      | ANSI error piece                                                             |

## The terminal

Press **Ctrl+K** / **⌘K** (or the `>_` button) on any page; the homepage hero terminal is live too.

`help` · `whoami` · `ls pages` · `cd <page>` · `skills` · `projects` · `experience` · `education` · `contact` ·
`theme <wildstyle|bubble|ansi|green>` · `matrix` · `clear` · `exit` · and `sudo`, if you must. Tab completes and
↑/↓ walks history.

## Develop

Requires Node ≥ 22.12 and pnpm (version pinned in `package.json` → `corepack enable`).

```bash
cd astro-portfolio
pnpm install
pnpm dev            # http://localhost:4321
pnpm test           # unit tests
pnpm build          # → dist/
pnpm e2e            # Playwright against the build (run `pnpm exec playwright install chromium` once)
pnpm format         # Prettier
```

## CI/CD

| Workflow           | When                              | What                                                        |
| ------------------ | --------------------------------- | ----------------------------------------------------------- |
| `ci.yml`           | PRs to `main`                     | audit, unit tests, format check, build, e2e on 3 devices (cached) |
| `deploy.yml`       | push to `main`                    | build and publish `dist/` to the `build` branch (with rollback) |
| `prettier.yml`     | after deploy                      | auto-format `main`                                          |
| `health-check.yml` | after deploy                      | probe every live page                                       |
| `trufflehog.yml`   | after deploy                      | secret-scan `main` and `build` history                      |

Contributor/agent guide: [`CLAUDE.md`](CLAUDE.md). Visual language: [`docs/ART_DIRECTION.md`](docs/ART_DIRECTION.md).

## License

© 2026 Stephen Lyons. All rights reserved. JetBrains Mono is used under the SIL Open Font License 1.1.
