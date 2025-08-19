import { KeycloakMCPClient } from './keycloak-client';
import { Neo4jMCPClient } from './neo4j-client';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

// Singleton MCP clients
let keycloakClient: KeycloakMCPClient | null = null;
let neo4jClient: Neo4jMCPClient | null = null;

export function getKeycloakClient(): KeycloakMCPClient {
  if (!keycloakClient) {
    keycloakClient = new KeycloakMCPClient(config.KEYCLOAK_MCP_URL);
    logger.info('Keycloak MCP client initialized', { url: config.KEYCLOAK_MCP_URL });
  }
  return keycloakClient;
}

export function getNeo4jClient(): Neo4jMCPClient {
  if (!neo4jClient) {
    neo4jClient = new Neo4jMCPClient(config.NEO4J_MCP_URL);
    logger.info('Neo4j MCP client initialized', { url: config.NEO4J_MCP_URL });
  }
  return neo4jClient;
}

export async function checkAllMcpServices(): Promise<{
  keycloak: boolean;
  neo4j: boolean;
  overall: boolean;
}> {
  const keycloakHealthy = await getKeycloakClient().healthCheck();
  const neo4jHealthy = await getNeo4jClient().healthCheck();
  
  return {
    keycloak: keycloakHealthy,
    neo4j: neo4jHealthy,
    overall: keycloakHealthy && neo4jHealthy
  };
}

// Export client classes
export { KeycloakMCPClient } from './keycloak-client';
export { Neo4jMCPClient } from './neo4j-client';
export { BaseMCPClient } from './client';