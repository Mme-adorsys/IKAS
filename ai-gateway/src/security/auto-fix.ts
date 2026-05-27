import { Neo4jMCPClient } from '../mcp';
import { logger } from '../utils/logger';
import { Finding } from './types';

/**
 * Best-effort auto-fix mappings from finding-rule → Cypher write that simulates
 * the remediation in the demo graph. We deliberately do NOT touch Keycloak here
 * — the realm is the source of truth for the demo, and resetting via the
 * "Demo zurücksetzen" button re-seeds the graph and restores every fix.
 *
 * Each handler returns a short description of what it did so the UI can display
 * a confirmation toast. Returning null signals "no auto-fix available for this
 * rule — user must remediate manually in Keycloak".
 */

export interface AppliedFix {
  rule: string;
  summary: string;
  graphMutations: number;
}

export async function applyAutoFix(finding: Finding, neo4j: Neo4jMCPClient): Promise<AppliedFix | null> {
  const handler = HANDLERS[finding.rule];
  if (!handler) {
    logger.info('No auto-fix handler for rule', { rule: finding.rule });
    return null;
  }
  return handler(finding, neo4j);
}

export function hasAutoFix(rule: string): boolean {
  return rule in HANDLERS;
}

export function listAutoFixRules(): string[] {
  return Object.keys(HANDLERS);
}

type Handler = (f: Finding, neo4j: Neo4jMCPClient) => Promise<AppliedFix>;

const HANDLERS: Record<string, Handler> = {
  // Remove sensitive role assignments from the affected user so the god-mode pattern goes away.
  // Counts must happen BEFORE the DELETE — Cypher returns 0 for count(rel) after a delete.
  USER_GOD_MODE: async (f, neo4j) => {
    const user = f.affected.find(a => a.type === 'user');
    if (!user) return { rule: f.rule, summary: 'Kein User im Finding referenziert', graphMutations: 0 };
    // Step 1: count
    const countRes = await neo4j.callTool('read_neo4j_cypher', {
      query: `
        MATCH (u:User { id: $userId })-[rel:HAS_ROLE]->(r:Role)
        WHERE r.name IN ['realm-admin', 'admin', 'super-admin']
        RETURN count(rel) AS toRemove
      `,
      params: { userId: user.id }
    });
    const toRemove = parseCount(countRes, 'toRemove');
    // Also drop sensitive Group→Role grants so the user no longer reaches the
    // sensitive roles via group membership — otherwise the next scan still flags them.
    const groupCountRes = await neo4j.callTool('read_neo4j_cypher', {
      query: `
        MATCH (u:User { id: $userId })-[:MEMBER_OF]->(g:Group)-[gr:GRANTS_ROLE]->(r:Role)
        WHERE r.name IN ['realm-admin', 'admin', 'super-admin']
        RETURN count(gr) AS toRemoveViaGroups
      `,
      params: { userId: user.id }
    });
    const toRemoveViaGroups = parseCount(groupCountRes, 'toRemoveViaGroups');

    // Step 2: actually delete
    await neo4j.callTool('write_neo4j_cypher', {
      query: `
        MATCH (u:User { id: $userId })-[rel:HAS_ROLE]->(r:Role)
        WHERE r.name IN ['realm-admin', 'admin', 'super-admin']
        DELETE rel
      `,
      params: { userId: user.id }
    });
    await neo4j.callTool('write_neo4j_cypher', {
      query: `
        MATCH (u:User { id: $userId })-[:MEMBER_OF]->(g:Group)-[gr:GRANTS_ROLE]->(r:Role)
        WHERE r.name IN ['realm-admin', 'admin', 'super-admin']
        DELETE gr
      `,
      params: { userId: user.id }
    });

    const total = toRemove + toRemoveViaGroups;
    if (total === 0) {
      return {
        rule: f.rule,
        summary: `${user.name} hatte keine sensitiven Rollen mehr — bereits behoben`,
        graphMutations: 0
      };
    }
    const parts = [];
    if (toRemove > 0) parts.push(`${toRemove} direkte`);
    if (toRemoveViaGroups > 0) parts.push(`${toRemoveViaGroups} via Gruppe`);
    return {
      rule: f.rule,
      summary: `Sensitive Rollen von ${user.name} entfernt (${parts.join(', ')})`,
      graphMutations: total
    };
  },

  // Delete the orphan role entirely.
  ORPHAN_ROLE: async (f, neo4j) => {
    const role = f.affected.find(a => a.type === 'role');
    if (!role) return { rule: f.rule, summary: 'Keine Rolle im Finding referenziert', graphMutations: 0 };
    await neo4j.callTool('write_neo4j_cypher', {
      query: `
        MATCH (r:Role { id: $roleId })
        DETACH DELETE r
      `,
      params: { roleId: role.id }
    });
    return {
      rule: f.rule,
      summary: `Rolle "${role.name}" gelöscht`,
      graphMutations: 1
    };
  },

  // Delete a redundant group (memberships and grant edges go with DETACH).
  REDUNDANT_GROUP: async (f, neo4j) => {
    const group = f.affected.find(a => a.type === 'group');
    if (!group) return { rule: f.rule, summary: 'Keine Gruppe im Finding referenziert', graphMutations: 0 };
    await neo4j.callTool('write_neo4j_cypher', {
      query: `
        MATCH (g:Group { id: $groupId })
        DETACH DELETE g
      `,
      params: { groupId: group.id }
    });
    return {
      rule: f.rule,
      summary: `Redundante Gruppe "${group.name}" gelöscht`,
      graphMutations: 1
    };
  },

  // Disable the stale account.
  STALE_ACCOUNT: async (f, neo4j) => {
    const user = f.affected.find(a => a.type === 'user');
    if (!user) return { rule: f.rule, summary: 'Kein User im Finding referenziert', graphMutations: 0 };
    await neo4j.callTool('write_neo4j_cypher', {
      query: `
        MATCH (u:User { id: $userId })
        SET u.enabled = false,
            u.disabledByAutoFix = true
      `,
      params: { userId: user.id }
    });
    return {
      rule: f.rule,
      summary: `Account ${user.name} deaktiviert`,
      graphMutations: 1
    };
  },

  // Disable the unused IdP.
  UNUSED_IDP: async (f, neo4j) => {
    // Finding affects the realm; rule evidence carries the IdP alias.
    const alias = (f.evidence as any)?.alias;
    if (!alias) return { rule: f.rule, summary: 'Kein IdP-Alias im Evidence', graphMutations: 0 };
    await neo4j.callTool('write_neo4j_cypher', {
      query: `
        MATCH (i:IdentityProvider { realm: $realm, alias: $alias })
        SET i.enabled = false,
            i.disabledByAutoFix = true
      `,
      params: { realm: f.realm, alias }
    });
    return {
      rule: f.rule,
      summary: `IdP "${alias}" deaktiviert`,
      graphMutations: 1
    };
  },

  // Mark the weak auth flow as requiring MFA (the cleanest fix is to enable
  // a conditional OTP step — we simulate that by flipping the requiresMfa flag).
  WEAK_AUTH_FLOW: async (f, neo4j) => {
    const alias = (f.evidence as any)?.alias;
    if (!alias) return { rule: f.rule, summary: 'Kein Flow-Alias im Evidence', graphMutations: 0 };
    await neo4j.callTool('write_neo4j_cypher', {
      query: `
        MATCH (af:AuthenticationFlow { realm: $realm, alias: $alias })
        SET af.requiresMfa = true,
            af.fixedByAutoFix = true
      `,
      params: { realm: f.realm, alias }
    });
    return {
      rule: f.rule,
      summary: `Auth-Flow "${alias}" auf MFA-pflichtig gesetzt`,
      graphMutations: 1
    };
  },

  // ─── User-behavior fixes ─────────────────────────────────────────────────

  // Disable a user that's the target of a brute-force pattern.
  USER_BRUTE_FORCE_TARGET: async (f, neo4j) => {
    const user = f.affected.find(a => a.type === 'user');
    if (!user) return { rule: f.rule, summary: 'Kein User im Finding referenziert', graphMutations: 0 };
    await neo4j.callTool('write_neo4j_cypher', {
      query: `MATCH (u:User { id: $userId }) SET u.enabled = false, u.lockedByAutoFix = true, u.lockReason = 'brute-force-target'`,
      params: { userId: user.id }
    });
    return { rule: f.rule, summary: `Account ${user.name} gesperrt (Brute-Force-Schutz)`, graphMutations: 1 };
  },

  // Many distinct IPs → enforce MFA on the user (simulated as an attribute).
  USER_MANY_IPS: async (f, neo4j) => {
    const user = f.affected.find(a => a.type === 'user');
    if (!user) return { rule: f.rule, summary: 'Kein User im Finding referenziert', graphMutations: 0 };
    await neo4j.callTool('write_neo4j_cypher', {
      query: `MATCH (u:User { id: $userId }) SET u.mfaRequired = true, u.mfaEnforcedByAutoFix = true`,
      params: { userId: user.id }
    });
    return { rule: f.rule, summary: `MFA für ${user.name} erzwungen (IP-Anomalie)`, graphMutations: 1 };
  },

  // Off-hours pattern → mark as needs-review, raise riskScore.
  OFF_HOURS_LOGIN: async (f, neo4j) => {
    const user = f.affected.find(a => a.type === 'user');
    if (!user) return { rule: f.rule, summary: 'Kein User im Finding referenziert', graphMutations: 0 };
    await neo4j.callTool('write_neo4j_cypher', {
      query: `MATCH (u:User { id: $userId }) SET u.timeRestricted = true, u.riskScore = coalesce(u.riskScore, 0) + 1`,
      params: { userId: user.id }
    });
    return { rule: f.rule, summary: `Zeit-Restriktion für ${user.name} aktiviert`, graphMutations: 1 };
  },

  // Excessive privilege → remove non-sensitive roles down to a sane number (keep top 2).
  EXCESSIVE_PRIVILEGE: async (f, neo4j) => {
    const user = f.affected.find(a => a.type === 'user');
    if (!user) return { rule: f.rule, summary: 'Kein User im Finding referenziert', graphMutations: 0 };
    const countRes = await neo4j.callTool('read_neo4j_cypher', {
      query: `MATCH (u:User { id: $userId })-[r:HAS_ROLE]->(:Role) RETURN count(r) AS n`,
      params: { userId: user.id }
    });
    const n = parseCount(countRes, 'n');
    // Keep at most 2 direct role assignments.
    await neo4j.callTool('write_neo4j_cypher', {
      query: `
        MATCH (u:User { id: $userId })-[r:HAS_ROLE]->(role:Role)
        WITH r, role ORDER BY role.name
        SKIP 2
        DELETE r
      `,
      params: { userId: user.id }
    });
    const removed = Math.max(0, n - 2);
    return { rule: f.rule, summary: `${removed} überzählige Rolle(n) von ${user.name} entfernt`, graphMutations: removed };
  },

  // ─── Realm-config fixes — flip a property on the Realm node. ────────────

  // Generic helper applied to many config rules. The check looks at a specific
  // property; the fix sets it to the secure value. Keys mirror what graph-seeder
  // and the checks read.
  BRUTE_FORCE_DISABLED: realmSet({ bruteForceProtected: true }, 'Brute-Force-Schutz aktiviert'),
  OWASP_A07_NO_BRUTE_FORCE: realmSet({ bruteForceProtected: true }, 'Brute-Force-Schutz aktiviert (OWASP A07)'),
  NO_MFA_POLICY: realmSet({ otpPolicyType: 'totp', requireMfaForAdmin: true }, 'MFA-Policy für Admins gesetzt'),
  OWASP_A07_NO_MFA: realmSet({ otpPolicyType: 'totp', requireMfaForAdmin: true }, 'MFA-Policy gesetzt (OWASP A07)'),
  PASSWORD_POLICY_MISSING: realmSet(
    { passwordPolicy: 'length(12) and digits(1) and upperCase(1) and specialChars(1) and notUsername(undefined)' },
    'Strikte Passwort-Policy gesetzt'
  ),
  SSL_REQUIRED_WEAK: realmSet({ sslRequired: 'all' }, 'SSL für alle Requests erzwungen'),
  OWASP_A02_SSL_WEAK: realmSet({ sslRequired: 'all' }, 'SSL erzwungen (OWASP A02)'),
  GDPR_TLS_NOT_ENFORCED: realmSet({ sslRequired: 'all' }, 'TLS-Pflicht aktiviert (DSGVO Art. 32)'),
  USER_EVENTS_DISABLED: realmSet({ eventsEnabled: true, eventsExpiration: 31536000 }, 'User-Events aktiviert (1 Jahr Retention)'),
  ADMIN_EVENTS_DISABLED: realmSet({ adminEventsEnabled: true, adminEventsDetailsEnabled: true }, 'Admin-Audit-Trail aktiviert'),
  OWASP_A09_EVENTS_OFF: realmSet({ eventsEnabled: true, adminEventsEnabled: true }, 'Events + Admin-Events aktiviert (OWASP A09)'),
  GDPR_NO_AUDIT_TRAIL: realmSet({ adminEventsEnabled: true, adminEventsDetailsEnabled: true }, 'Audit-Trail aktiviert (DSGVO Art. 30)'),
  GDPR_RETENTION_UNDEFINED: realmSet({ eventsExpiration: 31536000, retentionPolicyDefined: true }, 'Retention auf 1 Jahr gesetzt (DSGVO Art. 5)'),
  BEST_PRACTICE_LONG_SSO_SESSION: realmSet({ ssoSessionMaxLifespan: 28800, ssoSessionIdleTimeout: 1800 }, 'SSO-Session auf 8h / 30min Idle reduziert')
};

function parseCount(res: any, field: string): number {
  const rows = (res?.data as Array<Record<string, unknown>>) || [];
  if (rows.length === 0) return 0;
  const v = rows[0]?.[field];
  return typeof v === 'number' ? v : 0;
}

/**
 * Convenience factory: returns a handler that sets the given properties on the
 * affected realm. Used by every "flip a config flag" remediation.
 */
function realmSet(props: Record<string, unknown>, summary: string): Handler {
  return async (f, neo4j) => {
    // Build a SET clause from the keys so we can write them all in one query.
    const setClauses = Object.keys(props).map((k, i) => `r.${k} = $p${i}`).join(', ');
    const params: Record<string, unknown> = { realm: f.realm };
    Object.entries(props).forEach(([, v], i) => { params[`p${i}`] = v; });
    await neo4j.callTool('write_neo4j_cypher', {
      query: `MATCH (r:Realm { name: $realm }) SET ${setClauses}, r.fixedByAutoFix = true`,
      params
    });
    return { rule: f.rule, summary, graphMutations: 1 };
  };
}
