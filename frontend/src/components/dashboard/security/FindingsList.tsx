'use client';

import React from 'react';
import { Finding, Severity, SEVERITY_ORDER } from '@/types/security';

const severityClasses: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  error:    'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  warning:  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  info:     'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
};

interface FindingsListProps {
  findings: Finding[];
  onSelect: (finding: Finding) => void;
  emptyMessage?: string;
}

export function FindingsList({ findings, onSelect, emptyMessage = 'Keine Findings vorhanden.' }: FindingsListProps) {
  const sorted = [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {sorted.map(f => (
        <li
          key={f.id}
          onClick={() => onSelect(f)}
          className={`cursor-pointer p-3 rounded-md border bg-white dark:bg-gray-800 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors ${
            f.status === 'dismissed' ? 'opacity-60' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${severityClasses[f.severity]}`}>
                {f.severity}
              </span>
              <code className="text-xs text-gray-500 dark:text-gray-400 truncate">{f.rule}</code>
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500">
              {new Date(f.detectedAt).toLocaleString('de-DE')}
            </div>
          </div>
          <p className="mt-1 text-sm text-gray-900 dark:text-white">{f.title}</p>
          {f.affected.length > 0 && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
              {f.affected.map(a => `${a.type}:${a.name}`).join(' · ')}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
