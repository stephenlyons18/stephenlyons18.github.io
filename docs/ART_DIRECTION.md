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

Contrast is measured against `--bg` `#0c0a12` / `--bg-card` `#16131f`. Every text colour passes WCAG AA (≥ 4.5:1)
on both.

| Token               | Hex       | Role                                          | on bg / card |
| ------------------- | --------- | --------------------------------------------- | ------------ |
| `--bg`              | `#0c0a12` | ink-black wall, violet cast                   | —            |
| `--bg-card`         | `#16131f` | panels, cards, terminal body                  | —            |
| `--bg-elevated`     | `#1f1a2b` | inputs, chips, bars                           | —            |
| `--border`          | `#2e2742` | hairlines                                     | —            |
| `--text-white`      | `#f3efff` | headings, chrome highlight                    | 17.4 / 16.2  |
| `--text-primary`    | `#d9d3e8` | body                                          | 13.5 / 12.6  |
| `--text-secondary`  | `#a8a0bf` | secondary copy                                | 7.9 / 7.4    |
| `--text-muted`      | `#857d9e` | captions, hints (never for long copy)         | 5.1 / 4.7    |
| `--spray-magenta`   | `#ff3d9a` | **primary accent** (wildstyle pink)           | 6.0 / 5.6    |
| `--spray-cyan`      | `#22c7ff` | secondary accent (wildstyle blue)             | 10.0 / 9.3   |
| `--spray-lavender`  | `#b99cff` | fills, frameworks                             | 8.7 / 8.1    |
| `--spray-orange`    | `#ff7a3d` | fill shading, warnings                        | 7.6 / 7.1    |
| `--spray-mint`      | `#4ef0c8` | bubble accent, success                        | 13.7 / 12.8  |
| `--spray-yellow`    | `#ffd23f` | the heart / one glint per piece, never text blocks | 13.6 / 12.7 |
| `--ansi-blue`       | `#5b74ff` | 3D extrusion / shading (DEFCON ramp)          | 5.1 / 4.7    |
| `--ansi-steel`      | `#93a6dc` | extrusion mid-tone                            | 8.2 / 7.6    |

Themes (terminal `theme <name>`, persisted): **`wildstyle`** (default: magenta accent, cyan second),
**`bubble`** (mint accent, magenta second), **`ansi`** (blue/steel, DEFCON), **`green`** (the original phosphor,
kept for nostalgia). A theme swaps `--accent`, `--accent-2` and the title gradient only; the wall, text and
structure stay.

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
