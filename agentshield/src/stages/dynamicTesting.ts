import { AgentShieldConfig } from '../types/config';
import { StageReport } from '../types/report';
import { StageRunner } from './stage.interface';
import { DiscoveredServer } from '../types/discovery';
import { Finding } from '../types/findings';
import { checkGatewayReachable, callGateway } from './dynamic-testing/gateway-client';
import { runToolShadowingTest } from './dynamic-testing/tool-shadowing';
import { runRADETest } from './dynamic-testing/rade-test';
import { runEscalationChainTest } from './dynamic-testing/escalation-test';
import { formatASR, MCPSECBENCH_TAXONOMY } from './dynamic-testing/asr-calculator';

const GATEWAY_URL = 'http://localhost:8005';

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

function radeTaxonomyKey(component: string): string {
  if (component.endsWith(':role-takeover')) return 'rade-role-takeover';
  if (component.endsWith(':data-exfiltration-redirect')) return 'rade-data-exfiltration';
  if (component.endsWith(':privilege-escalation-command')) return 'rade-privilege-escalation';
  return 'rade';
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
    try {
      await checkGatewayReachable();

      const legitimateTools = extractLegitimateTools(previousReports);

      const shadowResult = await runToolShadowingTest(legitimateTools, callGateway);
      const radeResult = await runRADETest(legitimateTools, callGateway);
      const escalationResult = await runEscalationChainTest(legitimateTools, callGateway);

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

      const asrByAttackType = {
        toolShadowing: formatASR(shadowResult.successes, shadowResult.attempts, 'Tool Shadowing'),
        rade: formatASR(radeResult.successes, radeResult.attempts, 'RADE'),
        escalationChain: formatASR(escalationResult.successes, escalationResult.attempts, 'Escalation Chain'),
      };

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
