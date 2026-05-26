import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { Neo4jMCPClient } from '../mcp';
import { logger } from '../utils/logger';
import { ensureSchema } from './graph-queries';
import { IP_GEO_TABLE, IpRecord, pickRandomIp } from './ip-geo-table';

/**
 * Bulk-populates Neo4j with the IKAS demo knowledge graph.
 *
 * Sources:
 *  - docker/keycloak-realm-demo.json (entity structure)
 *  - synthetic ~72h login event history (~500 events, mostly benign)
 *  - embedded attack patterns: 2 brute-force targets, 1 credential-stuffing burst,
 *    1 impossible-travel pair.
 *
 * MERGE-based so re-running on a hot container is idempotent.
 */

interface SeedSummary {
  realms: number;
  users: number;
  groups: number;
  roles: number;
  clients: number;
  ipAddresses: number;
  geoLocations: number;
  loginEvents: number;
  memberships: number;
  roleGrants: number;
  adminEvents: number;
  groupHierarchyEdges: number;
  compositeRoleEdges: number;
  identityProviders: number;
  authFlows: number;
  durationMs: number;
}

// ── Privilege demo configuration ─────────────────────────────────────────────
// Synthetic memberships injected on top of the realm-import JSON so the
// privilege-audit checks (god-mode, redundant-group, etc.) have something to
// chew on. Keycloak's JSON omits group/role mappings; we patch them here.

const EXTRA_CORPORATE_GROUPS = ['ShadowAdmins', 'LegacyAdmins'];
const EXTRA_CORPORATE_ROLES = ['ReportsOnly']; // orphan role (no users, no groups)

const GROUP_ROLE_GRANTS: Record<string, string[]> = {
  // Realm-JSON groups (these need explicit role mappings)
  Admins:         ['realm-admin', 'developer', 'support-agent', 'finance-reader'],
  Engineering:    ['developer'],
  Support:        ['support-agent'],
  Finance:        ['finance-reader'],
  // Demo-only groups (created on top of the JSON)
  ShadowAdmins:   ['realm-admin', 'developer', 'support-agent', 'finance-reader'], // identical to Admins → REDUNDANT
  LegacyAdmins:   ['realm-admin', 'developer'] // partial overlap with Admins
};

// User → groups (corporate realm). Distribution chosen so demo checks fire on known users:
//   admin2  in Admins + ShadowAdmins  → god mode candidate
//   j.weber in Engineering + Support   → excessive privilege
//   h.kruger/d.lange/f.schneider in ShadowAdmins → redundant-group payload
//   demo-old in nothing                → orphan user
const USER_GROUP_MEMBERSHIPS: Record<string, string[]> = {
  admin2:       ['Admins', 'ShadowAdmins'],
  'j.weber':    ['Engineering', 'Support'],
  'h.kruger':   ['Engineering', 'ShadowAdmins'],
  'd.lange':    ['ShadowAdmins', 'LegacyAdmins'],
  'f.schneider':['ShadowAdmins'],
  'm.schulz':   ['Engineering'],
  'p.huber':    ['Engineering'],
  'n.meyer':    ['Support'],
  't.schmidt':  ['Support'],
  'e.becker':   ['Support', 'Finance'],
  'k.wagner':   ['Finance'],
  'j.richter':  ['Finance'],
  's.bauer':    ['Engineering'],
  'l.koch':     ['Engineering'],
  'a.fischer':  ['Engineering'],
  'i.zimmermann':['Support'],
  'r.werner':   ['Engineering']
  // demo-old + test deliberately omitted (orphan / direct-role anti-pattern)
};

// Direct user → role grants (bypassing groups — classic anti-pattern).
const USER_DIRECT_ROLES: Record<string, string[]> = {
  test:         ['realm-admin'],             // brand-new test account with admin — should ring alarm bells
  'r.werner':   ['realm-admin', 'developer'] // dual admin path (also member of Engineering)
};

const REALM_JSON_PATHS = [
  '/opt/keycloak/data/import/keycloak-realm-demo.json',   // inside docker
  path.resolve(process.cwd(), '../docker/keycloak-realm-demo.json'),
  path.resolve(__dirname, '../../../docker/keycloak-realm-demo.json'),
  path.resolve(__dirname, '../../../../docker/keycloak-realm-demo.json')
];

function loadRealmJson(): any[] {
  for (const p of REALM_JSON_PATHS) {
    try {
      if (fs.existsSync(p)) {
        logger.info('Loading realm-import JSON for graph seed', { path: p });
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
      }
    } catch {
      // continue
    }
  }
  logger.warn('No realm-import JSON found in expected locations — graph seed will be empty', {
    paths: REALM_JSON_PATHS
  });
  return [];
}

function stableId(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').substring(0, 24);
}

// ─── Synthetic user-attribute generators ─────────────────────────────────────
// Deterministic per username so reseeds don't shuffle timestamps. The bigger
// goal is to give the F2 checks (stale-account, weak-auth-flow) something
// recognisable to fire on during the demo.

function hashToFloat(seed: string): number {
  const h = createHash('sha256').update(seed).digest();
  // 32-bit unsigned → [0,1)
  return (h.readUInt32BE(0) % 1_000_000) / 1_000_000;
}

function synthCreatedAt(username: string): string {
  // Hard-coded ages for the special demo accounts so their lifecycle reads as a story.
  const special: Record<string, number> = {
    admin2:   90,
    test:     14,
    'demo-old': 540,           // >1 year — flagged as stale
    'r.werner': 120
  };
  const days = special[username] ?? (30 + hashToFloat(`age|${username}`) * 365);
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function synthLastLogin(username: string): string {
  // Two cohorts: most users logged in within last 7 days; "stale" demo users
  // haven't logged in for 90+ days (triggers stale-account checks).
  const staleUsers = new Set(['demo-old', 'test', 'h.kruger', 'f.schneider']);
  const days = staleUsers.has(username)
    ? 95 + hashToFloat(`stale|${username}`) * 60
    : hashToFloat(`active|${username}`) * 7;
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function synthAttributes(username: string): Record<string, string[]> {
  // Mirrors Keycloak's user.attributes shape: arrays of strings.
  const department = ((): string => {
    if (username.startsWith('admin')) return 'Security';
    if (username === 'test' || username === 'demo-old') return 'Unassigned';
    const buckets = ['Engineering', 'Support', 'Finance', 'Operations'];
    return buckets[Math.floor(hashToFloat(`dept|${username}`) * buckets.length)];
  })();
  return {
    department: [department],
    mfa_enrolled: [username.startsWith('admin') ? 'true' : (hashToFloat(`mfa|${username}`) > 0.4 ? 'true' : 'false')]
  };
}

// ─── Synthetic realm-semantic seeds (Group-Hierarchy / Composite-Roles /
//     IdP+AuthFlows) used by F2. Realm-JSON is intentionally minimal so we
//     inject these so the new checks fire deterministically. ─────────────────

const GROUP_PARENT_OF: Array<[string, string]> = [
  // [parent, child] — synthetic hierarchy that mirrors a typical org chart.
  ['Admins',       'ShadowAdmins'],   // Shadow-Admins inherit privileges → spotlight in graph
  ['Admins',       'LegacyAdmins'],
  ['Engineering',  'Support']         // Support reports into Engineering (slightly unusual but visible)
];

const COMPOSITE_ROLES: Array<{ parent: string; children: string[] }> = [
  // Classic Keycloak pattern: realm-admin transitively grants developer.
  { parent: 'realm-admin', children: ['developer', 'support-agent', 'finance-reader'] },
  { parent: 'developer',   children: ['finance-reader'] } // overly-broad composite
];

interface IdentityProviderSeed {
  alias: string;
  providerId: string;   // 'google' | 'github' | 'saml' | ...
  enabled: boolean;
  displayName: string;
  trustEmail: boolean;
  linkedUsers: string[]; // usernames known to be tied to this IdP — drives "unused IdP" check
}

const REALM_IDPS: Record<string, IdentityProviderSeed[]> = {
  corporate: [
    { alias: 'google',     providerId: 'google', enabled: true,  displayName: 'Google SSO',    trustEmail: true,  linkedUsers: ['j.weber', 'm.schulz'] },
    { alias: 'github',     providerId: 'github', enabled: true,  displayName: 'GitHub OAuth',  trustEmail: false, linkedUsers: ['a.fischer'] },
    { alias: 'legacy-saml',providerId: 'saml',   enabled: true,  displayName: 'Legacy SAML',   trustEmail: true,  linkedUsers: [] }     // unused → flagged
  ]
};

interface AuthFlowStep {
  authenticator: string;
  requirement: 'REQUIRED' | 'ALTERNATIVE' | 'CONDITIONAL' | 'DISABLED';
}

interface AuthFlowSeed {
  alias: string;
  description: string;
  topLevel: boolean;
  builtIn: boolean;
  steps: AuthFlowStep[];
}

const REALM_AUTH_FLOWS: Record<string, AuthFlowSeed[]> = {
  corporate: [
    {
      alias: 'browser',
      description: 'Standard Login mit MFA-Konditional',
      topLevel: true,
      builtIn: true,
      steps: [
        { authenticator: 'auth-username-password-form', requirement: 'REQUIRED' },
        { authenticator: 'conditional-otp-form',         requirement: 'CONDITIONAL' }
      ]
    },
    {
      alias: 'browser-without-mfa',
      description: 'Legacy Login OHNE MFA — sollte abgeschaltet sein',
      topLevel: true,
      builtIn: false,
      steps: [
        { authenticator: 'auth-username-password-form', requirement: 'REQUIRED' }
      ]
    },
    {
      alias: 'direct-grant',
      description: 'API Direct Access Grant',
      topLevel: true,
      builtIn: true,
      steps: [
        { authenticator: 'direct-grant-validate-username',  requirement: 'REQUIRED' },
        { authenticator: 'direct-grant-validate-password',  requirement: 'REQUIRED' }
      ]
    }
  ]
};

export class GraphSeeder {
  constructor(private neo4j: Neo4jMCPClient) {}

  /**
   * Idempotent: re-runs are safe. Returns counts of every node label written.
   */
  async seedAll(): Promise<SeedSummary> {
    const t0 = Date.now();
    await ensureSchema(this.neo4j);

    const realms = loadRealmJson();
    let userCount = 0, groupCount = 0, roleCount = 0, clientCount = 0;
    let eventCount = 0;

    // ── Entities ───────────────────────────────────────────────────────────
    for (const realm of realms) {
      await this.upsertRealm(realm);

      for (const group of realm.groups ?? []) {
        await this.upsertGroup(realm.realm, group);
        groupCount++;
      }

      for (const role of (realm.roles?.realm ?? [])) {
        await this.upsertRole(realm.realm, role);
        roleCount++;
      }

      for (const user of realm.users ?? []) {
        await this.upsertUser(realm.realm, user);
        userCount++;
      }

      for (const client of realm.clients ?? []) {
        await this.upsertClient(realm.realm, client);
        clientCount++;
      }
    }

    // ── IP + Geolocation lookup ───────────────────────────────────────────
    for (const ip of IP_GEO_TABLE) {
      await this.upsertIpGeo(ip);
    }

    // ── Privilege demo data (synthetic groups, role mappings, admin events) ─
    const extraGroupRoleCount = await this.seedExtraGroupsAndRoles();
    groupCount += EXTRA_CORPORATE_GROUPS.length;
    roleCount += EXTRA_CORPORATE_ROLES.length;
    const membershipCount = await this.seedMemberships();
    const grantsCount = extraGroupRoleCount.grants;
    const adminEventCount = await this.seedAdminEvents();

    // ── F2: Semantic enrichment — group hierarchy, composite roles, IdPs, AuthFlows ─
    const hierarchyCount = await this.seedGroupHierarchy();
    const compositeCount = await this.seedCompositeRoles();
    const idpCount = await this.seedIdentityProviders();
    const flowCount = await this.seedAuthFlows();

    // ── Synthetic event history (last 72 h) ───────────────────────────────
    eventCount = await this.seedLoginEvents(realms);

    const summary: SeedSummary = {
      realms: realms.length,
      users: userCount,
      groups: groupCount,
      roles: roleCount,
      clients: clientCount,
      ipAddresses: IP_GEO_TABLE.length,
      geoLocations: new Set(IP_GEO_TABLE.map(ip => `${ip.geo.country}-${ip.geo.city}`)).size,
      loginEvents: eventCount,
      memberships: membershipCount,
      roleGrants: grantsCount,
      adminEvents: adminEventCount,
      groupHierarchyEdges: hierarchyCount,
      compositeRoleEdges: compositeCount,
      identityProviders: idpCount,
      authFlows: flowCount,
      durationMs: Date.now() - t0
    };
    logger.info('Graph seed completed', summary);
    return summary;
  }

  // ─── Per-entity upserts ──────────────────────────────────────────────────

  private async upsertRealm(realm: any): Promise<void> {
    await this.neo4j.callTool('write_neo4j_cypher', {
      query: `
        MERGE (r:Realm { name: $name })
        SET r.id = $name,
            r.enabled = $enabled,
            r.sslRequired = $sslRequired,
            r.bruteForceProtected = $bruteForceProtected,
            r.registrationAllowed = $registrationAllowed,
            r.passwordPolicy = $passwordPolicy,
            r.eventsEnabled = $eventsEnabled,
            r.adminEventsEnabled = $adminEventsEnabled
        RETURN r.name
      `,
      params: {
        name: realm.realm,
        enabled: realm.enabled ?? true,
        sslRequired: realm.sslRequired ?? 'external',
        bruteForceProtected: realm.bruteForceProtected ?? false,
        registrationAllowed: realm.registrationAllowed ?? false,
        passwordPolicy: realm.passwordPolicy ?? '',
        eventsEnabled: realm.eventsEnabled ?? false,
        adminEventsEnabled: realm.adminEventsEnabled ?? false
      }
    });
  }

  private async upsertGroup(realmName: string, group: any): Promise<void> {
    const id = stableId(['group', realmName, group.name]);
    await this.neo4j.callTool('write_neo4j_cypher', {
      query: `
        MERGE (g:Group { id: $id })
        SET g.name = $name, g.realm = $realm
        WITH g
        MATCH (r:Realm { name: $realm })
        MERGE (g)-[:IN_REALM]->(r)
      `,
      params: { id, name: group.name, realm: realmName }
    });
  }

  private async upsertRole(realmName: string, role: any): Promise<void> {
    const id = stableId(['role', realmName, role.name]);
    await this.neo4j.callTool('write_neo4j_cypher', {
      query: `
        MERGE (r:Role { id: $id })
        SET r.name = $name, r.description = $description, r.realm = $realmName
        WITH r
        MATCH (realm:Realm { name: $realmName })
        MERGE (r)-[:IN_REALM]->(realm)
      `,
      params: { id, name: role.name, description: role.description ?? '', realmName }
    });
  }

  private async upsertUser(realmName: string, user: any): Promise<void> {
    const id = stableId(['user', realmName, user.username]);
    // Realm-import JSON has no createdAt / lastLogin — synthesize stable-but-realistic
    // values per username so the new stale-account / lifecycle checks fire on known
    // users (admin2, demo-old, test) without changing on every reseed.
    const createdAt = synthCreatedAt(user.username);
    const lastLogin = synthLastLogin(user.username);
    const attributes = synthAttributes(user.username);
    await this.neo4j.callTool('write_neo4j_cypher', {
      query: `
        MERGE (u:User { id: $id })
        SET u.username = $username,
            u.keycloakId = $keycloakId,
            u.email = $email,
            u.firstName = $firstName,
            u.lastName = $lastName,
            u.enabled = $enabled,
            u.emailVerified = $emailVerified,
            u.realm = $realm,
            u.createdAt = $createdAt,
            u.lastLogin = $lastLogin,
            u.attributes = $attributes,
            u.riskScore = 0
        WITH u
        MATCH (r:Realm { name: $realm })
        MERGE (u)-[:BELONGS_TO]->(r)
      `,
      params: {
        id,
        keycloakId: user.id ?? '',
        username: user.username,
        email: user.email ?? '',
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        enabled: user.enabled ?? true,
        emailVerified: user.emailVerified ?? false,
        realm: realmName,
        createdAt,
        lastLogin,
        attributes: JSON.stringify(attributes)
      }
    });
  }

  private async upsertClient(realmName: string, client: any): Promise<void> {
    const id = stableId(['client', realmName, client.clientId]);
    await this.neo4j.callTool('write_neo4j_cypher', {
      query: `
        MERGE (c:Client { id: $id })
        SET c.clientId = $clientId,
            c.name = $name,
            c.protocol = $protocol,
            c.enabled = $enabled,
            c.publicClient = $publicClient,
            c.standardFlowEnabled = $standardFlowEnabled,
            c.implicitFlowEnabled = $implicitFlowEnabled,
            c.directAccessGrantsEnabled = $directAccessGrantsEnabled,
            c.serviceAccountsEnabled = $serviceAccountsEnabled,
            c.realm = $realm
        WITH c
        MATCH (r:Realm { name: $realm })
        MERGE (c)-[:IN_REALM]->(r)
      `,
      params: {
        id,
        clientId: client.clientId,
        name: client.name ?? client.clientId,
        protocol: client.protocol ?? 'openid-connect',
        enabled: client.enabled ?? true,
        publicClient: client.publicClient ?? false,
        standardFlowEnabled: client.standardFlowEnabled ?? false,
        implicitFlowEnabled: client.implicitFlowEnabled ?? false,
        directAccessGrantsEnabled: client.directAccessGrantsEnabled ?? false,
        serviceAccountsEnabled: client.serviceAccountsEnabled ?? false,
        realm: realmName
      }
    });
  }

  private async upsertIpGeo(ip: IpRecord): Promise<void> {
    await this.neo4j.callTool('write_neo4j_cypher', {
      query: `
        MERGE (geo:Geolocation { country: $country, city: $city })
        SET geo.region = $region,
            geo.countryName = $countryName,
            geo.lat = $lat,
            geo.lon = $lon
        WITH geo
        MERGE (ip:IpAddress { address: $address })
        SET ip.classification = $classification,
            ip.asn = $asn
        MERGE (ip)-[:GEOLOCATED_AT]->(geo)
      `,
      params: {
        address: ip.address,
        classification: ip.classification,
        asn: ip.asn ?? '',
        country: ip.geo.country,
        countryName: ip.geo.countryName,
        region: ip.geo.region,
        city: ip.geo.city,
        lat: ip.geo.lat,
        lon: ip.geo.lon
      }
    });
  }

  // ─── Login event history with embedded attack patterns ──────────────────

  private async seedLoginEvents(realms: any[]): Promise<number> {
    let count = 0;
    const now = Date.now();
    const corporate = realms.find(r => r.realm === 'corporate');
    const customers = realms.find(r => r.realm === 'customers');
    const partners  = realms.find(r => r.realm === 'partners');

    // 1) ~400 benign logins distributed across realms and time
    const benignTargets: Array<{ realm: string; user: any }> = [];
    for (const realm of [corporate, customers, partners].filter(Boolean)) {
      for (const u of realm!.users ?? []) {
        benignTargets.push({ realm: realm!.realm, user: u });
      }
    }
    for (let i = 0; i < 400; i++) {
      const target = benignTargets[Math.floor(Math.random() * benignTargets.length)];
      const ip = pickRandomIp({ classification: 'normal' });
      const ago = Math.random() * 72 * 3600_000;
      await this.writeLoginEvent({
        time: new Date(now - ago).toISOString(),
        type: 'LOGIN',
        success: true,
        userId: stableId(['user', target.realm, target.user.username]),
        ip: ip.address,
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/132.0'
      });
      count++;
    }

    // 2) Brute-force attack pattern: 15 LOGIN_ERROR for `j.weber` from a known-bad IP in last 3h
    if (corporate) {
      const target = corporate.users.find((u: any) => u.username === 'j.weber');
      if (target) {
        const badIp = IP_GEO_TABLE.find(ip => ip.classification === 'known-bad')!;
        for (let i = 0; i < 15; i++) {
          await this.writeLoginEvent({
            time: new Date(now - (3 * 3600_000 - i * 90_000)).toISOString(),
            type: 'LOGIN_ERROR',
            success: false,
            userId: stableId(['user', 'corporate', target.username]),
            ip: badIp.address,
            userAgent: 'curl/7.88.1'
          });
          count++;
        }
      }
    }

    // 3) Second brute-force target: `admin2` from a Tor exit, 12 fails in last 90 min
    if (corporate) {
      const target = corporate.users.find((u: any) => u.username === 'admin2');
      if (target) {
        const tor = IP_GEO_TABLE.find(ip => ip.classification === 'tor')!;
        for (let i = 0; i < 12; i++) {
          await this.writeLoginEvent({
            time: new Date(now - (90 * 60_000 - i * 60_000)).toISOString(),
            type: 'LOGIN_ERROR',
            success: false,
            userId: stableId(['user', 'corporate', target.username]),
            ip: tor.address,
            userAgent: 'python-requests/2.31.0'
          });
          count++;
        }
      }
    }

    // 4) Credential-stuffing burst: 1 datacenter IP hits 8 different customer accounts in last 30min
    if (customers) {
      const dc = IP_GEO_TABLE.find(ip => ip.classification === 'datacenter')!;
      const victims = customers.users.slice(0, 8);
      for (let i = 0; i < victims.length; i++) {
        await this.writeLoginEvent({
          time: new Date(now - (30 * 60_000 - i * 120_000)).toISOString(),
          type: 'LOGIN_ERROR',
          success: false,
          userId: stableId(['user', 'customers', victims[i].username]),
          ip: dc.address,
          userAgent: 'Mozilla/5.0 (compatible; auth-checker/1.0)'
        });
        count++;
      }
    }

    // 5) Impossible-travel pair: `m.schulz` logs from Berlin then São Paulo within 40min
    if (corporate) {
      const target = corporate.users.find((u: any) => u.username === 'm.schulz');
      if (target) {
        const berlin = IP_GEO_TABLE.find(ip => ip.address === '85.214.10.4')!;
        const sao = IP_GEO_TABLE.find(ip => ip.address === '189.6.45.10')!;
        await this.writeLoginEvent({
          time: new Date(now - 80 * 60_000).toISOString(),
          type: 'LOGIN',
          success: true,
          userId: stableId(['user', 'corporate', target.username]),
          ip: berlin.address,
          userAgent: 'Mozilla/5.0 (Macintosh) Safari/17.0'
        });
        await this.writeLoginEvent({
          time: new Date(now - 40 * 60_000).toISOString(),
          type: 'LOGIN',
          success: true,
          userId: stableId(['user', 'corporate', target.username]),
          ip: sao.address,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0) Firefox/123.0'
        });
        count += 2;
      }
    }

    return count;
  }

  // ─── Privilege demo: extra groups, role grants, memberships, admin events ─

  /** Creates the demo-only Groups (ShadowAdmins, LegacyAdmins) and Role (ReportsOnly),
   *  then writes Group→Role grants for every group in GROUP_ROLE_GRANTS.
   *  Returns the number of GRANTS_ROLE edges created. */
  private async seedExtraGroupsAndRoles(): Promise<{ grants: number }> {
    const realm = 'corporate';

    for (const groupName of EXTRA_CORPORATE_GROUPS) {
      await this.upsertGroup(realm, { name: groupName });
    }
    for (const roleName of EXTRA_CORPORATE_ROLES) {
      await this.upsertRole(realm, { name: roleName, description: 'Read-only reporting access (currently unused)' });
    }

    let grants = 0;
    for (const [groupName, roleNames] of Object.entries(GROUP_ROLE_GRANTS)) {
      for (const roleName of roleNames) {
        await this.neo4j.callTool('write_neo4j_cypher', {
          query: `
            MATCH (g:Group { name: $groupName, realm: $realm })
            MATCH (r:Role  { name: $roleName,  realm: $realm })
            MERGE (g)-[:GRANTS_ROLE]->(r)
          `,
          params: { groupName, roleName, realm }
        });
        grants++;
      }
    }
    return { grants };
  }

  /** Writes User→Group (MEMBER_OF) and User→Role (HAS_ROLE) relationships per
   *  USER_GROUP_MEMBERSHIPS / USER_DIRECT_ROLES. Idempotent (MERGE). */
  private async seedMemberships(): Promise<number> {
    const realm = 'corporate';
    let count = 0;

    for (const [username, groupNames] of Object.entries(USER_GROUP_MEMBERSHIPS)) {
      const userId = stableId(['user', realm, username]);
      for (const groupName of groupNames) {
        await this.neo4j.callTool('write_neo4j_cypher', {
          query: `
            MATCH (u:User  { id: $userId })
            MATCH (g:Group { name: $groupName, realm: $realm })
            MERGE (u)-[:MEMBER_OF]->(g)
          `,
          params: { userId, groupName, realm }
        });
        count++;
      }
    }

    for (const [username, roleNames] of Object.entries(USER_DIRECT_ROLES)) {
      const userId = stableId(['user', realm, username]);
      for (const roleName of roleNames) {
        await this.neo4j.callTool('write_neo4j_cypher', {
          query: `
            MATCH (u:User { id: $userId })
            MATCH (r:Role { name: $roleName, realm: $realm })
            MERGE (u)-[:HAS_ROLE]->(r)
          `,
          params: { userId, roleName, realm }
        });
        count++;
      }
    }
    return count;
  }

  /** Writes synthetic AdminEvent nodes describing how the privileges above were
   *  granted. Pattern: a `super-admin-user` actor performing ASSIGN_ROLE /
   *  JOIN_GROUP operations over the last ~90 days. Some events are deliberately
   *  off-hours or shortly-after-user-creation to make Privilege-Escalation
   *  patterns visible in the UserDetailModal lifecycle timeline. */
  private async seedAdminEvents(): Promise<number> {
    const realm = 'corporate';

    interface Evt {
      ago: number;            // ms ago
      op: 'ASSIGN_ROLE' | 'JOIN_GROUP' | 'CREATE_USER';
      actor: string;
      targetUsername: string;
      details: string;
    }
    const day = 86_400_000;
    const events: Evt[] = [
      // admin2's privilege story
      { ago:  90 * day,         op: 'CREATE_USER', actor: 'super-admin-user', targetUsername: 'admin2',  details: 'Backup-Admin-Account angelegt' },
      { ago:  76 * day,         op: 'JOIN_GROUP',  actor: 'super-admin-user', targetUsername: 'admin2',  details: 'Hinzugefügt zu Gruppe "Admins"' },
      { ago:  60 * day,         op: 'ASSIGN_ROLE', actor: 'super-admin-user', targetUsername: 'admin2',  details: 'Rolle "realm-admin" direkt zugewiesen (via Admins-Gruppe)' },
      { ago:  30 * day,         op: 'JOIN_GROUP',  actor: 'super-admin-user', targetUsername: 'admin2',  details: 'Hinzugefügt zu Gruppe "ShadowAdmins" — zweite Admin-Mitgliedschaft' },
      // test: classic anti-pattern (admin role within 1 minute of creation)
      { ago:  14 * day + 60_000, op: 'CREATE_USER', actor: 'unbekannt',        targetUsername: 'test',    details: 'Test-Account angelegt' },
      { ago:  14 * day,          op: 'ASSIGN_ROLE', actor: 'unbekannt',        targetUsername: 'test',    details: 'Rolle "realm-admin" zugewiesen — 60s nach Account-Anlage' },
      // r.werner: dual admin path
      { ago: 120 * day,         op: 'CREATE_USER', actor: 'system',           targetUsername: 'r.werner', details: 'Account angelegt' },
      { ago:  45 * day,         op: 'ASSIGN_ROLE', actor: 'super-admin-user', targetUsername: 'r.werner', details: 'Rolle "realm-admin" direkt zugewiesen' },
      { ago:  45 * day - 5_000, op: 'ASSIGN_ROLE', actor: 'super-admin-user', targetUsername: 'r.werner', details: 'Rolle "developer" direkt zugewiesen' },
      // h.kruger / d.lange / f.schneider — ShadowAdmins escalation
      { ago:  10 * day,         op: 'JOIN_GROUP',  actor: 'super-admin-user', targetUsername: 'h.kruger', details: 'Hinzugefügt zu Gruppe "ShadowAdmins"' },
      { ago:   8 * day,         op: 'JOIN_GROUP',  actor: 'super-admin-user', targetUsername: 'd.lange',  details: 'Hinzugefügt zu Gruppe "ShadowAdmins" und "LegacyAdmins"' },
      { ago:   5 * day,         op: 'JOIN_GROUP',  actor: 'super-admin-user', targetUsername: 'f.schneider', details: 'Hinzugefügt zu Gruppe "ShadowAdmins"' },
      // off-hours role assignments (suspicious — actor not on duty)
      { ago:   3 * day + 23 * 3_600_000, op: 'ASSIGN_ROLE', actor: 'super-admin-user', targetUsername: 'j.weber',  details: 'Rolle "support-agent" off-hours (23:00 UTC) zugewiesen' },
      { ago:   2 * day + 22 * 3_600_000, op: 'JOIN_GROUP',  actor: 'super-admin-user', targetUsername: 'e.becker', details: 'Hinzugefügt zu Finance off-hours (22:00 UTC)' },
      // legitimate baseline events
      { ago:  40 * day,         op: 'JOIN_GROUP',  actor: 'super-admin-user', targetUsername: 'j.weber',   details: 'Hinzugefügt zu Gruppe "Engineering"' },
      { ago:  40 * day,         op: 'JOIN_GROUP',  actor: 'super-admin-user', targetUsername: 'm.schulz',  details: 'Hinzugefügt zu Gruppe "Engineering"' },
      { ago:  35 * day,         op: 'JOIN_GROUP',  actor: 'super-admin-user', targetUsername: 'n.meyer',   details: 'Hinzugefügt zu Gruppe "Support"' },
      { ago:  35 * day,         op: 'JOIN_GROUP',  actor: 'super-admin-user', targetUsername: 'k.wagner',  details: 'Hinzugefügt zu Gruppe "Finance"' }
    ];

    const now = Date.now();
    for (const e of events) {
      const id = stableId(['admin-event', realm, e.targetUsername, e.op, String(e.ago)]);
      const userId = stableId(['user', realm, e.targetUsername]);
      const time = new Date(now - e.ago).toISOString();
      await this.neo4j.callTool('write_neo4j_cypher', {
        query: `
          MATCH (u:User { id: $userId })
          MERGE (ae:AdminEvent { id: $id })
          SET ae.time = datetime($time),
              ae.operation = $op,
              ae.actor = $actor,
              ae.targetType = 'user',
              ae.targetId = $userId,
              ae.targetUsername = $targetUsername,
              ae.realm = $realm,
              ae.details = $details
          MERGE (ae)-[:AFFECTS]->(u)
        `,
        params: {
          id, userId, time,
          op: e.op,
          actor: e.actor,
          targetUsername: e.targetUsername,
          realm,
          details: e.details
        }
      });
    }
    return events.length;
  }

  // ─── F2: Group hierarchy (PARENT_OF) ─────────────────────────────────────

  private async seedGroupHierarchy(): Promise<number> {
    const realm = 'corporate';
    let count = 0;
    for (const [parent, child] of GROUP_PARENT_OF) {
      await this.neo4j.callTool('write_neo4j_cypher', {
        query: `
          MATCH (p:Group { name: $parent, realm: $realm })
          MATCH (c:Group { name: $child,  realm: $realm })
          MERGE (p)-[:PARENT_OF]->(c)
        `,
        params: { parent, child, realm }
      });
      count++;
    }
    return count;
  }

  // ─── F2: Composite roles (COMPOSED_OF) ───────────────────────────────────

  private async seedCompositeRoles(): Promise<number> {
    const realm = 'corporate';
    let count = 0;
    for (const { parent, children } of COMPOSITE_ROLES) {
      for (const child of children) {
        await this.neo4j.callTool('write_neo4j_cypher', {
          query: `
            MATCH (rp:Role { name: $parent, realm: $realm })
            MATCH (rc:Role { name: $child,  realm: $realm })
            MERGE (rp)-[:COMPOSED_OF]->(rc)
            SET rp.composite = true
          `,
          params: { parent, child, realm }
        });
        count++;
      }
    }
    return count;
  }

  // ─── F2: Identity providers + USES_IDP edges + LINKED_VIA per linked user ─

  private async seedIdentityProviders(): Promise<number> {
    let count = 0;
    for (const [realm, idps] of Object.entries(REALM_IDPS)) {
      for (const idp of idps) {
        await this.neo4j.callTool('write_neo4j_cypher', {
          query: `
            MERGE (i:IdentityProvider { realm: $realm, alias: $alias })
            SET i.providerId = $providerId,
                i.enabled = $enabled,
                i.displayName = $displayName,
                i.trustEmail = $trustEmail
            WITH i
            MATCH (r:Realm { name: $realm })
            MERGE (r)-[:USES_IDP]->(i)
          `,
          params: {
            realm,
            alias: idp.alias,
            providerId: idp.providerId,
            enabled: idp.enabled,
            displayName: idp.displayName,
            trustEmail: idp.trustEmail
          }
        });
        // Link known users so the unused-IdP check can distinguish active vs. orphan.
        for (const username of idp.linkedUsers) {
          const userId = stableId(['user', realm, username]);
          await this.neo4j.callTool('write_neo4j_cypher', {
            query: `
              MATCH (u:User { id: $userId })
              MATCH (i:IdentityProvider { realm: $realm, alias: $alias })
              MERGE (u)-[:LINKED_VIA]->(i)
            `,
            params: { userId, realm, alias: idp.alias }
          });
        }
        count++;
      }
    }
    return count;
  }

  // ─── F2: Authentication flows + HAS_FLOW + STEP_OF per step ───────────────

  private async seedAuthFlows(): Promise<number> {
    let count = 0;
    for (const [realm, flows] of Object.entries(REALM_AUTH_FLOWS)) {
      for (const flow of flows) {
        const requiresMfa = flow.steps.some(s =>
          /otp|webauthn|conditional-otp/i.test(s.authenticator) && s.requirement !== 'DISABLED'
        );
        await this.neo4j.callTool('write_neo4j_cypher', {
          query: `
            MERGE (af:AuthenticationFlow { realm: $realm, alias: $alias })
            SET af.description = $description,
                af.topLevel = $topLevel,
                af.builtIn = $builtIn,
                af.requiresMfa = $requiresMfa,
                af.steps = $steps
            WITH af
            MATCH (r:Realm { name: $realm })
            MERGE (r)-[:HAS_FLOW]->(af)
          `,
          params: {
            realm,
            alias: flow.alias,
            description: flow.description,
            topLevel: flow.topLevel,
            builtIn: flow.builtIn,
            requiresMfa,
            steps: JSON.stringify(flow.steps)
          }
        });
        count++;
      }
    }
    return count;
  }

  private async writeLoginEvent(evt: {
    time: string; type: string; success: boolean; userId: string; ip: string; userAgent: string;
  }): Promise<void> {
    const id = randomUUID();
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
      params: { id, time: evt.time, type: evt.type, success: evt.success, userId: evt.userId, ip: evt.ip, userAgent: evt.userAgent }
    });
  }
}

let seederInstance: GraphSeeder | null = null;
export function getGraphSeeder(neo4j: Neo4jMCPClient): GraphSeeder {
  if (!seederInstance) seederInstance = new GraphSeeder(neo4j);
  return seederInstance;
}
