import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { getSecurityEngine } from '../security';
import { CheckCategory, ScanScope } from '../security/types';
import { getNeo4jClient } from '../mcp';
import { getGraphSeeder } from '../security/graph-seeder';
import { getRealmSyncWorker } from '../security/realm-sync';
import { applyAutoFix, hasAutoFix } from '../security/auto-fix';
import { getDemoSimulator, Scenario } from '../security/demo-simulator';
import { LIVE_EVENTS_QUERY, IDENTITY_GRAPH_QUERY, ADMIN_EVENTS_FOR_USER_QUERY } from '../security/graph-queries';

const securityRouter = Router();

const scanSchema = z.object({
  realm: z.string().min(1),
  scope: z.enum(['all', 'config', 'fraud', 'owasp', 'compliance']).default('all')
});

const findingFiltersSchema = z.object({
  category: z.enum(['config', 'fraud', 'owasp', 'compliance']).optional(),
  realm: z.string().optional(),
  status: z.enum(['open', 'dismissed', 'resolved']).optional()
});

securityRouter.post('/scan', async (req, res): Promise<any> => {
  try {
    const { realm, scope } = scanSchema.parse(req.body);
    const scan = getSecurityEngine().startScan(realm, scope as ScanScope);
    logger.info('Security scan kicked off', { scanId: scan.id, realm, scope });
    res.status(202).json({
      scanId: scan.id,
      state: scan.state,
      totalChecks: scan.totalChecks,
      startedAt: scan.startedAt
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: err.errors });
    }
    logger.error('Failed to start security scan', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

securityRouter.get('/scan/:id', (req, res): any => {
  const scan = getSecurityEngine().getScan(req.params.id);
  if (!scan) return res.status(404).json({ error: 'Scan not found' });
  res.json(scan);
});

securityRouter.get('/findings', (req, res): any => {
  try {
    const filters = findingFiltersSchema.parse({
      category: req.query.category,
      realm: req.query.realm,
      status: req.query.status
    });
    const findings = getSecurityEngine().listFindings(filters as { category?: CheckCategory; realm?: string; status?: string });
    res.json({ findings, total: findings.length });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid filters', details: err.errors });
    }
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

securityRouter.get('/findings/:id', (req, res): any => {
  const finding = getSecurityEngine().listFindings().find(f => f.id === req.params.id);
  if (!finding) return res.status(404).json({ error: 'Finding not found' });
  res.json(finding);
});

securityRouter.post('/findings/:id/dismiss', (req, res): any => {
  const finding = getSecurityEngine().dismissFinding(req.params.id);
  if (!finding) return res.status(404).json({ error: 'Finding not found' });
  res.json(finding);
});

/**
 * Applies a rule-specific auto-fix to the demo graph (no Keycloak modifications).
 * Marks the finding as resolved. The "Demo zurücksetzen" endpoint restores everything.
 */
securityRouter.post('/findings/:id/apply-fix', async (req, res): Promise<any> => {
  try {
    const engine = getSecurityEngine();
    const finding = engine.findFinding(req.params.id);
    if (!finding) return res.status(404).json({ error: 'Finding not found' });
    if (!hasAutoFix(finding.rule)) {
      return res.status(422).json({
        error: 'No auto-fix available',
        rule: finding.rule,
        message: 'Diese Regel hat keinen automatischen Fix — manuell in Keycloak beheben.'
      });
    }
    const fix = await applyAutoFix(finding, getNeo4jClient());
    if (fix) engine.resolveFinding(finding.id);
    res.json({ finding: engine.findFinding(req.params.id), fix });
  } catch (err) {
    logger.error('Auto-fix failed', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

securityRouter.get('/auto-fix/availability', (_req, res): any => {
  // Tells the frontend which rules have an auto-fix handler so the UI can show
  // the "Auto-Fix" button only when it'd do something useful.
  const rules = ['USER_GOD_MODE', 'ORPHAN_ROLE', 'REDUNDANT_GROUP', 'STALE_ACCOUNT', 'UNUSED_IDP', 'WEAK_AUTH_FLOW'];
  res.json({ rules });
});

/**
 * Wipes the demo graph entirely and re-seeds from the realm-import JSON +
 * graph-seeder synthetic data. Restores every finding the demo was designed
 * around — useful for replaying the demo after experimenting with auto-fixes.
 */
securityRouter.post('/reset', async (_req, res): Promise<any> => {
  const t0 = Date.now();
  try {
    const neo4j = getNeo4jClient();
    // Wipe every node we own. Demo-realm constraints mean this is safe — production
    // would protect non-demo realms with a WHERE clause.
    await neo4j.callTool('write_neo4j_cypher', {
      query: `MATCH (n) DETACH DELETE n`,
      params: {}
    });
    const summary = await getGraphSeeder(neo4j).seedAll();
    getSecurityEngine().resetScans();
    logger.info('Demo reset completed', { durationMs: Date.now() - t0 });
    res.json({ ok: true, summary, durationMs: Date.now() - t0 });
  } catch (err) {
    logger.error('Demo reset failed', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * On-demand AI enrichment for one finding. First call hits the LLM, subsequent calls for the
 * same (rule + evidence-hash) return the cached enrichment.
 */
securityRouter.post('/findings/:id/enrich', async (req, res): Promise<any> => {
  try {
    const finding = await getSecurityEngine().enrichFindingOnDemand(req.params.id);
    if (!finding) return res.status(404).json({ error: 'Finding not found' });
    res.json(finding);
  } catch (err) {
    logger.error('Finding enrichment failed', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * Triggers a one-shot realm-to-graph sync. Returns the delta (added / updated /
 * removed user counts). Idempotent — calling repeatedly is a no-op when nothing
 * has changed. The periodic poller invokes the same code path.
 */
securityRouter.post('/sync', async (_req, res): Promise<any> => {
  try {
    const delta = await getRealmSyncWorker(getNeo4jClient()).syncNow();
    res.json(delta);
  } catch (err) {
    logger.error('Realm sync failed', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

securityRouter.get('/sync/status', (_req, res): any => {
  const status = getRealmSyncWorker(getNeo4jClient()).getStatus();
  res.json(status);
});

/**
 * Bulk-populates the Neo4j demo graph (realms, users, clients, groups, roles, IPs/geos,
 * 72h synthetic event history with embedded attack patterns). Idempotent via MERGE.
 */
securityRouter.post('/seed-graph', async (_req, res): Promise<any> => {
  try {
    const summary = await getGraphSeeder(getNeo4jClient()).seedAll();
    res.json({ ok: true, summary });
  } catch (err) {
    logger.error('Graph seeding failed', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * Recent login events with IP + geo, for the WorldLoginMap initial load. The WS broadcast
 * (demo-simulator) provides live deltas after this.
 */
const liveEventsQuerySchema = z.object({
  since: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional()
});

securityRouter.get('/live-events', async (req, res): Promise<any> => {
  try {
    const { since, limit } = liveEventsQuerySchema.parse({ since: req.query.since, limit: req.query.limit });
    const sinceIso = since ?? new Date(Date.now() - 24 * 3600_000).toISOString();
    const result = await getNeo4jClient().callTool('read_neo4j_cypher', {
      query: LIVE_EVENTS_QUERY,
      params: { since: sinceIso, limit: limit ?? 500 }
    });
    res.json({ events: result.data ?? [], since: sinceIso });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid query', details: err.errors });
    logger.error('Live events query failed', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * Projects a small subgraph (users + clients + groups around one realm) for the IdentityGraph
 * D3 force layout. Includes affected-by-finding pointers so the viz can highlight risk.
 */
const graphQuerySchema = z.object({
  realm: z.string().min(1),
  maxNodes: z.coerce.number().int().min(5).max(200).optional()
});

securityRouter.get('/graph', async (req, res): Promise<any> => {
  try {
    const { realm, maxNodes } = graphQuerySchema.parse({ realm: req.query.realm, maxNodes: req.query.maxNodes });
    const result = await getNeo4jClient().callTool('read_neo4j_cypher', {
      query: IDENTITY_GRAPH_QUERY,
      params: { realm, maxNodes: maxNodes ?? 50 }
    });
    res.json({ realm, data: result.data ?? [] });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid query', details: err.errors });
    logger.error('Identity graph query failed', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

const scenarioSchema = z.object({
  scenario: z.enum(['brute-force', 'stuffing', 'impossible-travel', 'calm', 'mixed'])
});

// Privilege-lifecycle: synthetic admin events for a single user, for the timeline section
// inside the UserDetailModal. Falls back to empty array on any error.
const adminEventsQuerySchema = z.object({
  userId: z.string().min(1)
});

securityRouter.get('/admin-events', async (req, res): Promise<any> => {
  try {
    const { userId } = adminEventsQuerySchema.parse({ userId: req.query.userId });
    const result = await getNeo4jClient().callTool('read_neo4j_cypher', {
      query: ADMIN_EVENTS_FOR_USER_QUERY,
      params: { userId }
    });
    res.json({ events: result.data ?? [] });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid query', details: err.errors });
    logger.error('Admin events query failed', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

securityRouter.post('/demo/scenario', async (req, res): Promise<any> => {
  try {
    const { scenario } = scenarioSchema.parse(req.body);
    await getDemoSimulator(getNeo4jClient()).triggerScenario(scenario as Scenario);
    res.json({ ok: true, scenario });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request', details: err.errors });
    logger.error('Scenario trigger failed', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

export { securityRouter };
