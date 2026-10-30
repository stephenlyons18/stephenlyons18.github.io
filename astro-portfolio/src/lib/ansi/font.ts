/**
 * "Bubble block" pixel font for ANSI graffiti titles.
 *
 * 8 rows tall, mostly 6 wide, with 2-pixel stems and bars and rounded (missing) corners, so the letters
 * read as inflated blocks rather than a thin terminal font. Each pixel renders as two monospace cells
 * (2 × 2 half-block units in piece.ts). Uppercase, plus the odd lowercase glyph leet words need (r); other letters are upper-cased. Unknown characters fall
 * back to a blank of the space width.
 */
export const GLYPH_HEIGHT = 8;

const RAW: Record<string, string> = {
    A: `.####. ###### ##..## ##..## ###### ###### ##..## ##..##`,
    B: `#####. ###### ##..## #####. ###### ##..## ###### #####.`,
    C: `.##### ###### ##.... ##.... ##.... ##.... ###### .#####`,
    D: `#####. ###### ##..## ##..## ##..## ##..## ###### #####.`,
    E: `###### ###### ##.... #####. #####. ##.... ###### ######`,
    F: `###### ###### ##.... #####. #####. ##.... ##.... ##....`,
    G: `.##### ###### ##.... ##.### ##.### ##..## ###### .####.`,
    H: `##..## ##..## ##..## ###### ###### ##..## ##..## ##..##`,
    I: `#### #### .##. .##. .##. .##. #### ####`,
    J: `...### ...### ....## ....## ##..## ##..## ###### .####.`,
    K: `##..## ##.##. ####.. ###... ####.. ##.##. ##..## ##..##`,
    L: `##.... ##.... ##.... ##.... ##.... ##.... ###### ######`,
    M: `##...## ###.### ####### ##.#.## ##...## ##...## ##...## ##...##`,
    N: `##..## ###.## ###.## ###### ###### ##.### ##.### ##..##`,
    O: `.####. ###### ##..## ##..## ##..## ##..## ###### .####.`,
    P: `#####. ###### ##..## ##..## ###### #####. ##.... ##....`,
    Q: `.####. ###### ##..## ##..## ##..## ##.### ###### .#####`,
    R: `#####. ###### ##..## ##..## #####. ###### ##..## ##..##`,
    S: `.##### ###### ##.... #####. .##### ....## ###### #####.`,
    T: `###### ###### ..##.. ..##.. ..##.. ..##.. ..##.. ..##..`,
    U: `##..## ##..## ##..## ##..## ##..## ##..## ###### .####.`,
    V: `##..## ##..## ##..## ##..## ##..## .####. .####. ..##..`,
    W: `##...## ##...## ##.#.## ##.#.## ##.#.## ####### ###.### ##...##`,
    X: `##..## ##..## .####. ..##.. ..##.. .####. ##..## ##..##`,
    Y: `##..## ##..## ##..## .####. ..##.. ..##.. ..##.. ..##..`,
    Z: `###### ###### ...##. ..##.. .##... ##.... ###### ######`,
    // Slashed, so leet words (r00t, LY0NS) don't read as O.
    '0': `.####. ###### ##.### ##.### ###.## ###.## ###### .####.`,
    '1': `.##. ###. .##. .##. .##. .##. #### ####`,
    '2': `.####. ###### ##..## ...##. ..##.. .##... ###### ######`,
    '3': `#####. ###### ....## .####. .####. ....## ###### #####.`,
    '4': `...##. ..###. .####. ##.##. ###### ###### ...##. ...##.`,
    '5': `###### ###### ##.... #####. ###### ....## ###### #####.`,
    '6': `.####. #####. ##.... #####. ###### ##..## ###### .####.`,
    '7': `###### ###### ....## ...##. ..##.. ..##.. ..##.. ..##..`,
    '8': `.####. ###### ##..## .####. ###### ##..## ###### .####.`,
    '9': `.####. ###### ##..## ###### .##### ....## .##### .####.`,
    '-': `.... .... .... #### #### .... .... ....`,
    '.': `.. .. .. .. .. .. ## ##`,
    '!': `## ## ## ## ## .. ## ##`,
    '?': `.####. ###### ##..## ...##. ..##.. ...... ..##.. ..##..`,
    "'": `## ## .# .. .. .. .. ..`,
    '+': `...... ...... ..##.. ###### ###### ..##.. ...... ......`,
    '/': `....## ....## ...##. ..##.. ..##.. .##... ##.... ##....`,
    // Lowercase where leet spelling needs it (r00t); everything else is upper-cased.
    r: `...... ...... ##.##. ###### ###... ##.... ##.... ##....`,
    ' ': `... ... ... ... ... ... ... ...`,
};

export interface Glyph {
    w: number;
    /** rows[y][x] — true where the glyph is filled */
    rows: boolean[][];
}

export const GLYPHS: Record<string, Glyph> = Object.fromEntries(
    Object.entries(RAW).map(([ch, s]) => {
        const rows = s.split(' ').map((r) => [...r].map((c) => c === '#'));
        return [ch, { w: rows[0]!.length, rows }];
    }),
);

/**
 * The original letterforms where R25 redrew them, for bubble pieces (R28), which keep the look of the
 * first title generator: its denser N, its W and an unslashed 0 (leet wall words keep the slash).
 * And a full-width capital I (R33, user review): serifs as wide as a letter, so it reads as I, never as a
 * lump (the old 4-wide I) or an l (a plain bar).
 */
export const LIVE_GLYPHS: Record<string, Glyph> = Object.fromEntries(
    Object.entries({
        N: `##..## ###.## ###### ###### ##.### ##..## ##..## ##..##`,
        W: `##...## ##...## ##...## ##.#.## ####### ####### ###.### ##...##`,
        '0': `.####. ###### ##..## ##..## ##..## ##..## ###### .####.`,
        I: `###### ###### ..##.. ..##.. ..##.. ..##.. ###### ######`,
    }).map(([ch, s]) => {
        const rows = s.split(' ').map((r) => [...r].map((c) => c === '#'));
        return [ch, { w: rows[0]!.length, rows }];
    }),
);

export function glyphFor(ch: string): Glyph {
    return GLYPHS[ch] ?? GLYPHS[ch.toUpperCase()] ?? GLYPHS[' ']!;
}

/** The letters a piece draws: all caps, except, for leet words, the lowercase ones the font has. */
export function pieceChars(text: string, leet = false): string[] {
    return [...text].map((c) => (leet && c !== c.toUpperCase() && GLYPHS[c] ? c : c.toUpperCase()));
}
