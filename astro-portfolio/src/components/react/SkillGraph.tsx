import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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

interface Camera { x: number; y: number; scale: number; }

interface TooltipState {
  name: string; weight: number; category: SkillCategory;
  projects: string[]; cssX: number; cssY: number; below: boolean;
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
const MOBILE_MIN_R  = 5;
const MOBILE_MAX_R  = 14;

const LABEL_PX_DESKTOP = 13;
const LABEL_PX_MOBILE  = 11;

// Collision radius padding: allows labels to breathe without overcrowding.
const LABEL_CLEARANCE_DESKTOP = 32;
const LABEL_CLEARANCE_MOBILE  = 18;

function weightToRadius(w: number, minR: number, maxR: number): number {
  const clamped = Math.max(1, Math.min(10, w));
  return minR + ((clamped - 1) / 9) * (maxR - minR);
}

// Visual (clockwise, starting at the top) order for the category clusters.
const CATEGORY_ORDER: SkillCategory[] = [
  'languages', 'frameworks', 'cloud', 'experience', 'security-skills', 'security-tools',
];

// Cluster centroids sit on a circle around the canvas centre, but unlike a
// fixed pentagon/hexagon of equal slices, each category claims an angular
// arc proportional to how many skills it holds and is pushed to a radius
// that also grows with its member count. A fixed equal-slice layout crammed
// the two ~12-13 node security categories while leaving smaller categories
// (cloud, experience) surrounded by disproportionate empty space — this
// keeps categories grouped but gives each roughly the canvas area it needs.
// Values are fractions of half-canvas width/height.
function buildClusterOffsets(): Record<SkillCategory, [number, number]> {
  const counts = new Map<SkillCategory, number>();
  for (const s of skills) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
  const total = skills.length;
  const offsets = {} as Record<SkillCategory, [number, number]>;
  let angle = -Math.PI / 2; // start at the top
  for (const cat of CATEGORY_ORDER) {
    const count  = counts.get(cat) ?? 1;
    const sector = (count / total) * Math.PI * 2;
    const mid    = angle + sector / 2;
    const radius = 0.40 + 0.075 * Math.sqrt(count);
    offsets[cat] = [Math.cos(mid) * radius, Math.sin(mid) * radius];
    angle += sector;
  }
  return offsets;
}
const CLUSTER_OFFSET = buildClusterOffsets();

// Pre-compute bidirectional adjacency for the ListView — `skills` is static,
// so this never changes after module load.
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
    { clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 } as Touch, c
  );
}

// ─── List view ────────────────────────────────────────────────────────────────
//
// Top-level component so it keeps its hover state across parent re-renders.
// Renders the same categorised skill grid as the graph but as text chips, with
// a fixed-position tooltip anchored to the hovered chip's bounding box (NOT
// the mouse position — that was causing the tooltip to drift far from its
// anchor). On hover/focus, related skills get a subtle highlight and unrelated
// skills are dimmed, mirroring the graph's behaviour.

interface ListHoverState {
  skill: Skill;
  rect: DOMRect;
}

function ListView() {
  const [listHovered, setListHovered] = useState<ListHoverState | null>(null);
  const [tooltipPos, setTooltipPos]   = useState<{ left: number; top: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const listMeta  = listHovered ? CATEGORY_META[listHovered.skill.category] : null;
  const cats      = Object.keys(CATEGORY_META) as SkillCategory[];

  // Skills directly connected to the hovered one — used to highlight related
  // chips and dim everything else.
  const relatedSet: Set<string> | null = listHovered
    ? SKILL_ADJACENCY.get(listHovered.skill.name) ?? new Set()
    : null;

  // Re-measure the tooltip after render so we can keep it on-screen no matter
  // which chip the user hovered. We anchor below-left by default and flip to
  // above the chip when there isn't enough room below.
  useEffect(() => {
    if (!listHovered) { setTooltipPos(null); return; }
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    const tw = tooltip.offsetWidth  || 240;
    const th = tooltip.offsetHeight || 80;
    const r  = listHovered.rect;
    const vw = typeof window !== 'undefined' ? window.innerWidth  : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

    // Prefer below the chip; flip above if it would overflow.
    let top = r.bottom + 8;
    if (top + th > vh - 8) top = Math.max(8, r.top - th - 8);

    // Align tooltip's left edge with the chip's left edge, clamped to viewport.
    let left = r.left;
    if (left + tw > vw - 8) left = vw - 8 - tw;
    if (left < 8) left = 8;

    setTooltipPos({ left, top });
  }, [listHovered]);

  function onItemEnter(skill: Skill, el: HTMLElement) {
    setListHovered({ skill, rect: el.getBoundingClientRect() });
  }

  return (
    <div style={{ position: 'relative' }}>
      <div className="skills-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {cats.map(cat => (
          <div key={cat} className="skill-category">
            <h3 style={{ color: CATEGORY_META[cat].color }}>{CATEGORY_META[cat].label}</h3>
            <ul className="skill-list">
              {skills
                .filter(s => s.category === cat)
                .sort((a, b) => b.weight - a.weight)
                .map(s => {
                  const isHovered = listHovered?.skill.name === s.name;
                  const isRelated = !isHovered && relatedSet !== null && relatedSet.has(s.name);
                  const isDimmed  = listHovered !== null && !isHovered && !isRelated;
                  const meta      = CATEGORY_META[s.category];

                  const style: React.CSSProperties = { cursor: 'pointer' };
                  if (isHovered) {
                    // Brightest: own category colour + glow.
                    style.borderColor = meta.color;
                    style.color       = meta.color;
                    style.background  = hexToRgba(meta.color, 0.12);
                    style.boxShadow   = `0 0 10px ${hexToRgba(meta.color, 0.45)}`;
                  } else if (isRelated) {
                    // Subtle: tinted border, no glow, slightly brighter text.
                    style.borderColor = hexToRgba(meta.color, 0.6);
                    style.color       = hexToRgba(meta.color, 0.95);
                    style.background  = hexToRgba(meta.color, 0.06);
                  } else if (isDimmed) {
                    style.opacity = 0.28;
                  }

                  return (
                    <li
                      key={s.name}
                      tabIndex={0}
                      style={style}
                      onMouseEnter={(e) => onItemEnter(s, e.currentTarget as HTMLLIElement)}
                      onMouseLeave={() => setListHovered(null)}
                      onFocus={(e) => onItemEnter(s, e.currentTarget as HTMLLIElement)}
                      onBlur={() => setListHovered(null)}
                      // Mobile: tap to reveal. A second tap on the same item clears it.
                      onClick={(e) => {
                        const el = e.currentTarget as HTMLLIElement;
                        if (listHovered?.skill.name === s.name) {
                          setListHovered(null);
                        } else {
                          onItemEnter(s, el);
                        }
                      }}
                    >
                      {s.name}
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>

      {/* Skill detail tooltip — rendered via portal into document.body so it
          is never clipped or mispositioned by ancestor transforms (the .reveal
          animation leaves transform:translateY(0) on its element, which creates
          a new containing block for position:fixed children). */}
      {listHovered && listMeta && typeof document !== 'undefined' && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          style={{
            position: 'fixed',
            left: tooltipPos?.left ?? 0,
            top:  tooltipPos?.top  ?? 0,
            visibility: tooltipPos ? 'visible' : 'hidden',
            background: 'var(--bg-elevated)',
            border: `1px solid ${listMeta.color}`,
            borderRadius: 'var(--radius)',
            padding: '8px 12px',
            pointerEvents: 'none',
            fontFamily: 'var(--font-display)',
            fontSize: '0.75rem',
            color: listMeta.color,
            zIndex: 9999,
            boxShadow: `0 0 12px ${hexToRgba(listMeta.color, 0.25)}`,
            maxWidth: 260,
          }}
        >
          <div style={{ marginBottom: 2 }}>
            <strong>{listHovered.skill.name}</strong>
            <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
              {listHovered.skill.weight}/10
            </span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginBottom: 4 }}>
            {listMeta.label}
          </div>
          {(listHovered.skill.relatedProjects?.length ?? 0) > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', borderTop: '1px solid var(--border)', paddingTop: 4, marginTop: 2 }}>
              {listHovered.skill.relatedProjects!.map(p => (
                <li key={p} style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', lineHeight: 1.5, whiteSpace: 'normal' }}>
                  › {p}
                </li>
              ))}
            </ul>
          )}
          {relatedSet && relatedSet.size > 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 4 }}>
              {relatedSet.size} connection{relatedSet.size !== 1 ? 's' : ''}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SkillGraph({ height = 700 }: { height?: number }) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef       = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const nodesRef     = useRef<GraphNode[]>([]);
  const linksRef     = useRef<GraphLink[]>([]);
  // Bidirectional adjacency for the active graph instance (used during draw).
  const biAdjRef     = useRef<Map<string, Set<string>>>(SKILL_ADJACENCY);
  const cameraRef    = useRef<Camera>({ x: 0, y: 0, scale: 1 });
  const hoveredRef   = useRef<GraphNode | null>(null);
  const draggedRef   = useRef<GraphNode | null>(null);
  const isPanRef     = useRef(false);
  const panStartRef  = useRef({ camX: 0, camY: 0, mx: 0, my: 0 });
  const pinchRef     = useRef<{ dist: number; mx: number; my: number } | null>(null);
  const activeCatRef = useRef<Set<SkillCategory>>(new Set());
  const isMobileRef  = useRef(false);
  const labelPxRef   = useRef(LABEL_PX_DESKTOP);

  const [zoomLevel,        setZoomLevel]        = useState(1);
  const [activeCategories, setActiveCategories] = useState<Set<SkillCategory>>(new Set());
  const [tooltip,          setTooltip]          = useState<TooltipState | null>(null);
  const [viewMode,         setViewMode]         = useState<ViewMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT ? 'list' : 'graph'
  );
  const [isMobile,         setIsMobile]         = useState(
    typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT,
  );

  // On mobile, cap the canvas height so users can still scroll past it without
  // getting trapped in the canvas. ~70% of viewport height feels right.
  const effectiveHeight =
    isMobile && typeof window !== 'undefined'
      ? Math.min(height, Math.max(360, Math.round(window.innerHeight * 0.7)))
      : height;

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
      const hit = Math.max(n.r, 16);
      if ((sx - n.x) ** 2 + (sy - n.y) ** 2 <= hit ** 2) return n;
    }
    return null;
  }

  // ─── Camera ───────────────────────────────────────────────────────────────

  function zoomAt(cx: number, cy: number, factor: number) {
    const cam = cameraRef.current;
    const ns  = clamp(cam.scale * factor, MIN_ZOOM, MAX_ZOOM);
    const af  = ns / cam.scale;
    cam.x = cx - (cx - cam.x) * af;
    cam.y = cy - (cy - cam.y) * af;
    cam.scale = ns;
    setZoomLevel(ns);
  }

  function fitAll(w: number, h: number) {
    const nodes = nodesRef.current;
    if (!nodes.length) return;
    const PAD = 52;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      if (n.x == null || n.y == null) continue;
      minX = Math.min(minX, n.x - n.r);
      minY = Math.min(minY, n.y - n.r);
      maxX = Math.max(maxX, n.x + n.r);
      // Account for label clearance below node in sim space (approx)
      maxY = Math.max(maxY, n.y + n.r + 24);
    }
    const gw = maxX - minX, gh = maxY - minY;
    if (!gw || !gh) return;
    const scale = clamp(Math.min((w - PAD * 2) / gw, (h - PAD * 2) / gh), MIN_ZOOM, MAX_ZOOM);
    cameraRef.current = {
      x: w / 2 - ((minX + maxX) / 2) * scale,
      y: h / 2 - ((minY + maxY) / 2) * scale,
      scale,
    };
    setZoomLevel(scale);
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
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      if (n.x == null || n.y == null) continue;
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    }
    const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
    cameraRef.current = {
      x: w / 2 - midX * MIN_READABLE_SCALE,
      y: h / 2 - midY * MIN_READABLE_SCALE,
      scale: MIN_READABLE_SCALE,
    };
    setZoomLevel(MIN_READABLE_SCALE);
  }

  // ─── Draw ──────────────────────────────────────────────────────────────────

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx)  return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cam     = cameraRef.current;
    const hovered = hoveredRef.current;
    const active  = activeCatRef.current;
    const hasCatFilter = active.size > 0;
    // hlSet: the hovered node + its direct neighbors — used for NODE dimming/highlighting only
    const hlSet   = hovered
      ? new Set([hovered.id, ...(biAdjRef.current.get(hovered.id) ?? [])])
      : null;

    // Read accent color from CSS for edge tinting
    const accentColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent').trim() || '#00FF41';
    // Background color for label halo — should match the graph card background
    // so the label "punches out" of any edges crossing behind it.
    const haloColor = 'rgba(11, 13, 16, 0.92)';

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
        ctx.lineWidth   = 1 / cam.scale;
      } else if (isHighlighted) {
        // Blend the two category colours for the highlighted edge
        const sc = CATEGORY_META[s.skill.category].color;
        const tc = CATEGORY_META[t.skill.category].color;
        const grad = ctx.createLinearGradient(s.x, s.y, t.x, t.y);
        grad.addColorStop(0, hexToRgba(sc, 0.85));
        grad.addColorStop(1, hexToRgba(tc, 0.85));
        ctx.strokeStyle = grad;
        ctx.lineWidth   = 2.5 / cam.scale;
      } else {
        ctx.strokeStyle = hexToRgba(accentColor, 0.16);
        ctx.lineWidth   = 1.25 / cam.scale;
      }
      ctx.stroke();
    }

    // Pass 2 — circles (sim space)
    for (const n of nodesRef.current) {
      if (n.x == null || n.y == null) continue;
      const meta   = CATEGORY_META[n.skill.category];
      const isSelf = hovered?.id === n.id;
      const isNear = hlSet?.has(n.id) ?? false;
      const dim    =
        (hasCatFilter && !active.has(n.skill.category)) ||
        (hlSet !== null && !isNear);

      if (isSelf) {
        ctx.save();
        ctx.shadowColor = meta.color;
        ctx.shadowBlur  = 18 / cam.scale;
      }
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle   = dim ? hexToRgba(meta.color, 0.07) : isSelf ? hexToRgba(meta.color, 0.30) : hexToRgba(meta.color, 0.18);
      ctx.strokeStyle = dim ? hexToRgba(meta.color, 0.12) : isSelf ? meta.color               : hexToRgba(meta.color, 0.7);
      ctx.lineWidth   = (isSelf ? 2 : 1) / cam.scale;
      ctx.fill();
      ctx.stroke();
      if (isSelf) ctx.restore();
    }

    ctx.restore();

    // Pass 3 — labels (screen space, fixed size). Drawn LAST and over the top
    // of edges, with a dark halo stroke so they stay readable when edges run
    // through them.
    if (cam.scale >= 0.30) {
      const labelPx = labelPxRef.current;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.font         = `600 ${labelPx}px 'JetBrains Mono', monospace`;
      // miter joins on text strokes spike at sharp corners — round is cleaner.
      ctx.lineJoin     = 'round';
      ctx.miterLimit   = 2;

      for (const n of nodesRef.current) {
        if (n.x == null || n.y == null) continue;
        const [sx, sy] = toScreen(n.x, n.y);
        const meta     = CATEGORY_META[n.skill.category];
        const isSelf   = hovered?.id === n.id;
        const isNear   = hlSet?.has(n.id) ?? false;
        const dim      =
          (hasCatFilter && !active.has(n.skill.category)) ||
          (hlSet !== null && !isNear);

        const ty = sy + n.r * cam.scale + 3;

        // Halo: thick dark stroke first, then bright fill on top. Skip halo on
        // dimmed labels — they should recede into the background.
        if (!dim) {
          ctx.lineWidth   = 4;
          ctx.strokeStyle = haloColor;
          ctx.strokeText(n.skill.name, sx, ty);
        }

        ctx.fillStyle = dim
          ? 'rgba(139,148,158,0.30)'
          : isSelf
            ? meta.color
            : '#E6EDF3';
        ctx.fillText(n.skill.name, sx, ty);
      }
      ctx.restore();
    }
  }

  // ─── Tooltip ──────────────────────────────────────────────────────────────

  function showTooltip(n: GraphNode) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const [sx, sy] = toScreen(n.x ?? 0, n.y ?? 0);
    const nr = n.r * cameraRef.current.scale;
    const below = sy - nr - 8 < 80;
    setTooltip({
      name: n.skill.name, weight: n.skill.weight, category: n.skill.category,
      projects: n.skill.relatedProjects ?? [],
      cssX: sx, cssY: sy + (below ? nr + 6 : -nr - 8), below,
    });
  }

  // ─── Simulation ───────────────────────────────────────────────────────────

  function startSimulation(cw: number, ch: number) {
    simRef.current?.stop();
    const cx = cw / 2, cy = ch / 2;

    const mobile = cw < MOBILE_BREAKPOINT;
    isMobileRef.current = mobile;

    // Continuous interpolation across the 375–1200px range instead of a hard
    // cutoff at MOBILE_BREAKPOINT, so intermediate widths (tablet / small
    // laptop) ease between the two states rather than "popping".
    const t    = clamp((cw - 375) / (1200 - 375), 0, 1);
    const lerp = (a: number, b: number) => a + (b - a) * t;

    const minR             = lerp(MOBILE_MIN_R, DESKTOP_MIN_R);
    const maxR             = lerp(MOBILE_MAX_R, DESKTOP_MAX_R);
    const labelPx           = lerp(LABEL_PX_MOBILE, LABEL_PX_DESKTOP);
    const clearance         = lerp(LABEL_CLEARANCE_MOBILE, LABEL_CLEARANCE_DESKTOP);
    // Link distance scales with canvas size so clusters can actually reach the
    // edges on wide screens but stay tight on mobile.
    const linkPad           = lerp(36, 70);
    const chargeBase        = lerp(160, 280);
    const clusterStrength   = lerp(0.24, 0.15);
    labelPxRef.current = labelPx;

    // Rough per-character glyph width for the label font, used so the
    // collision force reserves enough room for long label text rather than
    // just the node circle — this is what stops long names like "Endpoint
    // Detection & Response" from overlapping their neighbours.
    const charW = labelPx * 0.62;

    // Start nodes near their cluster center to reduce initial overlap chaos
    const nodes: GraphNode[] = skills.map(s => {
      const [ox, oy] = CLUSTER_OFFSET[s.category];
      return {
        id:    s.name,
        skill: s,
        r:     weightToRadius(s.weight, minR, maxR),
        labelHalfW: Math.max(10, (s.name.length * charW) / 2 + 6),
        x:     cx + ox * cw * 0.5 + (Math.random() - 0.5) * 40,
        y:     cy + oy * ch * 0.5 + (Math.random() - 0.5) * 40,
      };
    });

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Build bidirectional adjacency (normalises any remaining data asymmetries)
    const biAdj = new Map<string, Set<string>>();
    for (const n of nodes) {
      if (!biAdj.has(n.id)) biAdj.set(n.id, new Set());
      for (const conn of n.skill.connections ?? []) {
        if (conn === n.id) continue; // ignore self-connections
        biAdj.get(n.id)!.add(conn);
        if (!biAdj.has(conn)) biAdj.set(conn, new Set());
        biAdj.get(conn)!.add(n.id);
      }
    }
    biAdjRef.current = biAdj;

    // Build de-duplicated edge list using bidirectional adjacency
    const seenEdges = new Set<string>();
    const links: GraphLink[] = [];
    for (const [aid, neighbours] of biAdj) {
      for (const bid of neighbours) {
        const edgeKey = aid < bid ? `${aid}||${bid}` : `${bid}||${aid}`;
        if (seenEdges.has(edgeKey)) continue;
        seenEdges.add(edgeKey);
        const s = nodeMap.get(aid), t = nodeMap.get(bid);
        if (s && t) links.push({ source: s, target: t });
      }
    }

    nodesRef.current = nodes;
    linksRef.current = links;

    const sim = forceSimulation<GraphNode>(nodes)
      .force('link', forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(d => (d.source as GraphNode).r + (d.target as GraphNode).r + linkPad)
        .strength(0.15))
      .force('charge', forceManyBody<GraphNode>().strength(d => -(d.r * 30 + chargeBase)))
      .force('center', forceCenter(cx, cy).strength(0.02))
      // Collision radius is whichever is larger: the node circle plus a
      // small clearance, or half the node's own label width — so long
      // labels get the room they need instead of overlapping neighbours.
      .force('collide', forceCollide<GraphNode>(d => Math.max(d.r + clearance, d.labelHalfW)).strength(0.9))
      // Cluster forces pull each category toward its designated zone. Strength
      // is slightly higher on mobile so the categories actually separate in the
      // tighter space.
      .force('clusterX', forceX<GraphNode>(d => {
        const [ox] = CLUSTER_OFFSET[d.skill.category];
        return cx + ox * cw * 0.5;
      }).strength(clusterStrength))
      .force('clusterY', forceY<GraphNode>(d => {
        const [, oy] = CLUSTER_OFFSET[d.skill.category];
        return cy + oy * ch * 0.5;
      }).strength(clusterStrength))
      .alphaDecay(0.012)
      .stop();

    simRef.current = sim;

    // Settle synchronously — more ticks for better initial layout
    sim.tick(1200);
    if (mobile) settleCameraMobile(cw, ch); else fitAll(cw, ch);
    draw();

    if (!prefersReduced) {
      sim.alpha(0.04).on('tick', draw).restart();
    }
  }

  // ─── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    const canvas    = canvasRef.current;
    if (!container || !canvas) return;

    const ro = new ResizeObserver(entries => {
      const w   = entries[0].contentRect.width;
      // Skip when the container is CSS-hidden (display:none → width=0)
      if (w <= 0) return;
      const h   = effectiveHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width        = w * dpr;
      canvas.height       = h * dpr;
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${h}px`;
      startSimulation(w, h);
    });
    ro.observe(container);

    // Track viewport size to flip mobile/desktop layout when the user rotates
    // the device or resizes the window. Re-running the effect on `isMobile`
    // change rebuilds the simulation with the right radius/clearance.
    const onResize = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(prev => (prev !== mobile ? mobile : prev));
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    // Mouse
    function onMouseMove(e: MouseEvent) {
      const [cx, cy] = cssCoord(e, canvas!);
      if (draggedRef.current) {
        const [sx, sy]       = toSim(cx, cy);
        draggedRef.current.x = sx; draggedRef.current.y = sy;
        draggedRef.current.fx = sx; draggedRef.current.fy = sy;
        simRef.current?.alpha(0.2).restart();
        showTooltip(draggedRef.current);
        draw();
        return;
      }
      if (isPanRef.current) {
        const { camX, camY, mx, my } = panStartRef.current;
        cameraRef.current.x = camX + (cx - mx);
        cameraRef.current.y = camY + (cy - my);
        if (hoveredRef.current) showTooltip(hoveredRef.current);
        draw();
        return;
      }
      const hit = nodeAt(cx, cy);
      if (hit?.id !== hoveredRef.current?.id) {
        hoveredRef.current        = hit;
        canvas!.style.cursor = hit ? 'grab' : 'default';
        hit ? showTooltip(hit) : setTooltip(null);
        draw();
      }
    }
    function onMouseDown(e: MouseEvent) {
      const [cx, cy] = cssCoord(e, canvas!);
      const hit = nodeAt(cx, cy);
      if (hit) {
        draggedRef.current = hit; hit.fx = hit.x; hit.fy = hit.y;
        simRef.current?.alphaTarget(0.3).restart();
        canvas!.style.cursor = 'grabbing';
      } else {
        isPanRef.current = true;
        panStartRef.current = { camX: cameraRef.current.x, camY: cameraRef.current.y, mx: cx, my: cy };
        canvas!.style.cursor = 'move';
      }
    }
    function onMouseUp() {
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
      if (hit) { hit.fx = null; hit.fy = null; simRef.current?.alpha(0.3).restart(); }
    }
    function onMouseLeave() {
      if (draggedRef.current) { simRef.current?.alphaTarget(0); draggedRef.current = null; }
      isPanRef.current = false;
      hoveredRef.current = null; setTooltip(null);
      canvas!.style.cursor = 'default'; draw();
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const [cx, cy] = cssCoord(e, canvas!);
      zoomAt(cx, cy, Math.pow(0.999, e.deltaY));
      if (hoveredRef.current) showTooltip(hoveredRef.current);
      draw();
    }

    // Touch — preventDefault ONLY when we're actually interacting (dragging a
    // node or pinch-zooming). When the user starts a one-finger gesture on
    // empty canvas, we let the browser handle vertical scrolling so the page
    // doesn't get scroll-trapped inside the graph.
    function onTouchStart(e: TouchEvent) {
      const ts = e.touches;
      if (ts.length === 2) {
        e.preventDefault();
        draggedRef.current = null; isPanRef.current = false;
        const [mx, my] = touchMid(ts[0], ts[1], canvas!);
        pinchRef.current = { dist: touchDist(ts[0], ts[1]), mx, my };
        return;
      }
      pinchRef.current = null;
      const [cx, cy] = cssCoord(ts[0], canvas!);
      const hit = nodeAt(cx, cy);
      if (hit) {
        // Touching a node → drag intent, swallow the gesture from the page.
        e.preventDefault();
        draggedRef.current = hit; hoveredRef.current = hit;
        hit.fx = hit.x; hit.fy = hit.y;
        simRef.current?.alphaTarget(0.3).restart();
        showTooltip(hit);
        draw();
      } else {
        // Empty canvas → let the browser scroll the page. We do NOT enable
        // one-finger panning here on touch; users have pinch-zoom + the fit/
        // zoom buttons, and they need the canvas to be scroll-pass-through.
        hoveredRef.current = null;
        setTooltip(null);
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
        if (hoveredRef.current) showTooltip(hoveredRef.current);
        draw(); return;
      }
      if (ts.length === 1 && draggedRef.current) {
        e.preventDefault();
        const [cx, cy] = cssCoord(ts[0], canvas!);
        const [sx, sy] = toSim(cx, cy);
        draggedRef.current.x = sx; draggedRef.current.y = sy;
        draggedRef.current.fx = sx; draggedRef.current.fy = sy;
        simRef.current?.alpha(0.2).restart();
        showTooltip(draggedRef.current);
        draw();
      }
      // Otherwise (1 finger, not dragging a node) → don't preventDefault.
    }
    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) pinchRef.current = null;
      if (draggedRef.current) { simRef.current?.alphaTarget(0); draggedRef.current = null; }
      if (e.touches.length === 0) isPanRef.current = false;
    }

    canvas.addEventListener('mousemove',  onMouseMove);
    canvas.addEventListener('mousedown',  onMouseDown);
    canvas.addEventListener('mouseup',    onMouseUp);
    canvas.addEventListener('dblclick',   onDblClick);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel',      onWheel,      { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   onTouchEnd,   { passive: false });

    return () => {
      ro.disconnect();
      simRef.current?.stop();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      canvas.removeEventListener('mousemove',  onMouseMove);
      canvas.removeEventListener('mousedown',  onMouseDown);
      canvas.removeEventListener('mouseup',    onMouseUp);
      canvas.removeEventListener('dblclick',   onDblClick);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('wheel',      onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove',  onTouchMove);
      canvas.removeEventListener('touchend',   onTouchEnd);
    };
  }, [effectiveHeight]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    activeCatRef.current = activeCategories;
    draw();
  }, [activeCategories]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleCategory(cat: SkillCategory) {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  // ─── Zoom button handlers ─────────────────────────────────────────────────

  function handleZoomIn() {
    const c = canvasRef.current;
    if (c) { zoomAt(c.clientWidth / 2, c.clientHeight / 2, 1.3); draw(); }
  }
  function handleZoomOut() {
    const c = canvasRef.current;
    if (c) { zoomAt(c.clientWidth / 2, c.clientHeight / 2, 1 / 1.3); draw(); }
  }
  function handleFit() {
    const c = canvasRef.current;
    if (c) { fitAll(c.clientWidth, c.clientHeight); draw(); }
  }

  // ─── Style helpers ────────────────────────────────────────────────────────

  const btnBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, padding: 0,
    fontFamily: 'var(--font-display)', fontSize: '1rem',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', color: 'var(--text-secondary)',
    cursor: 'pointer', transition: 'all 0.15s ease', lineHeight: 1,
  };

  const tooltipMeta = tooltip ? CATEGORY_META[tooltip.category] : null;

  const cats = Object.keys(CATEGORY_META) as SkillCategory[];

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ width: '100%' }}>
      {/* ── View toggle ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem', gap: '0.5rem' }}>
        {(['graph', 'list'] as ViewMode[]).map(m => (
          <button
            key={m}
            onClick={() => setViewMode(m)}
            aria-pressed={viewMode === m}
            style={{
              padding: '5px 14px',
              fontSize: '0.72rem',
              fontFamily: 'var(--font-display)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              background: viewMode === m ? 'var(--accent-bg)' : 'var(--bg-elevated)',
              border: `1px solid ${viewMode === m ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              color: viewMode === m ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {m === 'graph' ? '⬡ Graph' : '≡ List'}
          </button>
        ))}
      </div>

      {/* ── List view — always mounted, shown/hidden via CSS ── */}
      <div style={{ display: viewMode === 'list' ? 'block' : 'none' }}>
        <ListView />
      </div>

      {/* ── Graph view — always mounted so ResizeObserver stays alive ── */}
      <div style={{ display: viewMode === 'graph' ? 'block' : 'none' }}>
        <div ref={containerRef} style={{
          position: 'relative', width: '100%',
          background: 'rgba(27, 27, 27, 0.29)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="Interactive skill graph. Hover to highlight, drag to pin, double-click to unpin, scroll or pinch to zoom."
            // touch-action: pan-y lets the browser scroll the page vertically
            // when the user drags inside the canvas with one finger on empty
            // space; our touchstart handler only calls preventDefault when the
            // gesture actually hits a node or starts a pinch.
            style={{ display: 'block', width: '100%', cursor: 'default', touchAction: 'pan-y' }}
          />

          {/* Zoom buttons */}
          <div aria-label="Zoom controls" style={{
            position: 'absolute', top: 12, right: 12,
            display: 'flex', flexDirection: 'column', gap: 4, zIndex: 5,
          }}>
            <button onClick={handleZoomIn}  disabled={zoomLevel >= MAX_ZOOM} aria-label="Zoom in"       style={btnBase} title="Zoom in">+</button>
            <button onClick={handleFit}                                       aria-label="Fit all nodes" style={btnBase} title="Fit all">⊙</button>
            <button onClick={handleZoomOut} disabled={zoomLevel <= MIN_ZOOM} aria-label="Zoom out"      style={btnBase} title="Zoom out">−</button>
          </div>

          {/* Tooltip */}
          {tooltip && tooltipMeta && (
            <div role="tooltip" style={{
              position: 'absolute', left: tooltip.cssX, top: tooltip.cssY,
              transform: tooltip.below ? 'translate(-50%,0)' : 'translate(-50%,-100%)',
              background: 'var(--bg-elevated)', border: `1px solid ${tooltipMeta.color}`,
              borderRadius: 'var(--radius)', padding: '8px 12px',
              pointerEvents: 'none', fontFamily: 'var(--font-display)',
              fontSize: '0.75rem', color: tooltipMeta.color, whiteSpace: 'nowrap',
              zIndex: 10, boxShadow: `0 0 12px ${hexToRgba(tooltipMeta.color, 0.25)}`,
              maxWidth: 230,
            }}>
              <div style={{ marginBottom: tooltip.projects.length ? 4 : 0 }}>
                <strong>{tooltip.name}</strong>
                <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}> {tooltip.weight}/10</span>
              </div>
              {tooltip.projects.length > 0 && (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', borderTop: '1px solid var(--border)', paddingTop: 4, marginTop: 2 }}>
                  {tooltip.projects.map(p => (
                    <li key={p} style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', lineHeight: 1.5, whiteSpace: 'normal' }}>› {p}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Legend / filter — multi-select. Click multiple categories to
              highlight them all at once; click again to remove. */}
          <div role="group" aria-label="Filter by category (multi-select)" style={{
            display: 'flex', flexWrap: 'wrap', gap: '0.5rem',
            marginTop: '0.875rem', justifyContent: 'center',
          }}>
            {cats.map(cat => {
              const { label, color } = CATEGORY_META[cat];
              const on = activeCategories.has(cat);
              return (
                <button key={cat} onClick={() => toggleCategory(cat)} aria-pressed={on} style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '5px 14px', fontSize: '0.75rem', fontFamily: 'var(--font-display)',
                  background: on ? hexToRgba(color, 0.15) : 'var(--bg-elevated)',
                  border: `1px solid ${on ? color : 'var(--border)'}`,
                  borderRadius: 'var(--radius)', color: on ? color : 'var(--text-secondary)',
                  cursor: 'pointer', transition: 'all 0.15s ease', minHeight: 44,
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: on ? `0 0 6px ${color}` : 'none' }} />
                  {label}
                </button>
              );
            })}
            {activeCategories.size > 0 && (
              <button onClick={() => setActiveCategories(new Set())} style={{
                padding: '5px 14px', fontSize: '0.75rem', fontFamily: 'var(--font-display)',
                background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', color: 'var(--text-muted)',
                cursor: 'pointer', minHeight: 44,
              }}>clear</button>
            )}
          </div>

          <p style={{ textAlign: 'center', fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', marginTop: '0.5rem' }}>
            {isMobile
              ? 'two-finger drag to pan · pinch to zoom · ⊙ fits everything'
              : 'scroll / pinch to zoom · drag to pin · double-click to release'}
          </p>
        </div>
      </div>   {/* end graph show/hide wrapper */}
    </div>
  );
}
