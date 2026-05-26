'use client';

import React, { useEffect, useMemo } from 'react';
import { IdentityGraphData, IdentityGraphNode } from '@/store';
import { Finding } from '@/types/security';
import { FindingsList } from './FindingsList';

interface Props {
  role: IdentityGraphNode | null;
  graph: IdentityGraphData | null;
  findings: Finding[];
  onClose: () => void;
  onSelectUser?: (user: IdentityGraphNode) => void;
  onSelectGroup?: (group: IdentityGraphNode) => void;
  onSelectFinding?: (f: Finding) => void;
}

const SENSITIVE_ROLE_NAMES = new Set(['realm-admin', 'admin', 'super-admin']);

export function RoleDetailModal({ role, graph, findings, onClose, onSelectUser, onSelectGroup, onSelectFinding }: Props) {
  useEffect(() => {
    if (!role) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [role, onClose]);

  const directUsers = useMemo(() => {
    if (!role || !graph) return [] as IdentityGraphNode[];
    const userIds = new Set(
      Object.entries(graph.directRolesByUser ?? {})
        .filter(([, roleIds]) => roleIds.includes(role.id))
        .map(([userId]) => userId)
    );
    return graph.nodes.filter(n => n.type === 'user' && userIds.has(n.id));
  }, [role, graph]);

  const grantingGroups = useMemo(() => {
    if (!role || !graph) return [] as IdentityGraphNode[];
    const groupIds = new Set(
      Object.entries(graph.rolesByGroup ?? {})
        .filter(([, roleIds]) => roleIds.includes(role.id))
        .map(([groupId]) => groupId)
    );
    return graph.nodes.filter(n => n.type === 'group' && groupIds.has(n.id));
  }, [role, graph]);

  const indirectUsers = useMemo(() => {
    if (!role || !graph) return [] as IdentityGraphNode[];
    const groupIds = new Set(grantingGroups.map(g => g.id));
    const indirectIds = new Set<string>();
    for (const [userId, gids] of Object.entries(graph.membershipByUser ?? {})) {
      if (gids.some(gid => groupIds.has(gid))) indirectIds.add(userId);
    }
    // Exclude users who already have it directly (shown in the direct list).
    const directIds = new Set(directUsers.map(u => u.id));
    return graph.nodes.filter(n => n.type === 'user' && indirectIds.has(n.id) && !directIds.has(n.id));
  }, [role, graph, grantingGroups, directUsers]);

  const totalUsers = directUsers.length + indirectUsers.length;

  const roleFindings = useMemo(() => {
    if (!role) return [] as Finding[];
    return findings.filter(f => f.affected.some(a => a.type === 'role' && a.id === role.id));
  }, [role, findings]);

  if (!role) return null;

  const isSensitive = SENSITIVE_ROLE_NAMES.has(role.roleName ?? '');
  const isOrphan = totalUsers === 0;

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
              <div className={`w-12 h-12 rounded-full ${isSensitive ? 'bg-red-500/20 border-red-500/40 text-red-700 dark:text-red-300' : 'bg-pink-500/20 border-pink-500/40 text-pink-700 dark:text-pink-300'} border flex items-center justify-center font-bold text-lg shrink-0`}>
                {isSensitive ? '🛡️' : 'R'}
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium tracking-wide">
                  Rolle · Realm {role.realm ?? '–'}
                </p>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate font-mono">
                  {role.roleName ?? role.label}
                </h3>
                {role.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{role.description}</p>
                )}
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
            <StatCard icon="🧍" label="Direkt" value={directUsers.length} accent="text-blue-600 dark:text-blue-300" />
            <StatCard icon="👥" label="via Gruppe" value={indirectUsers.length} accent="text-amber-600 dark:text-amber-300" />
            <StatCard icon="∑" label="Gesamt" value={totalUsers} accent="text-violet-600 dark:text-violet-300" />
          </div>

          {/* Direct holders */}
          {directUsers.length > 0 && (
            <section>
              <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium mb-2">
                Direkt zugewiesen ({directUsers.length})
              </h4>
              <ul className="text-xs space-y-1">
                {directUsers.map(u => (
                  <li
                    key={u.id}
                    onClick={() => { onSelectUser?.(u); onClose(); }}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-red-50 dark:bg-red-900/10 border-l-2 border-red-500 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/20"
                  >
                    <span className="font-mono">{u.username ?? u.label}</span>
                    <span className="text-[10px] uppercase text-red-600 dark:text-red-300">direkt · bypasst Gruppen</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Granting groups */}
          {grantingGroups.length > 0 && (
            <section>
              <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium mb-2">
                Wird vergeben durch Gruppen ({grantingGroups.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {grantingGroups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => { onSelectGroup?.(g); onClose(); }}
                    className="px-2 py-1 rounded text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/50"
                  >
                    {g.groupName ?? g.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Indirect (via group) users */}
          {indirectUsers.length > 0 && (
            <section>
              <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium mb-2">
                Über Gruppe ({indirectUsers.length})
              </h4>
              <ul className="text-xs grid grid-cols-2 gap-1">
                {indirectUsers.map(u => (
                  <li
                    key={u.id}
                    onClick={() => { onSelectUser?.(u); onClose(); }}
                    className="font-mono px-2 py-1 rounded bg-gray-50 dark:bg-gray-800/60 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 truncate"
                  >
                    {u.username ?? u.label}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Findings */}
          {roleFindings.length > 0 && (
            <section>
              <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium mb-2">
                Findings ({roleFindings.length})
              </h4>
              <FindingsList
                findings={roleFindings}
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
              {isOrphan && (
                <li>
                  <span className="font-semibold">Verwaiste Rolle</span> — kein Benutzer und keine Gruppe nutzt sie.
                  Empfehlung: Rolle archivieren falls nicht mehr benötigt.
                </li>
              )}
              {isSensitive && totalUsers > 0 && (
                <li>
                  <span className="font-semibold">Hochsensitive Rolle</span>: {totalUsers} Inhaber haben administrativen
                  Zugriff. Mindestens MFA + Audit-Logs erzwingen.
                </li>
              )}
              {isSensitive && directUsers.length > 0 && (
                <li>
                  {directUsers.length} User haben diese Rolle <span className="font-semibold">direkt</span> — klassisches
                  Anti-Pattern. Über Gruppen verwalten für Auditierbarkeit.
                </li>
              )}
              {!isSensitive && !isOrphan && totalUsers > 10 && (
                <li>Breit gestreute Rolle ({totalUsers} Inhaber) — vermutlich Standard-Berechtigung, unkritisch.</li>
              )}
              {!isOrphan && !isSensitive && totalUsers <= 10 && (
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
