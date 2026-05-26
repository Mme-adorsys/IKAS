'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { IdentityGraphNode, useIKASStore, isSecurityScanStale } from '@/store';
import { CheckCategory, Finding, ScanScope } from '@/types/security';
import { FindingsList } from './security/FindingsList';
import { FindingDetailDrawer } from './security/FindingDetailDrawer';
import { UserDetailDrawer } from './security/UserDetailDrawer';
import { GroupDetailModal } from './security/GroupDetailModal';
import { RoleDetailModal } from './security/RoleDetailModal';
import { DemoMonitoringView } from './security/DemoMonitoringView';
import { PrivilegeAuditWidgets } from './security/PrivilegeAuditWidgets';
import { CompliancePanel } from './CompliancePanel';

type Tab = CheckCategory;

const TAB_LABELS: Record<Tab, string> = {
  config: 'Konfiguration',
  fraud: 'Verdächtiges Verhalten',
  owasp: 'OWASP Top 10',
  compliance: 'Compliance (DSGVO)'
};

const DEMO_REALM = 'corporate';

export function SecurityPanel() {
  const { security, runSecurityScan } = useIKASStore();
  const syncRealmNow = useIKASStore(s => s.syncRealmNow);
  const [activeTab, setActiveTab] = useState<Tab>('config');
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [selectedUser, setSelectedUser] = useState<IdentityGraphNode | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<IdentityGraphNode | null>(null);
  const [selectedRole, setSelectedRole] = useState<IdentityGraphNode | null>(null);

  const [lastSync, setLastSync] = useState<{ at: number; delta: { added: number; updated: number; removed: number; durationMs: number } } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [, setNowTick] = useState(0);

  // Tick once a second so the "vor X s" indicator stays current.
  useEffect(() => {
    const t = setInterval(() => setNowTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const delta = await syncRealmNow();
      if (delta) {
        setLastSync({ at: Date.now(), delta: { added: delta.added, updated: delta.updated, removed: delta.removed, durationMs: delta.durationMs } });
      }
    } finally {
      setSyncing(false);
    }
  };

  const lastSyncLabel = lastSync
    ? `Sync vor ${Math.max(0, Math.floor((Date.now() - lastSync.at) / 1000))}s · +${lastSync.delta.added} / ~${lastSync.delta.updated} / -${lastSync.delta.removed}`
    : 'Noch nicht synchronisiert';

  const userNodes = useMemo(
    () => (security.identityGraph?.nodes ?? []).filter(n => n.type === 'user'),
    [security.identityGraph]
  );

  // Auto-trigger a scan when the cached results are stale (TTL-based). Tab-switching within
  // the TTL window reuses the existing findings instead of re-scanning.
  useEffect(() => {
    if (isSecurityScanStale(security.lastScanAt) && !security.isLoading && !security.activeScan) {
      void runSecurityScan(DEMO_REALM, 'all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const findingsByCategory = useMemo(() => {
    const map: Record<CheckCategory, Finding[]> = { config: [], fraud: [], owasp: [], compliance: [] };
    for (const f of security.findings) {
      if (f.category in map) map[f.category].push(f);
    }
    return map;
  }, [security.findings]);

  const counts = useMemo(() => ({
    config: findingsByCategory.config.length,
    fraud: findingsByCategory.fraud.length,
    owasp: findingsByCategory.owasp.length,
    compliance: findingsByCategory.compliance.length
  }), [findingsByCategory]);

  const handleScan = (scope: ScanScope = 'all') => {
    void runSecurityScan(DEMO_REALM, scope);
  };

  const renderTab = () => {
    if (activeTab === 'compliance') {
      // Reuse the existing CompliancePanel for the Compliance tab — already wired to render
      // data.complianceIssues. The store keeps that field updated independently for now,
      // but the SecurityEngine findings render via FindingsList too if useful in future.
      return (
        <div className="space-y-4">
          <FindingsList
            findings={findingsByCategory.compliance}
            onSelect={setSelectedFinding}
            emptyMessage="Keine Compliance-Findings — Scan starten."
          />
          <details className="rounded border border-gray-200 dark:border-gray-700">
            <summary className="px-4 py-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
              Legacy CompliancePanel-Ansicht
            </summary>
            <div className="p-2">
              <CompliancePanel />
            </div>
          </details>
        </div>
      );
    }
    return (
      <FindingsList
        findings={findingsByCategory[activeTab]}
        onSelect={setSelectedFinding}
        emptyMessage="Keine Findings in dieser Kategorie — Scan starten."
      />
    );
  };

  const tabs: Tab[] = ['config', 'fraud', 'owasp', 'compliance'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Sicherheit</h2>
          <p className="text-gray-600 dark:text-gray-300">
            KI-gestützter Sicherheitscheck für deine Keycloak-Installation.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              title="Holt aktuelle User/Rollen aus Keycloak und schreibt Diffs in den Graph"
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md flex items-center gap-2"
            >
              {syncing && (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" />
                </svg>
              )}
              {syncing ? 'Synchronisiere…' : '🔄 Realm synchronisieren'}
            </button>
            <button
              onClick={() => handleScan('all')}
              disabled={security.isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md flex items-center gap-2"
            >
              {security.isLoading && (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" />
                </svg>
              )}
              {security.isLoading ? 'Scan läuft…' : 'Vollständigen Scan starten'}
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className={`relative flex h-2 w-2`}>
              <span className={`${lastSync ? 'animate-ping' : ''} absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${lastSync ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
            </span>
            {lastSyncLabel}
          </div>
        </div>
      </div>

      {/* Battle-station live monitoring view */}
      <DemoMonitoringView
        onSelectFinding={setSelectedFinding}
        onSelectUser={setSelectedUser}
        onSelectGroup={setSelectedGroup}
        onSelectRole={setSelectedRole}
      />

      {/* Dashboard widgets: explicit "what the AI found" cards below the live battle-station.
          The graph above is the visualisation; these cards are the readable summary. */}
      <PrivilegeAuditWidgets
        graph={security.identityGraph}
        findings={security.findings}
        liveEvents={security.liveEvents}
        onSelectUser={setSelectedUser}
        onSelectGroup={setSelectedGroup}
        onSelectRole={setSelectedRole}
        onSelectFinding={setSelectedFinding}
      />

      {security.activeScan && (
        <div className="rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-blue-700 dark:text-blue-300">
              {security.activeScan.state === 'running' && `Scan läuft: ${security.activeScan.completedChecks}/${security.activeScan.totalChecks} Checks`}
              {security.activeScan.state === 'completed' && `Scan abgeschlossen — ${security.activeScan.findings.length} Findings`}
              {security.activeScan.state === 'failed' && `Scan fehlgeschlagen: ${security.activeScan.error}`}
            </span>
            <span className="text-blue-700 dark:text-blue-300">{security.activeScan.progress}%</span>
          </div>
          <div className="mt-2 h-1.5 rounded bg-blue-200 dark:bg-blue-900">
            <div
              className="h-1.5 rounded bg-blue-600 transition-all"
              style={{ width: `${security.activeScan.progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-6">
          {tabs.map(tab => {
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 text-sm font-medium ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {TAB_LABELS[tab]}
                <span className="ml-2 inline-block min-w-[1.5rem] text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                  {counts[tab]}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 min-h-[180px]">
        {renderTab()}
      </div>

      <FindingDetailDrawer finding={selectedFinding} onClose={() => setSelectedFinding(null)} />
      <UserDetailDrawer
        user={selectedUser}
        findings={security.findings}
        liveEvents={security.liveEvents}
        allUsers={userNodes}
        graph={security.identityGraph}
        onClose={() => setSelectedUser(null)}
        onSelectFinding={(f) => { setSelectedUser(null); setSelectedFinding(f); }}
      />
      <GroupDetailModal
        group={selectedGroup}
        graph={security.identityGraph}
        findings={security.findings}
        onClose={() => setSelectedGroup(null)}
        onSelectUser={(u) => { setSelectedGroup(null); setSelectedUser(u); }}
        onSelectFinding={(f) => { setSelectedGroup(null); setSelectedFinding(f); }}
      />
      <RoleDetailModal
        role={selectedRole}
        graph={security.identityGraph}
        findings={security.findings}
        onClose={() => setSelectedRole(null)}
        onSelectUser={(u) => { setSelectedRole(null); setSelectedUser(u); }}
        onSelectGroup={(g) => { setSelectedRole(null); setSelectedGroup(g); }}
        onSelectFinding={(f) => { setSelectedRole(null); setSelectedFinding(f); }}
      />
    </div>
  );
}
