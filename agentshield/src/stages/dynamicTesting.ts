import { AgentShieldConfig } from '../types/config';
import { StageReport } from '../types/report';
import { StageRunner } from './stage.interface';
import { DiscoveredServer } from '../types/discovery';
import { Finding } from '../types/findings';
import { checkGatewayReachable, callGateway, GATEWAY_URL } from './dynamic-testing/gateway-client';
import { runToolShadowingTest } from './dynamic-testing/tool-shadowing';
import { runRADETest } from './dynamic-testing/rade-test';
import { runEscalationChainTest } from './dynamic-testing/escalation-test';
import { buildASRMetadata, MCPSECBENCH_TAXONOMY } from './dynamic-testing/asr-calculator';

function extractLegitimateTools(previousReports: StageReport[] | undefined): string[] {
  if (!previousReports || previousReports.length === 0) return [];
  const discovery = previousReports.find((r) => r.stageId === 'discovery');
  if (!discovery || !discovery.metadata) return [];
  const raw = (discovery.metadata as Record<string, unknown>)['discoveredServers'];
  if (!Array.isArray(raw)) return [];
  const servers = raw as DiscoveredServer[];
  const names: string[] = [];
  for (const server of servers) {
    if (Array.isArray(server.tools)) {
      for (const tool of server.tools) {
        if (tool && typeof tool.name === 'string') {
          names.push(tool.name);
        }
      }
    }
  }
  return names;
}

const RADE_COMPONENT_TAXONOMY: Record<string, string> = {
  'gateway:rade:role-takeover': 'rade-role-takeover',
  'gateway:rade:data-exfiltration-redirect': 'rade-data-exfiltration',
  'gateway:rade:privilege-escalation-command': 'rade-privilege-escalation',
};

function radeTaxonomyKey(component: string): string {
  return RADE_COMPONENT_TAXONOMY[component] ?? 'rade';
}

export class DynamicTestingStage implements StageRunner {
  readonly id = 'dynamicTesting';
  readonly name = 'Dynamic Adversarial Testing';

  async run(
    _target: string,
    _config: AgentShieldConfig,
    previousReports?: StageReport[],
  ): Promise<StageReport> {
    const start = Date.now();
    const verbose = _config.verbose === true;
    try {
      await checkGatewayReachable();

      const legitimateTools = extractLegitimateTools(previousReports);

      const shadowResult = await runToolShadowingTest(legitimateTools, callGateway, verbose);
      const radeResult = await runRADETest(legitimateTools, callGateway, verbose);
      const escalationResult = await runEscalationChainTest(legitimateTools, callGateway, verbose);

      const taggedShadow: Finding[] = shadowResult.findings.map((f) => ({
        ...f,
        mcpSecBenchLabel: MCPSECBENCH_TAXONOMY['tool-shadowing'] ?? 'Unknown',
      }));
      const taggedRade: Finding[] = radeResult.findings.map((f) => ({
        ...f,
        mcpSecBenchLabel: MCPSECBENCH_TAXONOMY[radeTaxonomyKey(f.component)] ?? 'Unknown',
      }));
      const taggedEscalation: Finding[] = escalationResult.findings.map((f) => ({
        ...f,
        mcpSecBenchLabel: MCPSECBENCH_TAXONOMY['escalation'] ?? 'Unknown',
      }));

      const asrByAttackType = buildASRMetadata({
        toolShadowing: { successes: shadowResult.successes, attempts: shadowResult.attempts },
        radePerPayload: radeResult.perPayload,
        escalation: { successes: escalationResult.successes, attempts: escalationResult.attempts },
      });

      const totalAttempts =
        shadowResult.attempts + radeResult.attempts + escalationResult.attempts;

      return {
        stageId: this.id,
        stageName: this.name,
        findings: [...taggedShadow, ...taggedRade, ...taggedEscalation],
        duration: Date.now() - start,
        error: null,
        metadata: {
          asrByAttackType,
          totalAttempts,
          gatewayUrl: GATEWAY_URL,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        stageId: this.id,
        stageName: this.name,
        findings: [],
        duration: Date.now() - start,
        error: message,
        metadata: {
          asrByAttackType: null,
          totalAttempts: 0,
          gatewayUrl: GATEWAY_URL,
        },
      };
    }
  }
}
