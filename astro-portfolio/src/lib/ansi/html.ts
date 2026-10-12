import type { AnsiArt } from './generator';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Inner HTML for a <pre>, built as a string so template whitespace can never leak into the art.
 * Classes come only from the generators (never user input); text is escaped regardless.
 */
export function artToHtml(art: AnsiArt): string {
    return art.lines
        .map((line) =>
            line.map((r) => (r.c ? `<span class="${r.c}">${esc(r.t)}</span>` : esc(r.t))).join(''),
        )
        .join('\n');
}
