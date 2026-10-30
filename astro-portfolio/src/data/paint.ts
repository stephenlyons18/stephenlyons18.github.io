/**
 * Spray paint (R53): the options in the paint menu (PaintKit.astro) and their defaults. paint.ts
 * reads them at runtime and src/lib/paint/ draws with them; one source, so the menu, the engine and
 * the tests never disagree.
 */

export type CapId = 'soft' | 'fat' | 'skinny' | 'splatter' | 'block';
export const CAPS: { id: CapId; label: string; desc: string }[] = [
    { id: 'soft', label: 'Soft', desc: 'a round spray with a dithered edge' },
    { id: 'fat', label: 'Fat', desc: 'a wide, even fill with a short fade' },
    { id: 'skinny', label: 'Skinny', desc: 'a tight line for outlines and tags' },
    { id: 'splatter', label: 'Splatter', desc: 'flicks and speckles' },
    { id: 'block', label: 'Block', desc: 'a square pixel pen with solid █ cells' },
];

/**
 * Drips: how much wet paint a cell holds before it sags into a run (in coats; one coat is a solid
 * █ cell). Lower means runnier.
 */
export type DripsId = 'off' | 'some' | 'lots';
export const DRIPS: { id: DripsId; label: string; threshold: number }[] = [
    { id: 'off', label: 'Off', threshold: Infinity },
    { id: 'some', label: 'Some', threshold: 2.4 },
    { id: 'lots', label: 'Lots', threshold: 1.3 },
];

/** Spray radius in paint cells (a cell is ~6px: two 3px dither dots). */
export const SIZE = { min: 1, max: 24, default: 3 } as const;

/**
 * Theme colours: live CSS tokens, so they follow the colour theme the visitor picked (the first is
 * the default). A custom colour (the wheel or a hex) is stored as its hex instead.
 */
export const PAINT_TOKENS: { token: string; label: string }[] = [
    { token: '--title-hi', label: 'Theme' },
    { token: '--title-top', label: 'Theme light' },
    { token: '--title-mid', label: 'Theme mid' },
    { token: '--title-lo', label: 'Theme deep' },
    { token: '--accent', label: 'Accent' },
    { token: '--title-cut', label: 'Cut' },
    { token: '--white', label: 'White' },
    { token: '--title-ink', label: 'Ink' },
];

export interface PaintSettings {
    /** A token from PAINT_TOKENS, or a custom `#rrggbb`. */
    color: string;
    cap: CapId;
    size: number;
    drips: DripsId;
    /** Off: paint fades away a moment after it lands. On: it stays for the visit. */
    keep: boolean;
}
export const PAINT_DEFAULTS: PaintSettings = {
    color: '--title-hi',
    cap: 'soft',
    size: SIZE.default,
    drips: 'some',
    keep: false,
};

/** localStorage: the settings, and whether the Shift + scroll tip has done its job. */
export const PAINT_KEY = 'sl-paint';
export const PAINT_TIP_KEY = 'sl-paint-tip';
/** sessionStorage prefix for kept paint, one entry per page path. */
export const PAINT_ART_KEY = 'sl-paint-art:';

/** Settings from storage, with anything unknown or out of range back at its default. */
export function readSettings(raw: string | null): PaintSettings {
    let v: Partial<Record<keyof PaintSettings, unknown>> = {};
    try {
        const parsed: unknown = JSON.parse(raw ?? '{}');
        if (parsed && typeof parsed === 'object') v = parsed;
    } catch {
        /* corrupt: defaults */
    }
    const d = PAINT_DEFAULTS;
    const color =
        typeof v.color === 'string' &&
        (PAINT_TOKENS.some((t) => t.token === v.color) || /^#[0-9a-f]{6}$/i.test(v.color))
            ? v.color
            : d.color;
    const size =
        typeof v.size === 'number' && Number.isFinite(v.size)
            ? Math.round(Math.min(SIZE.max, Math.max(SIZE.min, v.size)))
            : d.size;
    return {
        color,
        cap: CAPS.some((c) => c.id === v.cap) ? (v.cap as CapId) : d.cap,
        size,
        drips: DRIPS.some((x) => x.id === v.drips) ? (v.drips as DripsId) : d.drips,
        keep: typeof v.keep === 'boolean' ? v.keep : d.keep,
    };
}
