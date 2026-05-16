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

interface Camera {
  x: number;
  y: number;
  scale: number;
}

interface TooltipState {
  name: string;
  weight: number;
  category: SkillCategory;
  projects: string[];
  /** CSS px from canvas top-left */
  cssX: number;
  cssY: number;
  /** true → render below the node instead of above */
  below: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_R = 7;
const MAX_R = 22;
const LABEL_PX = 12; // screen-space font size, always readable regardless of zoom
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;

function weightToRadius(w: number): number {
  return MIN_R + ((w - 1) / 9) * (MAX_R - MIN_R);
}

// Per-category quadrant offsets (fraction of half-canvas) for cluster forces.
// Soft forceX/forceY pulls nodes toward these quadrant centers without a hard
// boundary, producing the organic Obsidian bubble aesthetic.
const CLUSTER_OFFSET: Record<SkillCategory, [number, number]> = {
  languages:  [-0.30, -0.22],
  frameworks: [ 0.24, -0.22],
  security:   [-0.20,  0.28],
  cloud:      [ 0.28,  0.22],
};

// ─── Helpers (pure, no React dependency) ──────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** CSS pixel coordinate from a MouseEvent/TouchEvent relative to canvas */
function cssCoord(
  e: MouseEvent | Touch,
  canvas: HTMLCanvasElement
): [number, number] {
  const rect = canvas.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
}

function touchDist(a: Touch, b: Touch): number {
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

function touchMid(a: Touch, b: Touch, canvas: HTMLCanvasElement): [number, number] {
  return cssCoord(
    { clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 } as Touch,
    canvas
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  height?: number;
}

export default function SkillGraph({ height = 700 }: Props) {
  // DOM / canvas
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const containerRef  = useRef<HTMLDivElement>(null);

  // Simulation
  const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);

  // Camera (pan + zoom state kept in a ref so draw() always reads latest)
  const cameraRef = useRef<Camera>({ x: 0, y: 0, scale: 1 });

  // Interaction state (refs — no re-render needed)
  const hoveredRef    = useRef<GraphNode | null>(null);
  const draggedRef    = useRef<GraphNode | null>(null);
  const isPanningRef  = useRef(false);
  const panStartRef   = useRef({ camX: 0, camY: 0, mx: 0, my: 0 });
  const pinchRef      = useRef<{ dist: number; mx: number; my: number } | null>(null);

  // Mirrors of camera.scale exposed only for button disabled states
  const [zoomLevel, setZoomLevel] = useState(1);

  // React-rendered UI
  const [activeCategory, setActiveCategory] = useState<SkillCategory | null>(null);
  const activeCatRef = useRef<SkillCategory | null>(null);

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Detect prefers-reduced-motion once
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ─── Sim → screen helpers ──────────────────────────────────────────────────

  function toSim(cssX: number, cssY: number): [number, number] {
    const { x, y, scale } = cameraRef.current;
    return [(cssX - x) / scale, (cssY - y) / scale];
  }

  function toScreen(simX: number, simY: number): [number, number] {
    const { x, y, scale } = cameraRef.current;
    return [simX * scale + x, simY * scale + y];
  }

  // ─── Node hit-test ─────────────────────────────────────────────────────────

  function nodeAt(cssX: number, cssY: number): GraphNode | null {
    const [sx, sy] = toSim(cssX, cssY);
    // Iterate in reverse so top-painted nodes (drawn last) get priority
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const n = nodesRef.current[i];
      if (n.x == null || n.y == null) continue;
      const hit = Math.max(n.r, 16); // minimum 16px hit radius in sim space
      if ((sx - n.x) ** 2 + (sy - n.y) ** 2 <= hit ** 2) return n;
    }
    return null;
  }

  // ─── Camera controls ───────────────────────────────────────────────────────

  function zoomAt(cssX: number, cssY: number, factor: number) {
    const cam = cameraRef.current;
    const newScale = clamp(cam.scale * factor, MIN_ZOOM, MAX_ZOOM);
    const actual   = newScale / cam.scale;
    cam.x     = cssX - (cssX - cam.x) * actual;
    cam.y     = cssY - (cssY - cam.y) * actual;
    cam.scale = newScale;
    setZoomLevel(newScale);
  }

  function fitAll(canvasW: number, canvasH: number) {
    const nodes = nodesRef.current;
    if (!nodes.length) return;

    const LABEL_H = LABEL_PX + 4;   // extra below-node clearance for labels
    const PAD     = 48;              // canvas-edge padding (px)

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      if (n.x == null || n.y == null) continue;
      minX = Math.min(minX, n.x - n.r);
      minY = Math.min(minY, n.y - n.r);
      maxX = Math.max(maxX, n.x + n.r);
      maxY = Math.max(maxY, n.y + n.r + LABEL_H);
    }

    const gw = maxX - minX;
    const gh = maxY - minY;
    if (!gw || !gh) return;

    const scale = clamp(
      Math.min((canvasW - PAD * 2) / gw, (canvasH - PAD * 2) / gh),
      MIN_ZOOM, MAX_ZOOM
    );

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    cameraRef.current = {
      x:     canvasW  / 2 - cx * scale,
      y:     canvasH  / 2 - cy * scale,
      scale,
    };
    setZoomLevel(scale);
  }

  // ─── Draw ──────────────────────────────────────────────────────────────────

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx   = canvas.getContext('2d');
    if (!ctx)   return;

    // canvas.width/height are in physical pixels; CSS size is set separately
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, w * dpr, h * dpr);

    const cam     = cameraRef.current;
    const hovered = hoveredRef.current;
    const active  = activeCatRef.current;

    const highlightSet = hovered
      ? new Set([hovered.id, ...(hovered.skill.connections ?? [])])
      : null;

    // ── Pass 1: edges (in sim space via camera transform) ─────────────────
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(cam.x, cam.y);
    ctx.scale(cam.scale, cam.scale);

    for (const link of linksRef.current) {
      const s = link.source as GraphNode;
      const t = link.target as GraphNode;
      if (s.x == null || s.y == null || t.x == null || t.y == null) continue;

      const dimLink =
        (active !== null && s.skill.category !== active && t.skill.category !== active) ||
        (highlightSet !== null && !highlightSet.has(s.id) && !highlightSet.has(t.id));

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = dimLink ? 'rgba(46,58,74,0.25)' : 'rgba(46,58,74,0.75)';
      ctx.lineWidth   = 1;
      ctx.stroke();
    }

    // ── Pass 2: node circles (still in sim space) ─────────────────────────
    for (const node of nodesRef.current) {
      if (node.x == null || node.y == null) continue;

      const meta    = CATEGORY_META[node.skill.category];
      const isSelf  = hovered?.id === node.id;
      const isNeigh = highlightSet?.has(node.id) ?? false;
      const dimNode =
        (active !== null && node.skill.category !== active) ||
        (highlightSet !== null && !isNeigh);

      if (isSelf) {
        ctx.save();
        ctx.shadowColor = meta.color;
        ctx.shadowBlur  = 20 / cam.scale; // keep glow consistent in screen px
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);

      if (dimNode) {
        ctx.fillStyle   = hexToRgba(meta.color, 0.08);
        ctx.strokeStyle = hexToRgba(meta.color, 0.15);
      } else if (isSelf) {
        ctx.fillStyle   = hexToRgba(meta.color, 0.30);
        ctx.strokeStyle = meta.color;
      } else {
        ctx.fillStyle   = hexToRgba(meta.color, 0.15);
        ctx.strokeStyle = hexToRgba(meta.color, 0.65);
      }

      ctx.lineWidth = isSelf ? 2 / cam.scale : 1 / cam.scale;
      ctx.fill();
      ctx.stroke();

      if (isSelf) ctx.restore();
    }

    ctx.restore(); // end camera transform

    // ── Pass 3: labels in SCREEN space (constant font size) ───────────────
    // Drawing labels after restore so they're always LABEL_PX px regardless of zoom.
    // Below a certain zoom threshold, hide labels to reduce clutter.
    if (cam.scale >= 0.35) {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.font         = `${LABEL_PX}px 'JetBrains Mono', monospace`;

      for (const node of nodesRef.current) {
        if (node.x == null || node.y == null) continue;

        const [sx, sy]  = toScreen(node.x, node.y);
        const meta      = CATEGORY_META[node.skill.category];
        const isSelf    = hovered?.id === node.id;
        const isNeigh   = highlightSet?.has(node.id) ?? false;
        const dimNode   =
          (active !== null && node.skill.category !== active) ||
          (highlightSet !== null && !isNeigh);

        const nodeScreenR = node.r * cam.scale;
        const labelY      = sy + nodeScreenR + 4;

        ctx.fillStyle = dimNode
          ? 'rgba(139,148,158,0.25)'
          : isSelf
            ? meta.color
            : 'rgba(201,209,217,0.82)';

        ctx.fillText(node.skill.name, sx, labelY);
      }

      ctx.restore();
    }
  }

  // ─── Tooltip helper ────────────────────────────────────────────────────────

  function showTooltip(node: GraphNode) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const [sx, sy] = toScreen(node.x ?? 0, node.y ?? 0);
    const nodeScreenR = node.r * cameraRef.current.scale;
    const canvasH = canvas.clientHeight;
    const below = sy - nodeScreenR - 8 < 80; // flip tooltip below if near top
    setTooltip({
      name:     node.skill.name,
      weight:   node.skill.weight,
      category: node.skill.category,
      projects: node.skill.relatedProjects ?? [],
      cssX:     sx,
      cssY:     sy + (below ? nodeScreenR + 6 : -nodeScreenR - 8),
      below,
    });
  }

  // ─── Simulation builder ────────────────────────────────────────────────────

  function buildGraph(cx: number, cy: number) {
    const nodes: GraphNode[] = skills.map(s => ({
      id:    s.name,
      skill: s,
      r:     weightToRadius(s.weight),
      x:     cx + (Math.random() - 0.5) * 40,
      y:     cy + (Math.random() - 0.5) * 40,
    }));

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const links: GraphLink[] = [];

    for (const n of nodes) {
      for (const conn of n.skill.connections ?? []) {
        const target = nodeMap.get(conn);
        if (target && target.id > n.id) {
          links.push({ source: n, target });
        }
      }
    }

    nodesRef.current = nodes;
    linksRef.current = links;
    return { nodes, links };
  }

  function startSimulation(canvasW: number, canvasH: number) {
    simRef.current?.stop();

    const cx = canvasW / 2;
    const cy = canvasH / 2;
    const { nodes, links } = buildGraph(cx, cy);

    const sim = forceSimulation<GraphNode>(nodes)
      .force('link', forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(d => (d.source as GraphNode).r + (d.target as GraphNode).r + 28)
        .strength(0.35))
      .force('charge',  forceManyBody<GraphNode>().strength(d => -(d.r * 14)))
      .force('center',  forceCenter(cx, cy).strength(0.04))
      .force('collide', forceCollide<GraphNode>(d => d.r + 4).strength(0.9))
      // Intra-cluster gravity: each node pulled toward its category quadrant
      .force('clusterX', forceX<GraphNode>(d => {
        const [ox] = CLUSTER_OFFSET[d.skill.category];
        return cx + ox * canvasW;
      }).strength(0.08))
      .force('clusterY', forceY<GraphNode>(d => {
        const [, oy] = CLUSTER_OFFSET[d.skill.category];
        return cy + oy * canvasH;
      }).strength(0.08))
      .alphaDecay(0.02)
      .stop();

    simRef.current = sim;

    // Settle synchronously so all nodes are positioned on first paint
    sim.tick(400);
    fitAll(canvasW, canvasH);
    draw();

    if (!prefersReduced) {
      // Brief re-heat for a subtle settling animation
      sim.alpha(0.06).on('tick', draw).restart();
    }
  }

  // ─── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    const canvas    = canvasRef.current;
    if (!container || !canvas) return;

    // Resize: re-size canvas physical buffer and restart sim
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = w * dpr;
      canvas.height = height * dpr;
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${height}px`;
      startSimulation(w, height);
    });
    ro.observe(container);

    // ── Mouse events ─────────────────────────────────────────────────────────

    function onMouseMove(e: MouseEvent) {
      const [cx, cy] = cssCoord(e, canvas!);

      if (draggedRef.current) {
        const [sx, sy] = toSim(cx, cy);
        draggedRef.current.x  = sx;
        draggedRef.current.y  = sy;
        draggedRef.current.fx = sx;
        draggedRef.current.fy = sy;
        simRef.current?.alpha(0.2).restart();
        showTooltip(draggedRef.current);
        draw();
        return;
      }

      if (isPanningRef.current) {
        const { camX, camY, mx, my } = panStartRef.current;
        cameraRef.current.x = camX + (cx - mx);
        cameraRef.current.y = camY + (cy - my);
        draw();
        // Update tooltip position if hovering
        if (hoveredRef.current) showTooltip(hoveredRef.current);
        return;
      }

      const hit = nodeAt(cx, cy);
      if (hit?.id !== hoveredRef.current?.id) {
        hoveredRef.current = hit;
        canvas!.style.cursor = hit ? 'grab' : 'default';
        hit ? showTooltip(hit) : setTooltip(null);
        draw();
      }
    }

    function onMouseDown(e: MouseEvent) {
      const [cx, cy] = cssCoord(e, canvas!);
      const hit = nodeAt(cx, cy);
      if (hit) {
        draggedRef.current = hit;
        hit.fx = hit.x;
        hit.fy = hit.y;
        simRef.current?.alphaTarget(0.3).restart();
        canvas!.style.cursor = 'grabbing';
      } else {
        isPanningRef.current = true;
        panStartRef.current  = {
          camX: cameraRef.current.x, camY: cameraRef.current.y,
          mx: cx, my: cy,
        };
        canvas!.style.cursor = 'move';
      }
    }

    function onMouseUp() {
      if (draggedRef.current) {
        // Node stays pinned at dragged location (fx/fy NOT cleared)
        simRef.current?.alphaTarget(0);
        draggedRef.current = null;
      }
      isPanningRef.current    = false;
      canvas!.style.cursor    = hoveredRef.current ? 'grab' : 'default';
    }

    function onDblClick(e: MouseEvent) {
      const [cx, cy] = cssCoord(e, canvas!);
      const hit = nodeAt(cx, cy);
      if (hit) {
        // Double-click unpins a manually placed node
        hit.fx = null;
        hit.fy = null;
        simRef.current?.alpha(0.3).restart();
      }
    }

    function onMouseLeave() {
      if (draggedRef.current) {
        simRef.current?.alphaTarget(0);
        draggedRef.current  = null;
      }
      isPanningRef.current  = false;
      hoveredRef.current    = null;
      setTooltip(null);
      canvas!.style.cursor  = 'default';
      draw();
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const [cx, cy] = cssCoord(e, canvas!);
      const factor = Math.pow(0.999, e.deltaY);
      zoomAt(cx, cy, factor);
      // Reposition tooltip if node is hovered
      if (hoveredRef.current) showTooltip(hoveredRef.current);
      draw();
    }

    // ── Touch events ─────────────────────────────────────────────────────────

    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      const touches = e.touches;

      if (touches.length === 2) {
        // Begin pinch-zoom; cancel any single-touch interactions
        draggedRef.current    = null;
        isPanningRef.current  = false;
        const dist            = touchDist(touches[0], touches[1]);
        const [mx, my]        = touchMid(touches[0], touches[1], canvas!);
        pinchRef.current      = { dist, mx, my };
        return;
      }

      if (touches.length === 1) {
        pinchRef.current  = null;
        const [cx, cy]    = cssCoord(touches[0], canvas!);
        const hit         = nodeAt(cx, cy);
        if (hit) {
          draggedRef.current = hit;
          hoveredRef.current = hit;
          hit.fx = hit.x;
          hit.fy = hit.y;
          simRef.current?.alphaTarget(0.3).restart();
          showTooltip(hit);
        } else {
          isPanningRef.current = true;
          panStartRef.current  = {
            camX: cameraRef.current.x, camY: cameraRef.current.y,
            mx: cx, my: cy,
          };
          hoveredRef.current = null;
          setTooltip(null);
        }
        draw();
      }
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      const touches = e.touches;

      if (touches.length === 2 && pinchRef.current) {
        const newDist         = touchDist(touches[0], touches[1]);
        const [mx, my]        = touchMid(touches[0], touches[1], canvas!);
        const factor          = newDist / pinchRef.current.dist;
        zoomAt(mx, my, factor);
        pinchRef.current      = { dist: newDist, mx, my };
        if (hoveredRef.current) showTooltip(hoveredRef.current);
        draw();
        return;
      }

      if (touches.length === 1) {
        const [cx, cy] = cssCoord(touches[0], canvas!);

        if (draggedRef.current) {
          const [sx, sy]         = toSim(cx, cy);
          draggedRef.current.x   = sx;
          draggedRef.current.y   = sy;
          draggedRef.current.fx  = sx;
          draggedRef.current.fy  = sy;
          simRef.current?.alpha(0.2).restart();
          showTooltip(draggedRef.current);
          draw();
        } else if (isPanningRef.current) {
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

      if (draggedRef.current) {
        // Node stays pinned (fx/fy NOT cleared)
        simRef.current?.alphaTarget(0);
        draggedRef.current = null;
      }

      if (e.touches.length === 0) {
        isPanningRef.current = false;
      }
    }

    canvas.addEventListener('mousemove',  onMouseMove);
    canvas.addEventListener('mousedown',  onMouseDown);
    canvas.addEventListener('mouseup',    onMouseUp);
    canvas.addEventListener('dblclick',   onDblClick);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel',      onWheel, { passive: false });
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
  }, []); // run once; ResizeObserver handles re-layout

  // Redraw when active category changes (legend filter)
  useEffect(() => {
    activeCatRef.current = activeCategory;
    draw();
  }, [activeCategory]);

  // ─── Zoom button handlers ──────────────────────────────────────────────────

  function handleZoomIn() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, 1.3);
    draw();
  }

  function handleZoomOut() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, 1 / 1.3);
    draw();
  }

  function handleFit() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    fitAll(canvas.clientWidth, canvas.clientHeight);
    draw();
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const meta   = tooltip ? CATEGORY_META[tooltip.category] : null;
  const btnBase: React.CSSProperties = {
    display:     'inline-flex',
    alignItems:  'center',
    justifyContent: 'center',
    width:       32,
    height:      32,
    padding:     0,
    fontFamily:  'var(--font-display)',
    fontSize:    '1rem',
    background:  'var(--bg-elevated)',
    border:      '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color:       'var(--text-secondary)',
    cursor:      'pointer',
    transition:  'all 0.15s ease',
    lineHeight:  1,
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Interactive skill graph. Hover nodes to highlight connections; drag to pin; double-click to unpin; scroll or use buttons to zoom."
        style={{ display: 'block', width: '100%', cursor: 'default' }}
      />

      {/* Zoom controls — top-right corner */}
      <div
        aria-label="Zoom controls"
        style={{
          position:       'absolute',
          top:            12,
          right:          12,
          display:        'flex',
          flexDirection:  'column',
          gap:            4,
          zIndex:         5,
        }}
      >
        <button
          onClick={handleZoomIn}
          aria-label="Zoom in"
          disabled={zoomLevel >= MAX_ZOOM}
          style={btnBase}
          title="Zoom in"
        >+</button>
        <button
          onClick={handleFit}
          aria-label="Fit all nodes"
          style={btnBase}
          title="Fit all"
        >⊙</button>
        <button
          onClick={handleZoomOut}
          aria-label="Zoom out"
          disabled={zoomLevel <= MIN_ZOOM}
          style={btnBase}
          title="Zoom out"
        >−</button>
      </div>

      {/* Tooltip */}
      {tooltip && meta && (
        <div
          role="tooltip"
          style={{
            position:       'absolute',
            left:           tooltip.cssX,
            top:            tooltip.cssY,
            transform:      tooltip.below
              ? 'translate(-50%, 0)'
              : 'translate(-50%, -100%)',
            background:     'var(--bg-elevated)',
            border:         `1px solid ${meta.color}`,
            borderRadius:   'var(--radius)',
            padding:        '8px 12px',
            pointerEvents:  'none',
            fontFamily:     'var(--font-display)',
            fontSize:       '0.75rem',
            color:          meta.color,
            whiteSpace:     'nowrap',
            zIndex:         10,
            boxShadow:      `0 0 12px ${hexToRgba(meta.color, 0.25)}`,
            maxWidth:       220,
          }}
        >
          <div style={{ marginBottom: tooltip.projects.length ? 4 : 0 }}>
            <strong>{tooltip.name}</strong>
            <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
              lvl {tooltip.weight}/10
            </span>
          </div>
          {tooltip.projects.length > 0 && (
            <ul style={{
              margin:     0,
              padding:    0,
              listStyle:  'none',
              borderTop:  '1px solid var(--border)',
              paddingTop: 4,
              marginTop:  2,
            }}>
              {tooltip.projects.map(p => (
                <li
                  key={p}
                  style={{
                    color:      'var(--text-secondary)',
                    fontSize:   '0.7rem',
                    lineHeight: 1.5,
                    whiteSpace: 'normal',
                  }}
                >
                  › {p}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Legend / category filter */}
      <div
        role="group"
        aria-label="Filter by category"
        style={{
          display:         'flex',
          flexWrap:        'wrap',
          gap:             '0.5rem',
          marginTop:       '0.875rem',
          justifyContent:  'center',
        }}
      >
        {(Object.keys(CATEGORY_META) as SkillCategory[]).map(cat => {
          const { label, color } = CATEGORY_META[cat];
          const on = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(prev => prev === cat ? null : cat)}
              aria-pressed={on}
              style={{
                display:        'flex',
                alignItems:     'center',
                gap:            '0.4rem',
                padding:        '5px 14px',
                fontSize:       '0.75rem',
                fontFamily:     'var(--font-display)',
                background:     on ? hexToRgba(color, 0.15) : 'var(--bg-elevated)',
                border:         `1px solid ${on ? color : 'var(--border)'}`,
                borderRadius:   'var(--radius)',
                color:          on ? color : 'var(--text-secondary)',
                cursor:         'pointer',
                transition:     'all 0.15s ease',
                minHeight:      44, // 44px touch target on mobile
              }}
            >
              <span style={{
                width:      8,
                height:     8,
                borderRadius: '50%',
                background: color,
                flexShrink: 0,
                boxShadow:  on ? `0 0 6px ${color}` : 'none',
              }} />
              {label}
            </button>
          );
        })}
        {activeCategory && (
          <button
            onClick={() => setActiveCategory(null)}
            style={{
              padding:      '5px 14px',
              fontSize:     '0.75rem',
              fontFamily:   'var(--font-display)',
              background:   'transparent',
              border:       '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color:        'var(--text-muted)',
              cursor:       'pointer',
              minHeight:    44,
            }}
          >
            clear
          </button>
        )}
      </div>

      {/* Hint */}
      <p style={{
        textAlign:  'center',
        fontSize:   '0.68rem',
        color:      'var(--text-muted)',
        fontFamily: 'var(--font-display)',
        marginTop:  '0.5rem',
      }}>
        scroll / pinch to zoom · drag to pin · double-click to release
      </p>
    </div>
  );
}
