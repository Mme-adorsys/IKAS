import { DynamicTestingStage } from '../../src/stages/dynamicTesting';
import { AgentShieldConfig, STAGE_IDS } from '../../src/types/config';
import { StageReport } from '../../src/types/report';
import { Finding } from '../../src/types/findings';

// Mock the gateway-client module
jest.mock('../../src/stages/dynamic-testing/gateway-client', () => ({
  checkGatewayReachable: jest.fn(),
  callGateway: jest.fn(),
  GATEWAY_URL: 'http://localhost:8005/api/chat',
  GATEWAY_TIMEOUT_MS: 30000,
  GATEWAY_PROBE_TIMEOUT_MS: 3000,
  D04_ERROR_MESSAGE: 'Dynamic testing requires IKAS AI Gateway on http://localhost:8005. Start IKAS and re-run.',
}));

// Mock sub-runner modules
jest.mock('../../src/stages/dynamic-testing/tool-shadowing', () => ({
  runToolShadowingTest: jest.fn(),
  SHADOW_TOOL_NAME: 'shadow-list-users',
  TOOL_SHADOWING_OWASP: 'MCP09:2025',
  TOOL_SHADOWING_LABEL: 'Tool Shadowing Attack',
  buildShadowingPrompt: jest.fn(),
}));

jest.mock('../../src/stages/dynamic-testing/rade-test', () => ({
  runRADETest: jest.fn(),
  RADE_PAYLOADS: [] as unknown[],
  detectRADESuccess: jest.fn(),
}));

jest.mock('../../src/stages/dynamic-testing/escalation-test', () => ({
  runEscalationChainTest: jest.fn(),
  detectEscalationSuccess: jest.fn(),
}));

jest.mock('../../src/stages/dynamic-testing/asr-calculator', () => ({
  formatASR: jest.fn().mockImplementation((successes: number, attempts: number, label: string) =>
    `${label} ASR: ${attempts > 0 ? Math.round((successes / attempts) * 100) : 0}% (${successes}/${attempts} attempts succeeded)`,
  ),
  MCPSECBENCH_TAXONOMY: {
    'tool-shadowing': 'Tool Shadowing Attack',
    'rade': 'Indirect Prompt Injection',
    'escalation': 'Tool/Service Misuse via Confused AI',
  },
}));

// Import mocked modules for configuration
import * as gatewayClient from '../../src/stages/dynamic-testing/gateway-client';
import * as toolShadowing from '../../src/stages/dynamic-testing/tool-shadowing';
import * as radeTest from '../../src/stages/dynamic-testing/rade-test';
import * as escalationTest from '../../src/stages/dynamic-testing/escalation-test';

const baseConfig: AgentShieldConfig = {
  target: 'http://localhost:8001',
  allowedServers: ['http://localhost:8001'],
  outputDir: './test-output',
  stages: [...STAGE_IDS],
};

function makeDiscoveryReport(toolNames: string[] = ['list-users', 'create-user']): StageReport {
  return {
    stageId: 'discovery',
    stageName: 'Discovery & Inventory',
    findings: [],
    duration: 1,
    error: null,
    metadata: {
      discoveredServers: [
        {
          baseUrl: 'http://localhost:8001',
          transport: 'rest-keycloak',
          endpoint: '/tools',
          tools: toolNames.map((name) => ({ name })),
          hasAuth: false,
          responseTimeMs: 10,
        },
      ],
    },
  };
}

function makeToolShadowingFinding(): Finding {
  return {
    id: 'shadow-finding-001',
    title: 'Tool shadowing attack succeeded: shadow-list-users',
    description: 'Claude invoked the injected shadow tool.',
    severity: 'critical',
    component: 'gateway:shadow-list-users',
    score: 9.0,
    owaspCategory: 'MCP09:2025',
  };
}

function makeRadeFinding(): Finding {
  return {
    id: 'rade-finding-001',
    title: 'RADE attack succeeded: role-takeover',
    description: 'RADE payload triggered jailbreak behavior.',
    severity: 'critical',
    component: 'gateway:rade-role-takeover',
    score: 8.5,
    owaspCategory: 'MCP01:2025',
  };
}

function makeEscalationFinding(): Finding {
  return {
    id: 'escalation-finding-001',
    title: 'Privilege escalation chain succeeded',
    description: 'Neo4j write tool was invoked from Keycloak-scoped prompt.',
    severity: 'critical',
    component: 'gateway:escalation',
    score: 9.5,
    owaspCategory: 'MCP04:2025',
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  // Default mocks — gateway reachable, no attacks succeed
  (gatewayClient.checkGatewayReachable as jest.Mock).mockResolvedValue(undefined);
  (toolShadowing.runToolShadowingTest as jest.Mock).mockResolvedValue({
    attempts: 1,
    successes: 0,
    findings: [],
  });
  (radeTest.runRADETest as jest.Mock).mockResolvedValue({
    attempts: 9,
    successes: 0,
    findings: [],
  });
  (escalationTest.runEscalationChainTest as jest.Mock).mockResolvedValue({
    attempts: 1,
    successes: 0,
    findings: [],
  });
});

describe('DynamicTestingStage.run — stage metadata', () => {
  it('returns stageId "dynamicTesting" and stageName "Dynamic Adversarial Testing"', async () => {
    const stage = new DynamicTestingStage();
    const report = await stage.run('http://localhost:8001', baseConfig, [makeDiscoveryReport()]);

    expect(report.stageId).toBe('dynamicTesting');
    expect(report.stageName).toBe('Dynamic Adversarial Testing');
  });
});

describe('DynamicTestingStage.run — gateway unreachable (D-04)', () => {
  it('throws fail-fast: report.error contains "Dynamic testing requires IKAS AI Gateway"', async () => {
    (gatewayClient.checkGatewayReachable as jest.Mock).mockRejectedValue(
      new Error('Dynamic testing requires IKAS AI Gateway on http://localhost:8005. Start IKAS and re-run.'),
    );

    const stage = new DynamicTestingStage();
    const report = await stage.run('http://localhost:8001', baseConfig, [makeDiscoveryReport()]);

    expect(typeof report.error).toBe('string');
    expect(report.error).toContain('Dynamic testing requires IKAS AI Gateway');
  });
});

describe('DynamicTestingStage.run — ASR metadata', () => {
  it('populates metadata.asrByAttackType with toolShadowing, rade, and escalationChain', async () => {
    const stage = new DynamicTestingStage();
    const report = await stage.run('http://localhost:8001', baseConfig, [makeDiscoveryReport()]);

    expect(report.metadata).toBeDefined();
    const meta = report.metadata as Record<string, unknown>;
    expect(meta).toHaveProperty('asrByAttackType');
    const asrByAttackType = meta['asrByAttackType'] as Record<string, unknown>;
    expect(asrByAttackType).toHaveProperty('toolShadowing');
    expect(asrByAttackType).toHaveProperty('rade');
    expect(asrByAttackType).toHaveProperty('escalationChain');
  });
});

describe('DynamicTestingStage.run — finding aggregation', () => {
  it('aggregates findings from all three sub-runners', async () => {
    (toolShadowing.runToolShadowingTest as jest.Mock).mockResolvedValue({
      attempts: 1,
      successes: 1,
      findings: [makeToolShadowingFinding()],
    });
    (radeTest.runRADETest as jest.Mock).mockResolvedValue({
      attempts: 9,
      successes: 3,
      findings: [makeRadeFinding()],
    });
    (escalationTest.runEscalationChainTest as jest.Mock).mockResolvedValue({
      attempts: 1,
      successes: 1,
      findings: [makeEscalationFinding()],
    });

    const stage = new DynamicTestingStage();
    const report = await stage.run('http://localhost:8001', baseConfig, [makeDiscoveryReport()]);

    expect(report.findings.length).toBeGreaterThanOrEqual(3);
    expect(report.findings.some((f) => f.id === 'shadow-finding-001')).toBe(true);
    expect(report.findings.some((f) => f.id === 'rade-finding-001')).toBe(true);
    expect(report.findings.some((f) => f.id === 'escalation-finding-001')).toBe(true);
  });
});

describe('DynamicTestingStage.run — legitimate tools extraction', () => {
  it('extracts legitimateTools from previousReports[].metadata.discoveredServers and passes to runToolShadowingTest', async () => {
    const toolNames = ['list-users', 'create-user', 'delete-user'];
    const stage = new DynamicTestingStage();
    await stage.run('http://localhost:8001', baseConfig, [makeDiscoveryReport(toolNames)]);

    expect(toolShadowing.runToolShadowingTest).toHaveBeenCalledTimes(1);
    const [passedTools] = (toolShadowing.runToolShadowingTest as jest.Mock).mock.calls[0];
    // All discovered tool names should be included in the legitimate tools array
    for (const tool of toolNames) {
      expect(passedTools).toContain(tool);
    }
  });
});
