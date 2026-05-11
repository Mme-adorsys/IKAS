import { randomUUID } from 'crypto';
import { AgentShieldConfig } from '../types/config';
import { StageReport } from '../types/report';
import { StageRunner } from './stage.interface';
import { DiscoveredServer } from '../types/discovery';
import { Finding, SeverityLevel } from '../types/findings';
import { scanPromptInjection } from './static-analysis/prompt-injection';
import { detectToolPoisoning } from './static-analysis/tool-poisoning';
import { auditConfigFiles } from './static-analysis/config-auditor';
import { recordToolHashes } from './static-analysis/tool-hash';

/**
 * Extract DiscoveredServer[] from a previousReports array.
 * Returns null when the discovery stage did not run or did not store the metadata.
 * Throws if the metadata is present but malformed — caller catches and reports.
 */
function extractDiscoveredServers(previousReports: StageReport[] | undefined): DiscoveredServer[] | null {
  if (!previousReports || previousReports.length === 0) return null;
  const discovery = previousReports.find((r) => r.stageId === 'discovery');
  if (!discovery || !discovery.metadata) return null;
  const raw = (discovery.metadata as Record<string, unknown>)['discoveredServers'];
  if (raw === undefined) return null;
  if (!Array.isArray(raw)) {
    throw new Error(`discoveredServers metadata is not an array (got ${typeof raw})`);
  }
  return raw as DiscoveredServer[];
}

export class StaticAnalysisStage implements StageRunner {
  readonly id = 'staticAnalysis';
  readonly name = 'Static Analysis';

  async run(
    _target: string,
    config: AgentShieldConfig,
    previousReports?: StageReport[],
  ): Promise<StageReport> {
    const start = Date.now();
    try {
      const servers = extractDiscoveredServers(previousReports);

      // Config-auditor always runs (it does not depend on discovery output)
      const configFindings = auditConfigFiles(config);

      let toolFindings: Finding[] = [];
      let toolsScanned = 0;
      let hashBaselineWritten = false;

      if (servers !== null) {
        toolsScanned = servers.reduce((acc, s) => acc + s.tools.length, 0);
        const piFindings = scanPromptInjection(servers);
        const tpFindings = detectToolPoisoning(servers);
        const thFindings = await recordToolHashes(servers, config);
        // hashBaselineWritten is true on first scan: STAT-04 emits INFO findings only on first scan
        hashBaselineWritten = thFindings.some((f) => f.severity === 'info');
        toolFindings = [...piFindings, ...tpFindings, ...thFindings];
      } else {
        toolFindings.push({
          id: randomUUID(),
          title: 'Tool-level static analysis skipped',
          description:
            'No discoveredServers were available from the discovery stage. ' +
            'STAT-01 (prompt injection), STAT-02 (tool poisoning), and STAT-04 (tool hash) were skipped. ' +
            'STAT-03 (config audit) ran independently.',
          severity: 'info' as SeverityLevel,
          component: 'static-analysis',
          score: 0,
          owaspCategory: 'MCP03:2025',
        });
      }

      return {
        stageId: this.id,
        stageName: this.name,
        findings: [...toolFindings, ...configFindings],
        duration: Date.now() - start,
        error: null,
        metadata: { toolsScanned, hashBaselineWritten },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        stageId: this.id,
        stageName: this.name,
        findings: [],
        duration: Date.now() - start,
        error: message,
        metadata: { toolsScanned: 0, hashBaselineWritten: false },
      };
    }
  }
}
