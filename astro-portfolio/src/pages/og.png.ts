/**
 * /og.png — the 1200 × 630 social preview, drawn at build time from the same ANSI art as the site
 * (the default theme's bubble look) and rasterised by sharp. Pure rects, so no font is needed.
 */
import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { pieceToSvg, renderPiece, type Piece, type PieceClass } from '../lib/ansi/piece';

const W = 1200;
const H = 630;

const mix = (a: string, b: string, t: number) => {
    const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [x, y] = [p(a), p(b)];
    return `#${x
        .map((v, i) =>
            Math.round(v + (y[i]! - v) * t)
                .toString(16)
                .padStart(2, '0'),
        )
        .join('')}`;
};

// The default theme's bubble colours (R28: the hero's look), as global.css resolves them (no CSS in
// sharp): eight rows cyan → magenta, white outline, violet 3D, drips fading out over the wall.
const [TOP, BOTTOM, BG] = ['#22c7ff', '#ff3d9a', '#070b12'];
const COLORS: Partial<Record<PieceClass, string>> = {
    ...Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [`p-f${i}` as PieceClass, mix(TOP, BOTTOM, i / 7)]),
    ),
    'p-f8': mix(BOTTOM, BG, 0.25),
    'p-dr': BOTTOM,
    'p-d1': mix(BOTTOM, BG, 0.25),
    'p-d2': mix(BOTTOM, BG, 0.5),
    'p-d3': mix(BOTTOM, BG, 0.75),
    'p-ik': '#060914',
    'p-ol': '#eef6ff',
    'p-x1': '#7b3fe4',
    'p-x2': mix('#3b2385', BG, 0.25),
    'p-sh': '#ffffff',
    'p-os': mix('#b99cff', BG, 0.45),
};

/** A piece placed at (x, y), scaled to `width` px. Returns its SVG and drawn height. */
const place = (p: Piece, x: number, y: number, width: number) => {
    const h = (width / (p.w * (p.aspect ?? 1))) * p.h;
    const svg = pieceToSvg(p, {
        colors: COLORS,
        attrs: { x: String(x), y: String(y), width: String(width), height: h.toFixed(1) },
    });
    return { svg, h };
};

export const GET: APIRoute = async () => {
    const title = renderPiece('Stephen Lyons', { style: 'bubble' });
    const sub = renderPiece('Cyber Security Engineer', { style: 'bubble', seed: 4, drips: 0.15 });
    const tw = 1080;
    const sw = 900;
    const th = (tw / (title.w * (title.aspect ?? 1))) * title.h;
    const sh = (sw / (sub.w * (sub.aspect ?? 1))) * sub.h;
    const top = (H - th - sh - 30) / 2;
    const t = place(title, 60, top, tw);
    const s = place(sub, 60, top + th + 30, sw);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">
<rect width="${W}" height="${H}" fill="#070b12"/>
<rect x="0" y="${H - 14}" width="${W}" height="14" fill="#3cc4ff" fill-opacity="0.55"/>
${t.svg}
${s.svg}
</svg>`;
    const png = await sharp(Buffer.from(svg))
        .png({ compressionLevel: 9, palette: true })
        .toBuffer();
    return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
