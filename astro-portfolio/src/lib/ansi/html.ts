import { DRIP_BULB, DRIP_RUNS, dripRows, type DripStrip } from './wall';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Inner HTML for a drip strip's <pre>: an optional sprayed `▄` bar, then one absolutely placed
 * element per drip (positioned in CSS from --x / --h, in cells). Each drip holds its paint (stem +
 * bulb, inside a clip box so it can slide out of the bar) and a hidden drop for fx.ts to release.
 */
export function dripsToHtml(strip: DripStrip, bar: boolean): string {
    const head = bar ? `<span class="d-bar">${'▄'.repeat(strip.cols)}</span>` : '';
    // One wrapper per run (DRIP_RUNS): the browser moves a run as a single layer, so a strip
    // animates with a handful of compositor transforms, not one per drip.
    const runs = Array.from({ length: DRIP_RUNS }, (_, k) => {
        const own = strip.drips.filter((d) => d.run === k);
        if (!own.length) return '';
        const h = Math.max(...own.map((d) => d.stem + DRIP_BULB.length));
        const drips = own
            .map(({ x, stem }) => {
                const rows = dripRows(stem);
                // <i>: the shortest inline tag — there are ~100 of these on the home page.
                return `<i class="drip" style="--x:${x};--h:${rows.length}">${esc(rows.join('\n'))}</i>`;
            })
            .join('');
        return `<i class="drip-run" style="--k:${k};--h:${h}">${drips}</i>`;
    }).join('');
    return `${head}<i class="drips__clip">${runs}</i>`;
}
