import { randomUUID } from 'crypto';
import { DiscoveredServer } from '../../types/discovery';
import { Finding } from '../../types/findings';
import { PROMPT_INJECTION_PATTERNS } from '../../data/prompt-injection-patterns';

// Maximum characters of the tool description echoed into findings.
// Keeping this short prevents the scan report from replaying the suspected injection
// payload verbatim to any AI agent that consumes the report downstream (WR-01).
const MAX_ECHO_LEN = 120;

export function scanPromptInjection(servers: DiscoveredServer[]): Finding[] {
  const findings: Finding[] = [];
  for (const server of servers) {
    for (const tool of server.tools) {
      for (const pattern of PROMPT_INJECTION_PATTERNS) {
        if (pattern.match(tool)) {
          const rawDesc = tool.description ?? '(none)';
          const truncatedDesc =
            rawDesc.length > MAX_ECHO_LEN
              ? rawDesc.slice(0, MAX_ECHO_LEN) + '…[truncated]'
              : rawDesc;
          findings.push({
            id: randomUUID(),
            title: `${pattern.name}: ${tool.name}`,
            description:
              `Pattern "${pattern.name}" (${pattern.id}) matched in tool "${tool.name}" on ${server.baseUrl}. ` +
              `Tool description excerpt (first ${MAX_ECHO_LEN} chars): ${truncatedDesc}`,
            severity: pattern.severity,
            component: `${server.baseUrl}#${tool.name}`,
            score: pattern.score,
            owaspCategory: pattern.owaspCategory,
          });
        }
      }
    }
  }
  return findings;
}
