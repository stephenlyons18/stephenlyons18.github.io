# Copilot instructions

The single source of truth for working in this repo is **[`CLAUDE.md`](../CLAUDE.md)** at the root. Read it
first. It covers the workflow (private project board + PRs, security-only issues), commands, the testing bar
(Vitest + Playwright at desktop/laptop/mobile), architecture, and the non-negotiables. The look is defined
in **[`docs/ART_DIRECTION.md`](../docs/ART_DIRECTION.md)**.

The short version, for inline completions:

- Site code lives in `astro-portfolio/` (Astro 7, one React 19 island for the skill graph, vanilla TS). The pre-Astro
  site is archived on the `archive/old-html` branch; never port work into it.
- Use **pnpm**, never npm/yarn. `pnpm test`, `pnpm build`, `pnpm e2e`, `pnpm format`.
- Mobile-first; no hover-only interactions; no horizontal scroll at 320px.
- Static first: no new React islands or per-page framework JS without a reason; never run a rAF loop forever.
- Colours come from CSS tokens (`--ui*` blues/greens for elements, `--accent` pink sparingly, `--bg-*`,
  `--text-*`), never hard-coded.
- Content comes from `src/data/*.ts` only. Skill `connections` must be bidirectional.
- Art is build-time, `aria-hidden` text with a real text equivalent; animation is compositor-only and stops under
  `data-reduce-motion`.
- Never `innerHTML` untrusted input; never put `${{ github.event.* }}` inside a workflow `run:`.

If this file and `CLAUDE.md` disagree, `CLAUDE.md` wins. Fix this file.
