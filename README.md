# stephenlyons.dev

Stephen Lyons' cybersecurity portfolio: a working in-browser terminal painted onto an **ANSI-art graffiti wall**.

**Live:** [stephenlyons.dev](https://stephenlyons.dev)

## Stack

- **Astro 7** static site (`astro-portfolio/`), deployed to GitHub Pages from the `build` branch
- A **React 19** island only where interaction needs it: the **d3-force** skill graph. The project lightbox is a native `<dialog>`
- Vanilla TypeScript (bundled with esbuild) for site interactivity and the terminal
- Build-time ANSI/ASCII art: wildstyle and bubble pieces (titles and original pieces painted in the wall's whitespace) with ink outlines, 3D shading and paint drips, zero runtime JS
- Pixel type, self-hosted and subset (~22 KB): **Press Start 2P** for display, **Departure Mono** for body. A tiny JetBrains Mono subset sets the art's cells
- Play, all compositor-only: paint drips that pour out of cards and dividers on hover, cards that tilt toward the cursor, art you can grab and fling (Motion `motion/mini`), and pixel-wipe page transitions. All of it stops under reduced motion
- **Spray paint**: tap the can in the bottom-right corner (or press **P**) and paint over the site in its own
  ANSI style: dithered `░▒▓█` spray, five caps (soft, fat, skinny, splatter, block pen), theme or custom colours, and
  drips that run when you hold the can still. Paint fades by default, or keep it for the visit. In paint mode the
  cursor is a hollow ring the size of the spray (**Shift + scroll** resizes it); on touch, one finger sprays and two
  scroll. Off under reduced motion
- A pixel-block scroll progress strip, and on touch screens a grip on the right edge to drag through long pages
- SEO and AI-search ready, all generated from the typed data:
  - canonical URLs, Open Graph/Twitter cards, and an OG image drawn from the ANSI art;
  - JSON-LD (Person, WebSite, ProfilePage, project ItemList);
  - `sitemap.xml`, `robots.txt`, and `llms.txt` / `llms-full.txt`.
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
`theme <burner|mint|defcon|sunset|phosphor>` · `style <bubble|wildstyle>` · `matrix` · `clear` · `exit` · and `sudo`, if you must. Tab completes and
↑/↓ walks history.

## Spray paint

The can in the bottom-right corner (or **P**) switches paint mode on; **Esc**, **P** or the can again switch it off.
The sliders button beside it opens the menu: colour (the theme's palette, a colour wheel or a hex), cap, size, drips
(off / some / lots), keep paint, and clear. **Shift + scroll** or **[ ]** resize the spray. On touch, one finger
sprays and two fingers scroll; with paint off, nothing you do paints.

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
