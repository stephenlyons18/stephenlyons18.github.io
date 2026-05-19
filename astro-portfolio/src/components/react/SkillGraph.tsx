import { useRef, useEffect, useState } from 'react';
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

const MIN_R    = 7;
const MAX_R    = 20;
const LABEL_PX = 12;   // fixed screen-space label font size
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;

// Collision radius padding: allows labels to breathe without overcrowding.
// Reduced from 50 → 32 because the improved cluster forces spread nodes further apart.
const LABEL_CLEARANCE = 32;

function weightToRadius(w: number): number {
  return MIN_R + ((w - 1) / 9) * (MAX_R - MIN_R);
}

// Five-cluster layout: each category is pulled toward a quadrant.
// Values are fractions of half-canvas width/height from center.
// These are intentionally larger (0.55-0.65 range) to push clusters to the
// edges of the canvas and maximise use of the available space.
const CLUSTER_OFFSET: Record<SkillCategory, [number, number]> = {
  languages:        [-0.60, -0.48],   // top-left
  frameworks:       [ 0.52, -0.48],   // top-right
  'security-tools': [-0.44,  0.46],   // bottom-left
  'security-skills':[ 0.14,  0.54],   // bottom-center-right
  cloud:            [ 0.60,  0.12],   // center-right
};

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function SkillGraph({ height = 700 }: { height?: number }) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef       = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const nodesRef     = useRef<GraphNode[]>([]);
  const linksRef     = useRef<GraphLink[]>([]);
  // Bidirectional adjacency: maps skill-name → Set of all connected skill-names (both directions)
  const biAdjRef     = useRef<Map<string, Set<string>>>(new Map());
  const cameraRef    = useRef<Camera>({ x: 0, y: 0, scale: 1 });
  const hoveredRef   = useRef<GraphNode | null>(null);
  const draggedRef   = useRef<GraphNode | null>(null);
  const isPanRef     = useRef(false);
  const panStartRef  = useRef({ camX: 0, camY: 0, mx: 0, my: 0 });
  const pinchRef     = useRef<{ dist: number; mx: number; my: number } | null>(null);
  const activeCatRef = useRef<SkillCategory | null>(null);

  const [zoomLevel,      setZoomLevel]      = useState(1);
  const [activeCategory, setActiveCategory] = useState<SkillCategory | null>(null);
  const [tooltip,        setTooltip]        = useState<TooltipState | null>(null);
  const [viewMode,       setViewMode]       = useState<ViewMode>('graph');

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
    // hlSet: the hovered node + its direct neighbors — used for NODE dimming/highlighting only
    const hlSet   = hovered
      ? new Set([hovered.id, ...(biAdjRef.current.get(hovered.id) ?? [])])
      : null;

    // Read accent color from CSS for edge tinting
    const accentColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent').trim() || '#00FF41';

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
        (active !== null && s.skill.category !== active && t.skill.category !== active) ||
        (hovered !== null && !isHighlighted);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      if (dim) {
        ctx.strokeStyle = 'rgba(46,58,74,0.18)';
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
        ctx.strokeStyle = hexToRgba(accentColor, 0.22);
        ctx.lineWidth   = 1.5 / cam.scale;
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
        (active !== null && n.skill.category !== active) ||
        (hlSet !== null && !isNear);

      if (isSelf) {
        ctx.save();
        ctx.shadowColor = meta.color;
        ctx.shadowBlur  = 18 / cam.scale;
      }
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle   = dim ? hexToRgba(meta.color, 0.07) : isSelf ? hexToRgba(meta.color, 0.30) : hexToRgba(meta.color, 0.15);
      ctx.strokeStyle = dim ? hexToRgba(meta.color, 0.12) : isSelf ? meta.color               : hexToRgba(meta.color, 0.65);
      ctx.lineWidth   = (isSelf ? 2 : 1) / cam.scale;
      ctx.fill();
      ctx.stroke();
      if (isSelf) ctx.restore();
    }

    ctx.restore();

    // Pass 3 — labels (screen space, fixed size)
    if (cam.scale >= 0.30) {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.font         = `${LABEL_PX}px 'JetBrains Mono', monospace`;

      for (const n of nodesRef.current) {
        if (n.x == null || n.y == null) continue;
        const [sx, sy] = toScreen(n.x, n.y);
        const meta     = CATEGORY_META[n.skill.category];
        const isSelf   = hovered?.id === n.id;
        const isNear   = hlSet?.has(n.id) ?? false;
        const dim      =
          (active !== null && n.skill.category !== active) ||
          (hlSet !== null && !isNear);

        ctx.fillStyle = dim ? 'rgba(139,148,158,0.25)' : isSelf ? meta.color : 'rgba(201,209,217,0.82)';
        ctx.fillText(n.skill.name, sx, sy + n.r * cam.scale + 3);
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

    // Start nodes near their cluster center to reduce initial overlap chaos
    const nodes: GraphNode[] = skills.map(s => {
      const [ox, oy] = CLUSTER_OFFSET[s.category];
      return {
        id:    s.name,
        skill: s,
        r:     weightToRadius(s.weight * 2.5), // exaggerate radius differences for better visuals
        x:     cx + ox * cw * 0.5 + (Math.random() - 0.5) * 60,
        y:     cy + oy * ch * 0.5 + (Math.random() - 0.5) * 60,
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
        // Longer link distance spreads connected nodes apart
        .distance(d => (d.source as GraphNode).r + (d.target as GraphNode).r + 80)
        .strength(0.18))
      // Stronger repulsion pushes nodes further from each other
      .force('charge', forceManyBody<GraphNode>().strength(d => -(d.r * 45 + 280)))
      .force('center', forceCenter(cx, cy).strength(0.02))
      // LABEL_CLEARANCE ensures no two nodes are close enough for label overlap
      .force('collide', forceCollide<GraphNode>(d => d.r + LABEL_CLEARANCE).strength(0.9))
      // Cluster forces: use 0.5× canvas half-dimensions (matching the comment intent)
      // to pull categories toward their designated quadrant without going off-screen.
      .force('clusterX', forceX<GraphNode>(d => {
        const [ox] = CLUSTER_OFFSET[d.skill.category];
        return cx + ox * cw * 0.5;
      }).strength(0.15))
      .force('clusterY', forceY<GraphNode>(d => {
        const [, oy] = CLUSTER_OFFSET[d.skill.category];
        return cy + oy * ch * 0.5;
      }).strength(0.15))
      .alphaDecay(0.012)
      .stop();

    simRef.current = sim;

    // Settle synchronously — more ticks for better initial layout
    sim.tick(1200);
    fitAll(cw, ch);
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
      const dpr = window.devicePixelRatio || 1;
      canvas.width        = w * dpr;
      canvas.height       = height * dpr;
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${height}px`;
      startSimulation(w, height);
    });
    ro.observe(container);

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

    // Touch
    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      const ts = e.touches;
      if (ts.length === 2) {
        draggedRef.current = null; isPanRef.current = false;
        const [mx, my] = touchMid(ts[0], ts[1], canvas!);
        pinchRef.current = { dist: touchDist(ts[0], ts[1]), mx, my };
        return;
      }
      pinchRef.current = null;
      const [cx, cy] = cssCoord(ts[0], canvas!);
      const hit = nodeAt(cx, cy);
      if (hit) {
        draggedRef.current = hit; hoveredRef.current = hit;
        hit.fx = hit.x; hit.fy = hit.y;
        simRef.current?.alphaTarget(0.3).restart();
        showTooltip(hit);
      } else {
        isPanRef.current = true;
        panStartRef.current = { camX: cameraRef.current.x, camY: cameraRef.current.y, mx: cx, my: cy };
        hoveredRef.current = null; setTooltip(null);
      }
      draw();
    }
    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      const ts = e.touches;
      if (ts.length === 2 && pinchRef.current) {
        const nd = touchDist(ts[0], ts[1]);
        const [mx, my] = touchMid(ts[0], ts[1], canvas!);
        zoomAt(mx, my, nd / pinchRef.current.dist);
        pinchRef.current = { dist: nd, mx, my };
        if (hoveredRef.current) showTooltip(hoveredRef.current);
        draw(); return;
      }
      if (ts.length === 1) {
        const [cx, cy] = cssCoord(ts[0], canvas!);
        if (draggedRef.current) {
          const [sx, sy] = toSim(cx, cy);
          draggedRef.current.x = sx; draggedRef.current.y = sy;
          draggedRef.current.fx = sx; draggedRef.current.fy = sy;
          simRef.current?.alpha(0.2).restart();
          showTooltip(draggedRef.current); draw();
        } else if (isPanRef.current) {
          const { camX, camY, mx, my } = panStartRef.current;
          cameraRef.current.x = camX + (cx - mx);
          cameraRef.current.y = camY + (cy - my);
          if (hoveredRef.current) showTooltip(hoveredRef.current);
          draw();
        }
      }
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    activeCatRef.current = activeCategory;
    draw();
  }, [activeCategory]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ─── List view ────────────────────────────────────────────────────────────

  function ListView() {
    const [listHovered, setListHovered] = useState<{
      skill: Skill; x: number; y: number;
    } | null>(null);

    const listMeta = listHovered ? CATEGORY_META[listHovered.skill.category] : null;

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
                  .map(s => (
                    <li
                      key={s.name}
                      tabIndex={0}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={(e) => setListHovered({ skill: s, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setListHovered(null)}
                      onFocus={(e) => {
                        const r = (e.currentTarget as HTMLLIElement).getBoundingClientRect();
                        setListHovered({ skill: s, x: r.right, y: r.top + r.height / 2 });
                      }}
                      onBlur={() => setListHovered(null)}
                      onMouseMove={(e) => {
                        if (listHovered?.skill.name === s.name) {
                          setListHovered({ skill: s, x: e.clientX, y: e.clientY });
                        }
                      }}
                    >
                      {s.name}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Skill detail tooltip — fixed so it escapes overflow:hidden parents */}
        {listHovered && listMeta && (
          <div
            role="tooltip"
            style={{
              position: 'fixed',
              left: Math.min(listHovered.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 260),
              top: listHovered.y + 12,
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
              maxWidth: 240,
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
            {(listHovered.skill.connections?.length ?? 0) > 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 4 }}>
                {listHovered.skill.connections!.length} connection{listHovered.skill.connections!.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

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
            style={{ display: 'block', width: '100%', cursor: 'default' }}
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

          {/* Legend / filter */}
          <div role="group" aria-label="Filter by category" style={{
            display: 'flex', flexWrap: 'wrap', gap: '0.5rem',
            marginTop: '0.875rem', justifyContent: 'center',
          }}>
            {cats.map(cat => {
              const { label, color } = CATEGORY_META[cat];
              const on = activeCategory === cat;
              return (
                <button key={cat} onClick={() => { const next = on ? null : cat; setActiveCategory(next); }} aria-pressed={on} style={{
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
            {activeCategory && (
              <button onClick={() => setActiveCategory(null)} style={{
                padding: '5px 14px', fontSize: '0.75rem', fontFamily: 'var(--font-display)',
                background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', color: 'var(--text-muted)',
                cursor: 'pointer', minHeight: 44,
              }}>clear</button>
            )}
          </div>

          <p style={{ textAlign: 'center', fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', marginTop: '0.5rem' }}>
            scroll / pinch to zoom · drag to pin · double-click to release
          </p>
        </div>
      </div>   {/* end graph show/hide wrapper */}
    </div>
  );
}
