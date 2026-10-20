/**
 * The wall pieces' pool (R32): every leet word in both styles, drawn once at build time and served
 * as /art/wall-pieces.json. wall.ts picks from it at random on each visit (word, style, colour
 * variant, size, tilt, place), so the browser never runs the renderer: no long tasks on a phone.
 */
import { hash } from './grid';
import { pieceToSvg, renderPiece, type PieceStyle } from './piece';

export const WALL_WORDS = [
    'PWN',
    'PWN3D',
    'H4CK',
    'CV3',
    'LY0NS',
    'SL',
    'r00t',
    '0DAY',
    'SUD0',
    '1337',
];

export interface WallPoolPiece {
    word: string;
    style: PieceStyle;
    /** Drawn width ÷ height. */
    ratio: number;
    /** The piece as an SVG string (classes, themed by CSS). */
    svg: string;
}

export function wallPool(): WallPoolPiece[] {
    return WALL_WORDS.flatMap((word) =>
        (['bubble', 'wild'] as const).map((style) => {
            const piece = renderPiece(word, {
                style,
                seed: hash(`wall:${word}`) % 1000,
                overspray: 0,
                sparkles: 1,
                dripMax: 7,
                slashedZero: true,
                cloud: 3,
            });
            return {
                word,
                style,
                ratio: +((piece.w * (piece.aspect ?? 1)) / piece.h).toFixed(4),
                svg: pieceToSvg(piece, { attrs: { focusable: 'false' } }),
            };
        }),
    );
}
