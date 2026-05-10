import { DiscoveryStage } from '../../src/stages/discovery';
import { StaticAnalysisStage } from '../../src/stages/staticAnalysis';
import { DynamicTestingStage } from '../../src/stages/dynamicTesting';
import { RuntimeMonitoringStage } from '../../src/stages/runtimeMonitoring';
import { ReportStage } from '../../src/stages/report';
import { StageRunner } from '../../src/stages/stage.interface';
import { STAGE_IDS, AgentShieldConfig } from '../../src/types/config';

const minimalConfig: AgentShieldConfig = {
  target: 'http://localhost:8001',
  allowedServers: [],
  outputDir: './test-output',
  stages: [...STAGE_IDS],
};

const allStages: StageRunner[] = [
  new DiscoveryStage(),
  new StaticAnalysisStage(),
  new DynamicTestingStage(),
  new RuntimeMonitoringStage(),
  new ReportStage(),
];

describe('Stage stubs', () => {
  it('exposes the 5 expected stage IDs matching STAGE_IDS', () => {
    const ids = allStages.map((s) => s.id).sort();
    expect(ids).toEqual([...STAGE_IDS].sort());
  });

  it.each(allStages)('stage $name returns a valid StageReport', async (stage) => {
    const report = await stage.run('http://localhost:8001', minimalConfig);
    expect(report.stageId).toBe(stage.id);
    expect(report.stageName).toBe(stage.name);
    expect(Array.isArray(report.findings)).toBe(true);
    // DiscoveryStage performs real network probes; other stubs return empty findings
    if (stage.id !== 'discovery') {
      expect(report.findings).toEqual([]);
      expect(report.error).toBeNull();
    }
    expect(typeof report.duration).toBe('number');
  });

  it('every stage has a non-empty human-readable name', () => {
    for (const stage of allStages) {
      expect(stage.name.length).toBeGreaterThan(0);
    }
  });
});
