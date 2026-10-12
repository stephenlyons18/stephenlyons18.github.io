/**
 * ANSI art → SVG rects, for places a font can't follow the art: the Open Graph image (rasterised
 * by sharp at build time, where no web font is available). Each glyph becomes the quadrants it
 * lights; shades become opacity. Cell = 6 × 10 units (a 0.6-aspect monospace cell).
 */
import type { AnsiArt } from './generator';

export const SVG_CELL = { w: 6, h: 10 } as const;

type Quad = 'tl' | 'tr' | 'bl' | 'br';
const ALL: Quad[] = ['tl', 'tr', 'bl', 'br'];

/** Which quadrants a glyph lights, and at what opacity. Unknown glyphs draw nothing. */
const GLYPHS: Record<string, { q: Quad[]; o?: number; dot?: true }> = {
    '█': { q: ALL },
    '▓': { q: ALL, o: 0.75 },
    '▒': { q: ALL, o: 0.5 },
    '░': { q: ALL, o: 0.25 },
    '▀': { q: ['tl', 'tr'] },
    '▄': { q: ['bl', 'br'] },
    '▌': { q: ['tl', 'bl'] },
    '▐': { q: ['tr', 'br'] },
    '▘': { q: ['tl'] },
    '▝': { q: ['tr'] },
    '▖': { q: ['bl'] },
    '▗': { q: ['br'] },
    '▙': { q: ['tl', 'bl', 'br'] },
    '▛': { q: ['tl', 'tr', 'bl'] },
    '▜': { q: ['tl', 'tr', 'br'] },
    '▟': { q: ['tr', 'bl', 'br'] },
    '·': { q: [], dot: true },
};

export interface SvgArtOptions {
    /** Class → colour. Classes not listed draw nothing. */
    colors: Record<string, string>;
    /** Class → background fill behind the glyph (e.g. the glint's highlight). */
    backgrounds?: Record<string, string>;
    /** Class → extra opacity (e.g. overspray). */
    opacity?: Record<string, number>;
    x?: number;
    y?: number;
    /** Scale: SVG units per cell unit. */
    scale?: number;
}

/** The art as an SVG <g> of rects (no <svg> wrapper), positioned at (x, y). */
export function artToSvg(art: AnsiArt, opts: SvgArtOptions): string {
    const { colors, backgrounds = {}, opacity = {}, x = 0, y = 0, scale = 1 } = opts;
    const W = SVG_CELL.w * scale;
    const H = SVG_CELL.h * scale;
    const rects: string[] = [];
    const rect = (rx: number, ry: number, w: number, h: number, fill: string, o?: number) =>
        rects.push(
            `<rect x="${+rx.toFixed(2)}" y="${+ry.toFixed(2)}" width="${+w.toFixed(2)}" height="${+h.toFixed(2)}" fill="${fill}"${o !== undefined && o < 1 ? ` fill-opacity="${o}"` : ''}/>`,
        );
    art.lines.forEach((line, row) => {
        let col = 0;
        for (const run of line) {
            for (const ch of run.t) {
                const fill = colors[run.c];
                const g = GLYPHS[ch];
                const cx = x + col * W;
                const cy = y + row * H;
                if (fill && g) {
                    const bg = backgrounds[run.c];
                    if (bg) rect(cx, cy, W, H, bg);
                    const o = (g.o ?? 1) * (opacity[run.c] ?? 1);
                    if (g.dot) rect(cx + W / 3, cy + H * 0.4, W / 3, H / 5, fill, o);
                    // Merge quadrant pairs into halves/whole where possible (fewer rects).
                    const has = (q: Quad) => g.q.includes(q);
                    if (g.q.length === 4) rect(cx, cy, W, H, fill, o);
                    else {
                        for (const [a, b, rx, ry, w, h] of [
                            ['tl', 'tr', 0, 0, W, H / 2],
                            ['bl', 'br', 0, H / 2, W, H / 2],
                        ] as const) {
                            if (has(a) && has(b)) rect(cx + rx, cy + ry, w, h, fill, o);
                            else {
                                if (has(a)) rect(cx + rx, cy + ry, W / 2, H / 2, fill, o);
                                if (has(b)) rect(cx + W / 2, cy + ry, W / 2, H / 2, fill, o);
                            }
                        }
                    }
                }
                col++;
            }
        }
    });
    return `<g>${rects.join('')}</g>`;
}
