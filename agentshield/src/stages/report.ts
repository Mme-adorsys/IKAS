import { AgentShieldConfig } from '../types/config';
import { StageReport } from '../types/report';
import { StageRunner } from './stage.interface';

export class ReportStage implements StageRunner {
  readonly id = 'report';
  readonly name = 'Remediation Report';

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
