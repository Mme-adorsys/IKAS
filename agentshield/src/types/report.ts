import { Finding } from './findings';

export interface CompositeScore {
  value: number;
  breakdown: Record<string, number>;
}

export interface StageReport {
  stageId: string;
  stageName: string;
  findings: Finding[];
  duration: number;
  error: string | null;
  metadata?: Record<string, unknown>;
}

export interface ScanResult {
  target: string;
  timestamp: string;
  stages: StageReport[];
  compositeScore: CompositeScore;
}
