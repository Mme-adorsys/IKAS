import { DiscoveryStage } from '../../src/stages/discovery';
import { StaticAnalysisStage } from '../../src/stages/staticAnalysis';
import { DynamicTestingStage } from '../../src/stages/dynamicTesting';
import { RuntimeMonitoringStage } from '../../src/stages/runtimeMonitoring';
import { ReportStage } from '../../src/stages/report';
import { StageRunner } from '../../src/stages/stage.interface';
import { STAGE_IDS, AgentShieldConfig } from '../../src/types/config';

// Mock the dynamic-testing modules so DynamicTestingStage does not make live calls
jest.mock('../../src/stages/dynamic-testing/gateway-client', () => ({
  checkGatewayReachable: jest.fn().mockResolvedValue(undefined),
  callGateway: jest.fn(),
  GATEWAY_URL: 'http://localhost:8005/api/chat',
  GATEWAY_TIMEOUT_MS: 30000,
  GATEWAY_PROBE_TIMEOUT_MS: 3000,
  D04_ERROR_MESSAGE: 'Dynamic testing requires IKAS AI Gateway on http://localhost:8005. Start IKAS and re-run.',
}));

jest.mock('../../src/stages/dynamic-testing/tool-shadowing', () => ({
  runToolShadowingTest: jest.fn().mockResolvedValue({ attempts: 1, successes: 0, findings: [] }),
  SHADOW_TOOL_NAME: 'shadow-list-users',
  TOOL_SHADOWING_OWASP: 'MCP09:2025',
  TOOL_SHADOWING_LABEL: 'Tool Shadowing Attack',
  buildShadowingPrompt: jest.fn(),
}));

jest.mock('../../src/stages/dynamic-testing/rade-test', () => ({
  runRADETest: jest.fn().mockResolvedValue({ attempts: 9, successes: 0, findings: [] }),
  RADE_PAYLOADS: [] as unknown[],
  detectRADESuccess: jest.fn(),
}));

jest.mock('../../src/stages/dynamic-testing/escalation-test', () => ({
  runEscalationChainTest: jest.fn().mockResolvedValue({ attempts: 1, successes: 0, findings: [] }),
  detectEscalationSuccess: jest.fn(),
}));

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
  // Mock fetch globally so DiscoveryStage never makes live network probes in CI.
  // All probe attempts immediately reject — discovery returns empty findings with no error.
  beforeAll(() => {
    global.fetch = jest.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));
  });

  afterAll(() => {
    (global.fetch as jest.Mock).mockRestore?.();
  });

  it('exposes the 5 expected stage IDs matching STAGE_IDS', () => {
    const ids = allStages.map((s) => s.id).sort();
    expect(ids).toEqual([...STAGE_IDS].sort());
  });

  it.each(allStages)('stage $name returns a valid StageReport', async (stage) => {
    const report = await stage.run('http://localhost:8001', minimalConfig);
    expect(report.stageId).toBe(stage.id);
    expect(report.stageName).toBe(stage.name);
    expect(Array.isArray(report.findings)).toBe(true);
    expect(report.error).toBeNull();
    expect(typeof report.duration).toBe('number');
  });

  it('every stage has a non-empty human-readable name', () => {
    for (const stage of allStages) {
      expect(stage.name.length).toBeGreaterThan(0);
    }
  });
});
