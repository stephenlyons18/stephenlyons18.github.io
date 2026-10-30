import { describe, expect, test } from 'vitest';
import { stackQueries } from '../lib/ansi/title';

describe('AnsiTitle stacked variants (src/lib/ansi/title.ts)', () => {
    const rules = (q: string) =>
        [
            ...q.matchAll(
                /@container \(max-width: (\d+)px\) \{ S (\S+) \{ display: none \} S (\S+) \{ display: block \} \}/g,
            ),
        ].map(([, w, hide, show]) => ({ w: +w!, hide, show }));

    test('2 lines: the one-line piece gives way to the 2-line stack', () => {
        expect(rules(stackQueries('S', [900]))).toEqual([
            { w: 900, hide: '.ansi-title__one', show: '.ansi-title__stack--2' },
        ]);
    });

    test('3 lines: each narrower stack hides the one before it, never itself (R45)', () => {
        expect(rules(stackQueries('S', [900, 500]))).toEqual([
            { w: 900, hide: '.ansi-title__one', show: '.ansi-title__stack--2' },
            { w: 500, hide: '.ansi-title__stack--2', show: '.ansi-title__stack--3' },
        ]);
    });

    test('no stacks, no queries', () => {
        expect(stackQueries('S', [])).toBe('');
    });
});
