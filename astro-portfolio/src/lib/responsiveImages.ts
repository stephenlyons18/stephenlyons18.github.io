/**
 * Build-time responsive images for project photos (used by projects.astro).
 *
 * projects.ts keeps plain path strings (`/images/projects/foo.jpg`) because the terminal bundle
 * imports it through esbuild, which can't process image imports. Here we map each path to the
 * matching file in src/assets/projects/ and let astro:assets emit WebP at a few widths.
 */
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

const files = import.meta.glob<{ default: ImageMetadata }>(
    '../assets/projects/*.{jpg,jpeg,png,webp}',
    {
        eager: true,
    },
);
const byName = new Map(
    Object.entries(files).map(([path, mod]) => [path.split('/').pop()!, mod.default]),
);

export interface ResponsiveImage {
    src: string;
    srcset: string;
    width: number;
    height: number;
}

const WIDTHS = [480, 800, 1280];

export async function responsiveImage(publicPath: string): Promise<ResponsiveImage> {
    const name = publicPath.split('/').pop()!;
    const meta = byName.get(name);
    if (!meta) throw new Error(`Project image ${publicPath} not found in src/assets/projects/`);
    const widths = WIDTHS.filter((w) => w < meta.width).concat(meta.width);
    const images = await Promise.all(
        widths.map((width) => getImage({ src: meta, width, format: 'webp', quality: 78 })),
    );
    return {
        src: images[images.length - 1]!.src,
        srcset: images.map((img, i) => `${img.src} ${widths[i]}w`).join(', '),
        width: meta.width,
        height: meta.height,
    };
}
