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

type Handler = (f: Finding, neo4j: Neo4jMCPClient) => Promise<AppliedFix>;

const HANDLERS: Record<string, Handler> = {
  // Remove sensitive role assignments from the affected user so the god-mode pattern goes away.
  USER_GOD_MODE: async (f, neo4j) => {
    const user = f.affected.find(a => a.type === 'user');
    if (!user) return { rule: f.rule, summary: 'Kein User im Finding referenziert', graphMutations: 0 };
    const res = await neo4j.callTool('write_neo4j_cypher', {
      query: `
        MATCH (u:User { id: $userId })-[rel:HAS_ROLE]->(r:Role)
        WHERE r.name IN ['realm-admin', 'admin', 'super-admin']
        DELETE rel
        RETURN count(rel) AS removed
      `,
      params: { userId: user.id }
    });
    const removed = parseCount(res, 'removed');
    return {
      rule: f.rule,
      summary: `${removed} sensitive Rolle(n) von ${user.name} entfernt`,
      graphMutations: removed
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
  }
};

function parseCount(res: any, field: string): number {
  const rows = (res?.data as Array<Record<string, unknown>>) || [];
  if (rows.length === 0) return 0;
  const v = rows[0]?.[field];
  return typeof v === 'number' ? v : 0;
}
