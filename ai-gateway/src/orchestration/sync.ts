import { SyncResult } from '../types';
import { getKeycloakClient, getNeo4jClient } from '../mcp';
import { logger } from '../utils/logger';

export class DataSynchronizer {
  async syncKeycloakToNeo4j(realm: string = 'master', force: boolean = false): Promise<SyncResult> {
    logger.info('Starting Keycloak to Neo4j sync', { realm, force });

    try {
      // Check if sync is needed (unless forced)
      if (!force) {
        const freshness = await this.checkFreshness(realm);
        if (!freshness.needsRefresh) {
          logger.info('Sync skipped - data is fresh', {
            realm,
            reason: freshness.reason
          });
          return { 
            skipped: true, 
            reason: 'Data is fresh' 
          };
        }
      }

      const keycloakClient = getKeycloakClient();
      const neo4jClient = getNeo4jClient();

      // Fetch users from Keycloak
      logger.debug('Fetching users from Keycloak', { realm });
      const usersResponse = await keycloakClient.listUsers(realm, { max: 10000 });
      
      if (!usersResponse.success) {
        logger.error('Failed to fetch users from Keycloak', {
          error: usersResponse.error,
          realm
        });
        return { 
          success: false, 
          error: `Failed to fetch users: ${usersResponse.error}` 
        };
      }

      const users = usersResponse.data || [];
      logger.info('Fetched users from Keycloak', { 
        realm, 
        userCount: users.length 
      });

      // Sync users to Neo4j
      logger.debug('Syncing users to Neo4j', { realm, userCount: users.length });
      const syncResponse = await neo4jClient.syncUsersFromKeycloak(users, realm);

      if (!syncResponse.success) {
        logger.error('Failed to sync users to Neo4j', {
          error: syncResponse.error,
          realm
        });
        return { 
          success: false, 
          error: `Failed to sync to Neo4j: ${syncResponse.error}` 
        };
      }

      const syncData = syncResponse.data;
      const recordsSynced = syncData?.syncedUsers || users.length;

      logger.info('Keycloak to Neo4j sync completed', {
        realm,
        recordsSynced,
        duration: syncResponse.metadata?.duration
      });

      return { 
        success: true, 
        recordsSynced 
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Sync operation failed', {
        realm,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });

      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }

  private async checkFreshness(realm: string): Promise<{ needsRefresh: boolean; reason?: string }> {
    try {
      const neo4jClient = getNeo4jClient();
      const response = await neo4jClient.checkDataFreshness(realm);

      if (!response.success) {
        return { 
          needsRefresh: true, 
          reason: 'Unable to check freshness' 
        };
      }

      const data = response.data?.records[0]?.freshness || { needsRefresh: true, ageMinutes: null };
      return {
        needsRefresh: data.needsRefresh,
        reason: data.needsRefresh ? 
          `Data age: ${data.ageMinutes || 'unknown'} minutes` : 
          'Data is fresh'
      };

    } catch (error) {
      logger.warn('Error checking data freshness', {
        realm,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return { 
        needsRefresh: true, 
        reason: 'Error checking freshness' 
      };
    }
  }

  // Sync specific user data
  async syncUserData(userId: string, realm: string = 'master'): Promise<SyncResult> {
    logger.info('Starting user-specific sync', { userId, realm });

    try {
      const keycloakClient = getKeycloakClient();
      const neo4jClient = getNeo4jClient();

      // Find user in Keycloak
      const usersResponse = await keycloakClient.listUsers(realm, { 
        max: 1, 
        search: userId 
      });

      if (!usersResponse.success) {
        return { 
          success: false, 
          error: `Failed to find user: ${usersResponse.error}` 
        };
      }

      const users = usersResponse.data || [];
      const user = users.find((u: any) => u.id === userId);

      if (!user) {
        return { 
          success: false, 
          error: 'User not found in Keycloak' 
        };
      }

      // Sync single user to Neo4j
      const syncQuery = `
        MERGE (u:User {id: $userId, realm: $realm})
        SET u.username = $username,
            u.email = $email,
            u.firstName = $firstName,
            u.lastName = $lastName,
            u.enabled = $enabled,
            u.lastSync = datetime()
        RETURN u
      `;

      const syncResponse = await neo4jClient.writeQuery({
        query: syncQuery,
        parameters: {
          userId: user.id,
          realm,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          enabled: user.enabled
        }
      });

      if (!syncResponse.success) {
        return { 
          success: false, 
          error: `Failed to sync user: ${syncResponse.error}` 
        };
      }

      logger.info('User sync completed', {
        userId,
        realm,
        username: user.username
      });

      return { 
        success: true, 
        recordsSynced: 1 
      };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Get sync status for a realm
  async getSyncStatus(realm: string = 'master'): Promise<{
    lastSync: string | null;
    ageMinutes: number | null;
    recordCount: number;
    needsRefresh: boolean;
  }> {
    try {
      const neo4jClient = getNeo4jClient();

      // Get sync metadata and user count
      const statusQuery = `
        OPTIONAL MATCH (m:Metadata {type: 'sync', realm: $realm})
        OPTIONAL MATCH (u:User {realm: $realm})
        WITH m, count(u) as userCount
        RETURN {
          lastSync: toString(m.lastUpdated),
          ageMinutes: CASE 
            WHEN m.lastUpdated IS NOT NULL 
            THEN duration.between(m.lastUpdated, datetime()).minutes
            ELSE null 
          END,
          recordCount: userCount,
          needsRefresh: CASE 
            WHEN m.lastUpdated IS NULL THEN true
            WHEN duration.between(m.lastUpdated, datetime()).minutes > 30 THEN true
            ELSE false
          END
        } as status
      `;

      const response = await neo4jClient.readQuery({
        query: statusQuery,
        parameters: { realm }
      });

      if (response.success && response.data?.records.length > 0) {
        const status = response.data.records[0].status;
        
        logger.debug('Retrieved sync status', {
          realm,
          lastSync: status.lastSync,
          ageMinutes: status.ageMinutes,
          recordCount: status.recordCount,
          needsRefresh: status.needsRefresh
        });

        return status;
      }

      // Default response if no data found
      return {
        lastSync: null,
        ageMinutes: null,
        recordCount: 0,
        needsRefresh: true
      };

    } catch (error) {
      logger.error('Failed to get sync status', {
        realm,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        lastSync: null,
        ageMinutes: null,
        recordCount: 0,
        needsRefresh: true
      };
    }
  }

  // Force a complete re-sync (clears existing data)
  async forceFullSync(realm: string = 'master'): Promise<SyncResult> {
    logger.info('Starting forced full sync', { realm });
    
    return this.syncKeycloakToNeo4j(realm, true);
  }

  // Validate sync integrity
  async validateSyncIntegrity(realm: string = 'master'): Promise<{
    isValid: boolean;
    keycloakCount: number;
    neo4jCount: number;
    discrepancy: number;
    issues: string[];
  }> {
    logger.info('Validating sync integrity', { realm });
    
    try {
      const keycloakClient = getKeycloakClient();
      const neo4jClient = getNeo4jClient();

      // Get user count from both systems
      const [keycloakMetrics, neo4jCount] = await Promise.all([
        keycloakClient.getMetrics(realm),
        this.getNeo4jUserCount(neo4jClient, realm)
      ]);

      const keycloakCount = keycloakMetrics.success ? (keycloakMetrics.data?.userCount || 0) : 0;
      const discrepancy = Math.abs(keycloakCount - neo4jCount);
      const issues: string[] = [];

      if (!keycloakMetrics.success) {
        issues.push('Failed to get Keycloak metrics');
      }

      if (discrepancy > 0) {
        issues.push(`User count mismatch: Keycloak(${keycloakCount}) vs Neo4j(${neo4jCount})`);
      }

      const isValid = issues.length === 0;

      logger.info('Sync integrity validation completed', {
        realm,
        isValid,
        keycloakCount,
        neo4jCount,
        discrepancy,
        issueCount: issues.length
      });

      return {
        isValid,
        keycloakCount,
        neo4jCount,
        discrepancy,
        issues
      };

    } catch (error) {
      logger.error('Sync integrity validation failed', {
        realm,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        isValid: false,
        keycloakCount: 0,
        neo4jCount: 0,
        discrepancy: 0,
        issues: ['Validation failed due to error']
      };
    }
  }

  private async getNeo4jUserCount(neo4jClient: any, realm: string): Promise<number> {
    try {
      const response = await neo4jClient.readQuery({
        query: 'MATCH (u:User {realm: $realm}) RETURN count(u) as count',
        parameters: { realm }
      });

      if (response.success && response.data?.records.length > 0) {
        return response.data.records[0].count || 0;
      }

      return 0;
    } catch (error) {
      logger.warn('Failed to get Neo4j user count', {
        realm,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }
}