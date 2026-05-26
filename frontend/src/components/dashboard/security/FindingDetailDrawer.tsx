'use client';

import React, { useState } from 'react';
import { Finding } from '@/types/security';
import { useIKASStore } from '@/store';

interface Props {
  finding: Finding | null;
  onClose: () => void;
}

export function FindingDetailDrawer({ finding: propFinding, onClose }: Props) {
  const dismissFinding = useIKASStore(s => s.dismissSecurityFinding);
  const enrichFinding = useIKASStore(s => s.enrichSecurityFinding);
  const applyAutoFix = useIKASStore(s => s.applyAutoFix);
  const autoFixableRules = useIKASStore(s => s.autoFixableRules);
  // Re-read the finding from the store keyed by id so enrichment updates that the
  // store fans out are visible here even though the parent only handed us a snapshot.
  // Falls back to the prop if the finding isn't in the store yet.
  const liveFinding = useIKASStore(s =>
    propFinding ? (s.security.findings.find(f => f.id === propFinding.id) ?? propFinding) : null
  );
  const [enriching, setEnriching] = useState(false);
  const [fixing, setFixing] = useState(false);

  const finding = liveFinding;
  if (!finding) return null;

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      await enrichFinding(finding.id);
    } finally {
      setEnriching(false);
    }
  };

  const handleFix = async () => {
    setFixing(true);
    try {
      await applyAutoFix(finding.id);
    } finally {
      setFixing(false);
    }
  };

  const canAutoFix = autoFixableRules.includes(finding.rule) && finding.status === 'open';

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl z-50 overflow-y-auto border-l border-gray-200 dark:border-gray-700">
      <div className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium tracking-wide">
              {finding.category} · {finding.severity}
            </p>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
              {finding.title}
            </h3>
            <code className="text-xs text-gray-500 dark:text-gray-400">{finding.rule}</code>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="Schließen"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {finding.description && (
          <section>
            <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium mb-1">Beschreibung</h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{finding.description}</p>
          </section>
        )}

        {finding.remediation && (
          <section>
            <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium mb-1">Empfohlene Aktion</h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{finding.remediation}</p>
          </section>
        )}

        {finding.affected.length > 0 && (
          <section>
            <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium mb-1">Betroffene Objekte</h4>
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
              {finding.affected.map(a => (
                <li key={`${a.type}-${a.id}`} className="flex gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 capitalize">{a.type}</span>
                  <span>{a.name}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {finding.references && finding.references.length > 0 && (
          <section>
            <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium mb-1">Referenzen</h4>
            <div className="flex flex-wrap gap-1">
              {finding.references.map(r => (
                <span key={r} className="text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  {r}
                </span>
              ))}
            </div>
          </section>
        )}

        {finding.evidence && (
          <section>
            <h4 className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium mb-1">Evidenz</h4>
            <pre className="text-xs bg-gray-50 dark:bg-gray-800 rounded p-3 overflow-x-auto text-gray-700 dark:text-gray-300">
{JSON.stringify(finding.evidence, null, 2)}
            </pre>
          </section>
        )}

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-2">
          {canAutoFix && (
            <button
              onClick={handleFix}
              disabled={fixing}
              title="Wendet die Empfehlung auf den Demo-Graph an (Keycloak bleibt unverändert)"
              className="px-3 py-1.5 text-sm rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white flex items-center gap-1.5"
            >
              {fixing && (
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" />
                </svg>
              )}
              {fixing ? 'Fixe …' : '🔧 Auto-Fix anwenden'}
            </button>
          )}
          {finding.status === 'resolved' && (
            <span className="px-3 py-1.5 text-sm rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 flex items-center gap-1">
              ✓ Behoben (per Reset wiederherstellbar)
            </span>
          )}
          <button
            onClick={handleEnrich}
            disabled={enriching}
            className="px-3 py-1.5 text-sm rounded bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white flex items-center gap-1.5"
          >
            {enriching && (
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" />
              </svg>
            )}
            {enriching ? 'Analysiere …' : '🧠 AI-Analyse vertiefen'}
          </button>
          {finding.status !== 'dismissed' && finding.status !== 'resolved' && (
            <button
              onClick={() => dismissFinding(finding.id)}
              className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
            >
              Verwerfen
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
