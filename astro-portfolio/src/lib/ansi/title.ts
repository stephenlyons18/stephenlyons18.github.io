/**
 * AnsiTitle's stacked variants (R45): the container queries that swap the one-line piece for a
 * 2-line stack, then the 2-line stack for a 3-line one, as the container narrows. Pure, so it is
 * unit-tested; the component only supplies the selector and the widths.
 */

/** `sel`: one style's set; `breaks[i]`: the container width (px) below which stack i + 2 takes
 *  over from the variant before it (the one-line piece for i = 0, stack i + 1 after that). */
export function stackQueries(sel: string, breaks: number[]): string {
    return breaks
        .map((w, i) => {
            const hide = i === 0 ? '.ansi-title__one' : `.ansi-title__stack--${i + 1}`;
            return `@container (max-width: ${w}px) { ${sel} ${hide} { display: none } ${sel} .ansi-title__stack--${i + 2} { display: block } }`;
        })
        .join(' ');
}
