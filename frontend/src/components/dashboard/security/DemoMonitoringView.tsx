'use client';

import React, { useEffect } from 'react';
import { IdentityGraphNode, useIKASStore } from '@/store';
import { Finding } from '@/types/security';
import { ThreatGauge } from './ThreatGauge';
import { LiveActivityTicker } from './LiveActivityTicker';
import { WorldLoginMap } from './WorldLoginMap';
import { IdentityGraph } from './IdentityGraph';

/**
 * "Battle station" view shown above the category tabs inside SecurityPanel. Combines four
 * widgets in a 2x2 grid:
 *
 *   ┌──────────────────────────────┬──────────────┐
 *   │ WorldLoginMap                │ ThreatGauge  │
 *   ├──────────────────────────────┼──────────────┤
 *   │ IdentityGraph                │ LiveTicker   │
 *   └──────────────────────────────┴──────────────┘
 *
 * Pulls initial data from the AI Gateway and then subscribes to WS `data:update` events
 * (handled by store.appendLiveEvent) for live updates.
 */

const DEMO_REALM = 'corporate';

interface DemoMonitoringViewProps {
  /** Forwarded to widgets so users can drill from a card into the FindingDetailDrawer in the parent. */
  onSelectFinding?: (finding: Finding) => void;
  /** Forwarded so click on an IdentityGraph user node opens the UserDetailDrawer in the parent. */
  onSelectUser?: (user: IdentityGraphNode) => void;
  onSelectGroup?: (group: IdentityGraphNode) => void;
  onSelectRole?: (role: IdentityGraphNode) => void;
}

export function DemoMonitoringView({ onSelectFinding, onSelectUser, onSelectGroup, onSelectRole }: DemoMonitoringViewProps = {}) {
  const { security, loadLiveEvents, loadIdentityGraph, triggerDemoScenario } = useIKASStore();

  // Initial load + recurring refresh. The backend simulator emits events every 6s and bursts
  // during scenarios; we poll every 10s as a robust fallback even if the WebSocket push path
  // (`data:update` → `appendLiveEvent`) misses anything. Without this, the map empties out
  // after the 5-min decay window and the demo loses its "live" feel.
  useEffect(() => {
    void loadLiveEvents();
    void loadIdentityGraph(DEMO_REALM);
    const liveTimer = setInterval(() => { void loadLiveEvents(); }, 10_000);
    // Graph topology changes slowly (only when users/clients are added) — refresh sparsely.
    const graphTimer = setInterval(() => { void loadIdentityGraph(DEMO_REALM); }, 60_000);
    return () => {
      clearInterval(liveTimer);
      clearInterval(graphTimer);
    };
  }, [loadLiveEvents, loadIdentityGraph]);

  return (
    <div className="space-y-3">
      {/* Demo scenario controls — the on-stage choreography buttons */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
        <span className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium tracking-wide mr-2">
          Demo-Szenarien
        </span>
        <ScenarioBtn label="Brute-Force" tone="red" onClick={() => triggerDemoScenario('brute-force')} />
        <ScenarioBtn label="Credential Stuffing" tone="orange" onClick={() => triggerDemoScenario('stuffing')} />
        <ScenarioBtn label="Impossible Travel" tone="amber" onClick={() => triggerDemoScenario('impossible-travel')} />
        <ScenarioBtn label="Mixed" tone="blue" onClick={() => triggerDemoScenario('mixed')} />
        <ScenarioBtn label="Calm" tone="green" onClick={() => triggerDemoScenario('calm')} />
      </div>

      {/* Fixed row heights on lg+ keep the four cards visually symmetric. Without this,
          the LiveActivityTicker's variable-length list (and ThreatGauge's stacked sections)
          stretch their row, ballooning the neighbouring map/graph cells. Each card uses
          h-full + internal overflow-y-auto where needed. */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:auto-rows-[380px]">
        <div className="lg:col-span-3 min-h-[240px]">
          <WorldLoginMap events={security.liveEvents} />
        </div>
        <div className="min-h-[240px] overflow-hidden">
          <ThreatGauge findings={security.findings} onSelectFinding={onSelectFinding} />
        </div>

        <div className="lg:col-span-3 min-h-[280px]">
          <IdentityGraph
            data={security.identityGraph}
            findings={security.findings}
            liveEvents={security.liveEvents}
            onSelectUser={onSelectUser}
            onSelectGroup={onSelectGroup}
            onSelectRole={onSelectRole}
            onSelectFinding={onSelectFinding}
          />
        </div>
        <div className="min-h-[280px]">
          <LiveActivityTicker events={security.liveEvents} />
        </div>
      </div>

      <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-2">
        Analysiert mit <span className="font-medium">🦙 Ollama (lokal)</span> · Daten aus <span className="font-medium">Neo4j Knowledge Graph</span>
      </p>
    </div>
  );
}

function ScenarioBtn({ label, tone, onClick }: { label: string; tone: 'red' | 'orange' | 'amber' | 'blue' | 'green'; onClick: () => void }) {
  const colours: Record<typeof tone, string> = {
    red:    'bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-300',
    orange: 'bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 dark:text-orange-300',
    amber:  'bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-300',
    blue:   'bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300',
    green:  'bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-300'
  };
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${colours[tone]}`}
    >
      {label}
    </button>
  );
}
