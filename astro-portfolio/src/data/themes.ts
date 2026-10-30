/**
 * Colour themes and heading styles (R30): one source for the accessibility menu, the terminal's `theme` and
 * `style` commands, and BaseLayout's before-first-paint script.
 *
 * A theme's `id` is its `[data-theme]` value in global.css (the default, wildstyle, sets none) and its
 * name in localStorage `sl-theme`. The menu shows `label`, so colour themes never share a name with a
 * heading style (bubble / wildstyle); the terminal takes the id, the label or an alias.
 */
export interface Theme {
    id: string;
    label: string;
    desc: string;
    aliases: string[];
}

export const THEMES: Theme[] = [
    {
        id: 'wildstyle',
        label: 'Burner',
        desc: 'cyan → magenta, the default',
        aliases: ['burner', 'default'],
    },
    { id: 'bubble', label: 'Mint', desc: 'aqua + mint, a magenta outline', aliases: ['mint'] },
    { id: 'ansi', label: 'DEFCON', desc: 'DEFCON-era ANSI blues', aliases: ['defcon'] },
    { id: 'sunset', label: 'Sunset', desc: 'yellow → magenta, LA sunset', aliases: [] },
    {
        id: 'green',
        label: 'Phosphor',
        desc: 'the original phosphor terminal',
        aliases: ['phosphor'],
    },
];
export const DEFAULT_THEME = 'wildstyle';

/** A theme by id, label or alias (any case), or undefined. */
export function findTheme(name: string): Theme | undefined {
    const n = name.trim().toLowerCase();
    return THEMES.find((t) => t.id === n || t.label.toLowerCase() === n || t.aliases.includes(n));
}

export type TitleStyle = 'bubble' | 'wild';
export const TITLE_STYLES: { id: TitleStyle; label: string; desc: string; aliases: string[] }[] = [
    { id: 'bubble', label: 'Bubble', desc: 'the original pixel bubble letters', aliases: [] },
    {
        id: 'wild',
        label: 'Wildstyle',
        desc: 'interlocking burner letters, splits and arrows',
        aliases: ['wildstyle', 'burner'],
    },
];
export const DEFAULT_TITLE_STYLE: TitleStyle = 'bubble';

export function findTitleStyle(name: string): TitleStyle | undefined {
    const n = name.trim().toLowerCase();
    return TITLE_STYLES.find((s) => s.id === n || s.aliases.includes(n))?.id;
}

/** localStorage keys (BaseLayout's inline script repeats them: it runs before any bundle). */
export const THEME_KEY = 'sl-theme';
export const TITLE_STYLE_KEY = 'sl-title-style';
