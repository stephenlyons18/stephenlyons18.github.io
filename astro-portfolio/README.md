# astro-portfolio

The site itself: Astro 7, one React island (the skill graph) and two vanilla-TS bundles. Run everything from
this directory with **pnpm**:

```bash
pnpm install --frozen-lockfile
pnpm dev        # http://localhost:4321
pnpm test       # Vitest
pnpm build      # → dist/
pnpm e2e        # Playwright against the build (desktop, laptop, mobile)
```

Overview: [`../README.md`](../README.md). Workflow, testing bar and architecture: [`../CLAUDE.md`](../CLAUDE.md).
The look: [`../docs/ART_DIRECTION.md`](../docs/ART_DIRECTION.md).
