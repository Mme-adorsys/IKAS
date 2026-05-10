export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export const SEVERITY_RANK: Record<SeverityLevel, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

export interface Finding {
  id: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  component: string;
  score: number;
  remediation?: string;
  owaspCategory?: string;
}
