import { StageReport } from '../types/report';
import { CompositeScore } from '../types/report';

export function computeCompositeScore(_stages: StageReport[]): CompositeScore {
  // Phase 1 stub: real scoring (ASR × exploitability × blast radius × OWASP weight)
  // is implemented in Phase 6.
  return { value: 0, breakdown: {} };
}
