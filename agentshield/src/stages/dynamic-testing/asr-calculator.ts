export const MCPSECBENCH_TAXONOMY: Record<string, string> = {
  'tool-shadowing': 'Tool Shadowing Attack',
  'rade': 'Indirect Prompt Injection',
  'rade-role-takeover': 'Indirect Prompt Injection',
  'rade-data-exfiltration': 'Data Exfiltration',
  'rade-privilege-escalation': 'Tool/Service Misuse via Confused AI',
  'escalation': 'Tool/Service Misuse via Confused AI',
};

export function formatASR(successes: number, attempts: number, label: string): string {
  const pct = attempts > 0 ? Math.round((successes / attempts) * 100) : 0;
  return `${label} ASR: ${pct}% (${successes}/${attempts} attempts succeeded)`;
}

export interface ASRMetadata {
  toolShadowing: string;
  rade: {
    roleTakeover: string;
    dataExfiltration: string;
    privilegeEscalation: string;
  };
  escalationChain: string;
}

export interface ASRInput {
  toolShadowing: { successes: number; attempts: number };
  radePerPayload: Array<{ payloadId: string; successes: number; attempts: number }>;
  escalation: { successes: number; attempts: number };
}

function findPayload(
  perPayload: Array<{ payloadId: string; successes: number; attempts: number }>,
  id: string,
): { successes: number; attempts: number } {
  const match = perPayload.find((p) => p.payloadId === id);
  return match ?? { successes: 0, attempts: 0 };
}

export function buildASRMetadata(input: ASRInput): ASRMetadata {
  const roleTakeover = findPayload(input.radePerPayload, 'role-takeover');
  const dataExfil = findPayload(input.radePerPayload, 'data-exfiltration-redirect');
  const privEsc = findPayload(input.radePerPayload, 'privilege-escalation-command');
  return {
    toolShadowing: formatASR(input.toolShadowing.successes, input.toolShadowing.attempts, 'Tool Shadowing'),
    rade: {
      roleTakeover: formatASR(roleTakeover.successes, roleTakeover.attempts, 'RADE Role-Takeover'),
      dataExfiltration: formatASR(dataExfil.successes, dataExfil.attempts, 'RADE Data-Exfiltration'),
      privilegeEscalation: formatASR(privEsc.successes, privEsc.attempts, 'RADE Privilege-Escalation'),
    },
    escalationChain: formatASR(input.escalation.successes, input.escalation.attempts, 'Escalation Chain'),
  };
}

export function tagFindingWithTaxonomy<T extends { component: string }>(
  finding: T,
  taxonomyKey: string,
): T & { mcpSecBenchLabel: string } {
  return {
    ...finding,
    mcpSecBenchLabel: MCPSECBENCH_TAXONOMY[taxonomyKey] ?? 'Unknown',
  };
}
