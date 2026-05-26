import { CheckContext, RawFinding, SecurityCheck } from './check.interface';

/**
 * Privilege & permission audit checks. All read-only Cypher queries against Neo4j.
 *
 * Categorised as `fraud` to land in the existing "Verdächtiges Verhalten" tab — these
 * patterns are suspicious-by-nature (god mode, redundant groups, orphan roles).
 *
 * Sensitive roles that signal admin-level access regardless of count.
 */
const SENSITIVE_ROLES = ['realm-admin', 'admin', 'super-admin'];

interface UserRoleRow {
  userId: string;
  username: string;
  roles: string[];
  groups: string[];
}

async function fetchUserRoles(ctx: CheckContext): Promise<UserRoleRow[]> {
  const res = await ctx.neo4j.callTool('read_neo4j_cypher', {
    query: `
      MATCH (u:User { realm: $realm })
      OPTIONAL MATCH (u)-[:MEMBER_OF]->(g:Group)
      OPTIONAL MATCH (g)-[:GRANTS_ROLE]->(r1:Role)
      OPTIONAL MATCH (u)-[:HAS_ROLE]->(r2:Role)
      WITH u,
           collect(DISTINCT g.name)  AS groupNames,
           collect(DISTINCT r1.name) AS viaGroupRoles,
           collect(DISTINCT r2.name) AS directRoles
      RETURN u.id AS userId,
             u.username AS username,
             [x IN (viaGroupRoles + directRoles) WHERE x IS NOT NULL] AS roles,
             [g IN groupNames WHERE g IS NOT NULL] AS groups
    `,
    params: { realm: ctx.realm }
  });
  return ((res.data as any[]) || []).map(r => ({
    userId: r.userId,
    username: r.username,
    roles: Array.from(new Set(r.roles || [])),
    groups: Array.from(new Set(r.groups || []))
  }));
}

const userGodMode: SecurityCheck = {
  id: 'privilege.god-mode',
  category: 'fraud',
  title: 'God-Mode-Konten (übergreifende Admin-Rollen)',
  async run(ctx) {
    const rows = await fetchUserRoles(ctx);
    const findings: RawFinding[] = [];
    for (const r of rows) {
      const sensitiveHits = r.roles.filter(name => SENSITIVE_ROLES.includes(name));
      const isGodMode = sensitiveHits.length > 0 && (r.roles.length >= 4 || sensitiveHits.length >= 1);
      if (!isGodMode) continue;
      findings.push({
        checkId: 'privilege.god-mode',
        category: 'fraud',
        severity: 'critical',
        realm: ctx.realm,
        rule: 'USER_GOD_MODE',
        title: `Mögliches God-Mode-Konto: ${r.username} hat ${r.roles.length} Rolle(n) inkl. ${sensitiveHits.join(', ')}`,
        references: ['CIS-Keycloak:5.1', 'OWASP:A07', 'NIST:AC-6'],
        affected: [{ type: 'user', id: r.userId, name: r.username }],
        evidence: {
          roleCount: r.roles.length,
          sensitiveRoles: sensitiveHits,
          allRoles: r.roles,
          memberOfGroups: r.groups
        }
      });
    }
    return findings;
  }
};

const redundantGroup: SecurityCheck = {
  id: 'privilege.redundant-group',
  category: 'fraud',
  title: 'Redundante Gruppen (identische Rollen)',
  async run(ctx) {
    // Fetch all groups + their roles + their members; pairwise-compare in JS to avoid
    // depending on APOC for set-intersection.
    const res = await ctx.neo4j.callTool('read_neo4j_cypher', {
      query: `
        MATCH (g:Group { realm: $realm })
        OPTIONAL MATCH (g)-[:GRANTS_ROLE]->(r:Role)
        OPTIONAL MATCH (u:User)-[:MEMBER_OF]->(g)
        RETURN g.id AS id, g.name AS name,
               [x IN collect(DISTINCT r.name) WHERE x IS NOT NULL] AS roles,
               [x IN collect(DISTINCT u.id)   WHERE x IS NOT NULL] AS members
      `,
      params: { realm: ctx.realm }
    });
    const groups = ((res.data as any[]) || []).map(g => ({
      id: g.id as string,
      name: g.name as string,
      roles: new Set(g.roles as string[]),
      members: new Set(g.members as string[])
    }));

    const findings: RawFinding[] = [];
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i];
        const b = groups[j];
        if (a.roles.size === 0 || b.roles.size === 0) continue;

        const sharedRoles = [...a.roles].filter(r => b.roles.has(r));
        const roleOverlap = sharedRoles.length / Math.max(a.roles.size, b.roles.size);
        if (roleOverlap < 0.8) continue;

        const sharedMembers = [...a.members].filter(m => b.members.has(m));
        const memberOverlap = a.members.size > 0 && b.members.size > 0
          ? sharedMembers.length / Math.min(a.members.size, b.members.size)
          : 0;

        const overlapPct = Math.round(roleOverlap * 100);
        findings.push({
          checkId: 'privilege.redundant-group',
          category: 'fraud',
          severity: roleOverlap === 1 ? 'warning' : 'info',
          realm: ctx.realm,
          rule: 'REDUNDANT_GROUP',
          title: `Redundante Gruppe: '${b.name}' überlappt zu ${overlapPct}% mit '${a.name}'`,
          references: ['CIS-Keycloak:5.2', 'NIST:AC-6'],
          affected: [
            { type: 'group', id: a.id, name: a.name },
            { type: 'group', id: b.id, name: b.name }
          ],
          evidence: {
            groupA: a.name,
            groupB: b.name,
            sharedRoles,
            roleOverlapPercent: overlapPct,
            sharedMembers: sharedMembers.length,
            memberOverlapPercent: Math.round(memberOverlap * 100)
          }
        });
      }
    }
    return findings;
  }
};

const orphanRole: SecurityCheck = {
  id: 'privilege.orphan-role',
  category: 'fraud',
  title: 'Verwaiste Rollen (keine Benutzer, keine Gruppen)',
  async run(ctx) {
    const res = await ctx.neo4j.callTool('read_neo4j_cypher', {
      query: `
        MATCH (r:Role { realm: $realm })
        WHERE NOT EXISTS { (:User)-[:HAS_ROLE]->(r) }
          AND NOT EXISTS { (:Group)-[:GRANTS_ROLE]->(r) }
        RETURN r.id AS id, r.name AS name, r.description AS description
      `,
      params: { realm: ctx.realm }
    });
    return ((res.data as any[]) || []).map(r => ({
      checkId: 'privilege.orphan-role',
      category: 'fraud' as const,
      severity: 'info' as const,
      realm: ctx.realm,
      rule: 'ORPHAN_ROLE',
      title: `Verwaiste Rolle '${r.name}' — keine Benutzer, keine Gruppen`,
      references: ['CIS-Keycloak:5.3'],
      affected: [{ type: 'role' as const, id: r.id, name: r.name }],
      evidence: { roleName: r.name, description: r.description ?? '' }
    }));
  }
};

const excessivePrivilege: SecurityCheck = {
  id: 'privilege.excessive',
  category: 'fraud',
  title: 'Übermäßige Privilegien (deutlich mehr Rollen als Median)',
  async run(ctx) {
    const rows = await fetchUserRoles(ctx);
    if (rows.length === 0) return [];

    const counts = rows.map(r => r.roles.length).sort((a, b) => a - b);
    const median = counts[Math.floor(counts.length / 2)] || 0;
    const threshold = Math.max(3, median * 2);

    return rows
      .filter(r => r.roles.length >= threshold && !r.roles.some(role => SENSITIVE_ROLES.includes(role)))
      // Exclude god-mode users — they're already flagged with critical severity above.
      .map<RawFinding>(r => ({
        checkId: 'privilege.excessive',
        category: 'fraud',
        severity: 'warning',
        realm: ctx.realm,
        rule: 'EXCESSIVE_PRIVILEGE',
        title: `Excessive Privileges: ${r.username} hat ${r.roles.length} Rollen (Median im Realm: ${median})`,
        references: ['NIST:AC-6', 'OWASP:A07'],
        affected: [{ type: 'user', id: r.userId, name: r.username }],
        evidence: {
          roleCount: r.roles.length,
          medianRoleCount: median,
          threshold,
          allRoles: r.roles,
          memberOfGroups: r.groups
        }
      }));
  }
};

export const privilegeChecks: SecurityCheck[] = [
  userGodMode,
  redundantGroup,
  orphanRole,
  excessivePrivilege
];
