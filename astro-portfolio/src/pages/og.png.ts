/**
 * /og.png — the 1200 × 630 social preview, drawn at build time from the same ANSI art as the site
 * (default "wildstyle" palette) and rasterised by sharp. Pure rects, so no font is needed.
 */
import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { renderAnsi } from '../lib/ansi/generator';
import { artToSvg, SVG_CELL } from '../lib/ansi/svg';

const W = 1200;
const H = 630;
const TOP = '#22c7ff';
const BOTTOM = '#ff3d9a';

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

const TITLE_COLORS: Record<string, string> = {
    ...Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [`a-f${i}`, mix(TOP, BOTTOM, i / 7)]),
    ),
    'a-dr': BOTTOM,
    'a-ol': '#eef6ff',
    'a-x1': '#7b3fe4',
    'a-x2': '#3b2385',
    'a-gl': '#ffffff',
    'a-os': '#b99cff',
};

/** Fit art `cols` cells into `width` px: SVG units per cell unit. */
const fit = (cols: number, width: number) => width / (cols * SVG_CELL.w);

export const GET: APIRoute = async () => {
    const title = renderAnsi('Stephen Lyons', { style: 'wild', seed: 3 });
    const sub = renderAnsi('Cybersecurity Engineer', { style: 'block', drips: 0, overspray: 0 });
    const url = renderAnsi('stephenlyons.dev', { style: 'block', drips: 0, overspray: 0 });

    const tScale = fit(title.cols, 1080);
    const sScale = fit(sub.cols, 760);
    const uScale = fit(url.cols, 360);
    const tH = title.rows * SVG_CELL.h * tScale;
    const sH = sub.rows * SVG_CELL.h * sScale;
    const top = (H - tH - sH - 70) / 2;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">
<rect width="${W}" height="${H}" fill="#070b12"/>
<rect x="0" y="${H - 14}" width="${W}" height="14" fill="#3cc4ff" fill-opacity="0.55"/>
${artToSvg(title, { colors: TITLE_COLORS, backgrounds: { 'a-gl': TOP }, opacity: { 'a-os': 0.55 }, x: 60, y: top, scale: tScale })}
${artToSvg(sub, { colors: { ...TITLE_COLORS, 'a-ol': '#36e2c6' }, opacity: { 'a-os': 0 }, x: 60, y: top + tH + 40, scale: sScale })}
${artToSvg(url, { colors: Object.fromEntries(Object.keys(TITLE_COLORS).map((k) => [k, k === 'a-ol' ? '#4cc38a' : k.startsWith('a-x') ? '#14301f' : '#96aac0'])), x: W - 60 - 360, y: H - 70, scale: uScale })}
</svg>`;
    const png = await sharp(Buffer.from(svg))
        .png({ compressionLevel: 9, palette: true })
        .toBuffer();
    return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
