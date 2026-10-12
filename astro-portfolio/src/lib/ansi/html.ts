import type { AnsiArt } from './generator';
import { DROP, dripRows, type DripStrip } from './wall';

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

/**
 * Inner HTML for a drip strip's <pre>: an optional sprayed `▄` bar, then one absolutely placed
 * element per drip (positioned in CSS from --x / --h, in cells). Each drip holds its paint (stem +
 * bulb, inside a clip box so it can slide out of the bar) and a hidden drop for fx.ts to release.
 */
export function dripsToHtml(strip: DripStrip, bar: boolean): string {
    const head = bar ? `<span class="d-bar">${'▄'.repeat(strip.cols)}</span>` : '';
    const drips = strip.drips
        .map(({ x, stem }, i) => {
            const rows = dripRows(stem);
            return (
                // <i>: the shortest inline tag — there are ~100 of these on the home page.
                `<i class="drip" style="--x:${x};--h:${rows.length};--i:${i}">` +
                `<i class="drip__clip"><i class="drip__paint">${esc(rows.join('\n'))}</i></i>` +
                `<i class="drip__drop">${esc(DROP.join('\n'))}</i></i>`
            );
        })
        .join('');
    return head + drips;
}
