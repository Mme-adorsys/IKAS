import { randomUUID } from 'crypto';
import { DiscoveredServer } from '../../types/discovery';
import { Finding } from '../../types/findings';
import { PROMPT_INJECTION_PATTERNS } from '../../data/prompt-injection-patterns';

export function scanPromptInjection(servers: DiscoveredServer[]): Finding[] {
  const findings: Finding[] = [];
  for (const server of servers) {
    for (const tool of server.tools) {
      for (const pattern of PROMPT_INJECTION_PATTERNS) {
        if (pattern.match(tool)) {
          findings.push({
            id: randomUUID(),
            title: `${pattern.name}: ${tool.name}`,
            description:
              `Pattern "${pattern.name}" (${pattern.id}) matched in tool "${tool.name}" on ${server.baseUrl}. ` +
              `Full tool description: ${tool.description ?? '(none)'}`,
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
