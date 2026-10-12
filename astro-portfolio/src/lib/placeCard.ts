/**
 * Where to put a floating card so it stays attached to its anchor and inside its bounds.
 *
 * All rects are in the same coordinate space (e.g. canvas-container pixels, or viewport pixels).
 * The card sits on the preferred side of the anchor, flips to the other side when it would cross the
 * bounds, and slides horizontally (never vertically) so it stays fully visible. It never covers the
 * anchor unless the bounds are too small to avoid it.
 */
export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface Placement {
    left: number;
    top: number;
    side: 'above' | 'below';
}

export function placeCard(
    anchor: Rect,
    card: { w: number; h: number },
    bounds: Rect,
    opts: { prefer?: 'above' | 'below'; gap?: number; margin?: number } = {},
): Placement {
    const { prefer = 'above', gap = 8, margin = 8 } = opts;
    const above = anchor.y - gap - card.h;
    const below = anchor.y + anchor.h + gap;
    const minTop = bounds.y + margin;
    const maxTop = bounds.y + bounds.h - margin - card.h;

    const fitsAbove = above >= minTop;
    const fitsBelow = below <= maxTop;
    let side: Placement['side'] = prefer;
    if (prefer === 'above' && !fitsAbove && fitsBelow) side = 'below';
    if (prefer === 'below' && !fitsBelow && fitsAbove) side = 'above';
    // Neither side fits: take whichever has more room, then clamp.
    if (!fitsAbove && !fitsBelow) {
        side =
            anchor.y - bounds.y > bounds.y + bounds.h - (anchor.y + anchor.h) ? 'above' : 'below';
    }
    let top = side === 'above' ? above : below;
    top = Math.min(Math.max(top, minTop), Math.max(minTop, maxTop));

    // Centre on the anchor, then slide to stay inside the bounds.
    let left = anchor.x + anchor.w / 2 - card.w / 2;
    const minLeft = bounds.x + margin;
    const maxLeft = bounds.x + bounds.w - margin - card.w;
    left = Math.min(Math.max(left, minLeft), Math.max(minLeft, maxLeft));

    return { left: Math.round(left), top: Math.round(top), side };
}
