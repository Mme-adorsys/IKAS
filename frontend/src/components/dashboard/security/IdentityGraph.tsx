'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { IdentityGraphData, IdentityGraphNode } from '@/store';
import { Finding, LiveLoginEvent, Severity } from '@/types/security';
import { InlineNodeDetail } from './InlineNodeDetail';

interface IdentityGraphProps {
  data: IdentityGraphData | null;
  /** All findings — used to compute per-user risk score. */
  findings?: Finding[];
  /** All recent live login events — feeds risk score and visual cues. */
  liveEvents?: LiveLoginEvent[];
  /** Called when the user clicks (not drags) a user-typed node. */
  onSelectUser?: (user: IdentityGraphNode) => void;
  onSelectGroup?: (group: IdentityGraphNode) => void;
  onSelectRole?: (role: IdentityGraphNode) => void;
  /** Called when a finding sub-node (rendered on dblclick expand) is clicked. */
  onSelectFinding?: (f: Finding) => void;
  width?: number;
  height?: number;
}

const TYPE_COLOR: Record<string, string> = {
  realm: '#3b82f6',     // blue
  user: '#a855f7',      // purple (default for unscored)
  client: '#10b981',    // emerald
  group: '#f59e0b',     // amber
  role: '#ec4899'       // pink — distinguishes roles from groups visually
};

const SENSITIVE_ROLE_NAMES = new Set(['realm-admin', 'admin', 'super-admin']);

const SEVERITY_RISK: Record<Severity, number> = { critical: 8, error: 4, warning: 2, info: 1 };

export type RiskLevel = 'safe' | 'caution' | 'warning' | 'critical';

const RISK_COLOR: Record<RiskLevel, string> = {
  safe:     '#10b981', // emerald
  caution:  '#eab308', // yellow
  warning:  '#f97316', // orange
  critical: '#ef4444'  // red
};
const RISK_RADIUS: Record<RiskLevel, number> = { safe: 10, caution: 11, warning: 12, critical: 14 };

const DAY_MS = 24 * 3600 * 1000;

/**
 * Risk score per user, combining findings + recent login events + config anomalies.
 * Pure function so it's trivial to memoise and unit-test later.
 */
export function computeUserRisk(
  user: IdentityGraphNode,
  findings: Finding[],
  liveEvents: LiveLoginEvent[]
): { score: number; level: RiskLevel } {
  let score = 0;
  for (const f of findings) {
    if (f.status !== 'open') continue;
    if (f.affected.some(a => a.type === 'user' && a.id === user.id)) {
      score += SEVERITY_RISK[f.severity] ?? 0;
    }
  }
  const cutoff = Date.now() - DAY_MS;
  const recent = liveEvents.filter(e => e.username === user.username && new Date(e.time).getTime() >= cutoff);
  const failedCount = recent.filter(e => !e.success).length;
  score += Math.min(failedCount * 0.5, 10);
  if (recent.some(e => e.ipClassification === 'tor' || e.ipClassification === 'known-bad')) score += 5;
  if (user.emailVerified === false) score += 3;
  if (user.enabled === false) score -= 5;
  if (user.createdAt && Date.now() - new Date(user.createdAt).getTime() < 7 * DAY_MS) score += 2;

  const level: RiskLevel = score >= 16 ? 'critical' : score >= 9 ? 'warning' : score >= 4 ? 'caution' : 'safe';
  return { score: Math.max(0, Math.round(score)), level };
}

/**
 * Force-directed identity graph. Users coloured by AI-computed risk score.
 * Click on a user (not drag) bubbles up via `onSelectUser` so the parent can
 * open the UserDetailDrawer.
 */
export function IdentityGraph({ data, findings = [], liveEvents = [], onSelectUser, onSelectGroup, onSelectRole, onSelectFinding, width = 720, height = 360 }: IdentityGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Single-click selection — shown as an inline panel inside the graph card (NOT a modal).
  // Double-click expansion — dims everything outside the related sub-graph.
  const [inlineSelected, setInlineSelected] = useState<IdentityGraphNode | null>(null);
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  // Fullscreen mode: card grows to the entire viewport so the speaker can show the graph in
  // detail without scrolling around. ESC closes it.
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    if (!isFullscreen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullscreen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isFullscreen]);

  // Pre-compute risk levels per user so the d3-effect can read them and the legend can show counts.
  const riskByUserId = useMemo(() => {
    const map = new Map<string, { score: number; level: RiskLevel }>();
    if (!data) return map;
    for (const n of data.nodes) {
      if (n.type === 'user') map.set(n.id, computeUserRisk(n, findings, liveEvents));
    }
    return map;
  }, [data, findings, liveEvents]);

  // Stable refs so the d3 effect can call the latest handlers without re-running on prop changes.
  const onSelectUserRef = useRef(onSelectUser);
  const onSelectGroupRef = useRef(onSelectGroup);
  const onSelectRoleRef = useRef(onSelectRole);
  const onSelectFindingRef = useRef(onSelectFinding);
  useEffect(() => { onSelectUserRef.current = onSelectUser; }, [onSelectUser]);
  useEffect(() => { onSelectGroupRef.current = onSelectGroup; }, [onSelectGroup]);
  useEffect(() => { onSelectRoleRef.current = onSelectRole; }, [onSelectRole]);
  useEffect(() => { onSelectFindingRef.current = onSelectFinding; }, [onSelectFinding]);

  // Position cache survives across data-refreshes (every 60s) and risk-recalcs (every 10s),
  // so nodes don't re-tumble on each tick of the polling timers.
  const positionCacheRef = useRef<Map<string, { x?: number; y?: number; fx?: number | null; fy?: number | null }>>(new Map());

  // Click/dblclick discrimination timer ref. A drag.end with moved<4 starts a 220ms timer;
  // if a second click hits within that window we treat it as a dblclick (expand sub-graph)
  // and cancel the single-click action (open inline panel).
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (clickTimerRef.current) clearTimeout(clickTimerRef.current); }, []);

  // Findings attached to the expanded target — rendered as virtual sub-nodes hanging off
  // the focused node when the user double-clicks.
  const findingsForExpanded = useMemo(() => {
    if (!expandedNodeId) return [] as Finding[];
    return findings.filter(f => f.status === 'open' && f.affected.some(a => a.id === expandedNodeId));
  }, [expandedNodeId, findings]);

  // Lookup so the d3 click handler can map finding-node ID → Finding object.
  const findingLookup = useMemo(() => {
    const m = new Map<string, Finding>();
    for (const f of findingsForExpanded) m.set(`finding:${f.id}`, f);
    return m;
  }, [findingsForExpanded]);

  // Augmented graph: when expanded, inject virtual finding nodes + edges into the data the
  // force-sim sees. The position cache keeps the real-node positions stable; finding-nodes
  // get placed naturally by the sim around their parent.
  const augmentedData = useMemo<IdentityGraphData | null>(() => {
    if (!data) return null;
    if (!expandedNodeId || findingsForExpanded.length === 0) return data;
    const findingNodes: IdentityGraphNode[] = findingsForExpanded.map(f => ({
      id: `finding:${f.id}`,
      label: f.rule,
      type: 'finding',
      affected: true,
      // Carry severity through `description` for the click handler; render uses findingLookup.
      description: f.severity
    }));
    const findingLinks = findingsForExpanded.map(f => ({
      source: expandedNodeId,
      target: `finding:${f.id}`,
      type: 'HAS_FINDING'
    }));
    return {
      ...data,
      nodes: [...data.nodes, ...findingNodes],
      links: [...data.links, ...findingLinks]
    };
  }, [data, expandedNodeId, findingsForExpanded]);

  // Related-node IDs for the expanded sub-graph. Computed from the click-target's type:
  //   user  → its groups + roles (via group + direct) + findings affecting it
  //   group → its members + its roles + findings
  //   role  → its granting groups + direct holders + indirect holders + findings
  const relatedIds = useMemo(() => {
    if (!expandedNodeId || !data) return null;
    const target = data.nodes.find(n => n.id === expandedNodeId);
    if (!target) return null;
    const set = new Set<string>([target.id]);
    // Always keep the realm in view as the anchor.
    const realmNode = data.nodes.find(n => n.type === 'realm');
    if (realmNode) set.add(realmNode.id);

    if (target.type === 'user') {
      const groupIds = data.membershipByUser?.[target.id] ?? [];
      groupIds.forEach(g => {
        set.add(g);
        (data.rolesByGroup?.[g] ?? []).forEach(r => set.add(r));
      });
      (data.directRolesByUser?.[target.id] ?? []).forEach(r => set.add(r));
    } else if (target.type === 'group') {
      for (const [uid, gids] of Object.entries(data.membershipByUser ?? {})) {
        if (gids.includes(target.id)) set.add(uid);
      }
      (data.rolesByGroup?.[target.id] ?? []).forEach(r => set.add(r));
    } else if (target.type === 'role') {
      const grantingGroupIds: string[] = [];
      for (const [gid, rids] of Object.entries(data.rolesByGroup ?? {})) {
        if (rids.includes(target.id)) {
          set.add(gid);
          grantingGroupIds.push(gid);
        }
      }
      for (const [uid, rids] of Object.entries(data.directRolesByUser ?? {})) {
        if (rids.includes(target.id)) set.add(uid);
      }
      for (const [uid, gids] of Object.entries(data.membershipByUser ?? {})) {
        if (gids.some(g => grantingGroupIds.includes(g))) set.add(uid);
      }
    }
    // Findings sub-nodes for the expanded target are always part of the visible sub-graph.
    for (const f of findingsForExpanded) {
      set.add(`finding:${f.id}`);
    }
    return set;
  }, [expandedNodeId, data, findingsForExpanded]);

  useEffect(() => {
    const sourceData = augmentedData;
    if (!sourceData || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Restore positions from previous renders so the layout doesn't re-tumble on each
    // polling tick. New nodes (not in the cache) come in with x/y unset and the sim
    // places them naturally.
    const cache = positionCacheRef.current;
    const nodes = sourceData.nodes.map(n => {
      const cached = cache.get(n.id);
      return { ...n, ...(cached ?? {}) };
    });
    const links = sourceData.links.map(l => ({ ...l }));

    const sim = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(d => (d as any).type === 'BELONGS_TO' ? 70 : 100).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-180))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(22))
      // Fast cool-down: don't keep the sim "hot" forever. After ~80 ticks the layout is
      // settled and we stop chewing CPU on micro-movements.
      .alphaDecay(0.05)
      .velocityDecay(0.5);

    // If we already have cached positions, start cooler so existing nodes stay put.
    if (cache.size > 0) sim.alpha(0.3);

    const root = svg.append('g').attr('class', 'zoom-root');

    const link = root.append('g')
      .attr('stroke', 'rgb(100 116 139)')
      .attr('stroke-opacity', 0.5)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', 1);

    const node = root.append('g')
      .selectAll<SVGGElement, IdentityGraphNode>('g')
      .data(nodes)
      .join('g')
      .attr('class', (d) => (d.type === 'user' || d.type === 'group' || d.type === 'role') ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing');

    // Drag + click discrimination: we treat a "drag" that ended without movement as a click.
    node.call(
      d3.drag<SVGGElement, IdentityGraphNode>()
        .on('start', function (event, d: any) {
          if (!event.active) sim.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
          // Track initial pointer for click detection on drag end.
          (this as any).__pressX = event.x;
          (this as any).__pressY = event.y;
        })
        .on('drag', (event, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', function (event, d: any) {
          if (!event.active) sim.alphaTarget(0);
          const moved = Math.hypot(event.x - ((this as any).__pressX ?? event.x), event.y - ((this as any).__pressY ?? event.y));
          if (moved < 4) {
            // Click: release pin. Schedule the inline-panel open after 220ms; a dblclick
            // landing within that window cancels this and opens the sub-graph expansion.
            d.fx = null;
            d.fy = null;
            // Finding sub-node click → open FindingDetailDrawer immediately (no inline panel).
            if (d.type === 'finding') {
              if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
              const f = findingLookup.get(d.id);
              if (f) onSelectFindingRef.current?.(f);
              return;
            }
            if (d.type !== 'user' && d.type !== 'group' && d.type !== 'role') return;
            if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
            clickTimerRef.current = setTimeout(() => {
              setInlineSelected(d as IdentityGraphNode);
              setExpandedNodeId(null);
              clickTimerRef.current = null;
            }, 220);
          } else {
            // Real drag: pin the node at its new position so it doesn't fly back.
            d.fx = event.x;
            d.fy = event.y;
          }
        })
    );

    // Native dblclick → cancel pending single-click and expand the sub-graph.
    node.on('dblclick', function (event, d: any) {
      event.preventDefault();
      event.stopPropagation();
      if (d.type !== 'user' && d.type !== 'group' && d.type !== 'role') return;
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      setExpandedNodeId(d.id);
      setInlineSelected(null);
    });

    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.4, 4])
        .on('zoom', (event) => root.attr('transform', event.transform.toString()))
    );
    // Disable d3.zoom's default dblclick-to-zoom — we use dblclick for sub-graph expansion.
    svg.on('dblclick.zoom', null);

    // Map finding severity → fill colour for the sub-node shapes.
    const findingFill = (d: IdentityGraphNode): string => {
      const f = findingLookup.get(d.id);
      const sev = f?.severity ?? (d.description as Severity);
      return sev === 'critical' ? '#ef4444'
        : sev === 'error'    ? '#f97316'
        : sev === 'warning'  ? '#eab308'
        : '#3b82f6';
    };

    // Finding nodes rendered as a rotated square (diamond) so they're instantly distinguishable
    // from the round identity nodes. Real identity nodes still use circles.
    node.filter(d => d.type === 'finding')
      .append('rect')
      .attr('x', -7)
      .attr('y', -7)
      .attr('width', 14)
      .attr('height', 14)
      .attr('transform', 'rotate(45)')
      .attr('fill', findingFill)
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 1.5);

    // Main circle for identity nodes (skip findings — they got a diamond above).
    node.filter(d => d.type !== 'finding')
      .append('circle')
      .attr('r', (d) => {
        if (d.type === 'realm') return 18;
        if (d.type === 'user') {
          const r = riskByUserId.get(d.id);
          return r ? RISK_RADIUS[r.level] : 10;
        }
        if (d.type === 'role') return 7;   // small — there are several, keep them compact
        if (d.type === 'group') return 9;
        return 10;
      })
      .attr('fill', (d) => {
        if (d.type === 'user') {
          const r = riskByUserId.get(d.id);
          if (r) return RISK_COLOR[r.level];
        }
        return TYPE_COLOR[d.type] ?? '#94a3b8';
      })
      .attr('stroke', (d) => {
        if (d.type === 'role' && d.roleName && SENSITIVE_ROLE_NAMES.has(d.roleName)) return '#ef4444';
        if (d.type === 'user') {
          const r = riskByUserId.get(d.id);
          if (r && (r.level === 'critical' || r.level === 'warning')) return '#0f172a';
        }
        return d.affected ? '#ef4444' : '#0f172a';
      })
      .attr('stroke-width', (d) => {
        if (d.type === 'role' && d.roleName && SENSITIVE_ROLE_NAMES.has(d.roleName)) return 2.5;
        if (d.type === 'user') {
          const r = riskByUserId.get(d.id);
          if (r && r.level === 'critical') return 2.5;
        }
        return d.affected ? 3 : 1.5;
      })
      .attr('opacity', (d) => (d.type === 'role' && d.affected && !SENSITIVE_ROLE_NAMES.has(d.roleName ?? '')) ? 0.55 : 1);

    // Pulse ring for critical / warning user nodes (and any non-user affected node).
    node.filter((d) => {
      if (d.type === 'user') {
        const r = riskByUserId.get(d.id);
        return r ? (r.level === 'critical' || r.level === 'warning') : false;
      }
      return d.affected;
    }).append('circle')
      .attr('r', (d) => {
        if (d.type === 'user') {
          const r = riskByUserId.get(d.id);
          return r ? RISK_RADIUS[r.level] + 2 : 12;
        }
        return 12;
      })
      .attr('fill', 'none')
      .attr('stroke', (d) => {
        if (d.type === 'user') {
          const r = riskByUserId.get(d.id);
          return r ? RISK_COLOR[r.level] : '#ef4444';
        }
        return '#ef4444';
      })
      .attr('stroke-width', 2)
      .attr('opacity', 0.6)
      .append('animate')
      .attr('attributeName', 'r')
      .attr('from', '10')
      .attr('to', '24')
      .attr('dur', '1.6s')
      .attr('repeatCount', 'indefinite');

    node.append('text')
      .text((d) => d.label.length > 16 ? d.label.slice(0, 15) + '…' : d.label)
      .attr('font-size', 9)
      .attr('font-family', 'monospace')
      .attr('dx', 14)
      .attr('dy', 3)
      .attr('fill', 'currentColor')
      .attr('class', 'text-gray-700 dark:text-gray-200');

    node.append('title')
      .text((d) => {
        if (d.type === 'user') {
          const r = riskByUserId.get(d.id);
          return r ? `user: ${d.label} · Risk ${r.score} (${r.level})` : `user: ${d.label}`;
        }
        return `${d.type}: ${d.label}${d.affected ? ' ⚠ betroffen' : ''}`;
      });

    sim.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x ?? 0)
        .attr('y1', (d: any) => d.source.y ?? 0)
        .attr('x2', (d: any) => d.target.x ?? 0)
        .attr('y2', (d: any) => d.target.y ?? 0);
      node.attr('transform', (d: any) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      // Snapshot positions + pin state before the sim is torn down so the next render
      // can place nodes exactly where they were — no springing.
      const next = new Map<string, { x?: number; y?: number; fx?: number | null; fy?: number | null }>();
      for (const n of nodes as any[]) {
        next.set(n.id, { x: n.x, y: n.y, fx: n.fx, fy: n.fy });
      }
      positionCacheRef.current = next;
      sim.stop();
    };
  }, [augmentedData, riskByUserId, width, height]);

  // Sub-graph dim — toggles opacity on existing SVG nodes/links without rebuilding the d3
  // effect. Runs whenever relatedIds (and so expandedNodeId) changes.
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svg = d3.select(svgEl);
    const nodeSel = svg.selectAll<SVGGElement, IdentityGraphNode>('g.zoom-root > g > g');
    const linkSel = svg.selectAll<SVGLineElement, any>('g.zoom-root > g > line');
    if (!relatedIds) {
      nodeSel.attr('opacity', null);
      linkSel.attr('opacity', null);
      return;
    }
    nodeSel.attr('opacity', (d: any) => (relatedIds.has(d.id) ? 1 : 0.12));
    linkSel.attr('opacity', (l: any) => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      return (relatedIds.has(s) && relatedIds.has(t)) ? 0.9 : 0.05;
    });
    // Re-fire whenever augmentedData/riskByUserId rebuilds the d3 graph, so the dim survives
    // the 10s liveEvents-driven re-render. Without this, the sub-graph dim disappears as soon
    // as risk scores recompute.
  }, [relatedIds, augmentedData, riskByUserId]);

  // Risk-level legend counts for the header — counts per level.
  const riskCounts = useMemo(() => {
    const c: Record<RiskLevel, number> = { safe: 0, caution: 0, warning: 0, critical: 0 };
    for (const r of riskByUserId.values()) c[r.level]++;
    return c;
  }, [riskByUserId]);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-col ${
      isFullscreen
        ? 'fixed inset-4 z-40 h-auto'
        : 'h-full'
    }`}>
      <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium tracking-wide">
            Identity Graph · AI-Risk-Analyse
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
            {data ? `${data.nodes.length} Knoten · Realm "${data.realm}" · Klick · Doppelklick = Sub-Graph` : 'Lade …'}
          </div>
        </div>
        <div className="flex gap-2 text-[11px] flex-wrap justify-end items-center">
          {(['critical','warning','caution','safe'] as RiskLevel[]).map(level => (
            <span key={level} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700/60">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: RISK_COLOR[level] }} />
              <span className="capitalize text-gray-700 dark:text-gray-200">{level}</span>
              <span className="text-gray-500 dark:text-gray-400 font-semibold">{riskCounts[level]}</span>
            </span>
          ))}
          <button
            onClick={() => setIsFullscreen(v => !v)}
            aria-label={isFullscreen ? 'Vollbild verlassen' : 'Vollbild öffnen'}
            title={isFullscreen ? 'Vollbild verlassen (Esc)' : 'Vollbild'}
            className="ml-1 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          >
            {isFullscreen ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V5H5m14 0h-4v4m-6 6v4H5m14 0h-4v-4" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h4M4 16v4h4M20 8V4h-4M20 16v4h-4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 w-full overflow-hidden relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        />

        {/* Expanded-mode indicator + reset button */}
        {expandedNodeId && (
          <div className="absolute top-2 left-2 bg-violet-100 dark:bg-violet-900/40 border border-violet-300 dark:border-violet-700 rounded-md px-2 py-1 text-xs flex items-center gap-2 z-10">
            <span className="text-violet-700 dark:text-violet-200">
              🔍 Sub-Graph: {data?.nodes.find(n => n.id === expandedNodeId)?.label}
            </span>
            <button
              onClick={() => setExpandedNodeId(null)}
              className="text-violet-700 dark:text-violet-200 hover:underline font-semibold"
            >
              Vollansicht
            </button>
          </div>
        )}

        {/* Inline detail panel — opens on single-click, replaces the heavy centered modal */}
        {inlineSelected && (
          <InlineNodeDetail
            node={inlineSelected}
            graph={data}
            findings={findings}
            liveEvents={liveEvents}
            onClose={() => setInlineSelected(null)}
            onOpenFull={(n) => {
              if (n.type === 'user') onSelectUserRef.current?.(n);
              else if (n.type === 'group') onSelectGroupRef.current?.(n);
              else if (n.type === 'role') onSelectRoleRef.current?.(n);
              setInlineSelected(null);
            }}
            onSelectFinding={(f) => {
              // Bubble up via the user-find-callback chain; SecurityPanel routes findings.
              // The parent already wires modals to setSelectedFinding via onSelectUser→...
              // path. For inline simplicity, just close inline & open the linked node.
              // (Finding-detail flow stays via the full-modal "Vollständige Details" route.)
              // For now, route by selecting the first affected user/group/role as inline.
              const target = f.affected.find(a => a.type === 'user' || a.type === 'group' || a.type === 'role');
              const node = target ? data?.nodes.find(n => n.id === target.id) ?? null : null;
              if (node) setInlineSelected(node);
            }}
            onSelectNode={(n) => setInlineSelected(n)}
          />
        )}
      </div>
    </div>
  );
}
