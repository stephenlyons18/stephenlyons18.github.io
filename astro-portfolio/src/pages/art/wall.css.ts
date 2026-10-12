/**
 * /art/wall.css — the brick wall's mask tiles (src/lib/ansi/wall.ts), generated at build time.
 * A separate, cacheable file (~3 KB gzipped) loaded without blocking render: the wall is texture,
 * so it may arrive a beat after the content. Layer structure and sizing live in global.css.
 */
import type { APIRoute } from 'astro';
import { renderWallTile, svgDataUrl } from '../../lib/ansi/wall';

export const GET: APIRoute = () => {
    const { layers } = renderWallTile();
    const css = Object.entries(layers)
        .map(([cls, svg]) => `.ansi-wall .${cls}{mask-image:${svgDataUrl(svg)}}`)
        .join('\n');
    return new Response(css, { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
};
