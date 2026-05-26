'use client';

import React, { useMemo } from 'react';
import { Finding, LiveLoginEvent } from '@/types/security';
import { IdentityGraphData, IdentityGraphNode } from '@/store';

interface Props {
  graph: IdentityGraphData | null;
  findings: Finding[];
  liveEvents: LiveLoginEvent[];
  onSelectUser?: (user: IdentityGraphNode) => void;
  onSelectGroup?: (group: IdentityGraphNode) => void;
  onSelectRole?: (role: IdentityGraphNode) => void;
  onSelectFinding?: (f: Finding) => void;
}

const SENSITIVE_ROLE_NAMES = new Set(['realm-admin', 'admin', 'super-admin']);

/**
 * Four explicit "AI-Audit" cards summarising the security landscape. They sit below the
 * battle-station so users see the audit story at a glance without having to mentally
 * decode the IdentityGraph's pink/amber nodes.
 *
 *   ┌──────────┬──────────┬──────────┬──────────┐
 *   │ God-Mode │ Gruppen  │ Rollen   │ Threats  │
 *   └──────────┴──────────┴──────────┴──────────┘
 */
export function PrivilegeAuditWidgets({ graph, findings, liveEvents, onSelectUser, onSelectGroup, onSelectRole, onSelectFinding }: Props) {
  // ── God-Mode users (from USER_GOD_MODE findings) ──────────────────────────
  const godModeUsers = useMemo(() => {
    if (!graph) return [];
    const userById = new Map(graph.nodes.filter(n => n.type === 'user').map(n => [n.id, n] as const));
    return findings
      .filter(f => f.rule === 'USER_GOD_MODE' && f.status === 'open')
      .map(f => {
        const aff = f.affected.find(a => a.type === 'user');
        if (!aff) return null;
        const user = userById.get(aff.id);
        if (!user) return null;
        const ev = (f.evidence ?? {}) as any;
        return {
          user,
          roleCount: ev.roleCount ?? 0,
          sensitiveRoles: (ev.sensitiveRoles as string[]) ?? [],
          groups: (ev.memberOfGroups as string[]) ?? []
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.roleCount - a.roleCount);
  }, [graph, findings]);

  // ── Groups with member-count, role-count, redundancy flag ─────────────────
  const groupRows = useMemo(() => {
    if (!graph) return [];
    const redundantIds = new Set<string>();
    for (const f of findings) {
      if (f.rule === 'REDUNDANT_GROUP') {
        for (const a of f.affected) {
          if (a.type === 'group') redundantIds.add(a.id);
        }
      }
    }
    return graph.nodes
      .filter(n => n.type === 'group')
      .map(g => {
        const memberCount = Object.entries(graph.membershipByUser ?? {})
          .filter(([, gids]) => gids.includes(g.id)).length;
        const roleIds = graph.rolesByGroup?.[g.id] ?? [];
        const roleCount = roleIds.length;
        const hasSensitive = roleIds.some(rid => {
          const r = graph.nodes.find(n => n.id === rid);
          return r?.roleName ? SENSITIVE_ROLE_NAMES.has(r.roleName) : false;
        });
        return {
          group: g,
          memberCount,
          roleCount,
          hasSensitive,
          redundant: redundantIds.has(g.id)
        };
      })
      .sort((a, b) => (b.hasSensitive ? 1 : 0) - (a.hasSensitive ? 1 : 0) || b.memberCount - a.memberCount);
  }, [graph, findings]);

  // ── Roles with total-user count, sensitivity, orphan flag ─────────────────
  const roleRows = useMemo(() => {
    if (!graph) return [];
    const orphanIds = new Set<string>();
    for (const f of findings) {
      if (f.rule === 'ORPHAN_ROLE') {
        for (const a of f.affected) {
          if (a.type === 'role') orphanIds.add(a.id);
        }
      }
    }
    return graph.nodes
      .filter(n => n.type === 'role')
      .map(role => {
        const directUsers = Object.entries(graph.directRolesByUser ?? {})
          .filter(([, rids]) => rids.includes(role.id)).length;
        const grantingGroupIds = Object.entries(graph.rolesByGroup ?? {})
          .filter(([, rids]) => rids.includes(role.id))
          .map(([gid]) => gid);
        const indirectUserIds = new Set<string>();
        for (const [uid, gids] of Object.entries(graph.membershipByUser ?? {})) {
          if (gids.some(g => grantingGroupIds.includes(g))) indirectUserIds.add(uid);
        }
        const totalUsers = directUsers + indirectUserIds.size;
        const sensitive = role.roleName ? SENSITIVE_ROLE_NAMES.has(role.roleName) : false;
        return {
          role,
          directUsers,
          totalUsers,
          sensitive,
          orphan: orphanIds.has(role.id)
        };
      })
      .sort((a, b) => (b.sensitive ? 1 : 0) - (a.sensitive ? 1 : 0) || b.totalUsers - a.totalUsers);
  }, [graph, findings]);

  // ── Live Intrusion Detection: per-user threat score combining live events + findings ──
  // Score weighting (read-only, deterministic):
  //   ≥5 Failed logins in 5min   → +min(failed*3, 30)
  //   ≥1 Tor/Known-Bad in 5min    → +15
  //   ≥4 Unique IPs in 5min       → +10
  //   USER_BRUTE_FORCE_TARGET     → +20
  //   USER_MANY_IPS               → +15
  //   USER_IMPOSSIBLE_TRAVEL      → +30
  //   Email not verified          → +5
  //   PASSWORD_POLICY_MISSING (realm-level) → +5
  // Thresholds:  ≥50 SOFORT SPERREN  · ≥30 BLOCK empfohlen · ≥15 Beobachten
  const intrusionDetections = useMemo(() => {
    if (!graph) return [];

    const realmHasWeakPolicy = findings.some(f => f.rule === 'PASSWORD_POLICY_MISSING' && f.status === 'open');
    const cutoff = Date.now() - 5 * 60 * 1000;

    type Detection = {
      user: IdentityGraphNode;
      score: number;
      reasons: string[];
      severity: 'urgent' | 'block' | 'watch';
    };
    const detections: Detection[] = [];

    for (const user of graph.nodes) {
      if (user.type !== 'user' || !user.username) continue;
      const userEvents = liveEvents.filter(e => e.username === user.username && new Date(e.time).getTime() >= cutoff);
      const failed = userEvents.filter(e => !e.success).length;
      const torBad = userEvents.filter(e => e.ipClassification === 'tor' || e.ipClassification === 'known-bad').length;
      const uniqueIps = new Set(userEvents.map(e => e.ip)).size;

      const userFindings = findings.filter(f =>
        f.status === 'open' &&
        f.affected.some(a => a.type === 'user' && a.id === user.id)
      );
      const findingRules = new Set(userFindings.map(f => f.rule));

      let score = 0;
      const reasons: string[] = [];

      if (failed >= 5) {
        const pts = Math.min(failed * 3, 30);
        score += pts;
        reasons.push(`${failed} Failed in 5min`);
      }
      if (torBad >= 1) {
        score += 15;
        reasons.push(`${torBad}× Tor/Bad-IP`);
      }
      if (uniqueIps >= 4) {
        score += 10;
        reasons.push(`${uniqueIps} IPs in 5min`);
      }
      if (findingRules.has('USER_BRUTE_FORCE_TARGET')) {
        score += 20;
        reasons.push('Brute-Force-Ziel (24h)');
      }
      if (findingRules.has('USER_MANY_IPS')) {
        score += 15;
        reasons.push('Multi-IP-Anomalie');
      }
      if (findingRules.has('USER_IMPOSSIBLE_TRAVEL')) {
        score += 30;
        reasons.push('Impossible Travel');
      }
      if (user.emailVerified === false) {
        score += 5;
        reasons.push('Email unverifiziert');
      }
      if (realmHasWeakPolicy && score >= 15) {
        // Only meaningful when there's already activity — otherwise every user "qualifies".
        score += 5;
        reasons.push('Schwache Realm-Policy');
      }

      if (score < 15) continue;
      const severity: Detection['severity'] = score >= 50 ? 'urgent' : score >= 30 ? 'block' : 'watch';
      detections.push({ user, score, reasons, severity });
    }
    return detections.sort((a, b) => b.score - a.score).slice(0, 8);
  }, [graph, findings, liveEvents]);

  // Aggregate counters for the widget header.
  const intrusionStats = useMemo(() => {
    const cutoff = Date.now() - 5 * 60 * 1000;
    const recent = liveEvents.filter(e => new Date(e.time).getTime() >= cutoff);
    const failed = recent.filter(e => !e.success).length;
    const urgent = intrusionDetections.filter(d => d.severity === 'urgent').length;
    const block = intrusionDetections.filter(d => d.severity === 'block').length;
    return { failed, urgent, block };
  }, [liveEvents, intrusionDetections]);

  if (!graph) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* God-Mode users */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-col min-h-[260px] max-h-[420px]">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium tracking-wide">
              God-Mode-Konten
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {godModeUsers.length} kritisch
            </div>
          </div>
          <div className="text-2xl">⛔</div>
        </div>
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {godModeUsers.length === 0 ? (
            <div className="text-xs text-gray-500 dark:text-gray-400 py-4 text-center">
              Keine God-Mode-Konten erkannt.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {godModeUsers.map(({ user, roleCount, sensitiveRoles }) => (
                <li
                  key={user.id}
                  onClick={() => onSelectUser?.(user)}
                  className="cursor-pointer px-2 py-2 rounded border-l-2 border-red-500 bg-red-50 dark:bg-red-900/15 hover:bg-red-100 dark:hover:bg-red-900/25 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {user.username ?? user.label}
                    </span>
                    <span className="text-[10px] uppercase font-semibold text-red-600 dark:text-red-300 shrink-0">
                      {roleCount} Rollen
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {sensitiveRoles.slice(0, 3).map(r => (
                      <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-200 font-mono">
                        🛡️ {r}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Groups */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-col min-h-[260px] max-h-[420px]">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium tracking-wide">
              Gruppen-Audit
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {groupRows.length} Gruppen ·{' '}
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                {groupRows.filter(g => g.redundant).length} redundant
              </span>
            </div>
          </div>
          <div className="text-2xl">👥</div>
        </div>
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          <ul className="space-y-1">
            {groupRows.map(({ group, memberCount, roleCount, hasSensitive, redundant }) => (
              <li
                key={group.id}
                onClick={() => onSelectGroup?.(group)}
                className={`cursor-pointer px-2 py-1.5 rounded border-l-2 transition-colors ${
                  redundant
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/15 hover:bg-amber-100 dark:hover:bg-amber-900/25'
                    : hasSensitive
                      ? 'border-red-500 bg-red-50/60 dark:bg-red-900/10 hover:bg-red-100/60 dark:hover:bg-red-900/20'
                      : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 hover:bg-blue-50 dark:hover:bg-blue-900/15'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                    {hasSensitive && '🛡️ '}{group.groupName ?? group.label}
                  </span>
                  {redundant && (
                    <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 shrink-0">
                      Redundant
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {memberCount} Mitglied(er) · {roleCount} Rolle(n)
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Roles */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-col min-h-[260px] max-h-[420px]">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium tracking-wide">
              Rollen-Audit
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {roleRows.length} Rollen ·{' '}
              <span className="text-red-600 dark:text-red-400 font-semibold">
                {roleRows.filter(r => r.sensitive).length} sensitiv
              </span>
              {roleRows.some(r => r.orphan) && (
                <>
                  {' · '}
                  <span className="text-gray-500 dark:text-gray-400 font-semibold">
                    {roleRows.filter(r => r.orphan).length} verwaist
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="text-2xl">🔑</div>
        </div>
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          <ul className="space-y-1">
            {roleRows.map(({ role, totalUsers, directUsers, sensitive, orphan }) => (
              <li
                key={role.id}
                onClick={() => onSelectRole?.(role)}
                className={`cursor-pointer px-2 py-1.5 rounded border-l-2 transition-colors ${
                  sensitive
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/15 hover:bg-red-100 dark:hover:bg-red-900/25'
                    : orphan
                      ? 'border-gray-400 bg-gray-50 dark:bg-gray-800/40 opacity-70 hover:opacity-100'
                      : 'border-pink-400 bg-pink-50/40 dark:bg-pink-900/10 hover:bg-pink-50 dark:hover:bg-pink-900/20'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-mono text-sm truncate ${sensitive ? 'font-semibold text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-white'}`}>
                    {sensitive && '🛡️ '}{role.roleName ?? role.label}
                  </span>
                  {orphan && (
                    <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 shrink-0">
                      Orphan
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {totalUsers} Inhaber {directUsers > 0 && `(${directUsers} direkt)`}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Live Intrusion Detection — replaces the old Threat-Analyse widget.
          Per-user score combining live activity + findings → "BLOCK empfohlen". */}
      <div className={`rounded-lg shadow p-4 flex flex-col min-h-[260px] max-h-[420px] ${
        intrusionStats.urgent > 0
          ? 'bg-red-50 dark:bg-red-900/15 border-2 border-red-400 dark:border-red-700 animate-pulse-slow'
          : 'bg-white dark:bg-gray-800'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium tracking-wide">
              Live Intrusion Detection
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {intrusionStats.urgent > 0 && (
                <span className="text-red-600 dark:text-red-400 font-bold">{intrusionStats.urgent} URGENT · </span>
              )}
              {intrusionStats.block > 0 && (
                <span className="text-orange-600 dark:text-orange-400 font-semibold">{intrusionStats.block} Block · </span>
              )}
              <span>{intrusionStats.failed} Failed/5min</span>
            </div>
          </div>
          <div className="text-2xl">{intrusionStats.urgent > 0 ? '🚨' : '🛡️'}</div>
        </div>
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {intrusionDetections.length === 0 ? (
            <div className="text-xs text-gray-500 dark:text-gray-400 py-4 text-center">
              Keine aktiven Intrusion-Pattern erkannt.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {intrusionDetections.map(({ user, score, reasons, severity }) => {
                const bgClass = severity === 'urgent'
                  ? 'border-red-600 bg-red-100 dark:bg-red-900/25 hover:bg-red-200 dark:hover:bg-red-900/40'
                  : severity === 'block'
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30'
                    : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/15 hover:bg-yellow-100 dark:hover:bg-yellow-900/25';
                const actionLabel = severity === 'urgent' ? '🚨 SOFORT SPERREN' : severity === 'block' ? '🛑 BLOCK empfohlen' : '👁 Beobachten';
                const actionColor = severity === 'urgent'
                  ? 'bg-red-600 text-white'
                  : severity === 'block'
                    ? 'bg-orange-500 text-white'
                    : 'bg-yellow-500 text-gray-900';
                return (
                  <li
                    key={user.id}
                    onClick={() => onSelectUser?.(user)}
                    className={`cursor-pointer px-2 py-1.5 rounded border-l-2 transition-colors ${bgClass}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {user.username ?? user.label}
                      </span>
                      <span className="text-base font-bold text-red-700 dark:text-red-300 shrink-0">
                        {score}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {reasons.slice(0, 3).map(r => (
                        <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-white/70 dark:bg-black/30 text-gray-700 dark:text-gray-200">
                          {r}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1">
                      <span className={`inline-block text-[10px] uppercase font-bold px-2 py-0.5 rounded ${actionColor}`}>
                        {actionLabel}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
