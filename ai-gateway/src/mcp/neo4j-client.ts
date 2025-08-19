import { BaseMCPClient } from './client';
import { MCPResponse } from '../types';
import { logger } from '../utils/logger';

export interface Neo4jSchema {
  nodeLabels: string[];
  relationshipTypes: string[];
  propertyKeys: string[];
  constraints: Array<{
    id: string;
    name: string;
    type: string;
    entityType: string;
    labelsOrTypes: string[];
    properties: string[];
  }>;
  indexes: Array<{
    id: string;
    name: string;
    state: string;
    populationPercent: number;
    type: string;
    entityType: string;
    labelsOrTypes: string[];
    properties: string[];
  }>;
}

export interface Neo4jQueryResult {
  records: Array<Record<string, any>>;
  summary: {
    query: {
      text: string;
      parameters: Record<string, any>;
    };
    queryType: string;
    counters: {
      nodesCreated: number;
      nodesDeleted: number;
      relationshipsCreated: number;
      relationshipsDeleted: number;
      propertiesSet: number;
      labelsAdded: number;
      labelsRemoved: number;
      indexesAdded: number;
      indexesRemoved: number;
      constraintsAdded: number;
      constraintsRemoved: number;
    };
    resultConsumedAfter: number;
    resultAvailableAfter: number;
  };
}

export interface CypherQueryOptions {
  query: string;
  parameters?: Record<string, any>;
  database?: string;
}

export class Neo4jMCPClient extends BaseMCPClient {
  constructor(baseUrl: string) {
    super('neo4j', baseUrl);
  }

  // Schema Operations
  async getSchema(): Promise<MCPResponse<Neo4jSchema>> {
    return this.callTool('get_neo4j_schema', {});
  }

  // Read Operations
  async readQuery(options: CypherQueryOptions): Promise<MCPResponse<Neo4jQueryResult>> {
    return this.callTool('read_neo4j_cypher', {
      query: options.query,
      parameters: options.parameters || {},
      database: options.database || 'neo4j'
    });
  }

  // Write Operations  
  async writeQuery(options: CypherQueryOptions): Promise<MCPResponse<Neo4jQueryResult>> {
    return this.callTool('write_neo4j_cypher', {
      query: options.query,
      parameters: options.parameters || {},
      database: options.database || 'neo4j'
    });
  }

  // Convenience methods for common IKAS operations

  // User Analysis Operations
  async findDuplicateUsers(realm: string = 'master'): Promise<MCPResponse<Neo4jQueryResult>> {
    const query = `
      MATCH (u1:User {realm: $realm}), (u2:User {realm: $realm})
      WHERE u1.id < u2.id 
        AND (u1.email = u2.email OR u1.username = u2.username)
      RETURN u1, u2, 
        CASE 
          WHEN u1.email = u2.email THEN 'email'
          WHEN u1.username = u2.username THEN 'username'
          ELSE 'unknown'
        END as duplicateType
    `;

    return this.readQuery({
      query,
      parameters: { realm }
    });
  }

  async getUserRelationships(userId: string, realm: string = 'master'): Promise<MCPResponse<Neo4jQueryResult>> {
    const query = `
      MATCH (u:User {id: $userId, realm: $realm})
      OPTIONAL MATCH (u)-[r1]-(connected)
      OPTIONAL MATCH (u)-[r2*2..3]-(indirect)
      RETURN u, collect(DISTINCT {relationship: r1, node: connected}) as direct,
             collect(DISTINCT indirect) as indirect
    `;

    return this.readQuery({
      query,
      parameters: { userId, realm }
    });
  }

  async getComplianceAnalysis(realm: string = 'master'): Promise<MCPResponse<any>> {
    const query = `
      MATCH (u:User {realm: $realm})
      RETURN {
        totalUsers: count(u),
        enabledUsers: count(CASE WHEN u.enabled = true THEN 1 END),
        disabledUsers: count(CASE WHEN u.enabled = false THEN 1 END),
        usersWithEmail: count(CASE WHEN u.email IS NOT NULL AND u.email <> '' THEN 1 END),
        usersWithoutEmail: count(CASE WHEN u.email IS NULL OR u.email = '' THEN 1 END),
        lastAnalysis: datetime()
      } as complianceReport
    `;

    return this.readQuery({
      query,
      parameters: { realm }
    });
  }

  // Data Synchronization Operations
  async syncUsersFromKeycloak(users: any[], realm: string = 'master'): Promise<MCPResponse<any>> {
    const query = `
      // Clear existing users for this realm
      MATCH (n:User {realm: $realm}) DETACH DELETE n
      
      // Import users
      UNWIND $users as userData
      CREATE (u:User {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        enabled: userData.enabled,
        realm: $realm,
        createdTimestamp: userData.createdTimestamp,
        lastSync: datetime()
      })
      
      // Update sync metadata
      MERGE (m:Metadata {type: 'sync', realm: $realm})
      SET m.lastUpdated = datetime(),
          m.userCount = size($users),
          m.syncVersion = randomUUID()
      
      RETURN count(*) as syncedUsers, datetime() as syncTime
    `;

    return this.writeQuery({
      query,
      parameters: { users, realm }
    });
  }

  async checkDataFreshness(realm: string = 'master'): Promise<MCPResponse<Neo4jQueryResult>> {
    const query = `
      MATCH (m:Metadata {type: 'sync', realm: $realm})
      WITH m.lastUpdated as lastSync, datetime() as now
      RETURN {
        lastSync: toString(lastSync),
        ageMinutes: CASE 
          WHEN lastSync IS NOT NULL 
          THEN duration.between(lastSync, now).minutes
          ELSE null 
        END,
        needsRefresh: CASE 
          WHEN lastSync IS NULL THEN true
          WHEN duration.between(lastSync, now).minutes > 30 THEN true
          ELSE false
        END
      } as freshness
    `;

    return this.readQuery({
      query,
      parameters: { realm }
    });
  }

  // Pattern Analysis Operations
  async findSuspiciousPatterns(realm: string = 'master'): Promise<MCPResponse<Neo4jQueryResult>> {
    const query = `
      MATCH (u:User {realm: $realm})
      WITH u
      
      // Find users with suspicious patterns
      OPTIONAL MATCH (similar:User {realm: $realm})
      WHERE u.id <> similar.id 
        AND (u.email = similar.email OR 
             (u.firstName = similar.firstName AND u.lastName = similar.lastName))
      
      WITH u, collect(similar) as possibleDuplicates
      
      RETURN {
        user: u,
        patterns: {
          possibleDuplicates: possibleDuplicates,
          hasEmail: u.email IS NOT NULL AND u.email <> '',
          isEnabled: u.enabled,
          hasFullName: u.firstName IS NOT NULL AND u.lastName IS NOT NULL
        }
      } as analysis
      ORDER BY size(possibleDuplicates) DESC
    `;

    return this.readQuery({
      query,
      parameters: { realm }
    });
  }

  async getTopologyAnalysis(realm: string = 'master'): Promise<MCPResponse<any>> {
    const query = `
      MATCH (u:User {realm: $realm})
      OPTIONAL MATCH ()-[r]-()
      RETURN {
        nodeCount: count(DISTINCT u),
        relationshipCount: count(DISTINCT r),
        realm: $realm,
        timestamp: datetime(),
        topology: {
          totalUsers: count(u),
          enabledUsers: size([user IN collect(u) WHERE user.enabled = true]),
          connectedComponents: size(apoc.algo.aStar.findComponents(collect(u), []))
        }
      } as analysis
    `;

    return this.readQuery({
      query,
      parameters: { realm }
    });
  }
}