import { LLMFactory } from '../llm';
import { LLMProvider } from '../llm/llm-interface';
import { AnthropicService } from '../llm/anthropic-service';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { Finding } from './types';

/**
 * One-shot LLM enrichment for an array of findings.
 *
 * Detection is rule-based — the LLM is NEVER asked whether something is wrong. It only
 * generates human-readable `description` and `remediation` text for findings the engine has
 * already identified. This keeps cost predictable and findings deterministic.
 *
 * Falls back gracefully: if the LLM is unavailable or returns malformed JSON, findings keep
 * their machine-generated `title` and get an empty description/remediation.
 */
export class SecurityFindingExplainer {
  async enrich(findings: Finding[]): Promise<Finding[]> {
    if (findings.length === 0) return findings;

    // Only Anthropic supports prompt caching at the moment — for Gemini we just skip enrichment
    // rather than spinning up an extra cost on a non-cached provider.
    if (config.LLM_PROVIDER !== 'anthropic') {
      logger.info('Skipping LLM finding enrichment (non-anthropic provider)', {
        provider: config.LLM_PROVIDER,
        findingCount: findings.length
      });
      return findings;
    }

    try {
      const service = LLMFactory.createSpecificProvider(LLMProvider.ANTHROPIC) as AnthropicService;

      // Compact payload — pass only what the model needs to write the explanation.
      const compact = findings.map(f => ({
        id: f.id,
        category: f.category,
        severity: f.severity,
        rule: f.rule,
        title: f.title,
        references: f.references ?? [],
        affected: f.affected.map(a => ({ type: a.type, name: a.name })),
        evidence: f.evidence
      }));

      const prompt = [
        'Du bekommst eine Liste von Keycloak-Security-Findings als JSON.',
        'Für jedes Finding generierst du genau zwei Felder auf Deutsch:',
        '- description: 1–2 Sätze, was das Risiko konkret bedeutet.',
        '- remediation: 1–2 Sätze, welche Aktion in der Keycloak-Admin-Konsole das Problem behebt.',
        'Antworte AUSSCHLIESSLICH mit JSON in dieser Form:',
        '{ "results": [{ "id": "...", "description": "...", "remediation": "..." }, ...] }',
        'Keine zusätzlichen Felder, keine Anführungszeichen außerhalb des JSONs, keine Severity-Änderungen.',
        '',
        'Findings:',
        JSON.stringify(compact)
      ].join('\n');

      const response = await service.chat({
        message: prompt,
        sessionId: `security-enrich-${Date.now()}`,
        options: { temperature: 0, maxTokens: Math.min(4096, 200 * findings.length + 200) }
      });

      const parsed = extractJsonObject(response.response);
      if (!parsed || !Array.isArray(parsed.results)) {
        logger.warn('LLM enrichment returned malformed JSON; keeping rule-based findings as-is', {
          findingCount: findings.length
        });
        return findings;
      }

      const byId = new Map<string, { description?: string; remediation?: string }>();
      for (const r of parsed.results) {
        if (r && typeof r.id === 'string') {
          byId.set(r.id, { description: r.description, remediation: r.remediation });
        }
      }

      return findings.map(f => {
        const extra = byId.get(f.id);
        return extra
          ? { ...f, description: extra.description ?? f.description, remediation: extra.remediation ?? f.remediation }
          : f;
      });
    } catch (error) {
      logger.warn('LLM enrichment failed; returning unenriched findings', {
        error: error instanceof Error ? error.message : String(error)
      });
      return findings;
    }
  }
}

function extractJsonObject(text: string): any | null {
  // The LLM may wrap output in ```json fences or surround with explanation; pull the first
  // balanced `{...}` block.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.substring(start, end + 1));
  } catch {
    return null;
  }
}
