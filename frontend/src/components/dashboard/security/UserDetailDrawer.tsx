'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Finding, LiveLoginEvent } from '@/types/security';
import { AdminEvent, IdentityGraphData, IdentityGraphNode, useIKASStore } from '@/store';
import { FindingsList } from './FindingsList';
import { computeUserRisk, RiskLevel } from './IdentityGraph';

interface Props {
  user: IdentityGraphNode | null;
  findings: Finding[];
  liveEvents: LiveLoginEvent[];
  allUsers: IdentityGraphNode[];
  /** Whole identity graph so we can resolve User → Group / Role memberships. */
  graph?: IdentityGraphData | null;
  onClose: () => void;
  onSelectFinding?: (f: Finding) => void;
}

const SENSITIVE_ROLE_NAMES = new Set(['realm-admin', 'admin', 'super-admin']);

const RISK_PILL: Record<RiskLevel, { bg: string; text: string; label: string }> = {
  safe:     { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', label: 'Niedrig' },
  caution:  { bg: 'bg-yellow-100 dark:bg-yellow-900/30',   text: 'text-yellow-700 dark:text-yellow-300',   label: 'Auffällig' },
  warning:  { bg: 'bg-orange-100 dark:bg-orange-900/30',   text: 'text-orange-700 dark:text-orange-300',   label: 'Verdächtig' },
  critical: { bg: 'bg-red-100 dark:bg-red-900/30',         text: 'text-red-700 dark:text-red-300',         label: 'Kritisch' }
};

const DAY_MS = 24 * 3600 * 1000;

export function UserDetailDrawer({ user, findings, liveEvents, allUsers, graph, onClose, onSelectFinding }: Props) {
  const loadAdminEventsForUser = useIKASStore(s => s.loadAdminEventsForUser);
  const [adminEvents, setAdminEvents] = useState<AdminEvent[]>([]);

  // Close on ESC, like other modals/drawers.
  useEffect(() => {
    if (!user) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [user, onClose]);

  // Fetch admin-event lifecycle whenever the modal opens for a new user.
  useEffect(() => {
    if (!user?.id) { setAdminEvents([]); return; }
    let cancelled = false;
    loadAdminEventsForUser(user.id).then(evs => { if (!cancelled) setAdminEvents(evs); });
    return () => { cancelled = true; };
  }, [user?.id, loadAdminEventsForUser]);

  // All hooks must run on every render (React rules-of-hooks), so memoise unconditionally
  // and bail out only afterwards. Empty fallbacks keep the deps stable when user is null.
  const userFindings = useMemo(() => {
    if (!user) return [] as Finding[];
    return findings.filter(f => f.affected.some(a => a.type === 'user' && a.id === user.id));
  }, [user, findings]);

  const userEvents = useMemo(() => {
    if (!user?.username) return [] as LiveLoginEvent[];
    const cutoff = Date.now() - DAY_MS;
    return liveEvents
      .filter(e => e.username === user.username && new Date(e.time).getTime() >= cutoff)
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [user, liveEvents]);

  const duplicates = useMemo(() => {
    if (!user) return [] as Array<{ user: IdentityGraphNode; reason: string }>;
    const list: Array<{ user: IdentityGraphNode; reason: string }> = [];
    for (const other of allUsers) {
      if (other.id === user.id) continue;
      if (user.email && other.email && other.email.toLowerCase() === user.email.toLowerCase()) {
        list.push({ user: other, reason: 'Gleiche Email-Adresse' });
        continue;
      }
      if (user.username && other.username && other.username.toLowerCase() === user.username.toLowerCase()) {
        list.push({ user: other, reason: 'Gleicher Username (case-insensitive)' });
      }
    }
    return list;
  }, [user, allUsers]);

  const risk = useMemo(() => {
    if (!user) return { score: 0, level: 'safe' as RiskLevel };
    return computeUserRisk(user, findings, liveEvents);
  }, [user, findings, liveEvents]);

  // Roles attached to this user. Each entry tracks origin (direct or via which group)
  // so the UI can show "via Admins-Gruppe" badges.
  const userRoles = useMemo(() => {
    if (!user || !graph) return [] as Array<{ roleName: string; source: 'direct' | string; sensitive: boolean }>;
    const roleNodes = new Map(graph.nodes.filter(n => n.type === 'role').map(n => [n.id, n] as const));
    const groupNodes = new Map(graph.nodes.filter(n => n.type === 'group').map(n => [n.id, n] as const));
    const collected = new Map<string, { source: 'direct' | string; sensitive: boolean }>(); // roleName -> meta

    // Direct
    for (const roleId of graph.directRolesByUser?.[user.id] ?? []) {
      const r = roleNodes.get(roleId);
      if (!r?.roleName) continue;
      const sensitive = SENSITIVE_ROLE_NAMES.has(r.roleName);
      collected.set(r.roleName, { source: 'direct', sensitive });
    }
    // Via groups (direct wins if duplicate role name)
    for (const groupId of graph.membershipByUser?.[user.id] ?? []) {
      const group = groupNodes.get(groupId);
      for (const roleId of graph.rolesByGroup?.[groupId] ?? []) {
        const r = roleNodes.get(roleId);
        if (!r?.roleName) continue;
        if (collected.has(r.roleName)) continue;
        const sensitive = SENSITIVE_ROLE_NAMES.has(r.roleName);
        collected.set(r.roleName, { source: group?.groupName ?? 'unknown', sensitive });
      }
    }
    return Array.from(collected.entries()).map(([roleName, meta]) => ({ roleName, ...meta }));
  }, [user, graph]);

  // Helper to format "vor X Tagen" / "vor X Stunden" etc.
  const formatRelative = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const day = 86_400_000;
    if (diff < 60_000) return 'gerade eben';
    if (diff < 3_600_000) return `vor ${Math.floor(diff / 60_000)} Min.`;
    if (diff < day) return `vor ${Math.floor(diff / 3_600_000)} Std.`;
    return `vor ${Math.floor(diff / day)} Tagen`;
  };

  const stats = useMemo(() => {
    const failed = userEvents.filter(e => !e.success).length;
    const uniqueIps = new Set(userEvents.map(e => e.ip)).size;
    const riskyIps = userEvents.filter(e => e.ipClassification === 'tor' || e.ipClassification === 'known-bad').length;
    return { failed, uniqueIps, riskyIps };
  }, [userEvents]);

  const aiInsight = useMemo(() => {
    if (!user) return null;
    const patterns: string[] = [];
    const recs: string[] = [];

    if (stats.failed >= 10) {
      patterns.push(`wiederholte fehlgeschlagene Logins (${stats.failed} in 24h) — klassisches Brute-Force-Muster`);
      recs.push('Account temporär sperren, Brute-Force-Schutz im Realm aktivieren');
    }
    if (stats.uniqueIps >= 5) {
      patterns.push(`Logins aus ${stats.uniqueIps} verschiedenen IPs in 24h`);
      recs.push('IP-basierte Anomalie-Erkennung prüfen');
    }
    if (stats.riskyIps > 0) {
      patterns.push(`${stats.riskyIps} Logins aus bekannten Bedrohungs-IPs (Tor / Known-Bad)`);
      recs.push('Geo-Fencing und Threat-Intelligence-Block aktivieren');
    }
    if (user.emailVerified === false) {
      patterns.push('Email-Adresse nicht verifiziert');
      recs.push('Email-Verifikation erzwingen');
    }
    if (user.createdAt && Date.now() - new Date(user.createdAt).getTime() < 7 * DAY_MS) {
      patterns.push('Frisch erstellter Account (< 7 Tage)');
    }
    if (duplicates.length > 0) {
      patterns.push(`${duplicates.length} mögliche Duplikat-Konten gefunden`);
      recs.push('Konten-Konsolidierung prüfen');
    }

    // Privilege patterns
    const sensitiveRoles = userRoles.filter(r => r.sensitive).map(r => r.roleName);
    if (sensitiveRoles.length > 0 && userRoles.length >= 4) {
      patterns.push(`God-Mode-Konto: ${userRoles.length} Rollen inkl. ${sensitiveRoles.join(', ')}`);
      recs.push('Privilegien nach Least-Privilege auf die nötige Untermenge reduzieren');
    } else if (sensitiveRoles.length > 0) {
      patterns.push(`Administrative Rolle vorhanden: ${sensitiveRoles.join(', ')}`);
    }
    const directSensitive = userRoles.filter(r => r.sensitive && r.source === 'direct');
    if (directSensitive.length > 0) {
      patterns.push(`Sensitive Rolle direkt zugewiesen (Bypass von Gruppen-Audit): ${directSensitive.map(r => r.roleName).join(', ')}`);
      recs.push('Direkte Rollen-Zuweisung über Gruppen managen für Auditierbarkeit');
    }

    // Always recommend MFA when risk is elevated and not already mentioned.
    if (risk.level !== 'safe' && !recs.some(r => r.toLowerCase().includes('mfa'))) {
      recs.push('MFA erzwingen');
    }

    return { patterns, recs };
  }, [user, risk, stats, duplicates, userRoles]);

  if (!user) return null;

  const initials = (user.username ?? user.label ?? '??').slice(0, 2).toUpperCase();
  const pill = RISK_PILL[risk.level];

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
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium tracking-wide">
                User · Realm {user.realm ?? '–'}
              </p>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {user.username ?? user.label}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email ?? '—'}</p>
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

        {/* AI Risk Pill */}
        <div className={`flex items-center justify-between rounded-md px-3 py-2 ${pill.bg}`}>
          <div>
            <div className={`text-[10px] uppercase tracking-wide ${pill.text} opacity-80`}>AI-Risk-Score</div>
            <div className={`text-sm font-semibold ${pill.text}`}>{pill.label}</div>
          </div>
          <div className={`text-3xl font-bold ${pill.text}`}>{risk.score}</div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard icon="⚠️" label="Findings"      value={userFindings.length} accent="text-red-600 dark:text-red-300" />
          <StatCard icon="🔴" label="Failed (24h)"  value={stats.failed}        accent="text-red-600 dark:text-red-300" />
          <StatCard icon="🌐" label="Unique IPs"    value={stats.uniqueIps}     accent="text-blue-600 dark:text-blue-300" />
          <StatCard icon="🕵️" label="Tor / Bad"    value={stats.riskyIps}      accent="text-orange-600 dark:text-orange-300" />
        </div>

        {/* Stammdaten */}
        <section>
          <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium mb-2">Stammdaten</h4>
          <dl className="text-xs space-y-1 bg-gray-50 dark:bg-gray-800/60 rounded p-3">
            <Row label="Username"        value={user.username ?? '—'} mono />
            <Row label="Email"           value={user.email ?? '—'} mono />
            <Row label="Vorname"         value={user.firstName ?? '—'} />
            <Row label="Nachname"        value={user.lastName ?? '—'} />
            <Row label="Realm"           value={user.realm ?? '—'} />
            <Row label="Account angelegt" value={user.createdAt ? new Date(user.createdAt).toLocaleString('de-DE') : '—'} />
            <Row label="Enabled"         value={user.enabled === false ? '❌ Nein' : '✅ Ja'} />
            <Row label="Email verified"  value={user.emailVerified === false ? '❌ Nein' : '✅ Ja'} />
          </dl>
        </section>

        {/* Verdächtige Konfiguration */}
        <section>
          <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium mb-2">Verdächtige Konfiguration</h4>
          <ul className="text-xs space-y-1.5">
            {user.emailVerified === false && (
              <li className="flex items-start gap-2 text-red-700 dark:text-red-300">
                <span>❌</span>
                <span>Email-Adresse nicht verifiziert — Phishing-/Squatting-Risiko erhöht</span>
              </li>
            )}
            {user.enabled === false && (
              <li className="flex items-start gap-2 text-orange-700 dark:text-orange-300">
                <span>⚪</span>
                <span>Account ist deaktiviert</span>
              </li>
            )}
            {user.createdAt && Date.now() - new Date(user.createdAt).getTime() < 7 * DAY_MS && (
              <li className="flex items-start gap-2 text-amber-700 dark:text-amber-300">
                <span>⚠️</span>
                <span>Frisch erstellter Account ({Math.ceil((Date.now() - new Date(user.createdAt).getTime()) / DAY_MS)} Tage alt)</span>
              </li>
            )}
            <li className="flex items-start gap-2 text-gray-500 dark:text-gray-400">
              <span>⚪</span>
              <span>MFA-Status unbekannt (kein Keycloak-Credential-Tool angebunden)</span>
            </li>
            {(user.emailVerified !== false && user.enabled !== false && !(user.createdAt && Date.now() - new Date(user.createdAt).getTime() < 7 * DAY_MS)) && (
              <li className="text-gray-500 dark:text-gray-400">Keine weiteren Auffälligkeiten in den Stammdaten.</li>
            )}
          </ul>
        </section>

        {/* Aktive Findings */}
        <section>
          <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium mb-2">
            Aktive Findings <span className="text-gray-400">({userFindings.length})</span>
          </h4>
          {userFindings.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 px-1">Keine offenen Findings für diesen User.</p>
          ) : (
            <FindingsList
              findings={userFindings}
              onSelect={(f) => { onSelectFinding?.(f); onClose(); }}
            />
          )}
        </section>

        {/* Rollen & Privilegien */}
        <section>
          <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium mb-2">
            Rollen & Privilegien <span className="text-gray-400">({userRoles.length})</span>
          </h4>
          {userRoles.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 px-1">Keine Rollen zugewiesen.</p>
          ) : (
            <ul className="text-xs space-y-1">
              {userRoles.map(r => (
                <li
                  key={r.roleName}
                  className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded border-l-2 ${
                    r.sensitive
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40'
                  }`}
                >
                  <span className={`font-mono ${r.sensitive ? 'text-red-700 dark:text-red-300 font-semibold' : ''}`}>
                    {r.sensitive && '🛡️ '}{r.roleName}
                  </span>
                  <span className={`text-[10px] uppercase ${r.source === 'direct' ? 'text-red-600 dark:text-red-300 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                    {r.source === 'direct' ? 'direkt · bypass' : `via ${r.source}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Privilege-Lifecycle */}
        {adminEvents.length > 0 && (
          <section>
            <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium mb-2">
              Privilege-Lifecycle <span className="text-gray-400">({adminEvents.length})</span>
            </h4>
            <ul className="text-xs space-y-1">
              {adminEvents.map(ev => {
                const opLabel = ev.operation === 'ASSIGN_ROLE' ? '🔑 Rolle zugewiesen'
                  : ev.operation === 'JOIN_GROUP' ? '👥 Gruppen-Beitritt'
                  : ev.operation === 'CREATE_USER' ? '🆕 Account angelegt'
                  : ev.operation;
                return (
                  <li key={ev.id} className="px-2 py-1.5 rounded border-l-2 border-violet-400 bg-violet-50 dark:bg-violet-900/20">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="font-medium text-violet-700 dark:text-violet-300">{opLabel}</span>
                      <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400" title={ev.time}>
                        {formatRelative(ev.time)}
                      </span>
                    </div>
                    <div className="text-gray-700 dark:text-gray-200">{ev.details ?? '—'}</div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">durch <span className="font-mono">{ev.actor}</span></div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Login-Aktivität */}
        <section>
          <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium mb-2">
            Login-Aktivität (24h, letzte {Math.min(userEvents.length, 10)})
          </h4>
          {userEvents.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 px-1">Keine Login-Events in den letzten 24h.</p>
          ) : (
            <ul className="text-xs space-y-1">
              {userEvents.slice(0, 10).map(ev => (
                <li key={ev.id} className={`rounded px-2 py-1.5 border-l-2 ${
                  !ev.success
                    ? 'border-red-500 bg-red-50/50 dark:bg-red-900/10'
                    : ev.ipClassification === 'tor' || ev.ipClassification === 'known-bad'
                      ? 'border-orange-500 bg-orange-50/40 dark:bg-orange-900/10'
                      : 'border-green-500 bg-green-50/40 dark:bg-green-900/10'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-gray-500 dark:text-gray-400">
                      {new Date(ev.time).toLocaleString('de-DE', { hour12: false })}
                    </span>
                    <span className={`uppercase font-semibold ${ev.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                      {ev.type}
                    </span>
                  </div>
                  <div className="text-gray-700 dark:text-gray-200 mt-0.5">
                    <span className="font-mono">{ev.ip}</span> · {ev.city}, {ev.country}
                    {ev.ipClassification !== 'normal' && (
                      <span className="ml-1 text-[10px] uppercase px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                        {ev.ipClassification}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Duplikate */}
        <section>
          <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium mb-2">
            Mögliche Duplikate <span className="text-gray-400">({duplicates.length})</span>
          </h4>
          {duplicates.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 px-1">Keine Duplikate gefunden.</p>
          ) : (
            <ul className="text-xs space-y-1">
              {duplicates.map(({ user: d, reason }) => (
                <li key={d.id} className="px-2 py-1.5 rounded bg-yellow-50 dark:bg-yellow-900/20 border-l-2 border-yellow-500">
                  <div className="font-mono text-gray-900 dark:text-white">{d.username ?? d.label}</div>
                  <div className="text-gray-500 dark:text-gray-400">{reason} · {d.email ?? '—'}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* AI-Insight Footer */}
        {aiInsight && (aiInsight.patterns.length > 0 || aiInsight.recs.length > 0) && (
          <section className="rounded-md bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-300/30 dark:border-violet-700/40 p-3">
            <div className="text-[10px] uppercase tracking-wide text-violet-700 dark:text-violet-300 font-semibold mb-1">
              🧠 AI-Analyse
            </div>
            {aiInsight.patterns.length > 0 ? (
              <p className="text-sm text-gray-800 dark:text-gray-100 mb-2">
                Dieser User zeigt <span className="font-semibold">{aiInsight.patterns.length} verdächtige Muster</span>:
              </p>
            ) : (
              <p className="text-sm text-gray-800 dark:text-gray-100">Keine auffälligen Muster erkannt.</p>
            )}
            {aiInsight.patterns.length > 0 && (
              <ul className="text-xs text-gray-700 dark:text-gray-200 list-disc pl-4 space-y-0.5 mb-2">
                {aiInsight.patterns.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            )}
            {aiInsight.recs.length > 0 && (
              <>
                <div className="text-[11px] uppercase tracking-wide text-violet-700 dark:text-violet-300 font-semibold mt-2 mb-1">
                  Empfehlung
                </div>
                <ul className="text-xs text-gray-700 dark:text-gray-200 list-disc pl-4 space-y-0.5">
                  {aiInsight.recs.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </>
            )}
          </section>
        )}

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

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className={`text-gray-900 dark:text-white text-right truncate ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}
