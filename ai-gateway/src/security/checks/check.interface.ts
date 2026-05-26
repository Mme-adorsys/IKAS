import { KeycloakMCPClient, Neo4jMCPClient } from '../../mcp';
import { CheckCategory, Finding } from '../types';

/**
 * Context handed to every check. Each check is responsible for its own MCP calls.
 * Findings returned here are partial — id/detectedAt/status are stamped by the engine, and
 * description/remediation are filled in by the LLM explainer pass.
 */
export interface CheckContext {
  realm: string;
  keycloak: KeycloakMCPClient;
  neo4j: Neo4jMCPClient;
}

export type RawFinding = Omit<Finding, 'id' | 'detectedAt' | 'status' | 'description' | 'remediation'> & {
  description?: string;
  remediation?: string;
};

export interface SecurityCheck {
  id: string;                              // e.g. 'config.ssl-required'
  category: CheckCategory;
  title: string;                           // displayed in UI when expanded; not the finding's title
  /**
   * Runs the check. May return zero or many findings.
   * Throwing from here is allowed — the engine catches and emits an internal-error finding.
   */
  run(ctx: CheckContext): Promise<RawFinding[]>;
}
