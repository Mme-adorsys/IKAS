import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

import { AgentShieldConfig, StageId } from '../types/config';
import { ScanResult, StageReport } from '../types/report';
import { StageRunner } from '../stages/stage.interface';
import { DiscoveryStage } from '../stages/discovery';
import { StaticAnalysisStage } from '../stages/staticAnalysis';
import { DynamicTestingStage } from '../stages/dynamicTesting';
import { RuntimeMonitoringStage } from '../stages/runtimeMonitoring';
import { ReportStage } from '../stages/report';

import { computeCompositeScore } from './score';
import { renderTable } from './table';

const STAGE_REGISTRY: Record<StageId, () => StageRunner> = {
  discovery: () => new DiscoveryStage(),
  staticAnalysis: () => new StaticAnalysisStage(),
  dynamicTesting: () => new DynamicTestingStage(),
  runtimeMonitoring: () => new RuntimeMonitoringStage(),
  report: () => new ReportStage(),
};

export function buildStages(config: AgentShieldConfig): StageRunner[] {
  return config.stages.map((id) => STAGE_REGISTRY[id]());
}

export class ScanRunner {
  private readonly stages: StageRunner[];

  constructor(private readonly config: AgentShieldConfig) {
    this.stages = buildStages(config);
  }

  async run(target: string): Promise<ScanResult> {
    const stageReports: StageReport[] = [];
    for (const stage of this.stages) {
      const start = Date.now();
      try {
        const report = await stage.run(target, this.config, stageReports);
        stageReports.push({ ...report, duration: report.duration || Date.now() - start });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        stageReports.push({
          stageId: stage.id,
          stageName: stage.name,
          findings: [],
          duration: Date.now() - start,
          error: message,
        });
      }
    }
    const result: ScanResult = {
      target,
      timestamp: new Date().toISOString(),
      stages: stageReports,
      compositeScore: computeCompositeScore(stageReports),
    };
    this.writeJsonReport(result);
    renderTable(result);
    return result;
  }

  private writeJsonReport(result: ScanResult): void {
    const outDir = resolve(this.config.outputDir);
    mkdirSync(outDir, { recursive: true }); // Pitfall 5: create dir recursively
    const outPath = resolve(outDir, 'agentshield-report.json');
    writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
    console.log(`\nReport written to: ${outPath}`);
  }
}
