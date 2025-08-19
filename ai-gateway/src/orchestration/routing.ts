import { ExecutionStrategy, RoutingPattern, FreshnessCheck } from '../types';
import { getNeo4jClient } from '../mcp';
import { logger } from '../utils/logger';

export class IntelligentRouter {
  private freshnessThreshold = 30; // minutes
  private patterns: RoutingPattern = {
    freshDataKeywords: ['aktuell', 'current', 'latest', 'jetzt', 'live', 'neueste', 'momentan'],
    analysisKeywords: ['analysiere', 'analyze', 'finde', 'pattern', 'duplikat', 'muster', 'statistik', 'vergleich', 'auswertung'],
    writeKeywords: ['erstelle', 'create', 'lösche', 'delete', 'update', 'ändere', 'bearbeite', 'hinzufügen', 'entfernen']
  };

  async determineExecutionStrategy(userInput: string, context?: { realm?: string }): Promise<ExecutionStrategy> {
    const userLower = userInput.toLowerCase();
    
    logger.debug('Determining execution strategy', {
      userInput: userInput.substring(0, 100),
      inputLength: userInput.length,
      realm: context?.realm
    });

    // Check for write operations (always route to Keycloak first)
    if (this.containsKeywords(userLower, this.patterns.writeKeywords)) {
      logger.info('Detected write operation, using KEYCLOAK_WRITE_THEN_SYNC strategy');
      return ExecutionStrategy.KEYCLOAK_WRITE_THEN_SYNC;
    }

    // Check for fresh data requirements
    if (this.containsKeywords(userLower, this.patterns.freshDataKeywords)) {
      logger.info('Detected fresh data requirement, using KEYCLOAK_FRESH_DATA strategy');
      return ExecutionStrategy.KEYCLOAK_FRESH_DATA;
    }

    // Check for analysis requirements
    if (this.containsKeywords(userLower, this.patterns.analysisKeywords)) {
      const freshness = await this.checkGraphDataFreshness(context?.realm);
      
      if (freshness.needsRefresh) {
        logger.info('Analysis requested but data is stale, using SYNC_THEN_ANALYZE strategy', {
          ageMinutes: freshness.ageMinutes
        });
        return ExecutionStrategy.SYNC_THEN_ANALYZE;
      } else {
        logger.info('Analysis requested with fresh data, using NEO4J_ANALYSIS_ONLY strategy');
        return ExecutionStrategy.NEO4J_ANALYSIS_ONLY;
      }
    }

    // Default: coordinated approach
    logger.info('Using default COORDINATED_MULTI_MCP strategy');
    return ExecutionStrategy.COORDINATED_MULTI_MCP;
  }

  private containsKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  async checkGraphDataFreshness(realm: string = 'master'): Promise<FreshnessCheck> {
    try {
      const neo4jClient = getNeo4jClient();
      const response = await neo4jClient.checkDataFreshness(realm);

      if (!response.success || !response.data) {
        logger.warn('Failed to check data freshness, assuming refresh needed');
        return {
          needsRefresh: true,
          reason: 'Unable to check freshness'
        };
      }

      const freshness = response.data?.records[0]?.freshness || { lastSync: null, ageMinutes: null, needsRefresh: true };
      const { lastSync, ageMinutes, needsRefresh } = freshness;

      logger.debug('Data freshness check result', {
        realm,
        lastSync,
        ageMinutes,
        needsRefresh,
        threshold: this.freshnessThreshold
      });

      return {
        needsRefresh,
        lastSync,
        ageMinutes: ageMinutes || undefined,
        reason: needsRefresh ? 
          (ageMinutes ? `Data is ${ageMinutes} minutes old` : 'No sync data found') : 
          'Data is fresh'
      };

    } catch (error) {
      logger.error('Error checking graph data freshness', {
        realm,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        needsRefresh: true,
        reason: 'Error checking freshness'
      };
    }
  }

  // Analyze user intent for more granular routing decisions
  analyzeIntent(userInput: string): {
    category: 'management' | 'analysis' | 'monitoring' | 'general';
    confidence: number;
    detectedEntities: string[];
  } {
    const userLower = userInput.toLowerCase();
    const entities: string[] = [];

    // Entity detection
    const userRegex = /\b(?:benutzer|user|nutzer)\b/g;
    const realmRegex = /\b(?:realm|bereich)\s+([a-zA-Z0-9-_]+)/g;
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

    if (userRegex.test(userLower)) entities.push('user');
    
    let realmMatch;
    while ((realmMatch = realmRegex.exec(userLower)) !== null) {
      entities.push(`realm:${realmMatch[1]}`);
    }

    let emailMatch;
    while ((emailMatch = emailRegex.exec(userInput)) !== null) {
      entities.push(`email:${emailMatch[0]}`);
    }

    // Category classification
    let category: 'management' | 'analysis' | 'monitoring' | 'general' = 'general';
    let confidence = 0.5;

    if (this.containsKeywords(userLower, ['erstelle', 'lösche', 'bearbeite', 'verwalte'])) {
      category = 'management';
      confidence = 0.8;
    } else if (this.containsKeywords(userLower, ['analysiere', 'finde', 'vergleiche', 'statistik'])) {
      category = 'analysis';
      confidence = 0.8;
    } else if (this.containsKeywords(userLower, ['überwache', 'events', 'logs', 'aktivität'])) {
      category = 'monitoring';
      confidence = 0.7;
    }

    logger.debug('Intent analysis completed', {
      category,
      confidence,
      entities,
      inputLength: userInput.length
    });

    return { category, confidence, detectedEntities: entities };
  }

  // Get recommended tools based on strategy
  getRecommendedTools(strategy: ExecutionStrategy): string[] {
    switch (strategy) {
      case ExecutionStrategy.KEYCLOAK_FRESH_DATA:
        return ['keycloak_list-users', 'keycloak_list-realms', 'keycloak_get-metrics'];

      case ExecutionStrategy.NEO4J_ANALYSIS_ONLY:
        return ['neo4j_read_neo4j_cypher', 'neo4j_get_neo4j_schema'];

      case ExecutionStrategy.SYNC_THEN_ANALYZE:
        return ['keycloak_list-users', 'neo4j_write_neo4j_cypher', 'neo4j_read_neo4j_cypher'];

      case ExecutionStrategy.KEYCLOAK_WRITE_THEN_SYNC:
        return ['keycloak_create-user', 'keycloak_delete-user', 'neo4j_write_neo4j_cypher'];

      case ExecutionStrategy.COORDINATED_MULTI_MCP:
      default:
        return []; // All tools available
    }
  }

  // Update routing patterns based on usage
  updatePatterns(feedback: {
    userInput: string;
    actualStrategy: ExecutionStrategy;
    wasEffective: boolean;
  }): void {
    // Simple pattern learning - in production, this could use ML
    logger.debug('Received routing feedback', {
      strategy: feedback.actualStrategy,
      effective: feedback.wasEffective,
      inputLength: feedback.userInput.length
    });

    // For now, just log the feedback for manual pattern improvement
    if (!feedback.wasEffective) {
      logger.warn('Routing strategy was not effective', {
        userInput: feedback.userInput.substring(0, 100),
        strategy: feedback.actualStrategy
      });
    }
  }
}