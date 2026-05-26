/**
 * Shared types for the IKAS Security Engine.
 *
 * Findings are produced by rule-based SecurityCheck instances and later enriched (description +
 * remediation) by a single batched LLM call per scan in llm-explainer.ts.
 */

export type Severity = 'critical' | 'error' | 'warning' | 'info';

export type CheckCategory = 'config' | 'fraud' | 'owasp' | 'compliance';

export type FindingStatus = 'open' | 'dismissed' | 'resolved';

export type ScanScope = 'all' | CheckCategory;

export type ScanState = 'pending' | 'running' | 'completed' | 'failed';

export interface AffectedEntity {
  type: 'realm' | 'user' | 'client' | 'role' | 'group';
  id: string;
  name: string;
}

export interface Finding {
  id: string;                              // stable: sha256(`${checkId}|${realm}|${affectedKey}`)
  checkId: string;                         // e.g. 'config.ssl-required'
  category: CheckCategory;
  severity: Severity;
  realm: string;
  rule: string;                            // short machine identifier
  title: string;                           // human-readable headline
  description: string;                     // LLM-augmented narrative (may be empty pre-enrichment)
  remediation?: string;                    // LLM-suggested fix (may be empty pre-enrichment)
  references?: string[];                   // e.g. ['OWASP:A07', 'CWE-307', 'GDPR-Art.32']
  affected: AffectedEntity[];
  evidence?: Record<string, any>;          // raw signal used by the check (kept compact, no secrets)
  detectedAt: string;                      // ISO timestamp
  status: FindingStatus;
}

export interface Scan {
  id: string;
  realm: string;
  scope: ScanScope;
  state: ScanState;
  startedAt: string;
  finishedAt?: string;
  progress: number;                        // 0..100
  totalChecks: number;
  completedChecks: number;
  findings: Finding[];
  error?: string;
}
