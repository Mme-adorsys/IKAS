import { randomUUID } from 'crypto';
import leven = require('leven');
import { DiscoveredServer, ToolDefinition } from '../../types/discovery';
import { Finding } from '../../types/findings';

interface ToolEntry {
  server: DiscoveredServer;
  tool: ToolDefinition;
}

export function detectToolPoisoning(servers: DiscoveredServer[]): Finding[] {
  const findings: Finding[] = [];
  const allTools: ToolEntry[] = servers.flatMap((s) => s.tools.map((t) => ({ server: s, tool: t })));

  // ---- Shadow detection (D-07): group by lowercase tool name across DIFFERENT servers ----
  const nameToEntries = new Map<string, ToolEntry[]>();
  for (const entry of allTools) {
    const key = entry.tool.name.toLowerCase();
    if (!nameToEntries.has(key)) nameToEntries.set(key, []);
    nameToEntries.get(key)!.push(entry);
  }

  for (const [name, entries] of nameToEntries) {
    // Only consider entries from distinct servers
    const distinctServers = new Set(entries.map((e) => e.server.baseUrl));
    if (distinctServers.size < 2) continue;

    // Count how many servers share the same description (WR-05).
    // Using descSet.size === 1 (all descriptions identical) suppresses CRITICAL when a single
    // server has a different description even though two or more others share the exact same one.
    // Instead, flag CRITICAL if at least two servers share the same description.
    const descCounts = new Map<string, number>();
    for (const e of entries) {
      const d = e.tool.description ?? '';
      descCounts.set(d, (descCounts.get(d) ?? 0) + 1);
    }
    const maxDuplicateCount = Math.max(...descCounts.values());
    const sameDesc = maxDuplicateCount >= 2; // at least 2 servers share the exact same description
    const severity = sameDesc ? 'critical' : 'high';
    const owaspCategory = sameDesc ? 'MCP09:2025' : 'MCP02:2025';
    const score = sameDesc ? 9.0 : 7.5;
    const serversListed = Array.from(distinctServers).join(', ');

    findings.push({
      id: randomUUID(),
      title: `Shadow tool detected: "${name}" on multiple servers`,
      description:
        `Tool "${name}" is exposed by multiple servers (${serversListed}). ` +
        (sameDesc
          ? 'Descriptions are identical — agent may invoke the wrong server (D-07 CRITICAL).'
          : 'Descriptions diverge between servers — possible description manipulation / rug-pull risk (D-07 HIGH).'),
      severity,
      component: serversListed,
      score,
      owaspCategory,
      remediation:
        'Ensure each tool name is unique across the MCP servers your agent connects to. ' +
        'Remove or rename the unauthorized duplicate, or restrict the allow-list in agentshield.config.yaml.',
    });
  }

  // ---- Name-squatting (D-06 + D-08): Levenshtein <= 2, cross-server, both names >= 4 chars ----
  for (let i = 0; i < allTools.length; i++) {
    for (let j = i + 1; j < allTools.length; j++) {
      const a = allTools[i];
      const b = allTools[j];
      if (a.server.baseUrl === b.server.baseUrl) continue;        // D-08: same-server excluded
      if (a.tool.name === b.tool.name) continue;                  // exact match handled as shadow above
      const na = a.tool.name;
      const nb = b.tool.name;
      if (na.length < 4 || nb.length < 4) continue;              // Pitfall 3
      if (leven(na, nb) > 2) continue;                            // D-06 threshold

      findings.push({
        id: randomUUID(),
        title: `Tool name-squatting: "${na}" resembles "${nb}"`,
        description:
          `Tool "${na}" on ${a.server.baseUrl} has Levenshtein distance <= 2 from "${nb}" on ${b.server.baseUrl}. ` +
          `This pattern is consistent with name-squatting attacks where an attacker registers a near-identical ` +
          `tool name to misroute agent calls. Suspicious tool: "${na}". Legitimate-looking tool: "${nb}". (D-08)`,
        severity: 'medium',
        component: `${a.server.baseUrl}#${na}`,
        score: 6.0,
        owaspCategory: 'MCP03:2025',
        remediation:
          'Verify that one of the two tool names is intended; rename or remove the unauthorized duplicate. ' +
          'Consider enforcing a tool-name allow-list in agentshield.config.yaml.',
      });
    }
  }

  return findings;
}
