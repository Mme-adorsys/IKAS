import { AgentShieldConfig } from '../types/config';
import { StageReport } from '../types/report';

export interface StageRunner {
  readonly name: string;
  readonly id: string;
  run(target: string, config: AgentShieldConfig): Promise<StageReport>;
}
