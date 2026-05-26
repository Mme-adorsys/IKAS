import { randomUUID } from 'crypto';
import { Neo4jMCPClient } from '../mcp';
import { wsClient } from '../websocket';
import { logger } from '../utils/logger';
import { IP_GEO_TABLE, IpRecord, pickRandomIp } from './ip-geo-table';

/**
 * Background generator that keeps the demo dashboard alive. Two independent loops:
 *
 *  - Heartbeat (~6 s): inserts one realistic LoginEvent and broadcasts it via WS so the
 *    LiveActivityTicker and WorldLoginMap update immediately without polling Neo4j.
 *
 *  - Incident (~45 s, randomised): triggers a scripted incident — brute-force burst,
 *    credential-stuffing wave, or impossible-travel pair — to spike the threat gauge and
 *    populate the ticker with red entries.
 *
 * Manual scenario triggers (`triggerScenario(name)`) let the presenter drive the narrative
 * arc on stage. Calm mode pauses incidents; brute-force / stuffing / impossible-travel fire
 * one matching incident immediately.
 */

const HEARTBEAT_MS = 6000;
const INCIDENT_MS = 45000;

export type Scenario = 'brute-force' | 'stuffing' | 'impossible-travel' | 'calm' | 'mixed';

interface LiveLoginPayload {
  id: string;
  time: string;
  type: 'LOGIN' | 'LOGIN_ERROR';
  success: boolean;
  username: string | null;
  userId: string | null;
  ip: string;
  ipClassification: string;
  country: string;
  city: string;
  lat: number;
  lon: number;
  realm: string;
  userAgent: string;
}

interface DemoUserHandle {
  id: string;
  username: string;
  realm: string;
}

export class DemoSimulator {
  private heartbeatTimer?: NodeJS.Timeout;
  private incidentTimer?: NodeJS.Timeout;
  private users: DemoUserHandle[] = [];
  private currentScenario: Scenario = 'mixed';
  private warned = false;

  constructor(private neo4j: Neo4jMCPClient) {}

  async start(): Promise<void> {
    await this.refreshUsers();
    if (this.users.length === 0) {
      if (!this.warned) {
        logger.warn('DemoSimulator started but no Users exist in the graph yet — heartbeat will retry');
        this.warned = true;
      }
    }
    this.heartbeatTimer = setInterval(() => void this.heartbeat(), HEARTBEAT_MS);
    this.incidentTimer = setInterval(() => void this.tickIncident(), INCIDENT_MS);
    logger.info('DemoSimulator started', { heartbeatMs: HEARTBEAT_MS, incidentMs: INCIDENT_MS });
  }

  stop(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.incidentTimer) clearInterval(this.incidentTimer);
    this.heartbeatTimer = undefined;
    this.incidentTimer = undefined;
    logger.info('DemoSimulator stopped');
  }

  setScenario(scenario: Scenario): void {
    this.currentScenario = scenario;
    logger.info('DemoSimulator scenario changed', { scenario });
  }

  async triggerScenario(scenario: Scenario): Promise<void> {
    this.setScenario(scenario);
    if (scenario === 'calm') return;
    if (scenario === 'brute-force') await this.incidentBruteForce();
    else if (scenario === 'stuffing') await this.incidentCredentialStuffing();
    else if (scenario === 'impossible-travel') await this.incidentImpossibleTravel();
    else if (scenario === 'mixed') await this.tickIncident();
  }

  // ─── Heartbeat: one benign event every ~6s ──────────────────────────────

  private async heartbeat(): Promise<void> {
    if (this.users.length === 0) {
      await this.refreshUsers();
      if (this.users.length === 0) return;
    }
    const user = this.users[Math.floor(Math.random() * this.users.length)];
    const success = Math.random() > 0.1;
    const ip = pickRandomIp({ classification: 'normal' });
    await this.emitEvent(user, ip, success ? 'LOGIN' : 'LOGIN_ERROR', 'Mozilla/5.0 (X11; Linux x86_64) Chrome/132.0');
  }

  // ─── Incidents (one per tick, picked randomly unless overridden) ────────

  private async tickIncident(): Promise<void> {
    if (this.currentScenario === 'calm') return;
    const choices: Scenario[] = ['brute-force', 'stuffing', 'impossible-travel'];
    const pick = this.currentScenario === 'mixed'
      ? choices[Math.floor(Math.random() * choices.length)]
      : this.currentScenario;
    try {
      if (pick === 'brute-force') await this.incidentBruteForce();
      else if (pick === 'stuffing') await this.incidentCredentialStuffing();
      else if (pick === 'impossible-travel') await this.incidentImpossibleTravel();
    } catch (err) {
      logger.warn('Incident failed', { scenario: pick, error: err instanceof Error ? err.message : String(err) });
    }
  }

  private async incidentBruteForce(): Promise<void> {
    if (this.users.length === 0) await this.refreshUsers();
    if (this.users.length === 0) return;
    const target = this.users[Math.floor(Math.random() * this.users.length)];
    const ip = pickRandomIp({ classification: Math.random() > 0.5 ? 'known-bad' : 'tor' });
    const burst = 8 + Math.floor(Math.random() * 7);
    for (let i = 0; i < burst; i++) {
      await this.emitEvent(target, ip, 'LOGIN_ERROR', 'curl/7.88.1');
      await new Promise(r => setTimeout(r, 250));
    }
  }

  private async incidentCredentialStuffing(): Promise<void> {
    if (this.users.length === 0) await this.refreshUsers();
    if (this.users.length < 5) return;
    const ip = pickRandomIp({ classification: 'datacenter' });
    const victims = [...this.users].sort(() => Math.random() - 0.5).slice(0, 6);
    for (const v of victims) {
      await this.emitEvent(v, ip, 'LOGIN_ERROR', 'Mozilla/5.0 (compatible; auth-checker/1.0)');
      await new Promise(r => setTimeout(r, 200));
    }
  }

  private async incidentImpossibleTravel(): Promise<void> {
    if (this.users.length === 0) await this.refreshUsers();
    if (this.users.length === 0) return;
    const target = this.users[Math.floor(Math.random() * this.users.length)];
    // Pick two far-apart IPs from the table
    const a = IP_GEO_TABLE.find(ip => ip.geo.country === 'DE') ?? IP_GEO_TABLE[0];
    const b = IP_GEO_TABLE.find(ip => ip.geo.country === 'BR' || ip.geo.country === 'AU') ?? IP_GEO_TABLE[IP_GEO_TABLE.length - 1];
    await this.emitEvent(target, a, 'LOGIN', 'Mozilla/5.0 (Macintosh) Safari/17.0');
    await new Promise(r => setTimeout(r, 800));
    await this.emitEvent(target, b, 'LOGIN', 'Mozilla/5.0 (Windows NT 10.0) Firefox/123.0');
  }

  // ─── Event emit: write to Neo4j + broadcast over WS ────────────────────

  private async emitEvent(
    user: DemoUserHandle,
    ip: IpRecord,
    type: 'LOGIN' | 'LOGIN_ERROR',
    userAgent: string
  ): Promise<void> {
    const id = randomUUID();
    const time = new Date().toISOString();
    const success = type === 'LOGIN';

    // Persist to Neo4j so subsequent scans + initial page-loads see the event.
    try {
      await this.neo4j.callTool('write_neo4j_cypher', {
        query: `
          MATCH (u:User { id: $userId })
          MATCH (ip:IpAddress { address: $ip })
          CREATE (e:LoginEvent {
            id: $id,
            time: datetime($time),
            type: $type,
            success: $success,
            userAgent: $userAgent
          })
          MERGE (e)-[:FOR_USER]->(u)
          MERGE (e)-[:FROM_IP]->(ip)
        `,
        params: { id, time, type, success, userId: user.id, ip: ip.address, userAgent }
      });
    } catch (err) {
      // Persistence is best-effort during the demo; never crash the simulator.
      logger.debug('Failed to persist simulated event', { error: err instanceof Error ? err.message : String(err) });
    }

    // Broadcast a `data:update` event so the LiveActivityTicker + WorldLoginMap update
    // without re-querying Neo4j on every tick.
    const payload: LiveLoginPayload = {
      id,
      time,
      type,
      success,
      username: user.username,
      userId: user.id,
      ip: ip.address,
      ipClassification: ip.classification,
      country: ip.geo.country,
      city: ip.geo.city,
      lat: ip.geo.lat,
      lon: ip.geo.lon,
      realm: user.realm,
      userAgent
    };
    try {
      await wsClient.sendDataUpdate(`live-${user.realm}`, 'liveLogin', payload);
    } catch {
      // WS broadcast is best-effort.
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private async refreshUsers(): Promise<void> {
    try {
      const res = await this.neo4j.callTool('read_neo4j_cypher', {
        query: `
          MATCH (u:User)-[:BELONGS_TO]->(r:Realm)
          WHERE u.enabled = true
          RETURN u.id AS id, u.username AS username, r.name AS realm
          LIMIT 200
        `,
        params: {}
      });
      const rows = (res.data as any[]) || [];
      this.users = rows.map(r => ({ id: r.id, username: r.username, realm: r.realm }));
    } catch (err) {
      logger.debug('Failed to refresh user list', { error: err instanceof Error ? err.message : String(err) });
    }
  }
}

let simulatorInstance: DemoSimulator | null = null;
export function getDemoSimulator(neo4j: Neo4jMCPClient): DemoSimulator {
  if (!simulatorInstance) simulatorInstance = new DemoSimulator(neo4j);
  return simulatorInstance;
}
