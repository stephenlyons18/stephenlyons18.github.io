import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { DEFAULT_THEME, THEMES, TITLE_STYLES, findTheme, findTitleStyle } from '../data/themes';
import { WALL_THEMES } from '../lib/ansi/wall';

const css = readFileSync(new URL('../styles/global.css', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../layouts/BaseLayout.astro', import.meta.url), 'utf8');

describe('themes (src/data/themes.ts)', () => {
    test('every theme has its CSS block, its wall tile, and the pre-paint script knows it', () => {
        for (const t of THEMES) {
            const block = css.match(new RegExp(`\\[data-theme='${t.id}'\\][^{]*\\{([^}]*)\\}`));
            expect(block, t.id).not.toBeNull();
            if (t.id !== DEFAULT_THEME) {
                expect(block![1], t.id).toContain('--title-top');
                expect(block![1], t.id).toContain('--bubble-top');
                expect(layout, t.id).toMatch(new RegExp(`\\(([a-z|]*\\|)?${t.id}(\\|[a-z|]*)?\\)`));
            }
            expect(WALL_THEMES[t.id], t.id).toBeDefined();
        }
        expect(Object.keys(WALL_THEMES).sort()).toEqual(THEMES.map((t) => t.id).sort());
    });

    test('names are unambiguous: ids, labels and aliases each find exactly their theme', () => {
        // No name points at two themes.
        const owner = new Map<string, string>();
        for (const t of THEMES)
            for (const n of new Set([t.id, t.label.toLowerCase(), ...t.aliases])) {
                expect(owner.get(n) ?? t.id, n).toBe(t.id);
                owner.set(n, t.id);
            }
        for (const t of THEMES)
            for (const n of [t.id, t.label, t.label.toUpperCase(), ...t.aliases])
                expect(findTheme(n)?.id, n).toBe(t.id);
        expect(findTheme('nope')).toBeUndefined();
        // Theme labels never reuse a heading style's name.
        const styleNames = TITLE_STYLES.map((s) => s.label.toLowerCase());
        for (const t of THEMES) expect(styleNames).not.toContain(t.label.toLowerCase());
    });

    test('heading styles: bubble and wild, wildstyle as an alias', () => {
        expect(TITLE_STYLES.map((s) => s.id)).toEqual(['bubble', 'wild']);
        expect(findTitleStyle('Wildstyle')).toBe('wild');
        expect(findTitleStyle('bubble')).toBe('bubble');
        expect(findTitleStyle('x')).toBeUndefined();
        expect(layout).toContain("localStorage.getItem('sl-title-style') === 'wild'");
    });
});
