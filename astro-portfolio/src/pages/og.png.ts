/**
 * /og.png — the 1200 × 630 social preview, drawn at build time from the same ANSI art as the site
 * (default "wildstyle" palette) and rasterised by sharp. Pure rects, so no font is needed.
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

// The default (wildstyle) theme's piece colours, as global.css resolves them (no CSS in sharp).
const [TOP, HI, MID, LO, BOTTOM, INK] = [
    '#9ff0ff',
    '#22c7ff',
    '#2f6bff',
    '#8a3ffc',
    '#ff3d9a',
    '#060914',
];
const X2 = '#3b2385';
const COLORS: Partial<Record<PieceClass, string>> = {
    'p-f0': TOP,
    'p-f1': mix(TOP, HI, 0.5),
    'p-f2': HI,
    'p-f3': mix(HI, MID, 0.5),
    'p-f4': MID,
    'p-f5': mix(MID, LO, 0.5),
    'p-f6': LO,
    'p-f7': mix(LO, BOTTOM, 0.5),
    'p-f8': BOTTOM,
    'p-f9': mix(BOTTOM, INK, 0.2),
    'p-dr': BOTTOM,
    'p-d1': 'rgba(255,61,154,0.6)',
    'p-d2': 'rgba(255,61,154,0.3)',
    'p-ik': INK,
    'p-ol': '#eef6ff',
    'p-x1': X2,
    'p-x2': mix(X2, INK, 0.45),
    'p-sh': '#ffffff',
    'p-sp': '#ffffff',
    'p-cu': '#9dff6a',
    'p-os': 'rgba(185,156,255,0.6)',
};

/** A piece placed at (x, y), scaled to `width` px. Returns its SVG and drawn height. */
const place = (p: Piece, x: number, y: number, width: number) => {
    const h = (width / p.w) * p.h;
    const svg = pieceToSvg(p, {
        colors: COLORS,
        attrs: { x: String(x), y: String(y), width: String(width), height: h.toFixed(1) },
    });
    return { svg, h };
};

export const GET: APIRoute = async () => {
    const title = renderPiece('Stephen Lyons', { style: 'wild', seed: 3 });
    const sub = renderPiece('Cyber Security Engineer', {
        style: 'wild',
        seed: 4,
        blades: 0,
        arrow: false,
        sparkles: 0,
        drips: 0.12,
    });
    const tw = 1080;
    const sw = 900;
    const th = (tw / title.w) * title.h;
    const sh = (sw / sub.w) * sub.h;
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
