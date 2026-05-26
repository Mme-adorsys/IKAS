import { Neo4jMCPClient } from '../mcp';
import { logger } from '../utils/logger';
import { Finding } from './types';

/**
 * Persist findings to Neo4j as :SecurityFinding nodes linked to the affected entities. Writes
 * go through the existing Neo4j MCP tool — no schema migration is required because the graph
 * is open. We MERGE on the finding id to make scans idempotent (same finding from re-runs
 * gets `detectedAt` refreshed but no duplicate node).
 */
export class SecurityFindingPersistence {
  constructor(private neo4j: Neo4jMCPClient) {}

  async save(finding: Finding): Promise<void> {
    try {
      const params = {
        id: finding.id,
        checkId: finding.checkId,
        category: finding.category,
        severity: finding.severity,
        realm: finding.realm,
        rule: finding.rule,
        title: finding.title,
        description: finding.description ?? '',
        remediation: finding.remediation ?? '',
        references: finding.references ?? [],
        detectedAt: finding.detectedAt,
        status: finding.status,
        evidenceJson: finding.evidence ? JSON.stringify(finding.evidence) : null
      };

      const cypher = `
        MERGE (f:SecurityFinding { id: $id })
        SET f.checkId = $checkId,
            f.category = $category,
            f.severity = $severity,
            f.realm = $realm,
            f.rule = $rule,
            f.title = $title,
            f.description = $description,
            f.remediation = $remediation,
            f.references = $references,
            f.detectedAt = $detectedAt,
            f.status = $status,
            f.evidenceJson = $evidenceJson
        RETURN f.id AS id
      `;

      await this.neo4j.callTool('write_neo4j_cypher', { query: cypher, params });

      // Create AFFECTS relationships. Each affected entity may not have a node yet, so MERGE it.
      for (const a of finding.affected) {
        const label = ({ realm: 'Realm', user: 'User', client: 'Client', role: 'Role', group: 'Group' } as const)[a.type];
        const relCypher = `
          MERGE (t:${label} { id: $entityId })
            ON CREATE SET t.name = $entityName, t.createdBySecurityScan = true
          WITH t
          MATCH (f:SecurityFinding { id: $findingId })
          MERGE (f)-[:AFFECTS]->(t)
        `;
        await this.neo4j.callTool('write_neo4j_cypher', {
          query: relCypher,
          params: { entityId: a.id, entityName: a.name, findingId: finding.id }
        });
      }
    } catch (error) {
      // Persistence failures should never break the scan itself.
      logger.warn('Failed to persist SecurityFinding to Neo4j', {
        findingId: finding.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
