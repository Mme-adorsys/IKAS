import { IntelligentRouter } from '../../../src/orchestration/routing';
import { ExecutionStrategy } from '../../../src/types';
import * as mcpModule from '../../../src/mcp';

// Mock the MCP module
jest.mock('../../../src/mcp');
const mockedMcp = mcpModule as jest.Mocked<typeof mcpModule>;

describe('IntelligentRouter', () => {
  let router: IntelligentRouter;
  let mockNeo4jClient: any;

  beforeEach(() => {
    router = new IntelligentRouter();
    
    mockNeo4jClient = {
      checkDataFreshness: jest.fn()
    };
    
    mockedMcp.getNeo4jClient.mockReturnValue(mockNeo4jClient);
  });

  describe('determineExecutionStrategy', () => {
    it('should return KEYCLOAK_WRITE_THEN_SYNC for write operations', async () => {
      const strategy = await router.determineExecutionStrategy('Erstelle einen neuen Benutzer');
      
      expect(strategy).toBe(ExecutionStrategy.KEYCLOAK_WRITE_THEN_SYNC);
    });

    it('should return KEYCLOAK_FRESH_DATA for fresh data requests', async () => {
      const strategy = await router.determineExecutionStrategy('Zeige mir die aktuellen Benutzer');
      
      expect(strategy).toBe(ExecutionStrategy.KEYCLOAK_FRESH_DATA);
    });

    it('should return NEO4J_ANALYSIS_ONLY for analysis with fresh data', async () => {
      mockNeo4jClient.checkDataFreshness.mockResolvedValueOnce({
        success: true,
        data: { needsRefresh: false, ageMinutes: 10 }
      });

      const strategy = await router.determineExecutionStrategy('Analysiere die Benutzerdaten');
      
      expect(strategy).toBe(ExecutionStrategy.NEO4J_ANALYSIS_ONLY);
    });

    it('should return SYNC_THEN_ANALYZE for analysis with stale data', async () => {
      mockNeo4jClient.checkDataFreshness.mockResolvedValueOnce({
        success: true,
        data: { needsRefresh: true, ageMinutes: 45 }
      });

      const strategy = await router.determineExecutionStrategy('Finde Duplikate in den Benutzerdaten');
      
      expect(strategy).toBe(ExecutionStrategy.SYNC_THEN_ANALYZE);
    });

    it('should return COORDINATED_MULTI_MCP as default', async () => {
      const strategy = await router.determineExecutionStrategy('Was ist Keycloak?');
      
      expect(strategy).toBe(ExecutionStrategy.COORDINATED_MULTI_MCP);
    });
  });

  describe('analyzeIntent', () => {
    it('should detect management category', () => {
      const intent = router.analyzeIntent('Erstelle einen Benutzer mit Email test@example.com');
      
      expect(intent.category).toBe('management');
      expect(intent.confidence).toBeGreaterThan(0.7);
      expect(intent.detectedEntities).toContain('user');
      expect(intent.detectedEntities).toContain('email:test@example.com');
    });

    it('should detect analysis category', () => {
      const intent = router.analyzeIntent('Analysiere die Benutzerstatistiken für Realm test');
      
      expect(intent.category).toBe('analysis');
      expect(intent.confidence).toBeGreaterThan(0.7);
      expect(intent.detectedEntities).toContain('user');
      expect(intent.detectedEntities).toContain('realm:test');
    });

    it('should detect monitoring category', () => {
      const intent = router.analyzeIntent('Überwache die Admin Events');
      
      expect(intent.category).toBe('monitoring');
      expect(intent.confidence).toBeGreaterThan(0.6);
    });

    it('should default to general category', () => {
      const intent = router.analyzeIntent('Was ist Keycloak?');
      
      expect(intent.category).toBe('general');
      expect(intent.confidence).toBe(0.5);
    });
  });

  describe('getRecommendedTools', () => {
    it('should recommend Keycloak tools for fresh data strategy', () => {
      const tools = router.getRecommendedTools(ExecutionStrategy.KEYCLOAK_FRESH_DATA);
      
      expect(tools).toContain('keycloak_list-users');
      expect(tools).toContain('keycloak_list-realms');
      expect(tools).toContain('keycloak_get-metrics');
    });

    it('should recommend Neo4j tools for analysis strategy', () => {
      const tools = router.getRecommendedTools(ExecutionStrategy.NEO4J_ANALYSIS_ONLY);
      
      expect(tools).toContain('neo4j_read_neo4j_cypher');
      expect(tools).toContain('neo4j_get_neo4j_schema');
    });

    it('should recommend write tools for write strategy', () => {
      const tools = router.getRecommendedTools(ExecutionStrategy.KEYCLOAK_WRITE_THEN_SYNC);
      
      expect(tools).toContain('keycloak_create-user');
      expect(tools).toContain('keycloak_delete-user');
      expect(tools).toContain('neo4j_write_neo4j_cypher');
    });

    it('should return empty array for coordinated strategy', () => {
      const tools = router.getRecommendedTools(ExecutionStrategy.COORDINATED_MULTI_MCP);
      
      expect(tools).toEqual([]);
    });
  });

  describe('checkGraphDataFreshness', () => {
    it('should return freshness check result', async () => {
      mockNeo4jClient.checkDataFreshness.mockResolvedValueOnce({
        success: true,
        data: {
          lastSync: '2024-01-01T12:00:00Z',
          ageMinutes: 15,
          needsRefresh: false
        }
      });

      const result = await router.checkGraphDataFreshness('test-realm');
      
      expect(result.needsRefresh).toBe(false);
      expect(result.lastSync).toBe('2024-01-01T12:00:00Z');
      expect(result.ageMinutes).toBe(15);
      expect(result.reason).toBe('Data is fresh');
    });

    it('should handle errors gracefully', async () => {
      mockNeo4jClient.checkDataFreshness.mockRejectedValueOnce(new Error('Connection error'));

      const result = await router.checkGraphDataFreshness('test-realm');
      
      expect(result.needsRefresh).toBe(true);
      expect(result.reason).toBe('Error checking freshness');
    });
  });
});