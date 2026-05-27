'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useIKASStore, isSecurityScanStale } from '@/store';
import { Finding, SEVERITY_ORDER, Severity } from '@/types/security';
import { FindingDetailDrawer } from './security/FindingDetailDrawer';

type FixSeverityKey = 'urgent' | 'high' | 'medium' | 'low';

const FIX_SEVERITY_MAP: Record<Severity, FixSeverityKey> = {
  critical: 'urgent',
  error: 'high',
  warning: 'medium',
  info: 'low'
};

const FIX_SEVERITIES: Array<{
  key: FixSeverityKey;
  label: string;
  hint: string;
  matches: Severity;
  ringClass: string;
  badgeClass: string;
  cardClass: string;
}> = [
  {
    key: 'urgent',
    label: 'Urgent',
    hint: 'Sofort handeln',
    matches: 'critical',
    ringClass: 'ring-red-400',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
    cardClass: 'border-red-300 dark:border-red-800'
  },
  {
    key: 'high',
    label: 'High',
    hint: 'In dieser Woche',
    matches: 'error',
    ringClass: 'ring-orange-400',
    badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
    cardClass: 'border-orange-300 dark:border-orange-800'
  },
  {
    key: 'medium',
    label: 'Medium',
    hint: 'Im nächsten Sprint',
    matches: 'warning',
    ringClass: 'ring-yellow-400',
    badgeClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
    cardClass: 'border-yellow-300 dark:border-yellow-800'
  },
  {
    key: 'low',
    label: 'Low',
    hint: 'Bei Gelegenheit',
    matches: 'info',
    ringClass: 'ring-blue-300',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    cardClass: 'border-blue-300 dark:border-blue-800'
  }
];

const DEMO_REALM = 'corporate';

export function FixesPanel() {
  const findings = useIKASStore(s => s.security.findings);
  const isLoading = useIKASStore(s => s.security.isLoading);
  const activeScan = useIKASStore(s => s.security.activeScan);
  const lastScanAt = useIKASStore(s => s.security.lastScanAt);
  const autoFixableRules = useIKASStore(s => s.autoFixableRules);
  const runScan = useIKASStore(s => s.runSecurityScan);
  const enrichFinding = useIKASStore(s => s.enrichSecurityFinding);
  const dismissFinding = useIKASStore(s => s.dismissSecurityFinding);
  const applyAutoFix = useIKASStore(s => s.applyAutoFix);
  const loadAutoFixableRules = useIKASStore(s => s.loadAutoFixableRules);
  const resetDemo = useIKASStore(s => s.resetDemo);

  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [filterKey, setFilterKey] = useState<FixSeverityKey | 'all'>('all');
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // TTL-gated auto-scan: only re-runs when the cached scan is older than the TTL.
  useEffect(() => {
    if (isSecurityScanStale(lastScanAt) && !activeScan && !isLoading) {
      runScan(DEMO_REALM, 'all').catch(() => {});
    }
    if (autoFixableRules.length === 0) {
      loadAutoFixableRules().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFix = async (f: Finding) => {
    setFixingId(f.id);
    try {
      await applyAutoFix(f.id);
    } finally {
      setFixingId(null);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    setResetConfirmOpen(false);
    try {
      await resetDemo();
    } finally {
      setResetting(false);
    }
  };

  // Only open findings — resolved/dismissed disappear from the list so the user gets
  // unambiguous visual feedback when an auto-fix is applied. The success toast tells
  // them what changed; the "Demo zurücksetzen" button restores everything.
  const openFixes = useMemo(
    () => findings.filter(f => f.status === 'open'),
    [findings]
  );

  const counts = useMemo(() => {
    const c: Record<FixSeverityKey, number> = { urgent: 0, high: 0, medium: 0, low: 0 };
    // Severity counts only reflect still-open findings — resolved ones drop out.
    for (const f of openFixes) if (f.status === 'open') c[FIX_SEVERITY_MAP[f.severity]]++;
    return c;
  }, [openFixes]);

  const sortedFindings = useMemo(() => {
    const filtered = filterKey === 'all'
      ? openFixes
      : openFixes.filter(f => FIX_SEVERITY_MAP[f.severity] === filterKey);
    return [...filtered].sort((a, b) => {
      // Resolved drops to the bottom regardless of severity.
      if ((a.status === 'resolved') !== (b.status === 'resolved')) {
        return a.status === 'resolved' ? 1 : -1;
      }
      const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (sevDiff !== 0) return sevDiff;
      if (!!a.remediation !== !!b.remediation) return a.remediation ? -1 : 1;
      return 0;
    });
  }, [openFixes, filterKey]);

  const handleEnrich = async (f: Finding) => {
    setEnrichingId(f.id);
    try {
      await enrichFinding(f.id);
    } finally {
      setEnrichingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Fixes &amp; Empfehlungen
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Priorisierte Maßnahmen — sortiert nach Severity, mit AI-generierter Anleitung.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => runScan(DEMO_REALM, 'all')}
            disabled={isLoading || resetting}
            className="px-3 py-2 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white"
          >
            🔄 Erneut prüfen
          </button>
          <button
            onClick={() => setResetConfirmOpen(true)}
            disabled={resetting}
            title="Stellt den ursprünglichen Demo-Zustand wieder her — alle angewendeten Auto-Fixes werden zurückgesetzt"
            className="px-3 py-2 text-sm font-medium rounded-md bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white flex items-center gap-2"
          >
            {resetting && (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" />
              </svg>
            )}
            {resetting ? 'Setze zurück…' : '↺ Demo zurücksetzen'}
          </button>
        </div>
      </div>

      {resetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full p-6 mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Demo zurücksetzen?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
              Der gesamte Demo-Graph wird gelöscht und neu aufgebaut. Alle Auto-Fixes,
              Dismissals und gelösten Findings gehen verloren. Dauert ~3-5 Sekunden.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setResetConfirmOpen(false)}
                className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
              >
                Abbrechen
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-sm rounded bg-amber-600 hover:bg-amber-700 text-white"
              >
                Ja, zurücksetzen
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {FIX_SEVERITIES.map(s => {
          const active = filterKey === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setFilterKey(active ? 'all' : s.key)}
              className={`text-left p-4 rounded-lg border bg-white dark:bg-gray-800 transition-all ${s.cardClass} ${active ? `ring-2 ${s.ringClass}` : 'hover:shadow-md'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.badgeClass}`}>
                  {s.label}
                </span>
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  {counts[s.key]}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.hint}</p>
            </button>
          );
        })}
      </div>

      {filterKey !== 'all' && (
        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <span>Filter aktiv: <strong className="text-gray-700 dark:text-gray-200">{FIX_SEVERITIES.find(s => s.key === filterKey)?.label}</strong></span>
          <button onClick={() => setFilterKey('all')} className="text-blue-600 hover:underline">Filter entfernen</button>
        </div>
      )}

      <div className="space-y-3">
        {sortedFindings.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-lg font-medium">🎉 Keine offenen Fixes in dieser Kategorie</p>
            <p className="text-sm mt-1">Realm sieht gerade sauber aus.</p>
          </div>
        ) : (
          sortedFindings.map(f => {
            const sev = FIX_SEVERITIES.find(s => s.matches === f.severity)!;
            return (
              <div
                key={f.id}
                className={`bg-white dark:bg-gray-800 rounded-lg border ${sev.cardClass} overflow-hidden ${f.status === 'resolved' ? 'opacity-60' : ''}`}
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sev.badgeClass} mt-0.5`}>
                      {sev.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {f.title}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        <code>{f.rule}</code>
                        <span>·</span>
                        <span className="capitalize">{f.category}</span>
                        <span>·</span>
                        <span>{f.realm}</span>
                      </p>
                    </div>
                  </div>

                  {f.description && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                      {f.description}
                    </p>
                  )}

                  {f.remediation ? (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-400 dark:border-emerald-600 rounded p-3">
                      <p className="text-xs uppercase font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
                        Empfohlene Aktion
                      </p>
                      <p className="text-sm text-emerald-900 dark:text-emerald-100 whitespace-pre-line">
                        {f.remediation}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-900/40 border-l-4 border-gray-300 dark:border-gray-700 rounded p-3 text-xs text-gray-500 dark:text-gray-400">
                      Noch keine AI-Empfehlung — klick „🧠 AI-Empfehlung generieren" für eine Schritt-für-Schritt-Anleitung.
                    </div>
                  )}

                  {f.affected.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap text-xs text-gray-600 dark:text-gray-300">
                      <span className="text-gray-400 dark:text-gray-500">Betrifft:</span>
                      {f.affected.slice(0, 6).map(a => (
                        <span
                          key={`${a.type}-${a.id}`}
                          className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700"
                        >
                          <span className="text-gray-500 dark:text-gray-400 capitalize mr-1">{a.type}</span>
                          {a.name}
                        </span>
                      ))}
                      {f.affected.length > 6 && (
                        <span className="text-gray-400">+ {f.affected.length - 6} weitere</span>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
                    <button
                      onClick={() => setSelectedFinding(f)}
                      className="px-3 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Details
                    </button>
                    {autoFixableRules.includes(f.rule) && f.status === 'open' && (
                      <button
                        onClick={() => handleFix(f)}
                        disabled={fixingId === f.id || resetting}
                        title="Wendet die Empfehlung auf den Demo-Graph an (Keycloak bleibt unverändert)"
                        className="px-3 py-1.5 text-xs rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white flex items-center gap-1.5"
                      >
                        {fixingId === f.id && (
                          <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" />
                          </svg>
                        )}
                        {fixingId === f.id ? 'Fixe …' : '🔧 Auto-Fix anwenden'}
                      </button>
                    )}
                    {f.status === 'resolved' && (
                      <span className="px-3 py-1.5 text-xs rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 flex items-center gap-1">
                        ✓ Behoben
                      </span>
                    )}
                    <button
                      onClick={() => handleEnrich(f)}
                      disabled={enrichingId === f.id}
                      className="px-3 py-1.5 text-xs rounded bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white flex items-center gap-1.5"
                    >
                      {enrichingId === f.id && (
                        <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" />
                        </svg>
                      )}
                      {enrichingId === f.id
                        ? 'Analysiere …'
                        : f.remediation
                          ? '🧠 Empfehlung verbessern'
                          : '🧠 AI-Empfehlung generieren'}
                    </button>
                    <button
                      onClick={() => dismissFinding(f.id)}
                      className="px-3 py-1.5 text-xs rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
                    >
                      Verwerfen
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <FindingDetailDrawer finding={selectedFinding} onClose={() => setSelectedFinding(null)} />
    </div>
  );
}
