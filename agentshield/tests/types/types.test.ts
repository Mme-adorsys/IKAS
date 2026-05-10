import { Finding, SeverityLevel, SEVERITY_RANK } from '../../src/types/findings';
import { StageReport, ScanResult, CompositeScore } from '../../src/types/report';
import { StageRunner } from '../../src/stages/stage.interface';
import { AgentShieldConfig } from '../../src/types/config';

describe('AgentShield types', () => {
  it('Finding type accepts a fully populated record', () => {
    const f: Finding = {
      id: 'finding-001',
      title: 'Hardcoded credential in config',
      description: 'API key found in plain text',
      severity: 'high',
      component: 'keycloak-mcp-server',
      score: 7.5,
      remediation: 'Move to env var',
      owaspCategory: 'MCP-A02',
    };
    expect(f.severity).toBe('high');
    expect(f.score).toBe(7.5);
  });

  it('SEVERITY_RANK orders critical highest, info lowest', () => {
    expect(SEVERITY_RANK.critical).toBeGreaterThan(SEVERITY_RANK.high);
    expect(SEVERITY_RANK.high).toBeGreaterThan(SEVERITY_RANK.medium);
    expect(SEVERITY_RANK.medium).toBeGreaterThan(SEVERITY_RANK.low);
    expect(SEVERITY_RANK.low).toBeGreaterThan(SEVERITY_RANK.info);
  });

  it('StageReport accepts empty findings, null error, zero duration', () => {
    const r: StageReport = {
      stageId: 'discovery',
      stageName: 'Discovery & Inventory',
      findings: [],
      duration: 0,
      error: null,
    };
    expect(r.findings).toHaveLength(0);
    expect(r.error).toBeNull();
  });

  it('ScanResult composes target, timestamp, stages, compositeScore', () => {
    const score: CompositeScore = { value: 0, breakdown: {} };
    const result: ScanResult = {
      target: 'http://localhost:8001',
      timestamp: new Date().toISOString(),
      stages: [],
      compositeScore: score,
    };
    expect(result.target).toBe('http://localhost:8001');
    expect(result.compositeScore.value).toBe(0);
  });

  it('StageRunner interface is satisfied by an async class with id, name, run()', async () => {
    class TestStage implements StageRunner {
      readonly id = 'test';
      readonly name = 'Test Stage';
      async run(target: string, _config: AgentShieldConfig): Promise<StageReport> {
        return {
          stageId: this.id,
          stageName: this.name,
          findings: [],
          duration: 0,
          error: null,
        };
      }
    }
    const stage: StageRunner = new TestStage();
    const minimalConfig = { target: 'http://x', allowedServers: [], outputDir: '.', stages: [] } as AgentShieldConfig;
    const report = await stage.run('http://localhost:8001', minimalConfig);
    expect(report.stageId).toBe('test');
    expect(report.findings).toEqual([]);
  });

  it('SeverityLevel union excludes invalid values at compile time', () => {
    const valid: SeverityLevel[] = ['critical', 'high', 'medium', 'low', 'info'];
    expect(valid).toHaveLength(5);
    // @ts-expect-error 'extreme' is not a valid SeverityLevel
    const invalid: SeverityLevel = 'extreme';
    expect(invalid).toBe('extreme'); // runtime is fine; compile-time error is what matters
  });
});
