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
- Font: self-hosted **JetBrains Mono** subset (includes U+2500–259F). Never rely on a fallback font for block
  glyphs, because widths drift and the art shears.

## What art may never do

- Sit behind body copy, form fields or the terminal text. Art lives in headers, margins, separators and the
  hero, on its own rows.
- Move under the pointer or shift layout after load. No CLS from art.
- Animate by default. Allowed: a one-shot reveal and a hover glint, and only when `prefers-reduced-motion:
  no-preference`. Anything looping needs the user's OK and must pause offscreen and in hidden tabs.
- Be the only carrier of meaning. Every art title is `aria-hidden` with a real `<h1>/<h2>` (sr-only) next to it.
- Overflow. Art scales to fit its container (`--cols`-based font-size) down to 320px wide; below its legible
  minimum it falls back to a smaller piece or plain styled text.

## Future (not built)

The `tac` plugin from terminalart.club could produce an **animated** hero piece (e.g. a spray can tagging the
name, rendered as cell frames). Out of scope for now. If it's ever wanted: plan the piece and frame budget first,
ask the user, run it outside the repo, and ship frames as a static, reduced-motion-aware asset, never as a
runtime Python/uv dependency.
