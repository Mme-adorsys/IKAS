'use client';

import React, { useEffect, useMemo } from 'react';
import { IdentityGraphData, IdentityGraphNode } from '@/store';
import { Finding } from '@/types/security';
import { FindingsList } from './FindingsList';

interface Props {
  group: IdentityGraphNode | null;
  graph: IdentityGraphData | null;
  findings: Finding[];
  onClose: () => void;
  onSelectUser?: (user: IdentityGraphNode) => void;
  onSelectFinding?: (f: Finding) => void;
}

const SENSITIVE_ROLE_NAMES = new Set(['realm-admin', 'admin', 'super-admin']);

export function GroupDetailModal({ group, graph, findings, onClose, onSelectUser, onSelectFinding }: Props) {
  useEffect(() => {
    if (!group) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [group, onClose]);

  // All hooks run on every render; guards below handle null group.
  const members = useMemo(() => {
    if (!group || !graph) return [] as IdentityGraphNode[];
    const userIds = new Set(
      Object.entries(graph.membershipByUser ?? {})
        .filter(([, groupIds]) => groupIds.includes(group.id))
        .map(([userId]) => userId)
    );
    return graph.nodes.filter(n => n.type === 'user' && userIds.has(n.id));
  }, [group, graph]);

  const grantedRoles = useMemo(() => {
    if (!group || !graph) return [] as IdentityGraphNode[];
    const roleIds = new Set(graph.rolesByGroup?.[group.id] ?? []);
    return graph.nodes.filter(n => n.type === 'role' && roleIds.has(n.id));
  }, [group, graph]);

  const groupFindings = useMemo(() => {
    if (!group) return [] as Finding[];
    return findings.filter(f => f.affected.some(a => a.type === 'group' && a.id === group.id));
  }, [group, findings]);

  // Redundancy AI-insight: search findings whose evidence references this group.
  const redundancyTwin = useMemo(() => {
    if (!group) return null;
    const f = findings.find(f =>
      f.rule === 'REDUNDANT_GROUP'
      && f.affected.some(a => a.id === group.id)
    );
    if (!f) return null;
    const other = f.affected.find(a => a.type === 'group' && a.id !== group.id);
    const ev = (f.evidence ?? {}) as any;
    return other ? { name: other.name, overlapPct: ev.roleOverlapPercent ?? 100, sharedRoles: ev.sharedRoles ?? [] } : null;
  }, [group, findings]);

  const sensitiveRoleCount = useMemo(
    () => grantedRoles.filter(r => SENSITIVE_ROLE_NAMES.has(r.roleName ?? '')).length,
    [grantedRoles]
  );

  if (!group) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-2xl w-full max-h-[min(85vh,720px)] flex flex-col border border-gray-200 dark:border-gray-700 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="overflow-y-auto p-5 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-700 dark:text-amber-300 font-bold text-lg shrink-0">
                G
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium tracking-wide">
                  Gruppe · Realm {group.realm ?? '–'}
                </p>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  {group.groupName ?? group.label}
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors shrink-0"
              aria-label="Schließen"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2">
            <StatCard icon="👥" label="Mitglieder" value={members.length} accent="text-blue-600 dark:text-blue-300" />
            <StatCard icon="🔑" label="Rollen" value={grantedRoles.length} accent="text-violet-600 dark:text-violet-300" />
            <StatCard icon="⚠️" label="Findings" value={groupFindings.length} accent="text-red-600 dark:text-red-300" />
          </div>

          {/* Granted roles */}
          <section>
            <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium mb-2">
              Zugewiesene Rollen <span className="text-gray-400">({grantedRoles.length})</span>
            </h4>
            {grantedRoles.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 px-1">Keine Rollen — diese Gruppe vergibt aktuell keine Berechtigungen.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {grantedRoles.map(r => {
                  const isSensitive = SENSITIVE_ROLE_NAMES.has(r.roleName ?? '');
                  return (
                    <span
                      key={r.id}
                      className={`px-2 py-1 rounded text-xs font-mono ${
                        isSensitive
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300/50'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {isSensitive && '🛡️ '}{r.roleName ?? r.label}
                    </span>
                  );
                })}
              </div>
            )}
          </section>

          {/* Members */}
          <section>
            <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium mb-2">
              Mitglieder <span className="text-gray-400">({members.length})</span>
            </h4>
            {members.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 px-1">Keine Mitglieder.</p>
            ) : (
              <ul className="text-xs space-y-1">
                {members.map(m => (
                  <li
                    key={m.id}
                    onClick={() => { onSelectUser?.(m); onClose(); }}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-gray-50 dark:bg-gray-800/60 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    <span className="font-mono">{m.username ?? m.label}</span>
                    <span className="text-gray-500 dark:text-gray-400 truncate">{m.email ?? '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Active findings against this group */}
          {groupFindings.length > 0 && (
            <section>
              <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium mb-2">
                Aktive Findings <span className="text-gray-400">({groupFindings.length})</span>
              </h4>
              <FindingsList
                findings={groupFindings}
                onSelect={(f) => { onSelectFinding?.(f); onClose(); }}
              />
            </section>
          )}

          {/* AI insight */}
          <section className="rounded-md bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-300/30 dark:border-violet-700/40 p-3">
            <div className="text-[10px] uppercase tracking-wide text-violet-700 dark:text-violet-300 font-semibold mb-1">
              🧠 AI-Analyse
            </div>
            <ul className="text-xs text-gray-700 dark:text-gray-200 list-disc pl-4 space-y-0.5">
              {redundancyTwin && (
                <li>
                  Redundant zu <span className="font-semibold">{redundancyTwin.name}</span>{' '}
                  ({redundancyTwin.overlapPct}% Rollen-Überlappung) — Konsolidierung empfohlen.
                </li>
              )}
              {sensitiveRoleCount > 0 && (
                <li>
                  Enthält <span className="font-semibold">{sensitiveRoleCount}</span> sensible Rolle(n)
                  ({grantedRoles.filter(r => SENSITIVE_ROLE_NAMES.has(r.roleName ?? '')).map(r => r.roleName).join(', ')}).
                  Mitglieder dieser Gruppe haben Admin-Rechte.
                </li>
              )}
              {members.length >= 4 && sensitiveRoleCount > 0 && (
                <li>
                  <span className="font-semibold">{members.length} Mitglieder</span> mit Admin-Rechten —
                  Least-Privilege-Prinzip verletzt.
                </li>
              )}
              {grantedRoles.length === 0 && (
                <li>Gruppe vergibt keine Rollen — möglicherweise obsolet.</li>
              )}
              {!redundancyTwin && sensitiveRoleCount === 0 && grantedRoles.length > 0 && (
                <li>Keine auffälligen Muster.</li>
              )}
            </ul>
          </section>

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white"
            >
              Schließen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: string; label: string; value: number; accent: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/60 rounded-md p-2 flex items-center justify-between">
      <div>
        <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
        <div className={`text-xl font-bold leading-none ${accent}`}>{value}</div>
      </div>
      <div className="text-lg opacity-70">{icon}</div>
    </div>
  );
}
