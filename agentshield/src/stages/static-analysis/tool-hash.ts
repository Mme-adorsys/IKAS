import { createHash, randomUUID } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { DiscoveredServer, ToolDefinition } from '../../types/discovery';
import { AgentShieldConfig } from '../../types/config';
import { Finding, SeverityLevel } from '../../types/findings';

const BASELINE_FILENAME = 'tool-hashes.json';
const RUG_PULL_SCORE = 8.0;

function hashTool(tool: ToolDefinition): string {
  const canonical = JSON.stringify({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export async function recordToolHashes(
  servers: DiscoveredServer[],
  config: AgentShieldConfig,
): Promise<Finding[]> {
  // Pitfall 5: ensure outputDir exists before any read/write
  try {
    mkdirSync(config.outputDir, { recursive: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return [{
      id: randomUUID(),
      title: 'Tool hash recording failed: cannot create outputDir',
      description: message,
      severity: 'low' as SeverityLevel,
      component: config.outputDir,
      score: 0,
      owaspCategory: 'MCP03:2025',
    }];
  }

  const baselinePath = join(config.outputDir, BASELINE_FILENAME);

  // Compute current hashes keyed by `${baseUrl}#${toolName}`
  const currentHashes: Record<string, string> = {};
  for (const server of servers) {
    for (const tool of server.tools) {
      const key = `${server.baseUrl}#${tool.name}`;
      currentHashes[key] = hashTool(tool);
    }
  }

  // First-scan branch (D-15): no baseline file → write it and emit INFO per server
  if (!existsSync(baselinePath)) {
    try {
      writeFileSync(baselinePath, JSON.stringify(currentHashes, null, 2), 'utf8');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return [{
        id: randomUUID(),
        title: 'Tool hash baseline write failed',
        description: message,
        severity: 'low' as SeverityLevel,
        component: baselinePath,
        score: 0,
        owaspCategory: 'MCP03:2025',
      }];
    }
    return servers.map((server) => ({
      id: randomUUID(),
      title: `Tool hash baseline established for ${server.baseUrl}`,
      description:
        `Baseline established for ${server.tools.length} tool(s) on ${server.baseUrl}. ` +
        `Re-run AgentShield against this target to detect tool-definition changes (rug-pull). ` +
        `Baseline file: ${baselinePath}. (D-15)`,
      severity: 'info' as SeverityLevel,
      component: server.baseUrl,
      score: 0,
      owaspCategory: 'MCP03:2025',
    }));
  }

  // Re-scan branch (D-16): compare current hashes against baseline
  let baseline: Record<string, string>;
  try {
    const raw = readFileSync(baselinePath, 'utf8');
    baseline = JSON.parse(raw) as Record<string, string>;
    if (typeof baseline !== 'object' || baseline === null) baseline = {};
  } catch {
    baseline = {};
  }

  const findings: Finding[] = [];
  for (const [key, hash] of Object.entries(currentHashes)) {
    const previous = baseline[key];
    if (previous !== undefined && previous !== hash) {
      findings.push({
        id: randomUUID(),
        title: `Tool definition changed (rug-pull indicator): ${key}`,
        description:
          `Tool "${key}" definition has changed since the previous scan. ` +
          `Previous hash: ${previous.slice(0, 12)}... Current hash: ${hash.slice(0, 12)}... ` +
          `An attacker who controls the MCP server may have altered the tool description or inputSchema ` +
          `to expand the tool's scope or embed prompt injection after the agent approved it. (D-16)`,
        severity: 'high' as SeverityLevel,
        component: key,
        score: RUG_PULL_SCORE,
        owaspCategory: 'MCP02:2025',
        remediation:
          'Manually inspect the tool definition diff. If the change is unexpected, revoke the agent\'s ' +
          'trust in this MCP server until the change is explained. Delete tool-hashes.json to re-baseline once verified.',
      });
    }
  }

  // Second pass: detect tools that existed in the baseline but are no longer present (WR-02).
  // An attacker controlling an MCP server can silently remove a tool between scans; without this
  // pass the removal goes undetected.
  for (const [key, previousHash] of Object.entries(baseline)) {
    if (currentHashes[key] === undefined) {
      findings.push({
        id: randomUUID(),
        title: `Tool removed since last scan: ${key}`,
        description:
          `Tool "${key}" was present in the previous baseline (hash: ${previousHash.slice(0, 12)}...) ` +
          `but is no longer exposed by the server. Unexpected tool removal may indicate a rug-pull. (D-16)`,
        severity: 'high' as SeverityLevel,
        component: key,
        score: RUG_PULL_SCORE,
        owaspCategory: 'MCP02:2025',
        remediation:
          'Verify the tool was intentionally removed. If unexpected, treat the server as untrusted.',
      });
    }
  }

  // Always update baseline so the NEXT scan compares against current state (D-16)
  try {
    writeFileSync(baselinePath, JSON.stringify(currentHashes, null, 2), 'utf8');
  } catch {
    // Surface as low-severity finding so the user knows baseline drifted
    findings.push({
      id: randomUUID(),
      title: 'Tool hash baseline update failed',
      description: `Could not update ${baselinePath} after rug-pull comparison. The next scan will re-compare against the OLD baseline.`,
      severity: 'low',
      component: baselinePath,
      score: 0,
      owaspCategory: 'MCP03:2025',
    });
  }
  return findings;
}
