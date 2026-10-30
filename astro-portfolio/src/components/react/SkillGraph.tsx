import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import {
    forceSimulation,
    forceLink,
    forceManyBody,
    forceCenter,
    forceCollide,
    forceX,
    forceY,
    type Simulation,
    type SimulationNodeDatum,
    type SimulationLinkDatum,
} from 'd3-force';
import { skills, CATEGORY_META, type Skill, type SkillCategory } from '../../data/skills';
import { JOBS_BY_SKILL } from '../../data/experience';
import { placeCard } from '../../lib/placeCard';
import {
    countOverlaps,
    fitScale,
    forceBounds,
    forceLabelBoxes,
    relaxOverlaps,
} from '../../lib/graphLayout';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GraphNode extends SimulationNodeDatum {
    id: string;
    skill: Skill;
    r: number;
    /** Half the estimated pixel width of this node's label — used so the
     *  collision force reserves room for long label text, not just the circle. */
    labelHalfW: number;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
    source: GraphNode;
    target: GraphNode;
}

interface Camera {
    x: number;
    y: number;
    scale: number;
}

type ViewMode = 'graph' | 'list';

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;
const MOBILE_BREAKPOINT = 768;

// Radius bounds (desktop / mobile). Mobile uses smaller nodes so the graph
// uses the available canvas space rather than clumping into the center.
const DESKTOP_MIN_R = 8;
const DESKTOP_MAX_R = 22;
const MOBILE_MIN_R = 5;
const MOBILE_MAX_R = 14;

const LABEL_PX_DESKTOP = 13;
const LABEL_PX_MOBILE = 11;

// Collision radius padding: allows labels to breathe without overcrowding.
const LABEL_CLEARANCE_DESKTOP = 32;
const LABEL_CLEARANCE_MOBILE = 18;

function weightToRadius(w: number, minR: number, maxR: number): number {
    const clamped = Math.max(1, Math.min(10, w));
    return minR + ((clamped - 1) / 9) * (maxR - minR);
}

/** Top-right area covered by the zoom buttons (3 × 36px + gaps, 12px inset) — nodes stay out. */
const ZOOM_ZONE = (cw: number) => ({ x0: cw - 64, y0: 0, x1: cw, y1: 140 });

// Visual (clockwise, starting at the top) order for the category clusters.
// Jobs are not nodes: they show up as "Used at" context on each skill's card.
const CATEGORY_ORDER: SkillCategory[] = [
    'languages',
    'frameworks',
    'cloud',
    'security-skills',
    'security-tools',
];

// Cluster centroids sit on a circle around the canvas centre, but unlike a
// fixed pentagon of equal slices, each category claims an angular arc
// proportional to how many skills it holds and is pushed to a radius that
// also grows with its member count. A fixed equal-slice layout crammed the
// two ~12-13 node security categories while leaving the small cloud category
// surrounded by disproportionate empty space — this keeps categories grouped
// but gives each roughly the canvas area it needs.
// Values are fractions of half-canvas width/height.
function buildClusterOffsets(): Record<SkillCategory, [number, number]> {
    const counts = new Map<SkillCategory, number>();
    for (const s of skills) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
    const total = skills.length;
    const offsets = {} as Record<SkillCategory, [number, number]>;
    let angle = -Math.PI / 2; // start at the top
    for (const cat of CATEGORY_ORDER) {
        const count = counts.get(cat) ?? 1;
        const sector = (count / total) * Math.PI * 2;
        const mid = angle + sector / 2;
        const radius = 0.4 + 0.075 * Math.sqrt(count);
        offsets[cat] = [Math.cos(mid) * radius, Math.sin(mid) * radius];
        angle += sector;
    }
    return offsets;
}
const CLUSTER_OFFSET = buildClusterOffsets();

// Bidirectional adjacency — `skills` is static, so this never changes after
// module load. (Tests enforce symmetry; this also normalises any slip.)
const SKILL_ADJACENCY: Map<string, Set<string>> = (() => {
    const m = new Map<string, Set<string>>();
    for (const s of skills) {
        if (!m.has(s.name)) m.set(s.name, new Set());
        for (const c of s.connections ?? []) {
            if (c === s.name) continue;
            m.get(s.name)!.add(c);
            if (!m.has(c)) m.set(c, new Set());
            m.get(c)!.add(s.name);
        }
    }
    return m;
})();

const SKILL_BY_NAME = new Map(skills.map((s) => [s.name, s]));

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function hexToRgba(hex: string, a: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
}
function clamp(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, v));
}
function cssCoord(e: MouseEvent | Touch, c: HTMLCanvasElement): [number, number] {
    const r = c.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
}
function touchDist(a: Touch, b: Touch): number {
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}
function touchMid(a: Touch, b: Touch, c: HTMLCanvasElement): [number, number] {
    return cssCoord(
        { clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 } as Touch,
        c,
    );
}
/** Read a CSS custom property once (callers cache the result — never per frame). */
function cssVar(name: string, fallback: string): string {
    if (typeof document === 'undefined') return fallback;
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

// ─── Skill card (shared by graph + list) ──────────────────────────────────────
//
// Weight, category, the jobs that used the skill ("Used at"), related projects
// and connection count. Positioned by the caller through `style`.

function SkillCard({
    skill,
    cardRef,
    style,
}: {
    skill: Skill;
    cardRef: React.Ref<HTMLDivElement>;
    style?: React.CSSProperties;
}) {
    const meta = CATEGORY_META[skill.category];
    const jobs = JOBS_BY_SKILL.get(skill.name) ?? [];
    const projects = [...new Set(skill.relatedProjects ?? [])];
    const links = SKILL_ADJACENCY.get(skill.name)?.size ?? 0;
    return (
        <div
            ref={cardRef}
            role="tooltip"
            className="skill-card"
            style={{ ...style, ['--cat' as string]: meta.color }}
        >
            <div className="skill-card__head">
                <strong className="skill-card__name">{skill.name}</strong>
                <span className="skill-card__weight" aria-label={`${skill.weight} out of 10`}>
                    {'█'.repeat(skill.weight)}
                    <span aria-hidden="true">{'░'.repeat(10 - skill.weight)}</span>
                </span>
            </div>
            <div className="skill-card__cat">{meta.label}</div>
            {jobs.length > 0 && (
                <div className="skill-card__section">
                    <div className="skill-card__label">Used at</div>
                    <ul>
                        {jobs.map((j) => (
                            <li key={j.id}>
                                <span className="skill-card__role">{j.role}</span> · {j.shortOrg}
                                <span className="skill-card__date"> {j.date.split(' & ')[0]}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {projects.length > 0 && (
                <div className="skill-card__section">
                    <div className="skill-card__label">Projects</div>
                    <ul>
                        {projects.map((p) => (
                            <li key={p}>› {p}</li>
                        ))}
                    </ul>
                </div>
            )}
            {links > 0 && (
                <div className="skill-card__foot">
                    {links} connection{links !== 1 ? 's' : ''}
                </div>
            )}
        </div>
    );
}

/**
 * Hover is for real mice only. Touch opens/closes cards via click; on hover-less
 * devices the browser also keeps a virtual pointer at the last tap point and fires
 * enter/leave on whatever scrolls under it, which would swap or close the card.
 */
function isMouseHover(e: React.PointerEvent): boolean {
    return e.pointerType === 'mouse' && window.matchMedia('(hover: hover)').matches;
}

// ─── List view ────────────────────────────────────────────────────────────────
//
// Categorised chips. The card is absolutely positioned inside this view's own
// wrapper (not `position:fixed` in a portal), so it scrolls *with* its chip
// instead of detaching when the page moves. Placement is recomputed on
// hover and whenever the wrapper resizes.

function ListView() {
    const [hovered, setHovered] = useState<{ skill: Skill; chip: HTMLElement } | null>(null);
    const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    const cats = CATEGORY_ORDER;
    const relatedSet: Set<string> | null = hovered
        ? (SKILL_ADJACENCY.get(hovered.skill.name) ?? new Set())
        : null;

    function place() {
        const wrap = wrapRef.current;
        const card = cardRef.current;
        if (!wrap || !card || !hovered) return;
        const w = wrap.getBoundingClientRect();
        const c = hovered.chip.getBoundingClientRect();
        // Prefer below the chip unless that would run off the bottom of the viewport.
        const roomBelow = window.innerHeight - c.bottom;
        const p = placeCard(
            { x: c.left - w.left, y: c.top - w.top, w: c.width, h: c.height },
            { w: card.offsetWidth, h: card.offsetHeight },
            // Bounds: the wrapper's width; vertically, generous (the page scrolls).
            { x: 0, y: -10_000, w: w.width, h: 20_000 },
            { prefer: roomBelow < card.offsetHeight + 16 ? 'above' : 'below', margin: 0 },
        );
        setPos({ left: p.left, top: p.top });
    }

    useLayoutEffect(() => {
        if (!hovered) {
            setPos(null);
            return;
        }
        place();
        const ro = new ResizeObserver(place);
        if (wrapRef.current) ro.observe(wrapRef.current);
        return () => ro.disconnect();
    }, [hovered]); // eslint-disable-line react-hooks/exhaustive-deps

    // Tap outside clears a tapped-open card on touch devices.
    useEffect(() => {
        if (!hovered) return;
        const onDown = (e: PointerEvent) => {
            if (!wrapRef.current?.contains(e.target as Node)) setHovered(null);
        };
        document.addEventListener('pointerdown', onDown);
        return () => document.removeEventListener('pointerdown', onDown);
    }, [hovered]);

    // A tap fires focus/mouseenter *and* click; remember when the card opened so
    // the click that belongs to the same tap doesn't immediately close it.
    const openedAt = useRef(0);
    const show = (skill: Skill, chip: HTMLElement) => {
        if (hovered?.skill.name !== skill.name) openedAt.current = performance.now();
        setHovered({ skill, chip });
    };

    return (
        <div ref={wrapRef} className="skill-list-view" style={{ position: 'relative' }}>
            <div className="skills-grid">
                {cats.map((cat) => (
                    <div key={cat} className="skill-category">
                        <h3 style={{ color: CATEGORY_META[cat].color }}>
                            {CATEGORY_META[cat].label}
                        </h3>
                        <ul className="skill-list">
                            {skills
                                .filter((s) => s.category === cat)
                                .sort((a, b) => b.weight - a.weight)
                                .map((s) => {
                                    const isHovered = hovered?.skill.name === s.name;
                                    const isRelated =
                                        !isHovered && relatedSet !== null && relatedSet.has(s.name);
                                    const isDimmed = hovered !== null && !isHovered && !isRelated;
                                    return (
                                        <li
                                            key={s.name}
                                            tabIndex={0}
                                            data-skill={s.name}
                                            className={
                                                isHovered
                                                    ? 'is-active'
                                                    : isRelated
                                                      ? 'is-related'
                                                      : isDimmed
                                                        ? 'is-dimmed'
                                                        : undefined
                                            }
                                            style={{
                                                ['--cat' as string]:
                                                    CATEGORY_META[s.category].color,
                                            }}
                                            // Hover is for real mice only; touch opens/closes via click
                                            // (emulated mouseleave after a tap would close it at once).
                                            onPointerEnter={(e) =>
                                                isMouseHover(e) && show(s, e.currentTarget)
                                            }
                                            onPointerLeave={(e) =>
                                                isMouseHover(e) && setHovered(null)
                                            }
                                            onFocus={(e) => show(s, e.currentTarget)}
                                            onBlur={() => setHovered(null)}
                                            // Touch: tap to reveal, tap again to clear.
                                            onClick={(e) =>
                                                isHovered &&
                                                performance.now() - openedAt.current > 400
                                                    ? setHovered(null)
                                                    : show(s, e.currentTarget)
                                            }
                                        >
                                            {s.name}
                                        </li>
                                    );
                                })}
                        </ul>
                    </div>
                ))}
            </div>
            {hovered && (
                <SkillCard
                    skill={hovered.skill}
                    cardRef={cardRef}
                    style={{
                        position: 'absolute',
                        left: pos?.left ?? 0,
                        top: pos?.top ?? 0,
                        visibility: pos ? 'visible' : 'hidden',
                    }}
                />
            )}
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SkillGraph({ height = 700 }: { height?: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);
    /** Bumped by every startSimulation, so a superseded (e.g. resized) settle stops early. */
    const settleGenRef = useRef(0);
    const nodesRef = useRef<GraphNode[]>([]);
    const linksRef = useRef<GraphLink[]>([]);
    const cameraRef = useRef<Camera>({ x: 0, y: 0, scale: 1 });
    const hoveredRef = useRef<GraphNode | null>(null);
    /** The hovered node + its neighbours; recomputed only when the hover changes. */
    const hlSetRef = useRef<Set<string> | null>(null);
    const draggedRef = useRef<GraphNode | null>(null);
    const isPanRef = useRef(false);
    const panStartRef = useRef({ camX: 0, camY: 0, mx: 0, my: 0 });
    const pinchRef = useRef<{ dist: number; mx: number; my: number } | null>(null);
    const activeCatRef = useRef<Set<SkillCategory>>(new Set());
    const labelPxRef = useRef(LABEL_PX_DESKTOP);
    /** Theme colours, read from CSS once and refreshed when the theme changes. */
    const themeRef = useRef({
        accent: '#00FF41',
        halo: 'rgba(11, 13, 16, 0.92)',
        label: '#E6EDF3',
        font: "'Departure Mono', monospace",
    });

    const [zoomLevel, setZoomLevel] = useState(1);
    const [activeCategories, setActiveCategories] = useState<Set<SkillCategory>>(new Set());
    const [hoveredName, setHoveredName] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>(() =>
        typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT ? 'list' : 'graph',
    );
    const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT,
    );

    // On mobile, cap the canvas height so users can still scroll past it without
    // getting trapped in the canvas. ~70% of viewport height feels right.
    const effectiveHeight =
        isMobile && typeof window !== 'undefined'
            ? Math.min(900, Math.max(520, Math.round(window.innerHeight * 1.05)))
            : height;

    // ─── Coordinate helpers ────────────────────────────────────────────────────

    function toSim(cx: number, cy: number): [number, number] {
        const { x, y, scale } = cameraRef.current;
        return [(cx - x) / scale, (cy - y) / scale];
    }
    function toScreen(sx: number, sy: number): [number, number] {
        const { x, y, scale } = cameraRef.current;
        return [sx * scale + x, sy * scale + y];
    }
    function nodeAt(cx: number, cy: number): GraphNode | null {
        const [sx, sy] = toSim(cx, cy);
        for (let i = nodesRef.current.length - 1; i >= 0; i--) {
            const n = nodesRef.current[i];
            if (n.x == null || n.y == null) continue;
            const hit = Math.max(n.r, 16 / cameraRef.current.scale);
            if ((sx - n.x) ** 2 + (sy - n.y) ** 2 <= hit ** 2) return n;
        }
        return null;
    }

    function setHover(n: GraphNode | null) {
        hoveredRef.current = n;
        hlSetRef.current = n ? new Set([n.id, ...(SKILL_ADJACENCY.get(n.id) ?? [])]) : null;
        setHoveredName(n?.id ?? null);
    }

    // ─── Camera ───────────────────────────────────────────────────────────────

    function zoomAt(cx: number, cy: number, factor: number) {
        const cam = cameraRef.current;
        const ns = clamp(cam.scale * factor, MIN_ZOOM, MAX_ZOOM);
        const af = ns / cam.scale;
        cam.x = cx - (cx - cam.x) * af;
        cam.y = cy - (cy - cam.y) * af;
        cam.scale = ns;
        setZoomLevel(ns);
    }

    function fitAll(w: number, h: number) {
        const nodes = nodesRef.current;
        if (!nodes.length) return;
        // Labels are drawn at a fixed screen size, so the fit has to account for them at the
        // candidate scale (not in sim units) — fitScale binary-searches that.
        const { scale, box } = fitScale(nodes, labelPxRef.current, w, h, {
            minScale: MIN_ZOOM,
            maxScale: 1.25,
        });
        cameraRef.current = {
            x: w / 2 - (box.x0 + box.x1) / 2,
            y: h / 2 - (box.y0 + box.y1) / 2,
            scale,
        };
        setZoomLevel(scale);
    }

    /** Publish label-overlap count on the canvas (read by e2e: initial layout must be 0). */
    function reportOverlaps() {
        const c = canvasRef.current;
        if (!c) return;
        c.dataset.overlaps = String(
            countOverlaps(nodesRef.current, labelPxRef.current, cameraRef.current.scale),
        );
        c.dataset.scale = cameraRef.current.scale.toFixed(3);
    }

    // On mobile the graph shouldn't shrink itself down until every node fits
    // the viewport — that's how you end up with unreadably tiny text. Instead,
    // settle at a readable scale and centre the camera on the graph's mass;
    // the user pans/pinches to reach whatever falls outside the initial view.
    // If the graph is small enough to fit fully at that scale anyway, fitAll's
    // (possibly larger) scale wins and nothing is lost.
    function settleCameraMobile(w: number, h: number) {
        fitAll(w, h);
        const MIN_READABLE_SCALE = 1;
        if (cameraRef.current.scale >= MIN_READABLE_SCALE) return;
        const nodes = nodesRef.current;
        if (!nodes.length) return;
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
        for (const n of nodes) {
            if (n.x == null || n.y == null) continue;
            minX = Math.min(minX, n.x);
            maxX = Math.max(maxX, n.x);
            minY = Math.min(minY, n.y);
            maxY = Math.max(maxY, n.y);
        }
        const midX = (minX + maxX) / 2,
            midY = (minY + maxY) / 2;
        cameraRef.current = {
            x: w / 2 - midX * MIN_READABLE_SCALE,
            y: h / 2 - midY * MIN_READABLE_SCALE,
            scale: MIN_READABLE_SCALE,
        };
        setZoomLevel(MIN_READABLE_SCALE);
    }

    // ─── Card anchoring ───────────────────────────────────────────────────────
    //
    // Called at the end of every draw(), so the card follows its node through
    // simulation ticks, drags, pans and zooms — it is positioned by writing
    // style directly (no React re-render per frame) and clamped/flipped to stay
    // inside the canvas.

    function positionCard() {
        const card = cardRef.current;
        const canvas = canvasRef.current;
        const n = hoveredRef.current;
        if (!card || !canvas || !n || n.x == null || n.y == null) return;
        const [sx, sy] = toScreen(n.x, n.y);
        const nr = n.r * cameraRef.current.scale;
        // Node panned/zoomed out of view → hide the card rather than pin it to an edge.
        const offscreen =
            sx + nr < 0 ||
            sy + nr < 0 ||
            sx - nr > canvas.clientWidth ||
            sy - nr > canvas.clientHeight;
        card.style.visibility = offscreen ? 'hidden' : 'visible';
        canvas.dataset.anchor = `${Math.round(sx)},${Math.round(sy)},${Math.round(nr)}`;
        if (offscreen) return;
        const p = placeCard(
            { x: sx - nr, y: sy - nr, w: nr * 2, h: nr * 2 },
            { w: card.offsetWidth, h: card.offsetHeight },
            { x: 0, y: 0, w: canvas.clientWidth, h: canvas.clientHeight },
            { prefer: 'above', gap: 10 },
        );
        card.style.transform = `translate(${p.left}px, ${p.top}px)`;
        // Anchor point for e2e tests (cheap: two attribute writes per frame while hovering).
        canvas.dataset.anchor = `${Math.round(sx)},${Math.round(sy)},${Math.round(nr)}`;
        card.style.visibility = 'visible';
    }

    // ─── Draw ──────────────────────────────────────────────────────────────────

    function draw() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const cam = cameraRef.current;
        const hovered = hoveredRef.current;
        const hlSet = hlSetRef.current;
        const active = activeCatRef.current;
        const hasCatFilter = active.size > 0;
        const { accent, halo, label } = themeRef.current;

        // Pass 1 — edges (sim space via camera)
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.translate(cam.x, cam.y);
        ctx.scale(cam.scale, cam.scale);

        for (const lk of linksRef.current) {
            const s = lk.source as GraphNode;
            const t = lk.target as GraphNode;
            if (s.x == null || s.y == null || t.x == null || t.y == null) continue;
            // An edge is highlighted only when the hovered node is one of its own endpoints.
            // Using hlSet here would also highlight edges between two neighbors, which is wrong.
            const isHighlighted = hovered !== null && (s.id === hovered.id || t.id === hovered.id);
            const dim =
                (hasCatFilter && !active.has(s.skill.category) && !active.has(t.skill.category)) ||
                (hovered !== null && !isHighlighted);
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(t.x, t.y);
            if (dim) {
                ctx.strokeStyle = 'rgba(46,58,74,0.14)';
                ctx.lineWidth = 1 / cam.scale;
            } else if (isHighlighted) {
                // Blend the two category colours for the highlighted edge
                const sc = CATEGORY_META[s.skill.category].color;
                const tc = CATEGORY_META[t.skill.category].color;
                const grad = ctx.createLinearGradient(s.x, s.y, t.x, t.y);
                grad.addColorStop(0, hexToRgba(sc, 0.85));
                grad.addColorStop(1, hexToRgba(tc, 0.85));
                ctx.strokeStyle = grad;
                ctx.lineWidth = 2.5 / cam.scale;
            } else {
                ctx.strokeStyle = hexToRgba(accent, 0.16);
                ctx.lineWidth = 1.25 / cam.scale;
            }
            ctx.stroke();
        }

        // Pass 2 — circles (sim space)
        for (const n of nodesRef.current) {
            if (n.x == null || n.y == null) continue;
            const meta = CATEGORY_META[n.skill.category];
            const isSelf = hovered?.id === n.id;
            const isNear = hlSet?.has(n.id) ?? false;
            const dim =
                (hasCatFilter && !active.has(n.skill.category)) || (hlSet !== null && !isNear);

            if (isSelf) {
                ctx.save();
                ctx.shadowColor = meta.color;
                ctx.shadowBlur = 18 / cam.scale;
            }
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
            ctx.fillStyle = dim
                ? hexToRgba(meta.color, 0.07)
                : isSelf
                  ? hexToRgba(meta.color, 0.3)
                  : hexToRgba(meta.color, 0.18);
            ctx.strokeStyle = dim
                ? hexToRgba(meta.color, 0.12)
                : isSelf
                  ? meta.color
                  : hexToRgba(meta.color, 0.7);
            ctx.lineWidth = (isSelf ? 2 : 1) / cam.scale;
            ctx.fill();
            ctx.stroke();
            if (isSelf) ctx.restore();
        }

        ctx.restore();

        // Pass 3 — labels (screen space, fixed size). Drawn LAST and over the top
        // of edges, with a dark halo stroke so they stay readable when edges run
        // through them.
        if (cam.scale >= 0.3) {
            const labelPx = labelPxRef.current;
            ctx.save();
            ctx.scale(dpr, dpr);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.font = `${labelPx}px ${themeRef.current.font}`;
            // miter joins on text strokes spike at sharp corners — round is cleaner.
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;

            for (const n of nodesRef.current) {
                if (n.x == null || n.y == null) continue;
                const [sx, sy] = toScreen(n.x, n.y);
                const meta = CATEGORY_META[n.skill.category];
                const isSelf = hovered?.id === n.id;
                const isNear = hlSet?.has(n.id) ?? false;
                const dim =
                    (hasCatFilter && !active.has(n.skill.category)) || (hlSet !== null && !isNear);

                const ty = sy + n.r * cam.scale + 3;

                // Halo: thick dark stroke first, then bright fill on top. Skip halo on
                // dimmed labels — they should recede into the background.
                if (!dim) {
                    ctx.lineWidth = 4;
                    ctx.strokeStyle = halo;
                    ctx.strokeText(n.skill.name, sx, ty);
                }

                ctx.fillStyle = dim ? 'rgba(139,148,158,0.30)' : isSelf ? meta.color : label;
                ctx.fillText(n.skill.name, sx, ty);
            }
            ctx.restore();
        }

        positionCard();
    }

    // ─── Simulation ───────────────────────────────────────────────────────────

    function startSimulation(cw: number, ch: number) {
        // Until the new layout is published, no drag can restart a simulation mid-settle.
        simRef.current?.stop();
        simRef.current = null;
        const cx = cw / 2,
            cy = ch / 2;

        const mobile = cw < MOBILE_BREAKPOINT;

        // Continuous interpolation across the 375–1200px range instead of a hard
        // cutoff at MOBILE_BREAKPOINT, so intermediate widths (tablet / small
        // laptop) ease between the two states rather than "popping".
        const t = clamp((cw - 375) / (1200 - 375), 0, 1);
        const lerp = (a: number, b: number) => a + (b - a) * t;

        const minR = lerp(MOBILE_MIN_R, DESKTOP_MIN_R);
        const maxR = lerp(MOBILE_MAX_R, DESKTOP_MAX_R);
        const labelPx = lerp(LABEL_PX_MOBILE, LABEL_PX_DESKTOP);
        const clearance = lerp(LABEL_CLEARANCE_MOBILE, LABEL_CLEARANCE_DESKTOP);
        // Link distance scales with canvas size so clusters can actually reach the
        // edges on wide screens but stay tight on mobile.
        const linkPad = lerp(36, 70);
        const chargeBase = lerp(160, 280);
        const clusterStrength = lerp(0.24, 0.15);
        labelPxRef.current = labelPx;

        // Rough per-character glyph width for the label font, used so the
        // collision force reserves enough room for long label text rather than
        // just the node circle — this is what stops long names like "Endpoint
        // Detection & Response" from overlapping their neighbours.
        const charW = labelPx * 0.64; // Departure Mono advance is 0.636em

        // Start nodes near their cluster center to reduce initial overlap chaos. The jitter is
        // seeded (not Math.random) so every load produces the same, checked layout.
        let seed = 0x9e3779b9;
        const jitter = () => {
            seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
            return seed / 4294967296 - 0.5;
        };
        const nodes: GraphNode[] = skills.map((s) => {
            const [ox, oy] = CLUSTER_OFFSET[s.category];
            return {
                id: s.name,
                skill: s,
                r: weightToRadius(s.weight, minR, maxR),
                labelHalfW: Math.max(10, (s.name.length * charW) / 2 + 6),
                x: cx + ox * cw * 0.5 + jitter() * 40,
                y: cy + oy * ch * 0.5 + jitter() * 40,
            };
        });

        const nodeMap = new Map(nodes.map((n) => [n.id, n]));

        // De-duplicated edge list from the bidirectional adjacency
        const seenEdges = new Set<string>();
        const links: GraphLink[] = [];
        for (const [aid, neighbours] of SKILL_ADJACENCY) {
            for (const bid of neighbours) {
                const edgeKey = aid < bid ? `${aid}||${bid}` : `${bid}||${aid}`;
                if (seenEdges.has(edgeKey)) continue;
                seenEdges.add(edgeKey);
                const s = nodeMap.get(aid),
                    tg = nodeMap.get(bid);
                if (s && tg) links.push({ source: s, target: tg });
            }
        }

        // A rebuilt simulation means new node objects — drop any stale hover.
        if (hoveredRef.current) setHover(nodeMap.get(hoveredRef.current.id) ?? null);

        const sim = forceSimulation<GraphNode>(nodes)
            .force(
                'link',
                forceLink<GraphNode, GraphLink>(links)
                    .id((d) => d.id)
                    .distance(
                        (d) => (d.source as GraphNode).r + (d.target as GraphNode).r + linkPad,
                    )
                    .strength(0.15),
            )
            .force(
                'charge',
                forceManyBody<GraphNode>().strength((d) => -(d.r * 30 + chargeBase)),
            )
            .force('center', forceCenter(cx, cy).strength(0.02))
            // Circles keep a little air between nodes; the label-box force separates each node's
            // real footprint (circle + fixed-size label), and the bounds force keeps the whole
            // layout inside the canvas — so it settles near scale 1, where labels are sized right.
            .force('collide', forceCollide<GraphNode>((d) => d.r + clearance * 0.5).strength(0.7))
            .force('labels', forceLabelBoxes<GraphNode>(labelPx, 6))
            .force(
                'bounds',
                // Keep clear of the zoom controls (top-right, 3 × 36px buttons + gaps).
                forceBounds<GraphNode>(cw, ch, labelPx, 12, 0.5, ZOOM_ZONE(cw)),
            )
            // Cluster forces pull each category toward its designated zone. Strength
            // is slightly higher on mobile so the categories actually separate in the
            // tighter space.
            .force(
                'clusterX',
                forceX<GraphNode>((d) => {
                    const [ox] = CLUSTER_OFFSET[d.skill.category];
                    return cx + ox * cw * 0.5;
                }).strength(clusterStrength),
            )
            .force(
                'clusterY',
                forceY<GraphNode>((d) => {
                    const [, oy] = CLUSTER_OFFSET[d.skill.category];
                    return cy + oy * ch * 0.5;
                }).strength(clusterStrength),
            )
            .alphaDecay(0.012)
            .stop();

        // Settle the layout in ~6 ms slices, yielding between them, instead of 1200 ticks in one
        // go: that was a 300 ms task on a laptop (over a second on a phone) landing mid-scroll as
        // the graph came into view. Same ticks in the same order, so the layout is identical.
        const gen = ++settleGenRef.current;
        let left = 1200;
        const slice = () => {
            if (gen !== settleGenRef.current) return;
            const until = performance.now() + 6;
            while (left > 0 && performance.now() < until) {
                sim.tick();
                left--;
            }
            if (left > 0) {
                setTimeout(slice, 0);
                return;
            }
            // Untangle any last label collisions with only the label/bounds forces running.
            relaxOverlaps(nodes, labelPx, cw, ch, { avoid: ZOOM_ZONE(cw) });
            // Published only now, so nothing (a font-load redraw, a hover) draws a half-settled
            // layout, and no drag reheats one (d3's timer would tick alongside these slices).
            simRef.current = sim;
            nodesRef.current = nodes;
            linksRef.current = links;
            if (mobile) settleCameraMobile(cw, ch);
            else fitAll(cw, ch);
            draw();
            reportOverlaps();
            // The layout is final: the simulation only runs again while a node is being dragged
            // (no idle "breathing", which re-ran every force and nudged labels back together).
            sim.on('tick', draw).on('end', reportOverlaps);
        };
        slice();
    }

    // ─── Effects ─────────────────────────────────────────────────────────────

    // Theme colours + label font: read once, re-read when the terminal `theme` command flips
    // data-theme or the a11y menu flips the readable font on <html>; redraw once web fonts land.
    useEffect(() => {
        const read = () => {
            themeRef.current = {
                accent: cssVar('--ui', '#00FF41'),
                halo: cssVar('--graph-halo', 'rgba(11, 13, 16, 0.92)'),
                label: cssVar('--graph-label', '#E6EDF3'),
                font: cssVar('--font-body', "'Departure Mono', monospace"),
            };
            draw();
        };
        read();
        document.fonts?.ready.then(draw);
        const mo = new MutationObserver(read);
        mo.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme', 'data-a11y-font'],
        });
        return () => mo.disconnect();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const ro = new ResizeObserver((entries) => {
            const w = entries[0].contentRect.width;
            // Skip when the container is CSS-hidden (display:none → width=0)
            if (w <= 0) return;
            const h = effectiveHeight;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            startSimulation(w, h);
        });
        ro.observe(container);

        // Track viewport size to flip mobile/desktop layout when the user rotates
        // the device or resizes the window. Re-running the effect on `isMobile`
        // change rebuilds the simulation with the right radius/clearance.
        const onResize = () => {
            const mobile = window.innerWidth < MOBILE_BREAKPOINT;
            setIsMobile((prev) => (prev !== mobile ? mobile : prev));
        };
        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);

        // Browsers replay a tap as mousemove/mousedown/mouseup ~instantly after
        // touchend. By then the tapped node may have drifted, so the replayed
        // hit-test would clear the card the tap just opened — ignore them.
        let lastTouch = 0;
        const fromTouch = () => performance.now() - lastTouch < 800;

        // A press on a node only becomes a drag once the pointer moves a few pixels. A plain
        // click/tap just shows the card — it must not pin the node or reheat the simulation
        // (which would undo the overlap-free initial layout).
        let press: { node: GraphNode; x: number; y: number } | null = null;
        const DRAG_SLOP = 5;
        function maybeStartDrag(cx: number, cy: number) {
            if (!press || draggedRef.current) return;
            // Not while a new layout settles, nor on a node from the layout it replaced.
            if (!simRef.current || !nodesRef.current.includes(press.node)) return;
            if (Math.hypot(cx - press.x, cy - press.y) < DRAG_SLOP) return;
            const n = press.node;
            draggedRef.current = n;
            n.fx = n.x;
            n.fy = n.y;
            simRef.current?.alphaTarget(0.3).restart();
            canvas!.style.cursor = 'grabbing';
        }

        // Mouse
        function onMouseMove(e: MouseEvent) {
            if (fromTouch()) return;
            const [cx, cy] = cssCoord(e, canvas!);
            maybeStartDrag(cx, cy);
            if (draggedRef.current) {
                const [sx, sy] = toSim(cx, cy);
                draggedRef.current.x = sx;
                draggedRef.current.y = sy;
                draggedRef.current.fx = sx;
                draggedRef.current.fy = sy;
                simRef.current?.alpha(0.2).restart();
                draw();
                return;
            }
            if (isPanRef.current) {
                const { camX, camY, mx, my } = panStartRef.current;
                cameraRef.current.x = camX + (cx - mx);
                cameraRef.current.y = camY + (cy - my);
                draw();
                return;
            }
            const hit = nodeAt(cx, cy);
            if (hit?.id !== hoveredRef.current?.id) {
                setHover(hit);
                canvas!.style.cursor = hit ? 'grab' : 'default';
                draw();
            }
        }
        function onMouseDown(e: MouseEvent) {
            if (fromTouch()) return;
            const [cx, cy] = cssCoord(e, canvas!);
            const hit = nodeAt(cx, cy);
            if (hit) {
                press = { node: hit, x: cx, y: cy };
            } else {
                isPanRef.current = true;
                panStartRef.current = {
                    camX: cameraRef.current.x,
                    camY: cameraRef.current.y,
                    mx: cx,
                    my: cy,
                };
                canvas!.style.cursor = 'move';
            }
        }
        function onMouseUp() {
            press = null;
            if (draggedRef.current) {
                // Node stays pinned — fx/fy intentionally kept
                simRef.current?.alphaTarget(0);
                draggedRef.current = null;
            }
            isPanRef.current = false;
            canvas!.style.cursor = hoveredRef.current ? 'grab' : 'default';
        }
        function onDblClick(e: MouseEvent) {
            const [cx, cy] = cssCoord(e, canvas!);
            const hit = nodeAt(cx, cy);
            if (hit) {
                hit.fx = null;
                hit.fy = null;
                simRef.current?.alpha(0.3).restart();
            }
        }
        function onMouseLeave() {
            if (fromTouch()) return;
            if (draggedRef.current) {
                simRef.current?.alphaTarget(0);
                draggedRef.current = null;
            }
            isPanRef.current = false;
            setHover(null);
            canvas!.style.cursor = 'default';
            draw();
        }
        function onWheel(e: WheelEvent) {
            e.preventDefault();
            const [cx, cy] = cssCoord(e, canvas!);
            zoomAt(cx, cy, Math.pow(0.999, e.deltaY));
            draw();
        }

        // Touch — preventDefault ONLY when we're actually interacting (dragging a
        // node or pinch-zooming). When the user starts a one-finger gesture on
        // empty canvas, we let the browser handle vertical scrolling so the page
        // doesn't get scroll-trapped inside the graph.
        function onTouchStart(e: TouchEvent) {
            lastTouch = performance.now();
            const ts = e.touches;
            if (ts.length === 2) {
                e.preventDefault();
                draggedRef.current = null;
                isPanRef.current = false;
                const [mx, my] = touchMid(ts[0], ts[1], canvas!);
                pinchRef.current = { dist: touchDist(ts[0], ts[1]), mx, my };
                return;
            }
            pinchRef.current = null;
            const [cx, cy] = cssCoord(ts[0], canvas!);
            const hit = nodeAt(cx, cy);
            if (hit) {
                // Touching a node → show its card, and swallow the gesture from the page in case
                // it turns into a drag (which starts only after DRAG_SLOP px of movement).
                e.preventDefault();
                press = { node: hit, x: cx, y: cy };
                setHover(hit);
                draw();
            } else {
                // Empty canvas → let the browser scroll the page. We do NOT enable
                // one-finger panning here on touch; users have pinch-zoom + the fit/
                // zoom buttons, and they need the canvas to be scroll-pass-through.
                setHover(null);
                draw();
            }
        }
        function onTouchMove(e: TouchEvent) {
            const ts = e.touches;
            if (ts.length === 2 && pinchRef.current) {
                e.preventDefault();
                const nd = touchDist(ts[0], ts[1]);
                const [mx, my] = touchMid(ts[0], ts[1], canvas!);
                // Two-finger drag pans (translate by how much the midpoint moved)
                // and pinching zooms — both anchored at the new midpoint, so the
                // combined gesture feels natural instead of only supporting zoom.
                cameraRef.current.x += mx - pinchRef.current.mx;
                cameraRef.current.y += my - pinchRef.current.my;
                zoomAt(mx, my, nd / pinchRef.current.dist);
                pinchRef.current = { dist: nd, mx, my };
                draw();
                return;
            }
            if (ts.length === 1 && press) {
                const [px, py] = cssCoord(ts[0], canvas!);
                maybeStartDrag(px, py);
            }
            if (ts.length === 1 && draggedRef.current) {
                e.preventDefault();
                const [cx, cy] = cssCoord(ts[0], canvas!);
                const [sx, sy] = toSim(cx, cy);
                draggedRef.current.x = sx;
                draggedRef.current.y = sy;
                draggedRef.current.fx = sx;
                draggedRef.current.fy = sy;
                simRef.current?.alpha(0.2).restart();
                draw();
            }
            // Otherwise (1 finger, not dragging a node) → don't preventDefault.
        }
        function onTouchEnd(e: TouchEvent) {
            lastTouch = performance.now();
            press = null;
            if (e.touches.length < 2) pinchRef.current = null;
            if (draggedRef.current) {
                simRef.current?.alphaTarget(0);
                draggedRef.current = null;
            }
            if (e.touches.length === 0) isPanRef.current = false;
        }

        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mousedown', onMouseDown);
        canvas.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('dblclick', onDblClick);
        canvas.addEventListener('mouseleave', onMouseLeave);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd, { passive: false });

        return () => {
            ro.disconnect();
            settleGenRef.current++; // a settle in progress stops at its next slice
            simRef.current?.stop();
            window.removeEventListener('resize', onResize);
            window.removeEventListener('orientationchange', onResize);
            canvas.removeEventListener('mousemove', onMouseMove);
            canvas.removeEventListener('mousedown', onMouseDown);
            canvas.removeEventListener('mouseup', onMouseUp);
            canvas.removeEventListener('dblclick', onDblClick);
            canvas.removeEventListener('mouseleave', onMouseLeave);
            canvas.removeEventListener('wheel', onWheel);
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove', onTouchMove);
            canvas.removeEventListener('touchend', onTouchEnd);
        };
    }, [effectiveHeight]); // eslint-disable-line react-hooks/exhaustive-deps

    // The card mounts after the hover state renders — anchor it immediately so
    // it never flashes at the origin.
    useLayoutEffect(() => {
        if (hoveredName) positionCard();
    }, [hoveredName]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        activeCatRef.current = activeCategories;
        draw();
    }, [activeCategories]); // eslint-disable-line react-hooks/exhaustive-deps

    function toggleCategory(cat: SkillCategory) {
        setActiveCategories((prev) => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
        });
    }

    // ─── Zoom button handlers ─────────────────────────────────────────────────

    function handleZoomIn() {
        const c = canvasRef.current;
        if (c) {
            zoomAt(c.clientWidth / 2, c.clientHeight / 2, 1.3);
            draw();
        }
    }
    function handleZoomOut() {
        const c = canvasRef.current;
        if (c) {
            zoomAt(c.clientWidth / 2, c.clientHeight / 2, 1 / 1.3);
            draw();
        }
    }
    function handleFit() {
        const c = canvasRef.current;
        if (c) {
            fitAll(c.clientWidth, c.clientHeight);
            draw();
        }
    }

    const hoveredSkill = hoveredName ? SKILL_BY_NAME.get(hoveredName) : undefined;

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="skill-graph">
            {/* ── View toggle ── */}
            <div className="sg-toggle" role="group" aria-label="Skill view">
                {(['graph', 'list'] as ViewMode[]).map((m) => (
                    <button
                        key={m}
                        type="button"
                        onClick={() => setViewMode(m)}
                        aria-pressed={viewMode === m}
                        className="sg-btn"
                    >
                        {m === 'graph' ? '⬡ Graph' : '≡ List'}
                    </button>
                ))}
            </div>

            {/* ── List view — always mounted, shown/hidden via CSS ── */}
            <div hidden={viewMode !== 'list'}>
                <ListView />
            </div>

            {/* ── Graph view — always mounted so ResizeObserver stays alive ── */}
            <div hidden={viewMode !== 'graph'}>
                <div ref={containerRef} className="sg-canvas-wrap">
                    <canvas
                        ref={canvasRef}
                        role="img"
                        aria-label="Interactive skill graph. Hover or tap a skill to see where it was used, drag to pin, double-click to unpin, scroll or pinch to zoom. The List view has the same content."
                        // touch-action: pan-y lets the browser scroll the page vertically
                        // when the user drags inside the canvas with one finger on empty
                        // space; our touchstart handler only calls preventDefault when the
                        // gesture actually hits a node or starts a pinch.
                        style={{ display: 'block', width: '100%', touchAction: 'pan-y' }}
                    />

                    {/* Zoom buttons */}
                    <div className="sg-zoom" aria-label="Zoom controls">
                        <button
                            type="button"
                            onClick={handleZoomIn}
                            disabled={zoomLevel >= MAX_ZOOM}
                            aria-label="Zoom in"
                            title="Zoom in"
                        >
                            +
                        </button>
                        <button
                            type="button"
                            onClick={handleFit}
                            aria-label="Fit all nodes"
                            title="Fit all"
                        >
                            ⊙
                        </button>
                        <button
                            type="button"
                            onClick={handleZoomOut}
                            disabled={zoomLevel <= MIN_ZOOM}
                            aria-label="Zoom out"
                            title="Zoom out"
                        >
                            −
                        </button>
                    </div>

                    {/* Card — anchored to the hovered node by positionCard() every frame. */}
                    {hoveredSkill && (
                        <SkillCard
                            key={hoveredSkill.name}
                            skill={hoveredSkill}
                            cardRef={cardRef}
                            style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                visibility: 'hidden',
                                pointerEvents: 'none',
                            }}
                        />
                    )}
                </div>

                {/* Legend / filter — multi-select. Click multiple categories to
                    highlight them all at once; click again to remove. */}
                <div
                    className="sg-legend"
                    role="group"
                    aria-label="Filter by category (multi-select)"
                >
                    {CATEGORY_ORDER.map((cat) => {
                        const { label, color } = CATEGORY_META[cat];
                        const on = activeCategories.has(cat);
                        return (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => toggleCategory(cat)}
                                aria-pressed={on}
                                className="sg-chip"
                                style={{ ['--cat' as string]: color }}
                            >
                                <span className="sg-chip__dot" aria-hidden="true" />
                                {label}
                            </button>
                        );
                    })}
                    {activeCategories.size > 0 && (
                        <button
                            type="button"
                            className="sg-chip sg-chip--clear"
                            onClick={() => setActiveCategories(new Set())}
                        >
                            clear
                        </button>
                    )}
                </div>

                <p className="sg-hint">
                    {isMobile
                        ? 'tap a skill · pinch to zoom · two-finger drag to pan · ⊙ fits everything'
                        : 'hover a skill · scroll / pinch to zoom · drag to pin · double-click to release'}
                </p>
            </div>
        </div>
    );
}
