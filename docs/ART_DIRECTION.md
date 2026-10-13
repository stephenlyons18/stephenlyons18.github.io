# Art direction: "ANSI wall"

The site is a **terminal painted on a wall**. It keeps everything that makes it a hacker's portfolio (the real
interactive terminal, monospace type, prompts, `ls`/`cd`), but the visual language moves from Fallout-green
phosphor to **ANSI/ASCII art crossed with NY/SF/LA graffiti**. Every art element is made of **text-mode
glyphs** (block elements, shades, box drawing) coloured per cell, the way BBS-era ANSI packs and
terminalart.club pieces are. Art is generated at build time, not drawn as images.

This doc outranks prose elsewhere on style. Change it deliberately, with the user's OK.

## References (what we take from each)

| Reference                                                         | Take                                                                                                       |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **DEFCON 9 ANSI** (Pinky / eXiled, 2001)                          | 3D block letters shaded with `█▓▒░` in **blue → steel → grey** ramps; small CP437 detail text as captions.  |
| **"Church of Malware"** pixel title                               | Chunky pixel letters whose bottoms **drip** into dithered `▓▒░` columns that fade out: our signature drip. |
| **"i LOVE YOU" 3D pixel mural** (mint/teal, grey extrusion)       | Isometric **extrusion**: letters cast a stepped block shadow down-right; **mint** accent; red pixel confetti. |
| **"BOND" grey 3D pixel piece**                                    | Monochrome grey-ramp extrusion for secondary pieces; restraint: one colour family per piece.               |
| **Wildstyle burner** (magenta / cyan / lavender / orange)         | The **core palette**; white highlight strokes and "shine" glints; arrows and interlocking forms as accents. |
| **Bubble letters** ([graffitibible][bubble])                      | Letters "blown up like a balloon": one **equal-width rounded outline** around all letters, overlapping into a single silhouette; glossy highlight top-left. |
| **terminalart.club** (`tac` plugin)                               | Art as a grid of cells (glyph + 24-bit colour). We use the technique statically; the plugin itself (animated pieces) is not used. |

[bubble]: https://graffitibible.com/how-to-do-bubble-letters/

## Palette (CSS tokens in `astro-portfolio/src/styles/global.css`)

**Roles (user direction, 2026-10-12):** the site is mostly **blues and greens** on a navy/teal wall.
**Pink is the accent**, used sparingly: the typed cursor, text selection, the active-nav mark, the scroll bar,
the primary CTA's hover, and title art. Never use it for body text, borders or large fills. **Title art keeps
the cyan → magenta burner gradient** with a white bubble outline and purple 3D. Don't change the headers
without asking.

Contrast is measured against `--bg-primary` `#070b12` / `--bg-card` `#0e1724`. Every text colour passes WCAG AA.

| Token              | Hex       | Role                                                     | on bg / card |
| ------------------ | --------- | -------------------------------------------------------- | ------------ |
| `--bg-primary`     | `#070b12` | navy-black wall                                          | —            |
| `--bg-card`        | `#0e1724` | panels, cards, terminal body                             | —            |
| `--bg-elevated`    | `#142233` | inputs, chips, bars                                      | —            |
| `--border`         | `#1e3247` | hairlines                                                | —            |
| `--white`          | `#eef6ff` | headings                                                 | 18.1 / 16.5  |
| `--text-primary`   | `#cfdcea` | body                                                     | 14.2 / 12.9  |
| `--text-secondary` | `#96aac0` | secondary copy                                           | 8.3 / 7.6    |
| `--text-muted`     | `#7590ab` | captions, hints                                          | 5.9 / 5.4    |
| `--ui`             | `#3cc4ff` | **primary UI**: links, labels, buttons, borders on focus  | 9.9 / 9.0    |
| `--ui-2`           | `#36e2c6` | aqua: secondary labels, success                          | 12.1 / 11.0  |
| `--ui-3`           | `#4cc38a` | forest: tertiary accents (timeline, tags)                | 8.9 / 8.1    |
| `--ansi-blue`      | `#4d9dff` | blue fills / graph category                              | 7.1 / 6.5    |
| `--accent`         | `#ff3d9a` | **pink accent: sparingly** (list above)                  | 6.0 / 5.5    |
| `--title-top/bottom` | `#22c7ff` → `#ff3d9a` | title art gradient                          | —            |
| `--title-outline`  | `#eef6ff` | bubble outline                                           | —            |
| `--title-x1/x2`    | `#7b3fe4` / `#3b2385` | 3D extrusion                                 | —            |

Skill-graph categories: languages sky `#3CC4FF`, frameworks aqua `#36E2C6`, cloud blue `#4D9DFF`, security
skills forest `#4CC38A`, security tools lavender `#B99CFF`.

Themes (terminal `theme <name>`, persisted, applied before first paint): **`wildstyle`** (default, above),
**`bubble`** (aqua UI, aqua→cyan titles with a pink outline), **`ansi`** (steel/blue, DEFCON), **`sunset`**
(orange/yellow), **`green`** (the original phosphor). A theme swaps the `--ui*`, `--accent` and `--title-*`
slots only; the wall and text stay.

## Glyph rules

- **Fills:** `█` solid; shading ramp `█ ▓ ▒ ░` (dark→light or core→fade). Half-pixel edges `▀ ▄ ▌ ▐`.
- **Pixels are 2 cells wide** (`██`) so a pixel is close to square in a monospace cell (≈0.6em × 1.2em ÷ 2).
- **Drips** hang only from the bottom edge of fills: 1–4 cells, `▓` → `▒` → `░`, seeded so every build is
  identical (no `Math.random` at runtime).
- **Extrusion** goes down-right, 1–2 cells, in the theme's shading ramp (`--ansi-blue` → `--ansi-steel`).
- **Outline (bubble)**: a 1-pixel dilation of the letter mask in ink or white, shared across letters so they
  merge into one silhouette.
- **Highlight**: a short white `▀` glint on the top-left of a bowl or stem, at most one per letter.
- Frames and UI chrome use box drawing (`╔═╗ ║ ╚═╝ ┌─┐`) and CP437-style separators (`─▬═`); prompts keep `$`
  and `>`.
- Art font: self-hosted **JetBrains Mono**, subset to the art's cells only (space, `·`, U+2580–259F; ~1 KB,
  `--font-art`). Never rely on a fallback font for block glyphs, because widths drift and the art shears.

## Typography (user decision, 2026-10-12)

| Token            | Face                  | Used for                                                                    |
| ---------------- | --------------------- | --------------------------------------------------------------------------- |
| `--font-display` | **Press Start 2P**    | Headings, nav, buttons, labels, stats, plain-mode headings                  |
| `--font-body`    | **Departure Mono**    | Paragraphs, terminal, captions, chips, small UI text, skill-graph labels    |
| `--font-art`     | JetBrains Mono (cells) | ANSI art only                                                              |

- All three are self-hosted and subset, ~22 KB in total.
- Pixel faces have one weight. `font-synthesis: none` stops a faux bold from smearing them; use colour or size
  for emphasis instead.
- Press Start 2P carries its own wide spacing, so keep `letter-spacing` at about 0.02em. It is too wide for
  paragraphs and never sets body copy.
- The a11y menu's **Readable font** swaps `--font-display`/`--font-body` for the platform sans. Art keeps its
  cells.

## Site-wide pieces (all build-time, zero JS)

- **Wall** (`AnsiWall.astro`, `wallPixels`): a running-bond brick wall of `▓`/`░`/`▒` behind every page
  at 7% strength. It **scrolls with the content**, like paint on a real wall. The cells are drawn as a seamless
  80 × 30-cell tile, where each shade glyph becomes its 2 × 2 dither, baked per theme into a ~2 KB PNG
  (`/art/wall-<theme>.png`) and tiled with `image-rendering: pixelated`. There are no glyphs in the DOM and no
  masks: a tiled bitmap is nearly free to raster, and the old theme-coloured masks cost most of a phone's raster
  time while scrolling (R22). It replaced the matrix rain, which ran a rAF loop forever. The `matrix` terminal
  command still plays the rain once, as an easter egg.
- **Drips** (`AnsiDrips.astro`, `renderDripStrip`): a 1-cell stem ending in a **teardrop** of quadrant blocks
  (`▗█▖` / `▟█▙` / `▜█▛`). It is 2-4-4-6-6-4 half-cell pixels wide: a gentle taper from the stem, then a
  rounded bottom. **Title drips don't get the teardrop** (user direction, 2026-10-12): they stay thin 1-cell
  runs fading `█` → `▓` → `▒` → `░`, as in the original pieces. Strips only.
  - **Like spray paint running down a wall** (user direction, 2026-10-12): paint runs out of the edge, catches,
    runs again and creeps to a stop. It never detaches, falls or splats. The "catch" is a slow-down, never a
    stop: the easing (`--drip-ease`) is sampled from a speed curve that swells and eases without ever hitting
    zero or jumping, because a dead stop followed by a lurch reads as stutter (R22).
  - **The whole strip animates together, never drip by drip.** Drips are dealt into 4 runs (`.drip-run`).
    On hover/focus every run slides out at its own pace (a beat later and a little slower than the last), so
    the strip pours without moving in step. Each run is one compositor layer: CSS transitions, no JS.
  - **Divider** (`AnsiDivider.astro`): drips under a sprayed `▄` bar, **always visible**, about halfway out.
    Stems are 2–6 cells. Hover (or a tap on touch) runs them all out to full length; they creep back slowly
    after. Dividers below the fold start tucked in the bar and run out on first view. Used under page headers
    and between home sections.
  - **Card drips** (`.card-drips`): **only while the card is hovered or focused** (user direction,
    2026-10-12).
    - At rest every run is hidden and tucked fully inside the clip, so not a pixel shows. On hover they pour,
      and on leave they pull back quickly and hide.
    - Fixed 7px cells and 1–4-cell stems. Grids with drip cards get a wider row gap so the drips stay inside
      it (e2e checks this).
    - Under reduced motion they simply appear on hover.
- **Headers** (`AnsiTitle.astro`): lean wildstyle for page titles, bubble for the 404 and the "SL" avatar.
  With the a11y menu's **Plain headings**, the art hides and its real heading shows instead: Press Start 2P,
  the same burner gradient and a two-step block extrusion (`drop-shadow` in `--title-x1`/`--title-x2`).
- **Components**: buttons and cards carry the art's hard down-right offset shadow (`--title-x2`); section
  labels start with a `▓▒░` ramp; the timeline is a sprayed sky→forest stripe with square pixel markers; the
  terminal banner uses the title gradient.

## What art may never do

- Sit behind body copy, form fields or the terminal text. Art lives in headers, margins, separators and the
  hero, on its own rows.
- Move under the pointer on its own, or shift layout after load. No CLS from art. Movement the user starts is
  fine: grabbing `[data-drag]` art, hovering a card or a divider to pour its drips.
- Animate when motion is off. Every animation stops under `data-reduce-motion` (the OS setting or the a11y
  menu).
  - Allowed (user OK, 2026-10-12): drips pouring on hover/focus (R12, R17), page transitions, card
    tilt/press, and draggable art (R13).
  - Nothing ambient: no drops recur on their own.
  - Never a rAF loop: compositor-only transforms/opacity via CSS or WAAPI (Motion).
- Hijack touch scrolling. Large art is draggable with a mouse only (`data-drag="fine"`); only small pieces
  (the avatar) take touch drags.
- Be the only carrier of meaning. Every art title is `aria-hidden` with a real `<h1>/<h2>` (sr-only) next to it.
- Overflow. Art scales to fit its container (`--cols`-based font-size) down to 320px wide; below its legible
  minimum it falls back to a smaller piece or plain styled text.

## Interactive motion (R13)

- **Springs:** Motion's `spring()` is rendered to CSS `linear()` easings (`--spring-snappy`, `--spring-bouncy`
  in `global.css`). CSS-only motion and `fx.ts` therefore share one feel.
- **Page transitions:** cross-document View Transitions, typed `page`. The header stays put, the old page
  drops back and fades, and the new page is sprayed on with a 10-step wipe. Off under reduced motion.
- **Cards:**
  - Up to 760px wide, they tilt toward the mouse (≤ 5°/7°) and spring back level.
  - Wider cards only lift.
  - All cards squash on press, and buttons squash too.
- **Draggable art** (`[data-drag]`): the hero name, the 404 piece (mouse only) and the avatar (any pointer).
  They stretch against a rubber band and snap home on a Motion spring. In plain-headings mode the title stays
  put and selectable.

## Future (not built)

The `tac` plugin from terminalart.club could produce an **animated** hero piece (e.g. a spray can tagging the
name, rendered as cell frames). Out of scope for now. If it's ever wanted: plan the piece and frame budget first,
ask the user, run it outside the repo, and ship frames as a static, reduced-motion-aware asset, never as a
runtime Python/uv dependency.
