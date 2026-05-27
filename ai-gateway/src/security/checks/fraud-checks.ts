import { CheckContext, RawFinding, SecurityCheck } from './check.interface';
import { FRAUD_EVENTS_QUERY } from '../graph-queries';

/**
 * Account-fraud / anomalous-behaviour detection. Read-only — sources are list-user-events,
 * list-admin-events, and list-users. Patterns are heuristic and intentionally tuned for
 * false-negative bias (we'd rather miss an attack than flood the dashboard with noise).
 *
 * EVENT_SOURCE=graph (default for demo) reads enriched events from Neo4j via Cypher.
 * EVENT_SOURCE=keycloak falls back to the Keycloak admin API (list-user-events tool).
 */

interface UserEvent {
  type: string;
  userId?: string;
  ipAddress?: string;
  time: number;
  details?: any;
}

const LOOKBACK_HOURS = 24;

async function fetchRecentUserEvents(ctx: CheckContext): Promise<UserEvent[]> {
  const source = (process.env.EVENT_SOURCE || 'graph').toLowerCase();
  const fromDate = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

  if (source === 'graph') {
    const res = await ctx.neo4j.callTool('read_neo4j_cypher', {
      query: FRAUD_EVENTS_QUERY,
      params: { realm: ctx.realm, since: fromDate }
    });
    const rows = (res.data as any[]) || [];
    return rows.map(r => ({
      type: r.type,
      userId: r.userId,
      ipAddress: r.ipAddress,
      time: typeof r.time === 'string' ? Date.parse(r.time) : Date.parse(JSON.stringify(r.time).replace(/"/g, '')),
      details: { username: r.username, userAgent: r.userAgent }
    }));
  }

  const res = await ctx.keycloak.callTool('list-user-events', {
    realm: ctx.realm,
    fromDate,
    first: 0,
    max: 5000
  });
  return (res.data as UserEvent[]) || [];
}

async function fetchRecentAdminEvents(ctx: CheckContext): Promise<any[]> {
  const fromDate = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const res = await ctx.keycloak.callTool('list-admin-events', {
    realm: ctx.realm,
    fromDate,
    first: 0,
    max: 5000
  });
  return (res.data as any[]) || [];
}

// Pick a human-readable display name for a user from the event-details payload.
// Falls back to the userId hash so old data still renders something.
function displayUserName(events: UserEvent[], userId: string): string {
  for (const e of events) {
    const u = e.details?.username;
    if (typeof u === 'string' && u.length > 0) return u;
  }
  return userId;
}

const bruteForceTarget: SecurityCheck = {
  id: 'fraud.brute-force-target',
  category: 'fraud',
  title: 'Wiederholte fehlgeschlagene Logins pro Benutzer',
  async run(ctx) {
    const events = await fetchRecentUserEvents(ctx);
    const failedByUser = new Map<string, UserEvent[]>();
    for (const ev of events) {
      if (ev.type === 'LOGIN_ERROR' && ev.userId) {
        const arr = failedByUser.get(ev.userId) ?? [];
        arr.push(ev);
        failedByUser.set(ev.userId, arr);
      }
    }
    const findings: RawFinding[] = [];
    for (const [userId, fails] of failedByUser) {
      if (fails.length >= 10) {
        const uniqIps = new Set(fails.map(f => f.ipAddress).filter(Boolean)).size;
        const username = displayUserName(fails, userId);
        findings.push({
          checkId: 'fraud.brute-force-target',
          category: 'fraud',
          severity: fails.length >= 50 ? 'critical' : 'error',
          realm: ctx.realm,
          rule: 'USER_BRUTE_FORCE_TARGET',
          title: `${fails.length} fehlgeschlagene Logins für Benutzer ${username} in ${LOOKBACK_HOURS}h`,
          references: ['OWASP:A07', 'CWE-307'],
          affected: [{ type: 'user', id: userId, name: username }],
          evidence: { failedLogins: fails.length, uniqueIps: uniqIps, lookbackHours: LOOKBACK_HOURS, username }
        });
      }
    }
    return findings;
  }
};

const ipRotation: SecurityCheck = {
  id: 'fraud.ip-rotation',
  category: 'fraud',
  title: 'Benutzer mit vielen unterschiedlichen IP-Adressen',
  async run(ctx) {
    const events = await fetchRecentUserEvents(ctx);
    const ipsByUser = new Map<string, Set<string>>();
    for (const ev of events) {
      if (ev.userId && ev.ipAddress) {
        const set = ipsByUser.get(ev.userId) ?? new Set();
        set.add(ev.ipAddress);
        ipsByUser.set(ev.userId, set);
      }
    }
    // Build a userId → username map once so each finding gets a human name.
    const usernamesById = new Map<string, string>();
    for (const ev of events) {
      if (ev.userId && ev.details?.username && !usernamesById.has(ev.userId)) {
        usernamesById.set(ev.userId, ev.details.username as string);
      }
    }
    const findings: RawFinding[] = [];
    for (const [userId, ips] of ipsByUser) {
      if (ips.size >= 5) {
        const username = usernamesById.get(userId) ?? userId;
        findings.push({
          checkId: 'fraud.ip-rotation',
          category: 'fraud',
          severity: ips.size >= 10 ? 'error' : 'warning',
          realm: ctx.realm,
          rule: 'USER_MANY_IPS',
          title: `Benutzer ${username} hat sich von ${ips.size} verschiedenen IPs angemeldet`,
          references: ['OWASP:A07'],
          affected: [{ type: 'user', id: userId, name: username }],
          evidence: { distinctIps: ips.size, sample: Array.from(ips).slice(0, 5), username }
        });
      }
    }
    return findings;
  }
};

const offHoursLogin: SecurityCheck = {
  id: 'fraud.off-hours-login',
  category: 'fraud',
  title: 'Logins außerhalb üblicher Geschäftszeiten',
  async run(ctx) {
    const events = await fetchRecentUserEvents(ctx);
    const offHoursByUser = new Map<string, number>();
    for (const ev of events) {
      if (ev.type !== 'LOGIN' || !ev.userId) continue;
      const hour = new Date(ev.time).getUTCHours();
      if (hour < 5 || hour > 22) {
        offHoursByUser.set(ev.userId, (offHoursByUser.get(ev.userId) ?? 0) + 1);
      }
    }
    const usernamesById = new Map<string, string>();
    for (const ev of events) {
      if (ev.userId && ev.details?.username && !usernamesById.has(ev.userId)) {
        usernamesById.set(ev.userId, ev.details.username as string);
      }
    }
    const findings: RawFinding[] = [];
    for (const [userId, n] of offHoursByUser) {
      if (n >= 3) {
        const username = usernamesById.get(userId) ?? userId;
        findings.push({
          checkId: 'fraud.off-hours-login',
          category: 'fraud',
          severity: 'info',
          realm: ctx.realm,
          rule: 'OFF_HOURS_LOGIN',
          title: `${n} Logins außerhalb 05–22 UTC für ${username}`,
          affected: [{ type: 'user', id: userId, name: username }],
          evidence: { count: n, username }
        });
      }
    }
    return findings;
  }
};

const newUserAdminEscalation: SecurityCheck = {
  id: 'fraud.new-user-admin-escalation',
  category: 'fraud',
  title: 'Frisch angelegte Benutzer mit Admin-Rolle',
  async run(ctx) {
    const events = await fetchRecentAdminEvents(ctx);
    // Sort events chronologically and walk forward looking for CREATE user followed by role-mapping CREATE for the same user within 5 minutes.
    const creates = events.filter(e => e.operationType === 'CREATE' && e.resourceType === 'USER');
    const findings: RawFinding[] = [];
    for (const ev of creates) {
      const userId = ev.resourcePath?.split('/').pop();
      if (!userId) continue;
      const t0 = new Date(ev.time).getTime();
      const adminAssign = events.find(e =>
        e.operationType === 'CREATE'
        && e.resourceType === 'REALM_ROLE_MAPPING'
        && e.resourcePath?.includes(userId)
        && new Date(e.time).getTime() - t0 < 5 * 60 * 1000
      );
      if (adminAssign) {
        findings.push({
          checkId: 'fraud.new-user-admin-escalation',
          category: 'fraud',
          severity: 'warning',
          realm: ctx.realm,
          rule: 'NEW_USER_ADMIN_ESCALATION',
          title: `Neuer Benutzer ${userId} erhielt innerhalb von 5 Minuten eine Rolle`,
          references: ['OWASP:A01'],
          affected: [{ type: 'user', id: userId, name: userId }],
          evidence: { createdAt: ev.time, roleAssignedAt: adminAssign.time }
        });
      }
    }
    return findings;
  }
};

const dormantReactivation: SecurityCheck = {
  id: 'fraud.dormant-reactivation',
  category: 'fraud',
  title: 'Schlafende Konten plötzlich aktiv',
  async run(ctx) {
    const usersRes = await ctx.keycloak.callTool('list-users', { realm: ctx.realm, first: 0, max: 1000 });
    const users = (usersRes.data as any[]) || [];
    const events = await fetchRecentUserEvents(ctx);
    const loginsByUser = new Map<string, number>();
    for (const ev of events) {
      if (ev.type === 'LOGIN' && ev.userId) {
        loginsByUser.set(ev.userId, (loginsByUser.get(ev.userId) ?? 0) + 1);
      }
    }
    const findings: RawFinding[] = [];
    const ninetyDaysAgo = Date.now() - 90 * 86400_000;
    for (const u of users) {
      const recent = loginsByUser.get(u.id) ?? 0;
      if (recent > 0 && u.createdTimestamp && u.createdTimestamp < ninetyDaysAgo) {
        // We don't have a `last_login` field directly; use the count + age heuristic.
        if (recent >= 3) {
          findings.push({
            checkId: 'fraud.dormant-reactivation',
            category: 'fraud',
            severity: 'info',
            realm: ctx.realm,
            rule: 'DORMANT_REACTIVATION',
            title: `${u.username} (älter als 90 Tage) hat ${recent} kürzliche Logins`,
            affected: [{ type: 'user', id: u.id, name: u.username }],
            evidence: { createdAt: new Date(u.createdTimestamp).toISOString(), recentLogins: recent }
          });
        }
      }
    }
    return findings;
  }
};

const serviceAccountMisconfig: SecurityCheck = {
  id: 'fraud.service-account-misconfig',
  category: 'fraud',
  title: 'Service-Account-ähnliche Konten ohne Service-Account-Konfiguration',
  async run(ctx) {
    const usersRes = await ctx.keycloak.callTool('list-users', { realm: ctx.realm, first: 0, max: 1000 });
    const users = (usersRes.data as any[]) || [];
    const findings: RawFinding[] = [];
    for (const u of users) {
      const name: string = (u.username || '').toLowerCase();
      const looksLikeSA = name.startsWith('service-') || name.startsWith('svc-') || name.startsWith('bot-');
      if (looksLikeSA && !u.attributes?.serviceAccountClientId) {
        findings.push({
          checkId: 'fraud.service-account-misconfig',
          category: 'fraud',
          severity: 'warning',
          realm: ctx.realm,
          rule: 'SERVICE_ACCOUNT_MISCONFIG',
          title: `Benutzer ${u.username} sieht aus wie ein Service-Account, ist aber als regulärer User angelegt`,
          affected: [{ type: 'user', id: u.id, name: u.username }],
          evidence: { username: u.username }
        });
      }
    }
    return findings;
  }
};

export const fraudChecks: SecurityCheck[] = [
  bruteForceTarget,
  ipRotation,
  offHoursLogin,
  newUserAdminEscalation,
  dormantReactivation,
  serviceAccountMisconfig
];
