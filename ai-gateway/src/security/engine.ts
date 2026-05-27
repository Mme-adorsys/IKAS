import { createHash, randomUUID } from 'crypto';
import { getKeycloakClient, getNeo4jClient } from '../mcp';
import { wsClient } from '../websocket';
import { logger } from '../utils/logger';
import { resolveChecks } from './registry';
import { SecurityFindingExplainer } from './llm-explainer';
import { SecurityFindingPersistence } from './persistence';
import { CheckCategory, Finding, Scan, ScanScope } from './types';
import { CheckContext } from './checks/check.interface';
import { lookupExplanation, substituteTemplate } from './static-explanations';

/**
 * Orchestrates a security scan end-to-end:
 *   1. Resolve checks from the registry.
 *   2. Run them in parallel (with concurrency cap) against the Keycloak MCP.
 *   3. Stamp ids + status + detectedAt onto raw findings.
 *   4. Single batched LLM call to fill description + remediation.
 *   5. Persist each finding into Neo4j.
 *   6. Emit COMPLIANCE_ALERT events on the WS bus so the dashboard updates live.
 *
 * Holds scans in an in-memory `Map<scanId, Scan>` for status polling. The scan object is
 * mutated as progress accumulates — the API route reads from the same map.
 */

const CONCURRENCY = 4;

export class SecurityEngine {
  private scans = new Map<string, Scan>();
  private explainer = new SecurityFindingExplainer();
  private persistence = new SecurityFindingPersistence(getNeo4jClient());

  startScan(realm: string, scope: ScanScope): Scan {
    const id = randomUUID();
    const checks = resolveChecks(scope);
    const scan: Scan = {
      id,
      realm,
      scope,
      state: 'pending',
      startedAt: new Date().toISOString(),
      progress: 0,
      totalChecks: checks.length,
      completedChecks: 0,
      findings: []
    };
    this.scans.set(id, scan);
    // Fire-and-forget; status is observable via getScan(id).
    void this.runScan(scan);
    return scan;
  }

  getScan(id: string): Scan | undefined {
    return this.scans.get(id);
  }

  listFindings(filters?: { category?: CheckCategory; realm?: string; status?: string }): Finding[] {
    // Dedupe by finding-id across all scans. Re-runs produce the same finding-id
    // (deterministic hash), so we keep the most-recent-detected version — that's
    // also the one carrying the current status (dismissed / resolved / open).
    const byId = new Map<string, Finding>();
    for (const scan of this.scans.values()) {
      for (const f of scan.findings) {
        const existing = byId.get(f.id);
        if (!existing) {
          byId.set(f.id, f);
          continue;
        }
        // Prefer the most-recently-detected entry, but never let `open` overwrite
        // an explicit dismissed/resolved (those are user actions, sticky).
        if (existing.status !== 'open' && f.status === 'open') continue;
        if (f.detectedAt.localeCompare(existing.detectedAt) >= 0) {
          byId.set(f.id, f);
        }
      }
    }
    return Array.from(byId.values())
      .filter(f => !filters?.category || f.category === filters.category)
      .filter(f => !filters?.realm || f.realm === filters.realm)
      .filter(f => !filters?.status || f.status === filters.status)
      .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
  }

  dismissFinding(id: string): Finding | null {
    // Update every copy of this finding across scans so the dedup keeps the
    // dismissed status sticky on rerender. Without this, a fresh scan would
    // re-add an `open` copy that the dedup might surface above the dismissed one.
    let last: Finding | null = null;
    for (const scan of this.scans.values()) {
      for (const f of scan.findings) {
        if (f.id === id) {
          f.status = 'dismissed';
          last = f;
        }
      }
    }
    return last;
  }

  /**
   * Mark a finding as resolved (used by apply-fix). Different from dismiss — the user
   * has actually performed a remediation rather than choosing to ignore it.
   */
  resolveFinding(id: string): Finding | null {
    // Same fix as dismissFinding: update every copy so re-scans don't resurrect.
    let last: Finding | null = null;
    for (const scan of this.scans.values()) {
      for (const f of scan.findings) {
        if (f.id === id) {
          f.status = 'resolved';
          last = f;
        }
      }
    }
    return last;
  }

  /**
   * Wipes the in-memory scan history + enrichment cache. Used by the demo-reset
   * endpoint after the graph has been wiped + reseeded — old finding IDs would
   * point at no-longer-existing graph state.
   */
  resetScans(): void {
    this.scans.clear();
    this.enrichmentCache.clear();
  }

  /**
   * Look up a finding across all scans by id. Used by the on-demand AI enrichment endpoint.
   */
  findFinding(id: string): Finding | null {
    for (const scan of this.scans.values()) {
      const f = scan.findings.find(x => x.id === id);
      if (f) return f;
    }
    return null;
  }

  /**
   * Lazily enrich a single finding via the LLM and cache the result. Cache key includes a
   * hash of the evidence so the same rule on different evidence gets distinct enrichments.
   * Subsequent calls for the same finding return instantly from cache.
   */
  private enrichmentCache = new Map<string, { description: string; remediation: string }>();

  async enrichFindingOnDemand(id: string): Promise<Finding | null> {
    const finding = this.findFinding(id);
    if (!finding) return null;
    const cacheKey = `${finding.rule}|${createHash('sha256').update(JSON.stringify(finding.evidence || {})).digest('hex').substring(0, 16)}`;
    const cached = this.enrichmentCache.get(cacheKey);
    if (cached) {
      finding.description = cached.description;
      finding.remediation = cached.remediation;
      return finding;
    }
    const [enriched] = await this.explainer.enrich([finding]);
    if (enriched) {
      this.enrichmentCache.set(cacheKey, {
        description: enriched.description,
        remediation: enriched.remediation ?? ''
      });
      finding.description = enriched.description;
      finding.remediation = enriched.remediation;
    }
    return finding;
  }

  /**
   * Apply the static-explanations lookup to a finding. Fills description + remediation
   * from the template table, substituting `${evidence.foo}` placeholders.
   */
  private applyStaticExplanation(f: Finding): Finding {
    if (f.description && f.remediation) return f;                  // already has both
    const tpl = lookupExplanation(f.rule);
    if (!tpl) return f;
    return {
      ...f,
      description: f.description || substituteTemplate(tpl.description, f.evidence),
      remediation: f.remediation || substituteTemplate(tpl.remediation, f.evidence)
    };
  }

  private async runScan(scan: Scan): Promise<void> {
    const checks = resolveChecks(scan.scope);
    scan.state = 'running';
    void wsClient.sendAnalysisProgress(scan.id, scan.id, 0, 'Sicherheitsscan gestartet');

    const ctx: CheckContext = {
      realm: scan.realm,
      keycloak: getKeycloakClient(),
      neo4j: getNeo4jClient()
    };

    const queue = [...checks];
    const workers: Promise<void>[] = [];
    for (let i = 0; i < CONCURRENCY; i++) {
      workers.push((async () => {
        while (queue.length > 0) {
          const check = queue.shift();
          if (!check) return;
          try {
            const rawFindings = await check.run(ctx);
            for (const raw of rawFindings) {
              const f = this.stampFinding(raw, scan.realm);
              scan.findings.push(f);
            }
          } catch (err) {
            logger.warn('Security check failed', {
              checkId: check.id,
              error: err instanceof Error ? err.message : String(err)
            });
          }
          scan.completedChecks++;
          scan.progress = Math.round((scan.completedChecks / scan.totalChecks) * 90); // leave 10% for enrichment + persist
          void wsClient.sendAnalysisProgress(scan.id, scan.id, scan.progress, `${scan.completedChecks}/${scan.totalChecks} Checks abgeschlossen`);
        }
      })());
    }
    await Promise.all(workers);

    // Always apply the static template lookup first — zero LLM cost. For findings whose rule
    // has a static template, this fills description + remediation immediately.
    scan.findings = scan.findings.map(f => this.applyStaticExplanation(f));

    // Optional LLM batch enrichment for findings still missing a description (only when the
    // operator opts in via SECURITY_ENRICHMENT_MODE=batch).
    const mode = (process.env.SECURITY_ENRICHMENT_MODE || 'static').toLowerCase();
    if (mode === 'batch') {
      try {
        const toEnrich = scan.findings.filter(f => !f.description);
        if (toEnrich.length > 0) {
          const enriched = await this.explainer.enrich(toEnrich);
          const map = new Map(enriched.map(f => [f.id, f]));
          scan.findings = scan.findings.map(f => map.get(f.id) ?? f);
        }
      } catch (err) {
        logger.warn('Explainer step failed', { error: err instanceof Error ? err.message : String(err) });
      }
    }

    for (const f of scan.findings) {
      await this.persistence.save(f);
      void this.publishFindingEvent(f);
    }

    scan.progress = 100;
    scan.state = 'completed';
    scan.finishedAt = new Date().toISOString();
    void wsClient.sendAnalysisComplete(scan.id, scan.id, {
      findingsCount: scan.findings.length,
      durationMs: Date.parse(scan.finishedAt) - Date.parse(scan.startedAt)
    });
    logger.info('Security scan completed', {
      scanId: scan.id,
      realm: scan.realm,
      scope: scan.scope,
      findings: scan.findings.length
    });
  }

  /**
   * Stamp engine-owned fields on a raw finding. The id is stable across re-runs of the same
   * check for the same realm + affected entity, so persistence MERGEs cleanly.
   */
  private stampFinding(raw: any, realm: string): Finding {
    const affectedKey = (raw.affected || []).map((a: any) => `${a.type}:${a.id}`).join(',');
    const idSource = `${raw.checkId}|${realm}|${affectedKey}|${raw.rule}`;
    const id = createHash('sha256').update(idSource).digest('hex').substring(0, 24);
    // Sticky status: if an earlier scan saw this finding-id and the user has
    // dismissed/resolved it, the new scan inherits that status. Otherwise a TTL
    // re-scan would resurrect dismissed/resolved findings as "open" copies.
    let priorStatus: 'open' | 'dismissed' | 'resolved' = 'open';
    for (const scan of this.scans.values()) {
      for (const f of scan.findings) {
        if (f.id === id && (f.status === 'dismissed' || f.status === 'resolved')) {
          priorStatus = f.status;
        }
      }
    }
    return {
      id,
      checkId: raw.checkId,
      category: raw.category,
      severity: raw.severity,
      realm,
      rule: raw.rule,
      title: raw.title,
      description: raw.description ?? '',
      remediation: raw.remediation,
      references: raw.references,
      affected: raw.affected,
      evidence: raw.evidence,
      detectedAt: new Date().toISOString(),
      status: priorStatus
    };
  }

  /**
   * Publishes a `compliance:alert` event on the WS bus. The frontend store already handles
   * this event type and appends to `data.complianceIssues` — we reuse that wiring instead
   * of inventing a new event channel.
   */
  private async publishFindingEvent(f: Finding): Promise<void> {
    try {
      await wsClient.sendDataUpdate(f.id, 'complianceIssue', {
        id: f.id,
        severity: f.severity,
        rule: f.rule,
        description: f.description || f.title,
        affected: f.affected.map(a => ({ type: a.type, id: a.id, name: a.name })),
        timestamp: f.detectedAt,
        category: f.category,
        references: f.references,
        remediation: f.remediation
      });
    } catch (err) {
      logger.debug('Failed to publish finding event', { findingId: f.id });
    }
  }
}

let engineInstance: SecurityEngine | null = null;

export function getSecurityEngine(): SecurityEngine {
  if (!engineInstance) {
    engineInstance = new SecurityEngine();
  }
  return engineInstance;
}
