'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useIKASStore, isSecurityScanStale } from '@/store';
import { Finding, Severity } from '@/types/security';
import { FindingDetailDrawer } from './security/FindingDetailDrawer';

const COMPLIANCE_REALM = 'corporate';

/**
 * Compliance & OWASP overview. Reads from `security.findings` (filtered to compliance + owasp)
 * — no more hard-coded mock issues. "Compliance Check durchführen" triggers a real scan.
 */
export function CompliancePanel() {
  const { security, runSecurityScan, dismissSecurityFinding } = useIKASStore();
  const [selectedSeverity, setSelectedSeverity] = useState<'all' | Severity>('all');
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  // Auto-run a scan when the cached results are stale (TTL-based, see SECURITY_SCAN_TTL_MS
  // in the store). Tab-switching within the TTL window reuses the existing findings.
  useEffect(() => {
    if (isSecurityScanStale(security.lastScanAt) && !security.isLoading && !security.activeScan) {
      void runSecurityScan(COMPLIANCE_REALM, 'all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const issues = useMemo(
    () => security.findings.filter(
      f => (f.category === 'compliance' || f.category === 'owasp') && f.status !== 'dismissed'
    ),
    [security.findings]
  );

  const filteredIssues = useMemo(
    () => selectedSeverity === 'all' ? issues : issues.filter(i => i.severity === selectedSeverity),
    [issues, selectedSeverity]
  );

  const severityCounts = useMemo(() => ({
    critical: issues.filter(i => i.severity === 'critical').length,
    error:    issues.filter(i => i.severity === 'error').length,
    warning:  issues.filter(i => i.severity === 'warning').length,
    info:     issues.filter(i => i.severity === 'info').length
  }), [issues]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400';
      case 'error': return 'text-red-500 bg-red-50 dark:bg-red-900/10 dark:text-red-300';
      case 'warning': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'info': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'error':
        return (
          <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="h-5 w-5 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.84 4.25a2 2 0 00-3.68 0L3.16 16.25A2 2 0 005 19z" />
          </svg>
        );
      case 'info':
        return (
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default: return null;
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'critical': return 'Kritisch';
      case 'error': return 'Fehler';
      case 'warning': return 'Warnung';
      case 'info': return 'Info';
      default: return severity;
    }
  };

  const formatTimestamp = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3_600_000);
    const d = Math.floor(h / 24);
    if (d > 0) return `vor ${d} Tag${d > 1 ? 'en' : ''}`;
    if (h > 0) return `vor ${h} Stunde${h > 1 ? 'n' : ''}`;
    const m = Math.floor(diff / 60_000);
    if (m > 0) return `vor ${m} Min.`;
    return 'gerade eben';
  };

  const handleRunComplianceCheck = async () => {
    // Run the existing security engine — compliance + owasp checks are part of it.
    await runSecurityScan(COMPLIANCE_REALM, 'all');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Compliance Überwachung
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          DSGVO- und OWASP-Findings aus dem aktuellen Sicherheits-Scan
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {([
          { label: 'Kritisch',  value: severityCounts.critical, bg: 'bg-red-100 dark:bg-red-900/20',     icon: 'text-red-600 dark:text-red-400' },
          { label: 'Fehler',    value: severityCounts.error,    bg: 'bg-red-50 dark:bg-red-900/10',      icon: 'text-red-500 dark:text-red-300' },
          { label: 'Warnungen', value: severityCounts.warning,  bg: 'bg-yellow-100 dark:bg-yellow-900/20', icon: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'Info',      value: severityCounts.info,     bg: 'bg-blue-100 dark:bg-blue-900/20',   icon: 'text-blue-600 dark:text-blue-400' }
        ] as const).map(card => (
          <div key={card.label} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.bg}`}>
                <svg className={`w-5 h-5 ${card.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filter nach Schweregrad:
            </label>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value as 'all' | Severity)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="all">Alle ({issues.length})</option>
              <option value="critical">Kritisch ({severityCounts.critical})</option>
              <option value="error">Fehler ({severityCounts.error})</option>
              <option value="warning">Warnungen ({severityCounts.warning})</option>
              <option value="info">Info ({severityCounts.info})</option>
            </select>
          </div>

          <button
            onClick={handleRunComplianceCheck}
            disabled={security.isLoading}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {security.isLoading ? (
              <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" />
              </svg>
            ) : (
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            )}
            {security.isLoading ? 'Scan läuft…' : 'Compliance Check durchführen'}
          </button>
        </div>
      </div>

      {/* Issues List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Compliance & OWASP Findings ({filteredIssues.length})
          </h3>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {filteredIssues.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {issues.length === 0
                  ? 'Noch kein Compliance-Scan durchgeführt — klicke "Compliance Check durchführen".'
                  : `Keine ${getSeverityLabel(selectedSeverity)}-Findings gefunden`}
              </p>
            </div>
          ) : (
            filteredIssues.map((issue) => (
              <div key={issue.id} className="p-6">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    {getSeverityIcon(issue.severity)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {issue.title}
                      </h4>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] uppercase text-gray-500 dark:text-gray-400 font-mono">{issue.category}</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(issue.severity)}`}>
                          {getSeverityLabel(issue.severity)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTimestamp(issue.detectedAt)}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      {issue.description || `Rule: ${issue.rule}`}
                    </p>

                    {issue.affected.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          Betroffene Objekte ({issue.affected.length}):
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {issue.affected.map((affected, index) => (
                            <span
                              key={index}
                              className="inline-flex px-2 py-1 text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded"
                            >
                              {affected.type}: {affected.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {issue.references && issue.references.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {issue.references.map(r => (
                          <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            {r}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex items-center space-x-3">
                      <button
                        onClick={() => setSelectedFinding(issue)}
                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 font-medium"
                      >
                        Details anzeigen
                      </button>
                      <button
                        onClick={() => dismissSecurityFinding(issue.id)}
                        className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 font-medium"
                      >
                        Ignorieren
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <FindingDetailDrawer finding={selectedFinding} onClose={() => setSelectedFinding(null)} />
    </div>
  );
}
