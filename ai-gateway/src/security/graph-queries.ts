/**
 * Typed Cypher query strings + projection helpers. Keeping these separate so the seeder, the
 * fraud checks, and the API endpoints all hit the same view of the graph schema.
 */

import { Neo4jMCPClient } from '../mcp';

export const CONSTRAINTS_AND_INDEXES: string[] = [
  'CREATE CONSTRAINT realm_id IF NOT EXISTS FOR (r:Realm) REQUIRE r.id IS UNIQUE',
  'CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE',
  'CREATE CONSTRAINT client_id IF NOT EXISTS FOR (c:Client) REQUIRE c.id IS UNIQUE',
  'CREATE CONSTRAINT group_id IF NOT EXISTS FOR (g:Group) REQUIRE g.id IS UNIQUE',
  'CREATE CONSTRAINT role_id IF NOT EXISTS FOR (r:Role) REQUIRE r.id IS UNIQUE',
  'CREATE CONSTRAINT login_event_id IF NOT EXISTS FOR (e:LoginEvent) REQUIRE e.id IS UNIQUE',
  'CREATE CONSTRAINT ip_address IF NOT EXISTS FOR (i:IpAddress) REQUIRE i.address IS UNIQUE',
  'CREATE CONSTRAINT geo_key IF NOT EXISTS FOR (g:Geolocation) REQUIRE (g.country, g.city) IS UNIQUE',
  'CREATE CONSTRAINT finding_id IF NOT EXISTS FOR (f:SecurityFinding) REQUIRE f.id IS UNIQUE',
  'CREATE CONSTRAINT admin_event_id IF NOT EXISTS FOR (ae:AdminEvent) REQUIRE ae.id IS UNIQUE',
  // Identity-Provider + AuthFlow semantics added in F2 — scoped per realm so the
  // same alias can exist across realms (Keycloak's actual model).
  'CREATE CONSTRAINT idp_key IF NOT EXISTS FOR (i:IdentityProvider) REQUIRE (i.realm, i.alias) IS UNIQUE',
  'CREATE CONSTRAINT auth_flow_key IF NOT EXISTS FOR (af:AuthenticationFlow) REQUIRE (af.realm, af.alias) IS UNIQUE',
  'CREATE INDEX login_event_time IF NOT EXISTS FOR (e:LoginEvent) ON (e.time)',
  'CREATE INDEX login_event_success IF NOT EXISTS FOR (e:LoginEvent) ON (e.success)',
  'CREATE INDEX admin_event_target IF NOT EXISTS FOR (ae:AdminEvent) ON (ae.targetId)',
  'CREATE INDEX admin_event_time IF NOT EXISTS FOR (ae:AdminEvent) ON (ae.time)',
  // Speeds up the keycloakId-based lookup the sync worker uses.
  'CREATE INDEX user_keycloak_id IF NOT EXISTS FOR (u:User) ON (u.keycloakId)'
];

export async function ensureSchema(neo4j: Neo4jMCPClient): Promise<void> {
  for (const stmt of CONSTRAINTS_AND_INDEXES) {
    await neo4j.callTool('write_neo4j_cypher', { query: stmt, params: {} });
  }
}

// ─── Live events (Powers WorldLoginMap initial load) ────────────────────────

export const LIVE_EVENTS_QUERY = `
  MATCH (e:LoginEvent)-[:FROM_IP]->(ip:IpAddress)-[:GEOLOCATED_AT]->(geo:Geolocation)
  OPTIONAL MATCH (e)-[:FOR_USER]->(u:User)
  WHERE e.time >= datetime($since)
  RETURN e.id        AS id,
         e.time      AS time,
         e.type      AS type,
         e.success   AS success,
         u.username  AS username,
         ip.address  AS ip,
         ip.classification AS ipClassification,
         geo.country AS country,
         geo.city    AS city,
         geo.lat     AS lat,
         geo.lon     AS lon
  ORDER BY e.time DESC
  LIMIT $limit
`;

// ─── Identity graph projection (powers IdentityGraph viz) ───────────────────

export const IDENTITY_GRAPH_QUERY = `
  MATCH (r:Realm { name: $realm })
  OPTIONAL MATCH (u:User)-[:BELONGS_TO]->(r)
  OPTIONAL MATCH (c:Client)-[:IN_REALM]->(r)
  OPTIONAL MATCH (g:Group)-[:IN_REALM]->(r)
  OPTIONAL MATCH (role:Role)-[:IN_REALM]->(r)
  WITH r,
       collect(DISTINCT u)    AS users,
       collect(DISTINCT c)    AS clients,
       collect(DISTINCT g)    AS groups,
       collect(DISTINCT role) AS roles
  WITH r, users[0..$maxNodes] AS users, clients, groups, roles
  // Privilege relationships: user→group, group→role, user→role direct
  OPTIONAL MATCH (uu:User)-[:MEMBER_OF]->(gg:Group)-[:IN_REALM]->(r)
  WHERE uu IN users AND gg IN groups
  WITH r, users, clients, groups, roles,
       collect(DISTINCT { userId: uu.id, groupId: gg.id }) AS memberships
  OPTIONAL MATCH (gg2:Group)-[:GRANTS_ROLE]->(rr:Role)
  WHERE gg2 IN groups AND rr IN roles
  WITH r, users, clients, groups, roles, memberships,
       collect(DISTINCT { groupId: gg2.id, roleId: rr.id }) AS grants
  OPTIONAL MATCH (uu2:User)-[:HAS_ROLE]->(rr2:Role)
  WHERE uu2 IN users AND rr2 IN roles
  WITH r, users, clients, groups, roles, memberships, grants,
       collect(DISTINCT { userId: uu2.id, roleId: rr2.id }) AS directRoles
  // Findings AFFECTS edges across all entity types
  OPTIONAL MATCH (f:SecurityFinding)-[:AFFECTS]->(target)
  WHERE target IN (users + clients + groups + roles + [r])
  RETURN r            AS realm,
         users        AS users,
         clients      AS clients,
         groups       AS groups,
         roles        AS roles,
         memberships  AS memberships,
         grants       AS grants,
         directRoles  AS directRoles,
         collect({ findingId: f.id, severity: f.severity, targetId: target.id }) AS findings
`;

// ─── Admin events for a user's privilege lifecycle ─────────────────────────

export const ADMIN_EVENTS_FOR_USER_QUERY = `
  MATCH (ae:AdminEvent)-[:AFFECTS]->(u:User { id: $userId })
  RETURN ae.id          AS id,
         ae.time        AS time,
         ae.operation   AS operation,
         ae.actor       AS actor,
         ae.targetType  AS targetType,
         ae.targetUsername AS targetUsername,
         ae.details     AS details
  ORDER BY ae.time DESC
  LIMIT 50
`;

// ─── Recent fraud signal (fraud-checks.ts reads from graph) ─────────────────

export const FRAUD_EVENTS_QUERY = `
  MATCH (e:LoginEvent)-[:FOR_USER]->(u:User)-[:BELONGS_TO]->(r:Realm { name: $realm })
  WHERE e.time >= datetime($since)
  OPTIONAL MATCH (e)-[:FROM_IP]->(ip:IpAddress)
  RETURN e.id        AS id,
         e.time      AS time,
         e.type      AS type,
         e.success   AS success,
         u.id        AS userId,
         u.username  AS username,
         ip.address  AS ipAddress,
         e.userAgent AS userAgent
  ORDER BY e.time ASC
  LIMIT 5000
`;
