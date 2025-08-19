import { BaseMCPClient } from './client';
import { MCPResponse } from '../types';
import { logger } from '../utils/logger';

export interface KeycloakUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  createdTimestamp: number;
}

export interface KeycloakRealm {
  id: string;
  realm: string;
  displayName?: string;
  enabled: boolean;
}

export interface KeycloakAdminEvent {
  id: string;
  time: number;
  realmId: string;
  authDetails: {
    realmId: string;
    clientId: string;
    userId: string;
  };
  operationType: string;
  resourceType: string;
  resourcePath: string;
  representation?: string;
}

export interface KeycloakMetrics {
  userCount: number;
  activeUsers: number;
  realms: string[];
  timestamp: string;
}

export class KeycloakMCPClient extends BaseMCPClient {
  constructor(baseUrl: string) {
    super('keycloak', baseUrl);
  }

  // User Management Operations
  async createUser(userData: {
    username: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    enabled?: boolean;
    realm?: string;
  }): Promise<MCPResponse<{ userId: string }>> {
    return this.callTool('create-user', userData);
  }

  async deleteUser(userId: string, realm: string = 'master'): Promise<MCPResponse<{ success: boolean }>> {
    return this.callTool('delete-user', { userId, realm });
  }

  async listUsers(realm: string = 'master', options?: {
    max?: number;
    first?: number;
    search?: string;
  }): Promise<MCPResponse<KeycloakUser[]>> {
    return this.callTool('list-users', { realm, ...options });
  }

  // Realm Management Operations
  async listRealms(): Promise<MCPResponse<KeycloakRealm[]>> {
    return this.callTool('list-realms', {});
  }

  // Event and Audit Operations
  async listAdminEvents(realm: string = 'master', options?: {
    max?: number;
    first?: number;
    dateFrom?: string;
    dateTo?: string;
    operationTypes?: string[];
  }): Promise<MCPResponse<KeycloakAdminEvent[]>> {
    return this.callTool('list-admin-events', { realm, ...options });
  }

  async getEventDetails(eventId: string, realm: string = 'master'): Promise<MCPResponse<KeycloakAdminEvent>> {
    return this.callTool('get-event-details', { eventId, realm });
  }

  async listUserEvents(realm: string = 'master', options?: {
    max?: number;
    first?: number;
    dateFrom?: string;
    dateTo?: string;
    userId?: string;
  }): Promise<MCPResponse<any[]>> {
    return this.callTool('list-user-events', { realm, ...options });
  }

  // Metrics and Analytics
  async getMetrics(realm: string = 'master'): Promise<MCPResponse<KeycloakMetrics>> {
    return this.callTool('get-metrics', { realm });
  }

  // Convenience methods for common operations
  async findUserByUsername(username: string, realm: string = 'master'): Promise<MCPResponse<KeycloakUser | null>> {
    try {
      const response = await this.listUsers(realm, { search: username, max: 1 });
      
      if (!response.success || !response.data) {
        return { success: false, error: response.error };
      }

      const user = response.data.find((u: KeycloakUser) => u.username === username) || null;
      
      return {
        success: true,
        data: user,
        metadata: response.metadata
      };

    } catch (error) {
      logger.error('Failed to find user by username', {
        username,
        realm,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getUserCount(realm: string = 'master'): Promise<MCPResponse<number>> {
    try {
      const response = await this.getMetrics(realm);
      
      if (!response.success) {
        return { success: false, error: response.error };
      }

      return {
        success: true,
        data: response.data?.userCount || 0,
        metadata: response.metadata
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getRecentAdminActivity(realm: string = 'master', hours: number = 24): Promise<MCPResponse<KeycloakAdminEvent[]>> {
    const dateFrom = new Date(Date.now() - (hours * 60 * 60 * 1000)).toISOString();
    
    return this.listAdminEvents(realm, {
      dateFrom,
      max: 100,
      operationTypes: ['CREATE', 'UPDATE', 'DELETE']
    });
  }
}