'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Finding, Severity, SEVERITY_ORDER } from '@/types/security';
import { FindingsList } from './FindingsList';

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 10,
  error: 5,
  warning: 2,
  info: 1
};

interface ThreatGaugeProps {
  findings: Finding[];
  /** Called when the user selects a finding from the AI-insight row or the severity-drill-down modal. */
  onSelectFinding?: (finding: Finding) => void;
}

const SEVERITY_CARDS: Array<{
  key: Severity;
  label: string;
  bg: string;
  text: string;
  ring: string;
  icon: string;
}> = [
  { key: 'critical', label: 'Kritisch',  bg: 'bg-red-50 dark:bg-red-900/25',       text: 'text-red-700 dark:text-red-300',       ring: 'hover:ring-red-300 dark:hover:ring-red-700',       icon: '⛔' },
  { key: 'error',    label: 'Error',     bg: 'bg-orange-50 dark:bg-orange-900/25', text: 'text-orange-700 dark:text-orange-300', ring: 'hover:ring-orange-300 dark:hover:ring-orange-700', icon: '⚠️' },
  { key: 'warning',  label: 'Warnung',   bg: 'bg-yellow-50 dark:bg-yellow-900/25', text: 'text-yellow-700 dark:text-yellow-300', ring: 'hover:ring-yellow-300 dark:hover:ring-yellow-700', icon: '⚡' },
  { key: 'info',     label: 'Info',      bg: 'bg-blue-50 dark:bg-blue-900/25',     text: 'text-blue-700 dark:text-blue-300',     ring: 'hover:ring-blue-300 dark:hover:ring-blue-700',     icon: 'ℹ️' }
];

/**
 * Animated semicircular gauge for the overall threat score, with severity drill-down.
 *
 * - Score = weighted sum of open findings (severity weights), capped at 100.
 * - AI-Insight row highlights the highest-severity / freshest open finding.
 * - Four severity cards summarise + open a modal listing findings of that severity.
 * - Clicking a finding in the modal closes it and bubbles up via `onSelectFinding` so the
 *   parent (SecurityPanel) can open the existing FindingDetailDrawer.
 */
export function ThreatGauge({ findings, onSelectFinding }: ThreatGaugeProps) {
  const [popoverSeverity, setPopoverSeverity] = useState<Severity | null>(null);

  const score = useMemo(() => {
    const raw = findings
      .filter(f => f.status === 'open')
      .reduce((acc, f) => acc + (SEVERITY_WEIGHT[f.severity] ?? 0), 0);
    return Math.min(100, raw);
  }, [findings]);

  const angle = (score / 100) * 180 - 90;

  const color = score < 20 ? '#22c55e'
    : score < 40 ? '#eab308'
    : score < 70 ? '#f97316'
    : '#ef4444';

  const label = score < 20 ? 'Niedrig'
    : score < 40 ? 'Mittel'
    : score < 70 ? 'Hoch'
    : 'Kritisch';

  const counts = useMemo(() => {
    const c: Record<Severity, number> = { critical: 0, error: 0, warning: 0, info: 0 };
    for (const f of findings) if (f.status === 'open') c[f.severity]++;
    return c;
  }, [findings]);

  // Top-1 open finding by severity weight, then by freshest detectedAt.
  const topInsight = useMemo(() => {
    const open = findings.filter(f => f.status === 'open');
    if (open.length === 0) return null;
    const sorted = [...open].sort((a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
      || new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
    );
    return sorted[0];
  }, [findings]);

  const findingsForPopover = useMemo(() => {
    if (!popoverSeverity) return [];
    return findings.filter(f => f.severity === popoverSeverity && f.status === 'open');
  }, [findings, popoverSeverity]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-col h-full">
      <div className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium tracking-wide mb-2">
        Bedrohungsstufe
      </div>

      {/* AI-Insight: top finding callout */}
      {topInsight && (
        <button
          type="button"
          onClick={() => onSelectFinding?.(topInsight)}
          className="w-full text-left rounded-md bg-gradient-to-r from-red-500/10 via-orange-500/10 to-amber-500/5 border border-red-300/40 dark:border-red-700/50 px-3 py-2 mb-3 hover:from-red-500/20 hover:via-orange-500/20 transition-colors group"
          aria-label="Top-Finding öffnen"
        >
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-red-700 dark:text-red-300 font-semibold">
            <span>⚠ Top-Risiko · {topInsight.severity}</span>
            <code className="font-mono text-[10px] opacity-70 truncate">{topInsight.rule}</code>
          </div>
          <div className="text-sm font-medium text-gray-900 dark:text-white mt-0.5 line-clamp-1">
            {topInsight.title}
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <div className="text-[11px] text-gray-600 dark:text-gray-400 truncate">
              {topInsight.affected[0]
                ? `${topInsight.affected[0].type}:${topInsight.affected[0].name}`
                : 'systemweit'}
            </div>
            <span className="text-[11px] text-blue-600 dark:text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity">
              Details ›
            </span>
          </div>
        </button>
      )}

      <div className="relative flex-1 flex items-center justify-center min-h-[80px]">
        <svg viewBox="0 0 200 110" className="w-full max-w-[160px]">
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="currentColor"
            className="text-gray-200 dark:text-gray-700"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <motion.path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: score / 100 }}
            transition={{ type: 'spring', stiffness: 80, damping: 20 }}
          />
          <motion.line
            x1="100"
            y1="100"
            x2="100"
            y2="30"
            stroke="currentColor"
            className="text-gray-700 dark:text-gray-200"
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ rotate: -90 }}
            animate={{ rotate: angle }}
            transition={{ type: 'spring', stiffness: 80, damping: 18 }}
            style={{ transformOrigin: '100px 100px' }}
          />
          <circle cx="100" cy="100" r="6" fill="currentColor" className="text-gray-700 dark:text-gray-200" />
        </svg>
      </div>

      <div className="text-center mt-1">
        <div className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{score.toFixed(0)}</div>
        <div className="text-xs font-medium" style={{ color }}>{label}</div>
      </div>

      {/* Clickable severity cards — drill into modal */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 mt-2">
        {SEVERITY_CARDS.map(s => {
          const count = counts[s.key];
          const disabled = count === 0;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => !disabled && setPopoverSeverity(s.key)}
              disabled={disabled}
              aria-label={`${s.label}: ${count} Findings`}
              className={`${s.bg} ${disabled
                ? 'opacity-40 cursor-not-allowed'
                : `cursor-pointer hover:scale-[1.03] hover:ring-2 ${s.ring}`
              } rounded-md p-1.5 text-left transition-all border border-black/5 dark:border-white/5`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm leading-none">{s.icon}</span>
                <span className={`text-xl font-bold leading-none ${s.text}`}>{count}</span>
              </div>
              <div className={`mt-0.5 text-[10px] font-semibold ${s.text}`}>{s.label}</div>
              {!disabled && (
                <div className={`text-[9px] opacity-70 ${s.text}`}>Details ›</div>
              )}
            </button>
          );
        })}
      </div>

      {popoverSeverity && (
        <SeverityDetailModal
          severity={popoverSeverity}
          findings={findingsForPopover}
          onClose={() => setPopoverSeverity(null)}
          onSelectFinding={(f) => {
            onSelectFinding?.(f);
            setPopoverSeverity(null);
          }}
        />
      )}
    </div>
  );
}

interface SeverityDetailModalProps {
  severity: Severity;
  findings: Finding[];
  onClose: () => void;
  onSelectFinding: (f: Finding) => void;
}

function SeverityDetailModal({ severity, findings, onClose, onSelectFinding }: SeverityDetailModalProps) {
  // Close on ESC.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const severityLabel = ({
    critical: 'Kritisch',
    error: 'Error',
    warning: 'Warnung',
    info: 'Info'
  } as const)[severity];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col border border-gray-200 dark:border-gray-700"
        onClick={e => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Bedrohungen</div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {severityLabel} <span className="text-gray-400 font-normal">({findings.length})</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="overflow-y-auto p-4">
          <FindingsList
            findings={findings}
            onSelect={onSelectFinding}
            emptyMessage={`Keine Findings der Stufe ${severityLabel}.`}
          />
        </div>
      </div>
    </div>
  );
}
