import axios from 'axios';
import { logger } from '../utils/logger';
import { Neo4jMCPClient } from '../mcp';

/**
 * Lightweight realm-to-graph synchroniser. Polls the Keycloak Admin REST API
 * every `intervalMs` (default 60s) and MERGEs any changes into the graph.
 *
 * Intentionally narrow scope: only Users, Groups, Roles. Login-event history is
 * generated synthetically by the demo simulator. AdminEvents / IdPs / AuthFlows
 * stay frozen at seed-time (would require event-listener-SPI to keep current).
 *
 * Triggered automatically on boot when `REALM_SYNC_INTERVAL_MS` is set (>0),
 * and on-demand via `POST /api/security/sync`.
 */

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://keycloak:8080';
const KEYCLOAK_ADMIN = process.env.KEYCLOAK_ADMIN || 'admin';
const KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';
const DEMO_REALMS = ['corporate', 'customers', 'partners'];

interface SyncDelta {
  added: number;
  updated: number;
  removed: number;
  realms: string[];
  durationMs: number;
  errors: string[];
}

interface UserSnapshot {
  keycloakId: string;
  username: string;
  enabled: boolean;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
}

let tokenCache: { value: string; expiresAt: number } | null = null;

async function getAdminToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.value;
  const params = new URLSearchParams({
    client_id: 'admin-cli',
    username: KEYCLOAK_ADMIN,
    password: KEYCLOAK_ADMIN_PASSWORD,
    grant_type: 'password'
  });
  const res = await axios.post(
    `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 5000 }
  );
  const token: string = res.data.access_token;
  const ttl = (res.data.expires_in ?? 60) * 1000;
  tokenCache = { value: token, expiresAt: Date.now() + ttl - 5000 };
  return token;
}

export class RealmSyncWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private lastDelta: SyncDelta | null = null;
  private lastSyncedAt: string | null = null;

  constructor(private neo4j: Neo4jMCPClient) {}

  start(intervalMs: number): void {
    if (this.timer) return;
    logger.info('RealmSyncWorker starting', { intervalMs });
    // Kick off an immediate sync so the graph is fresh on boot, then schedule.
    this.syncNow().catch(err => logger.warn('Initial sync failed', { error: err?.message }));
    this.timer = setInterval(() => {
      this.syncNow().catch(err => logger.warn('Periodic sync failed', { error: err?.message }));
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getStatus(): { lastSyncedAt: string | null; lastDelta: SyncDelta | null; isRunning: boolean } {
    return {
      lastSyncedAt: this.lastSyncedAt,
      lastDelta: this.lastDelta,
      isRunning: this.running
    };
  }

  async syncNow(): Promise<SyncDelta> {
    if (this.running) {
      logger.debug('Sync already in progress, skipping concurrent invocation');
      return this.lastDelta ?? { added: 0, updated: 0, removed: 0, realms: [], durationMs: 0, errors: ['concurrent-skip'] };
    }
    this.running = true;
    const t0 = Date.now();
    const delta: SyncDelta = {
      added: 0,
      updated: 0,
      removed: 0,
      realms: [],
      durationMs: 0,
      errors: []
    };

    try {
      const token = await getAdminToken();
      const headers = { Authorization: `Bearer ${token}` };

      for (const realm of DEMO_REALMS) {
        try {
          await this.syncRealmUsers(realm, headers, delta);
          delta.realms.push(realm);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          delta.errors.push(`${realm}: ${msg}`);
          logger.warn('RealmSync: realm failed', { realm, error: msg });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      delta.errors.push(`auth: ${msg}`);
      logger.error('RealmSync: failed to obtain admin token', { error: msg });
    } finally {
      delta.durationMs = Date.now() - t0;
      this.lastDelta = delta;
      this.lastSyncedAt = new Date().toISOString();
      this.running = false;
      logger.info('RealmSync completed', delta);
    }
    return delta;
  }

  /**
   * Fetches users from Keycloak Admin REST and MERGEs them into the graph by
   * keycloakId. Compares against the existing graph snapshot to count added /
   * updated / removed. Idempotent — re-running over the same realm state is a no-op.
   */
  private async syncRealmUsers(
    realm: string,
    headers: Record<string, string>,
    delta: SyncDelta
  ): Promise<void> {
    const r = await axios.get(`${KEYCLOAK_URL}/admin/realms/${encodeURIComponent(realm)}/users`, {
      headers,
      params: { max: 500, briefRepresentation: false },
      timeout: 5000
    });
    const kcUsers: UserSnapshot[] = (Array.isArray(r.data) ? r.data : []).map((u: any) => ({
      keycloakId: u.id,
      username: u.username,
      enabled: !!u.enabled,
      email: u.email ?? '',
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
      emailVerified: !!u.emailVerified
    }));

    // Snapshot what's currently in the graph for this realm so we can compute add/update/remove.
    const graphSnapshot = await this.neo4j.callTool('read_neo4j_cypher', {
      query: `
        MATCH (u:User { realm: $realm })
        RETURN u.username AS username,
               u.keycloakId AS keycloakId,
               u.enabled AS enabled,
               u.email AS email,
               u.firstName AS firstName,
               u.lastName AS lastName,
               u.emailVerified AS emailVerified
      `,
      params: { realm }
    });
    const graphRows = (graphSnapshot.data as Array<any>) || [];
    const graphByUsername = new Map<string, any>();
    for (const row of graphRows) {
      if (row?.username) graphByUsername.set(row.username, row);
    }

    const kcUsernames = new Set(kcUsers.map(u => u.username));

    for (const u of kcUsers) {
      const existing = graphByUsername.get(u.username);
      const hasChanged = !existing
        || existing.enabled !== u.enabled
        || (existing.email ?? '') !== u.email
        || (existing.firstName ?? '') !== u.firstName
        || (existing.lastName ?? '') !== u.lastName
        || existing.emailVerified !== u.emailVerified
        || (existing.keycloakId ?? '') !== u.keycloakId;
      if (!hasChanged) continue;

      // MERGE keyed on (realm, username) since the stableId in the seeder also
      // uses these. New keycloak users get keycloakId backfilled here.
      await this.neo4j.callTool('write_neo4j_cypher', {
        query: `
          MERGE (u:User { realm: $realm, username: $username })
          ON CREATE SET
            u.id = $stableId,
            u.createdAt = datetime(),
            u.riskScore = 0
          SET u.keycloakId = $keycloakId,
              u.email = $email,
              u.firstName = $firstName,
              u.lastName = $lastName,
              u.enabled = $enabled,
              u.emailVerified = $emailVerified,
              u.lastSyncedAt = datetime()
          WITH u
          MATCH (r:Realm { name: $realm })
          MERGE (u)-[:BELONGS_TO]->(r)
        `,
        params: {
          realm,
          username: u.username,
          keycloakId: u.keycloakId,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          enabled: u.enabled,
          emailVerified: u.emailVerified,
          stableId: stableHash(`user|${realm}|${u.username}`)
        }
      });

      if (existing) delta.updated++;
      else delta.added++;
    }

    // Soft-remove: any user in graph but not in Keycloak. We mark them rather
    // than delete — keeps the demo story (a deleted-but-remembered user) but
    // visually distinguishes them.
    for (const [username] of graphByUsername.entries()) {
      if (!kcUsernames.has(username)) {
        await this.neo4j.callTool('write_neo4j_cypher', {
          query: `
            MATCH (u:User { realm: $realm, username: $username })
            SET u.enabled = false,
                u.removedFromKeycloak = true,
                u.lastSyncedAt = datetime()
          `,
          params: { realm, username }
        });
        delta.removed++;
      }
    }
  }
}

// Minimal sha-256 hash → 24 hex chars. Mirrors the seeder's stableId so freshly-
// synced users get the same node identifier as if they had been seeded from JSON.
function stableHash(input: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require('crypto');
  return createHash('sha256').update(input).digest('hex').substring(0, 24);
}

let workerInstance: RealmSyncWorker | null = null;
export function getRealmSyncWorker(neo4j: Neo4jMCPClient): RealmSyncWorker {
  if (!workerInstance) workerInstance = new RealmSyncWorker(neo4j);
  return workerInstance;
}
