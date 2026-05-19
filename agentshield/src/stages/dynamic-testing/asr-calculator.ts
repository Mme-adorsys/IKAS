export const MCPSECBENCH_TAXONOMY: Record<string, string> = {
  'tool-shadowing': 'Tool Shadowing Attack',
  'rade': 'Indirect Prompt Injection',
  'rade-role-takeover': 'Indirect Prompt Injection',
  'rade-data-exfiltration': 'Data Exfiltration',
  'rade-privilege-escalation': 'Tool/Service Misuse via Confused AI',
  'escalation': 'Tool/Service Misuse via Confused AI',
};

/**
 * Format an Attack Success Rate string. `attempts` here is the number of *evaluated*
 * attempts (i.e. the gateway responded with a real model answer). Attempts that ended
 * in transport/orchestrator errors are tracked separately via `indeterminate` and must
 * NOT be folded into this denominator.
 */
export function formatASR(successes: number, attempts: number, label: string): string {
  const pct = attempts > 0 ? Math.round((successes / attempts) * 100) : 0;
  return `${label} ASR: ${pct}% (${successes}/${attempts} attempts succeeded)`;
}

/**
 * Append an indeterminate-count suffix when one or more attempts could not be evaluated.
 * Kept as a separate helper so callers that don't track indeterminate counts (legacy
 * call sites, tests) keep using `formatASR` unchanged.
 */
export function formatASRWithIndeterminate(
  successes: number,
  attempts: number,
  indeterminate: number,
  label: string,
): string {
  const base = formatASR(successes, attempts, label);
  return indeterminate > 0 ? `${base} [${indeterminate} indeterminate excluded]` : base;
}

export interface ASRMetadata {
  toolShadowing: string;
  rade: {
    roleTakeover: string;
    dataExfiltration: string;
    privilegeEscalation: string;
  };
  escalationChain: string;
  indeterminate: {
    toolShadowing: number;
    rade: {
      roleTakeover: number;
      dataExfiltration: number;
      privilegeEscalation: number;
    };
    escalationChain: number;
    total: number;
  };
}

export interface ASRInput {
  toolShadowing: { successes: number; attempts: number; indeterminate?: number };
  radePerPayload: Array<{ payloadId: string; successes: number; attempts: number; indeterminate?: number }>;
  escalation: { successes: number; attempts: number; indeterminate?: number };
}

function findPayload(
  perPayload: Array<{ payloadId: string; successes: number; attempts: number; indeterminate?: number }>,
  id: string,
): { successes: number; attempts: number; indeterminate: number } {
  const match = perPayload.find((p) => p.payloadId === id);
  if (!match) return { successes: 0, attempts: 0, indeterminate: 0 };
  return {
    successes: match.successes,
    attempts: match.attempts,
    indeterminate: match.indeterminate ?? 0,
  };
}

export function buildASRMetadata(input: ASRInput): ASRMetadata {
  const roleTakeover = findPayload(input.radePerPayload, 'role-takeover');
  const dataExfil = findPayload(input.radePerPayload, 'data-exfiltration-redirect');
  const privEsc = findPayload(input.radePerPayload, 'privilege-escalation-command');

  const shadowIndeterminate = input.toolShadowing.indeterminate ?? 0;
  const escalationIndeterminate = input.escalation.indeterminate ?? 0;
  const totalIndeterminate =
    shadowIndeterminate +
    roleTakeover.indeterminate +
    dataExfil.indeterminate +
    privEsc.indeterminate +
    escalationIndeterminate;

  return {
    toolShadowing: formatASRWithIndeterminate(
      input.toolShadowing.successes,
      input.toolShadowing.attempts,
      shadowIndeterminate,
      'Tool Shadowing',
    ),
    rade: {
      roleTakeover: formatASRWithIndeterminate(
        roleTakeover.successes,
        roleTakeover.attempts,
        roleTakeover.indeterminate,
        'RADE Role-Takeover',
      ),
      dataExfiltration: formatASRWithIndeterminate(
        dataExfil.successes,
        dataExfil.attempts,
        dataExfil.indeterminate,
        'RADE Data-Exfiltration',
      ),
      privilegeEscalation: formatASRWithIndeterminate(
        privEsc.successes,
        privEsc.attempts,
        privEsc.indeterminate,
        'RADE Privilege-Escalation',
      ),
    },
    escalationChain: formatASRWithIndeterminate(
      input.escalation.successes,
      input.escalation.attempts,
      escalationIndeterminate,
      'Escalation Chain',
    ),
    indeterminate: {
      toolShadowing: shadowIndeterminate,
      rade: {
        roleTakeover: roleTakeover.indeterminate,
        dataExfiltration: dataExfil.indeterminate,
        privilegeEscalation: privEsc.indeterminate,
      },
      escalationChain: escalationIndeterminate,
      total: totalIndeterminate,
    },
  };
}
