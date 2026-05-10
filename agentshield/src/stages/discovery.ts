import { AgentShieldConfig } from '../types/config';
import { StageReport } from '../types/report';
import { StageRunner } from './stage.interface';

export class DiscoveryStage implements StageRunner {
  readonly id = 'discovery';
  readonly name = 'Discovery & Inventory';

  async run(_target: string, _config: AgentShieldConfig): Promise<StageReport> {
    return {
      stageId: this.id,
      stageName: this.name,
      findings: [],
      duration: 0,
      error: null,
    };
  }
}
