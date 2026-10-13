/**
 * /art/wall-<theme>.png: the brick wall tile (src/lib/ansi/wall.ts) baked in each theme's colours,
 * ~2 KB each. global.css picks the active theme's tile (--wall-tile), so only one is downloaded.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import sharp from 'sharp';
import { WALL_THEMES, wallPixels } from '../../lib/ansi/wall';

export const getStaticPaths = (() =>
    Object.keys(WALL_THEMES).map((theme) => ({ params: { theme } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) => {
    const { width, height, data } = wallPixels(WALL_THEMES[params.theme!]!);
    const png = await sharp(Buffer.from(data), { raw: { width, height, channels: 4 } })
        .png({ palette: true, compressionLevel: 9 })
        .toBuffer();
    return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
