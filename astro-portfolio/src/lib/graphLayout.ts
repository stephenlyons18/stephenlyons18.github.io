/**
 * Layout helpers for the skill graph — pure functions + two custom d3-force forces, unit-tested in
 * src/__tests__/graphLayout.test.ts.
 *
 * Labels are drawn at a fixed *screen* size under each node, so a node's real footprint is its
 * circle plus a label box. d3's forceCollide only knows circles; these work on that footprint.
 */

export interface LayoutNode {
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    r: number;
    /** Half the label's pixel width. */
    labelHalfW: number;
}

export interface Box {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

/** Footprint at camera scale `s` (circle scales, the label does not), in screen-space units. */
export function footprint(n: LayoutNode, labelPx: number, s = 1, pad = 0): Box {
    const x = (n.x ?? 0) * s;
    const y = (n.y ?? 0) * s;
    const r = n.r * s;
    const halfW = Math.max(r, n.labelHalfW);
    return {
        x0: x - halfW - pad,
        x1: x + halfW + pad,
        y0: y - r - pad,
        y1: y + r + 3 + labelPx + pad,
    };
}

const overlap = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Pairs of nodes whose footprints (circle + label) intersect at scale `s`. O(n²); n ≈ 50. */
export function countOverlaps(nodes: LayoutNode[], labelPx: number, s = 1): number {
    const boxes = nodes.map((n) => footprint(n, labelPx, s));
    let count = 0;
    for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) if (overlap(boxes[i]!, boxes[j]!)) count++;
    return count;
}

/**
 * Largest camera scale (≤ maxScale) at which every footprint fits inside w × h minus padding.
 * Footprint width isn't linear in scale (labels are fixed-size), so binary-search it.
 * Returns the scale and the screen-space bbox of the graph at that scale.
 */
export function fitScale(
    nodes: LayoutNode[],
    labelPx: number,
    w: number,
    h: number,
    { pad = 24, minScale = 0.15, maxScale = 1.25 } = {},
): { scale: number; box: Box } {
    const bbox = (s: number): Box => {
        const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
        for (const n of nodes) {
            const f = footprint(n, labelPx, s);
            b.x0 = Math.min(b.x0, f.x0);
            b.y0 = Math.min(b.y0, f.y0);
            b.x1 = Math.max(b.x1, f.x1);
            b.y1 = Math.max(b.y1, f.y1);
        }
        return b;
    };
    const fits = (s: number) => {
        const b = bbox(s);
        return b.x1 - b.x0 <= w - pad * 2 && b.y1 - b.y0 <= h - pad * 2;
    };
    let lo = minScale,
        hi = maxScale;
    if (fits(hi)) lo = hi;
    else
        for (let i = 0; i < 30; i++) {
            const mid = (lo + hi) / 2;
            if (fits(mid)) lo = mid;
            else hi = mid;
        }
    return { scale: lo, box: bbox(lo) };
}

/**
 * d3 force: push apart nodes whose footprints overlap (in sim space, at scale 1), along the axis
 * of least penetration. This is what keeps long names from sitting on top of each other.
 */
export function forceLabelBoxes<N extends LayoutNode>(labelPx: number, pad = 4, strength = 0.6) {
    let nodes: N[] = [];
    function force(alpha: number) {
        const k = strength * Math.max(alpha, 0.1);
        for (let i = 0; i < nodes.length; i++) {
            const a = nodes[i]!;
            const ba = footprint(a, labelPx, 1, pad / 2);
            for (let j = i + 1; j < nodes.length; j++) {
                const b = nodes[j]!;
                const bb = footprint(b, labelPx, 1, pad / 2);
                if (!overlap(ba, bb)) continue;
                const ox = Math.min(ba.x1, bb.x1) - Math.max(ba.x0, bb.x0);
                const oy = Math.min(ba.y1, bb.y1) - Math.max(ba.y0, bb.y0);
                const dx = (a.x ?? 0) - (b.x ?? 0) || 0.01;
                const dy = (a.y ?? 0) - (b.y ?? 0) || 0.01;
                if (ox < oy) {
                    const m = (ox / 2) * k * Math.sign(dx);
                    a.vx = (a.vx ?? 0) + m;
                    b.vx = (b.vx ?? 0) - m;
                } else {
                    const m = (oy / 2) * k * Math.sign(dy);
                    a.vy = (a.vy ?? 0) + m;
                    b.vy = (b.vy ?? 0) - m;
                }
            }
        }
    }
    force.initialize = (ns: N[]) => {
        nodes = ns;
    };
    return force;
}

/**
 * d3 force: keep footprints inside [0, w] × [0, h] (sim space) — a soft wall, not a clamp — and
 * out of an optional `avoid` box (e.g. the zoom controls in the top-right corner).
 */
export function forceBounds<N extends LayoutNode>(
    w: number,
    h: number,
    labelPx: number,
    margin = 16,
    strength = 0.5,
    avoid?: Box,
) {
    let nodes: N[] = [];
    function force() {
        for (const n of nodes) {
            const f = footprint(n, labelPx);
            if (f.x0 < margin) n.vx = (n.vx ?? 0) + (margin - f.x0) * strength;
            if (f.x1 > w - margin) n.vx = (n.vx ?? 0) - (f.x1 - (w - margin)) * strength;
            if (f.y0 < margin) n.vy = (n.vy ?? 0) + (margin - f.y0) * strength;
            if (f.y1 > h - margin) n.vy = (n.vy ?? 0) - (f.y1 - (h - margin)) * strength;
            if (avoid && overlap(f, avoid)) {
                // Leave by the cheaper side: left, or down.
                const left = f.x1 - avoid.x0;
                const down = avoid.y1 - f.y0;
                if (left < down) n.vx = (n.vx ?? 0) - left * strength;
                else n.vy = (n.vy ?? 0) + down * strength;
            }
        }
    }
    force.initialize = (ns: N[]) => {
        nodes = ns;
    };
    return force;
}

/**
 * Final clean-up after the main simulation has settled: run only the label-box and bounds forces
 * (no links, charge or clusters fighting them) until no two footprints touch, or `iters` runs out.
 * Moves are small — it untangles the last few collisions without reshaping the layout.
 * Returns the number of overlaps left (0 when it succeeded).
 */
export function relaxOverlaps(
    nodes: LayoutNode[],
    labelPx: number,
    w: number,
    h: number,
    {
        iters = 1000,
        pad = 6,
        margin = 12,
        avoid,
    }: { iters?: number; pad?: number; margin?: number; avoid?: Box } = {},
): number {
    const labels = forceLabelBoxes(labelPx, pad, 1);
    const bounds = forceBounds(w, h, labelPx, margin, 0.5, avoid);
    labels.initialize(nodes);
    bounds.initialize(nodes);
    for (let i = 0; i < iters; i++) {
        for (const n of nodes) n.vx = n.vy = 0;
        labels(1);
        bounds();
        let moved = false;
        for (const n of nodes) {
            if (Math.abs(n.vx!) + Math.abs(n.vy!) > 0.01) moved = true;
            n.x = (n.x ?? 0) + n.vx!;
            n.y = (n.y ?? 0) + n.vy!;
            n.vx = n.vy = 0;
        }
        if (!moved) break;
    }
    return countOverlaps(nodes, labelPx);
}
