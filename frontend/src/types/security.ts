/**
 * Frontend-side mirror of the AI Gateway's security types. Kept thin — only what the UI needs.
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
  id: string;
  checkId: string;
  category: CheckCategory;
  severity: Severity;
  realm: string;
  rule: string;
  title: string;
  description: string;
  remediation?: string;
  references?: string[];
  affected: AffectedEntity[];
  evidence?: Record<string, any>;
  detectedAt: string;
  status: FindingStatus;
}

export interface Scan {
  id: string;
  realm: string;
  scope: ScanScope;
  state: ScanState;
  startedAt: string;
  finishedAt?: string;
  progress: number;
  totalChecks: number;
  completedChecks: number;
  findings: Finding[];
  error?: string;
}

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  error: 1,
  warning: 2,
  info: 3
};

/**
 * Live login event published by the AI Gateway's demo simulator (and loaded via the
 * `GET /api/security/live-events` endpoint on initial page-load). The WorldLoginMap +
 * LiveActivityTicker consume this shape.
 */
export interface LiveLoginEvent {
  id: string;
  time: string;
  type: 'LOGIN' | 'LOGIN_ERROR' | string;
  success: boolean;
  username: string | null;
  userId?: string | null;
  ip: string;
  ipClassification: 'normal' | 'tor' | 'datacenter' | 'known-bad' | string;
  country: string;
  city: string;
  lat: number;
  lon: number;
  realm?: string;
  userAgent?: string;
}
