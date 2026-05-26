import { RawFinding, SecurityCheck } from './check.interface';

/**
 * F2 — Realm-semantic checks on the freshly-seeded IdentityProvider /
 * AuthenticationFlow nodes. Both run against Neo4j (no Keycloak round-trip).
 *
 * Categorised as `config` so they show up next to brute-force-protection,
 * SSL-required, etc. in the Sicherheit-Tab.
 */

interface AuthFlowRow {
  alias: string;
  description: string;
  topLevel: boolean;
  builtIn: boolean;
  requiresMfa: boolean;
  steps: string; // serialized JSON
}

const weakAuthFlow: SecurityCheck = {
  id: 'config.weak-auth-flow',
  category: 'config',
  title: 'Authentifizierungs-Flow ohne MFA',
  async run(ctx): Promise<RawFinding[]> {
    const res = await ctx.neo4j.callTool('read_neo4j_cypher', {
      query: `
        MATCH (r:Realm { name: $realm })-[:HAS_FLOW]->(af:AuthenticationFlow)
        WHERE af.topLevel = true
        RETURN af.alias AS alias,
               af.description AS description,
               af.topLevel AS topLevel,
               af.builtIn AS builtIn,
               af.requiresMfa AS requiresMfa,
               af.steps AS steps
      `,
      params: { realm: ctx.realm }
    });
    const rows = ((res.data as AuthFlowRow[]) || []);
    const findings: RawFinding[] = [];

    for (const row of rows) {
      // Browser-style flows without an MFA step are the dangerous case;
      // direct-grant flows are expected to skip MFA (API access).
      const looksBrowserish = /browser|login/i.test(row.alias) || /browser|login/i.test(row.description || '');
      if (!looksBrowserish) continue;
      if (row.requiresMfa) continue;

      findings.push({
        checkId: 'config.weak-auth-flow',
        category: 'config',
        severity: 'error',
        realm: ctx.realm,
        rule: 'WEAK_AUTH_FLOW',
        title: `Auth-Flow "${row.alias}" erzwingt keine MFA`,
        references: ['NIST:IA-2(1)', 'CIS-Keycloak:3.4', 'OWASP:A07'],
        affected: [{
          type: 'realm',
          id: ctx.realm,
          name: ctx.realm
        }],
        evidence: {
          alias: row.alias,
          description: row.description,
          steps: safeParseSteps(row.steps),
          requiresMfa: row.requiresMfa
        }
      });
    }
    return findings;
  }
};

const unusedIdentityProvider: SecurityCheck = {
  id: 'config.unused-idp',
  category: 'config',
  title: 'Identity-Provider ohne aktive User',
  async run(ctx): Promise<RawFinding[]> {
    const res = await ctx.neo4j.callTool('read_neo4j_cypher', {
      query: `
        MATCH (r:Realm { name: $realm })-[:USES_IDP]->(i:IdentityProvider)
        OPTIONAL MATCH (u:User)-[:LINKED_VIA]->(i)
        WITH i, count(u) AS userCount
        RETURN i.alias       AS alias,
               i.providerId  AS providerId,
               i.displayName AS displayName,
               i.enabled     AS enabled,
               userCount     AS userCount
      `,
      params: { realm: ctx.realm }
    });
    const rows = ((res.data as Array<{
      alias: string;
      providerId: string;
      displayName: string;
      enabled: boolean;
      userCount: number;
    }>) || []);

    return rows
      .filter(r => r.enabled && r.userCount === 0)
      .map<RawFinding>(r => ({
        checkId: 'config.unused-idp',
        category: 'config',
        severity: 'info',
        realm: ctx.realm,
        rule: 'UNUSED_IDP',
        title: `Identity-Provider "${r.alias}" ist aktiv, aber kein User damit verknüpft`,
        references: ['CIS-Keycloak:6.2'],
        affected: [{ type: 'realm', id: ctx.realm, name: ctx.realm }],
        evidence: {
          alias: r.alias,
          providerId: r.providerId,
          displayName: r.displayName,
          linkedUsers: r.userCount
        }
      }));
  }
};

const staleAccount: SecurityCheck = {
  id: 'config.stale-account',
  category: 'config',
  title: 'Konten ohne Login > 90 Tage',
  async run(ctx): Promise<RawFinding[]> {
    const res = await ctx.neo4j.callTool('read_neo4j_cypher', {
      query: `
        MATCH (u:User { realm: $realm })
        WHERE u.lastLogin IS NOT NULL
          AND duration.between(datetime(u.lastLogin), datetime()).days >= 90
        RETURN u.id        AS userId,
               u.username  AS username,
               u.lastLogin AS lastLogin,
               u.enabled   AS enabled
        ORDER BY u.lastLogin ASC
        LIMIT 50
      `,
      params: { realm: ctx.realm }
    });
    const rows = ((res.data as Array<{
      userId: string;
      username: string;
      lastLogin: string;
      enabled: boolean;
    }>) || []);

    return rows.map<RawFinding>(r => ({
      checkId: 'config.stale-account',
      category: 'config',
      severity: r.enabled ? 'warning' : 'info',
      realm: ctx.realm,
      rule: 'STALE_ACCOUNT',
      title: `Inaktives Konto: ${r.username} (letzter Login ${formatDaysAgo(r.lastLogin)})`,
      references: ['NIST:AC-2(3)', 'ISO27001:A.9.2.6'],
      affected: [{ type: 'user', id: r.userId, name: r.username }],
      evidence: {
        username: r.username,
        lastLogin: r.lastLogin,
        enabled: r.enabled,
        daysSinceLogin: Math.floor((Date.now() - new Date(r.lastLogin).getTime()) / 86_400_000)
      }
    }));
  }
};

function safeParseSteps(serialized: string): unknown {
  try { return JSON.parse(serialized); } catch { return serialized; }
}

function formatDaysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return `vor ${days} Tagen`;
}

export const identityChecks: SecurityCheck[] = [
  weakAuthFlow,
  unusedIdentityProvider,
  staleAccount
];
