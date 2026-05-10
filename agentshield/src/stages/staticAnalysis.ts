import { AgentShieldConfig } from '../types/config';
import { StageReport } from '../types/report';
import { StageRunner } from './stage.interface';

export class StaticAnalysisStage implements StageRunner {
  readonly id = 'staticAnalysis';
  readonly name = 'Static Analysis';

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
