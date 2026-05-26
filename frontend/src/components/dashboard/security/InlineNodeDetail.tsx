'use client';

import React, { useMemo } from 'react';
import { Finding, LiveLoginEvent } from '@/types/security';
import { IdentityGraphData, IdentityGraphNode } from '@/store';
import { computeUserRisk, RiskLevel } from './IdentityGraph';

interface Props {
  node: IdentityGraphNode;
  graph: IdentityGraphData | null;
  findings: Finding[];
  liveEvents: LiveLoginEvent[];
  onClose: () => void;
  onOpenFull?: (node: IdentityGraphNode) => void;
  onSelectFinding?: (f: Finding) => void;
  onSelectNode?: (n: IdentityGraphNode) => void;
}

const SENSITIVE_ROLE_NAMES = new Set(['realm-admin', 'admin', 'super-admin']);

const RISK_PILL: Record<RiskLevel, { bg: string; text: string; label: string }> = {
  safe:     { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', label: 'Niedrig' },
  caution:  { bg: 'bg-yellow-100 dark:bg-yellow-900/30',   text: 'text-yellow-700 dark:text-yellow-300',   label: 'Auffällig' },
  warning:  { bg: 'bg-orange-100 dark:bg-orange-900/30',   text: 'text-orange-700 dark:text-orange-300',   label: 'Verdächtig' },
  critical: { bg: 'bg-red-100 dark:bg-red-900/30',         text: 'text-red-700 dark:text-red-300',         label: 'Kritisch' }
};

/**
 * Compact inline detail panel rendered inside the IdentityGraph card. Replaces the heavy
 * centered modal that used to fire on single-click. Provides quick summary stats + findings
 * list + an optional "Vollständige Details" hand-off to the full modal.
 */
export function InlineNodeDetail({ node, graph, findings, liveEvents, onClose, onOpenFull, onSelectFinding, onSelectNode }: Props) {
  const nodeFindings = useMemo(() => {
    return findings.filter(f => f.affected.some(a => a.id === node.id));
  }, [findings, node.id]);

  // Risk score for users — same heuristic as the graph node colouring.
  const risk = useMemo(() => {
    if (node.type !== 'user') return null;
    return computeUserRisk(node, findings, liveEvents as any);
  }, [node, findings, liveEvents]);

  // For users, also expose the assigned roles (direct + via group).
  const userRoles = useMemo(() => {
    if (node.type !== 'user' || !graph) return [];
    const roleNodes = new Map(graph.nodes.filter(n => n.type === 'role').map(n => [n.id, n] as const));
    const groupNodes = new Map(graph.nodes.filter(n => n.type === 'group').map(n => [n.id, n] as const));
    const collected = new Map<string, { source: string; sensitive: boolean; roleNode: IdentityGraphNode }>();
    for (const roleId of graph.directRolesByUser?.[node.id] ?? []) {
      const r = roleNodes.get(roleId);
      if (!r?.roleName) continue;
      collected.set(r.roleName, { source: 'direkt', sensitive: SENSITIVE_ROLE_NAMES.has(r.roleName), roleNode: r });
    }
    for (const groupId of graph.membershipByUser?.[node.id] ?? []) {
      const group = groupNodes.get(groupId);
      for (const roleId of graph.rolesByGroup?.[groupId] ?? []) {
        const r = roleNodes.get(roleId);
        if (!r?.roleName || collected.has(r.roleName)) continue;
        collected.set(r.roleName, { source: group?.groupName ?? '?', sensitive: SENSITIVE_ROLE_NAMES.has(r.roleName), roleNode: r });
      }
    }
    return Array.from(collected.entries()).map(([roleName, m]) => ({ roleName, ...m }));
  }, [node, graph]);

  // For groups: members + roles
  const groupMembers = useMemo(() => {
    if (node.type !== 'group' || !graph) return [];
    const userIds = new Set(
      Object.entries(graph.membershipByUser ?? {})
        .filter(([, gs]) => gs.includes(node.id))
        .map(([uid]) => uid)
    );
    return graph.nodes.filter(n => n.type === 'user' && userIds.has(n.id));
  }, [node, graph]);

  const groupRoles = useMemo(() => {
    if (node.type !== 'group' || !graph) return [];
    const roleIds = new Set(graph.rolesByGroup?.[node.id] ?? []);
    return graph.nodes.filter(n => n.type === 'role' && roleIds.has(n.id));
  }, [node, graph]);

  // For roles: holders direct + via group + granting groups
  const roleHolders = useMemo(() => {
    if (node.type !== 'role' || !graph) return { direct: [], viaGroup: [], grantingGroups: [] as IdentityGraphNode[] };
    const direct = graph.nodes.filter(n =>
      n.type === 'user' && (graph.directRolesByUser?.[n.id] ?? []).includes(node.id)
    );
    const grantingGroupIds = new Set(
      Object.entries(graph.rolesByGroup ?? {})
        .filter(([, rs]) => rs.includes(node.id))
        .map(([gid]) => gid)
    );
    const grantingGroups = graph.nodes.filter(n => n.type === 'group' && grantingGroupIds.has(n.id));
    const indirectIds = new Set<string>();
    for (const [uid, gids] of Object.entries(graph.membershipByUser ?? {})) {
      if (gids.some(g => grantingGroupIds.has(g))) indirectIds.add(uid);
    }
    const directIds = new Set(direct.map(d => d.id));
    const viaGroup = graph.nodes.filter(n => n.type === 'user' && indirectIds.has(n.id) && !directIds.has(n.id));
    return { direct, viaGroup, grantingGroups };
  }, [node, graph]);

  const initials = ((node.username ?? node.label ?? '??').slice(0, 2)).toUpperCase();
  const isSensitiveRole = node.type === 'role' && SENSITIVE_ROLE_NAMES.has(node.roleName ?? '');

  return (
    <div className="absolute right-2 top-2 bottom-2 w-72 bg-white/97 dark:bg-gray-900/97 backdrop-blur-sm rounded-md border border-gray-200 dark:border-gray-700 shadow-lg flex flex-col z-20 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-start gap-2">
        {node.type === 'user' && (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {initials}
          </div>
        )}
        {node.type === 'group' && (
          <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-700 dark:text-amber-300 font-bold text-sm shrink-0">G</div>
        )}
        {node.type === 'role' && (
          <div className={`w-9 h-9 rounded-full ${isSensitiveRole ? 'bg-red-500/20 border-red-500/40 text-red-700 dark:text-red-300' : 'bg-pink-500/20 border-pink-500/40 text-pink-700 dark:text-pink-300'} border flex items-center justify-center font-bold text-sm shrink-0`}>
            {isSensitiveRole ? '🛡️' : 'R'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {node.type} {node.realm ? `· ${node.realm}` : ''}
          </div>
          <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {node.username ?? node.groupName ?? node.roleName ?? node.label}
          </div>
          {node.email && (
            <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{node.email}</div>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Schließen"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body — scrolls if content overflows */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 text-xs">
        {/* Risk pill (users only) */}
        {risk && (
          <div className={`flex items-center justify-between rounded px-2 py-1.5 ${RISK_PILL[risk.level].bg}`}>
            <div>
              <div className={`text-[9px] uppercase tracking-wide ${RISK_PILL[risk.level].text} opacity-80`}>AI-Risk</div>
              <div className={`text-xs font-semibold ${RISK_PILL[risk.level].text}`}>{RISK_PILL[risk.level].label}</div>
            </div>
            <div className={`text-2xl font-bold ${RISK_PILL[risk.level].text}`}>{risk.score}</div>
          </div>
        )}

        {/* User: roles */}
        {node.type === 'user' && userRoles.length > 0 && (
          <section>
            <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Rollen ({userRoles.length})
            </div>
            <ul className="space-y-0.5">
              {userRoles.map(r => (
                <li
                  key={r.roleName}
                  onClick={() => onSelectNode?.(r.roleNode)}
                  className={`flex items-center justify-between gap-2 px-1.5 py-1 rounded cursor-pointer border-l-2 ${
                    r.sensitive ? 'border-red-500 bg-red-50 dark:bg-red-900/15 hover:bg-red-100 dark:hover:bg-red-900/25' : 'border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                  }`}
                >
                  <span className={`font-mono ${r.sensitive ? 'text-red-700 dark:text-red-300 font-semibold' : ''}`}>
                    {r.sensitive && '🛡️ '}{r.roleName}
                  </span>
                  <span className={`text-[9px] uppercase shrink-0 ${r.source === 'direkt' ? 'text-red-600 dark:text-red-300 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                    {r.source === 'direkt' ? 'direkt' : `via ${r.source}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Group: members + roles */}
        {node.type === 'group' && (
          <>
            {groupRoles.length > 0 && (
              <section>
                <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                  Rollen ({groupRoles.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {groupRoles.map(r => {
                    const sensitive = SENSITIVE_ROLE_NAMES.has(r.roleName ?? '');
                    return (
                      <button
                        key={r.id}
                        onClick={() => onSelectNode?.(r)}
                        className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${
                          sensitive ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {sensitive && '🛡️ '}{r.roleName ?? r.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
            {groupMembers.length > 0 && (
              <section>
                <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                  Mitglieder ({groupMembers.length})
                </div>
                <ul className="space-y-0.5">
                  {groupMembers.map(m => (
                    <li
                      key={m.id}
                      onClick={() => onSelectNode?.(m)}
                      className="font-mono px-1.5 py-1 rounded cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      {m.username ?? m.label}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {/* Role: holders + granting groups */}
        {node.type === 'role' && (
          <>
            {roleHolders.direct.length > 0 && (
              <section>
                <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                  Direkt ({roleHolders.direct.length})
                </div>
                <ul className="space-y-0.5">
                  {roleHolders.direct.map(u => (
                    <li
                      key={u.id}
                      onClick={() => onSelectNode?.(u)}
                      className="px-1.5 py-1 rounded border-l-2 border-red-500 bg-red-50 dark:bg-red-900/15 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/25 font-mono"
                    >
                      {u.username ?? u.label}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {roleHolders.grantingGroups.length > 0 && (
              <section>
                <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                  Via Gruppe ({roleHolders.grantingGroups.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {roleHolders.grantingGroups.map(g => (
                    <button
                      key={g.id}
                      onClick={() => onSelectNode?.(g)}
                      className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-200"
                    >
                      {g.groupName ?? g.label}
                    </button>
                  ))}
                </div>
              </section>
            )}
            {roleHolders.viaGroup.length > 0 && (
              <section>
                <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                  Inhaber via Gruppe ({roleHolders.viaGroup.length})
                </div>
                <ul className="grid grid-cols-2 gap-0.5 text-[11px]">
                  {roleHolders.viaGroup.map(u => (
                    <li
                      key={u.id}
                      onClick={() => onSelectNode?.(u)}
                      className="font-mono truncate px-1 py-0.5 rounded cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      {u.username ?? u.label}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {/* Findings (any type) */}
        {nodeFindings.length > 0 && (
          <section>
            <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Findings ({nodeFindings.length})
            </div>
            <ul className="space-y-1">
              {nodeFindings.map(f => (
                <li
                  key={f.id}
                  onClick={() => onSelectFinding?.(f)}
                  className={`px-1.5 py-1 rounded cursor-pointer text-[11px] hover:opacity-80 ${
                    f.severity === 'critical' ? 'bg-red-50 dark:bg-red-900/15 border-l-2 border-red-500'
                    : f.severity === 'error' ? 'bg-orange-50 dark:bg-orange-900/15 border-l-2 border-orange-500'
                    : f.severity === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/15 border-l-2 border-yellow-500'
                    : 'bg-blue-50 dark:bg-blue-900/15 border-l-2 border-blue-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] uppercase font-semibold text-gray-600 dark:text-gray-300">{f.severity}</span>
                    <code className="text-[9px] text-gray-500 dark:text-gray-400 font-mono truncate">{f.rule}</code>
                  </div>
                  <div className="text-gray-900 dark:text-white mt-0.5 line-clamp-2">{f.title}</div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {nodeFindings.length === 0 && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Keine Findings zu diesem Knoten.</p>
        )}
      </div>

      {/* Footer */}
      {onOpenFull && (
        <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => onOpenFull(node)}
            className="w-full px-2 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            Vollständige Details öffnen ›
          </button>
        </div>
      )}
    </div>
  );
}
