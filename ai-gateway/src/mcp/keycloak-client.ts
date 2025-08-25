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
  emailVerified?: boolean;
  createdTimestamp: number;
}

export interface KeycloakRealm {
  id: string;
  realm: string;
  displayName?: string;
  displayNameHtml?: string;
  enabled: boolean;
  userManagedAccessAllowed?: boolean;
  loginTheme?: string;
  accountTheme?: string;
  adminTheme?: string;
  emailTheme?: string;
}

export interface KeycloakClient {
  id?: string;
  clientId: string;
  name?: string;
  description?: string;
  enabled: boolean;
  publicClient?: boolean;
  standardFlowEnabled?: boolean;
  implicitFlowEnabled?: boolean;
  directAccessGrantsEnabled?: boolean;
  serviceAccountsEnabled?: boolean;
  redirectUris?: string[];
  webOrigins?: string[];
}

export interface KeycloakGroup {
  id: string;
  name: string;
  parentId?: string;
  path?: string;
  attributes?: Record<string, any>;
  subGroups?: KeycloakGroup[];
}

export interface KeycloakRole {
  id: string;
  name: string;
  description?: string;
  composite?: boolean;
  clientRole?: boolean;
  containerId?: string;
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

export interface KeycloakUserEvent {
  id: string;
  time: number;
  type: string;
  realmId: string;
  clientId: string;
  userId: string;
  ipAddress: string;
  details?: Record<string, any>;
}

export interface KeycloakMetrics {
  userCount: number;
  activeUsers: number;
  realms: string[];
  timestamp: string;
}

export interface KeycloakSession {
  id: string;
  userId: string;
  username: string;
  ipAddress: string;
  start: number;
  lastAccess: number;
  clients?: Record<string, string>;
}

export interface KeycloakServerInfo {
  systemInfo: {
    version: string;
    uptime: string;
    uptimeMillis: number;
  };
  memoryInfo: {
    total: number;
    totalFormated: string;
    used: number;
    usedFormated: string;
    free: number;
    freePercentage: number;
    freeFormated: string;
  };
  themes: Record<string, string[]>;
  providers: Record<string, any>;
}

export class KeycloakMCPClient extends BaseMCPClient {
  constructor(baseUrl: string) {
    super('keycloak', baseUrl);
  }

  // ===== REALM MANAGEMENT OPERATIONS =====
  
  async listRealms(): Promise<MCPResponse<KeycloakRealm[]>> {
    return this.callTool('list-realms', {});
  }

  async getRealm(realm: string): Promise<MCPResponse<KeycloakRealm>> {
    return this.callTool('get-realm', { realm });
  }

  async createRealm(realmData: {
    realm: string;
    displayName?: string;
    enabled?: boolean;
    displayNameHtml?: string;
    userManagedAccessAllowed?: boolean;
    loginTheme?: string;
    accountTheme?: string;
    adminTheme?: string;
    emailTheme?: string;
  }): Promise<MCPResponse<void>> {
    return this.callTool('create-realm', realmData);
  }

  async updateRealm(realm: string, updates: {
    displayName?: string;
    enabled?: boolean;
    displayNameHtml?: string;
    userManagedAccessAllowed?: boolean;
    loginTheme?: string;
    accountTheme?: string;
    adminTheme?: string;
    emailTheme?: string;
  }): Promise<MCPResponse<void>> {
    return this.callTool('update-realm', { realm, ...updates });
  }

  async deleteRealm(realm: string): Promise<MCPResponse<void>> {
    return this.callTool('delete-realm', { realm });
  }

  // ===== USER MANAGEMENT OPERATIONS =====

  async createUser(userData: {
    realm: string;
    username: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    enabled?: boolean;
    emailVerified?: boolean;
  }): Promise<MCPResponse<{ userId: string }>> {
    return this.callTool('create-user', userData);
  }

  async updateUser(userData: {
    realm: string;
    userId: string;
    username?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    enabled?: boolean;
    emailVerified?: boolean;
  }): Promise<MCPResponse<void>> {
    return this.callTool('update-user', userData);
  }

  async deleteUser(realm: string, userId: string): Promise<MCPResponse<void>> {
    return this.callTool('delete-user', { realm, userId });
  }

  async listUsers(realm: string = 'master', options?: {
    username?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    enabled?: boolean;
    emailVerified?: boolean;
    first?: number;
    max?: number;
  }): Promise<MCPResponse<KeycloakUser[]>> {
    return this.callTool('list-users', { realm, ...options });
  }

  async getUser(realm: string, userId: string): Promise<MCPResponse<KeycloakUser>> {
    return this.callTool('get-user', { realm, userId });
  }

  async resetUserPassword(realm: string, userId: string, newPassword: string, temporary: boolean = true): Promise<MCPResponse<void>> {
    return this.callTool('reset-user-password', { realm, userId, newPassword, temporary });
  }

  async sendVerificationEmail(realm: string, userId: string): Promise<MCPResponse<void>> {
    return this.callTool('send-verification-email', { realm, userId });
  }

  async getUserGroups(realm: string, userId: string): Promise<MCPResponse<KeycloakGroup[]>> {
    return this.callTool('get-user-groups', { realm, userId });
  }

  async getUserRoles(realm: string, userId: string): Promise<MCPResponse<KeycloakRole[]>> {
    return this.callTool('get-user-roles', { realm, userId });
  }

  // ===== CLIENT MANAGEMENT OPERATIONS =====

  async createClient(clientData: {
    realm: string;
    clientId: string;
    name?: string;
    description?: string;
    enabled?: boolean;
    publicClient?: boolean;
    standardFlowEnabled?: boolean;
    implicitFlowEnabled?: boolean;
    directAccessGrantsEnabled?: boolean;
    serviceAccountsEnabled?: boolean;
    redirectUris?: string[];
    webOrigins?: string[];
  }): Promise<MCPResponse<{ clientId: string }>> {
    return this.callTool('create-client', clientData);
  }

  async updateClient(clientData: {
    realm: string;
    clientId: string;
    name?: string;
    description?: string;
    enabled?: boolean;
    publicClient?: boolean;
    standardFlowEnabled?: boolean;
    implicitFlowEnabled?: boolean;
    directAccessGrantsEnabled?: boolean;
    serviceAccountsEnabled?: boolean;
    redirectUris?: string[];
    webOrigins?: string[];
  }): Promise<MCPResponse<void>> {
    return this.callTool('update-client', clientData);
  }

  async deleteClient(realm: string, clientId: string): Promise<MCPResponse<void>> {
    return this.callTool('delete-client', { realm, clientId });
  }

  async listClients(realm: string, options?: {
    clientId?: string;
    name?: string;
    enabled?: boolean;
    first?: number;
    max?: number;
  }): Promise<MCPResponse<KeycloakClient[]>> {
    return this.callTool('list-clients', { realm, ...options });
  }

  async getClient(realm: string, clientId: string): Promise<MCPResponse<KeycloakClient>> {
    return this.callTool('get-client', { realm, clientId });
  }

  async getClientSecret(realm: string, clientId: string): Promise<MCPResponse<{ value: string }>> {
    return this.callTool('get-client-secret', { realm, clientId });
  }

  async regenerateClientSecret(realm: string, clientId: string): Promise<MCPResponse<{ value: string }>> {
    return this.callTool('regenerate-client-secret', { realm, clientId });
  }

  async getClientRoles(realm: string, clientId: string): Promise<MCPResponse<KeycloakRole[]>> {
    return this.callTool('get-client-roles', { realm, clientId });
  }

  async getClientUsers(realm: string, clientId: string, first?: number, max?: number): Promise<MCPResponse<KeycloakUser[]>> {
    return this.callTool('get-client-users', { realm, clientId, first, max });
  }

  // ===== GROUP MANAGEMENT OPERATIONS =====

  async createGroup(groupData: {
    realm: string;
    name: string;
    parentId?: string;
    attributes?: Record<string, any>;
  }): Promise<MCPResponse<{ groupId: string }>> {
    return this.callTool('create-group', groupData);
  }

  async updateGroup(groupData: {
    realm: string;
    groupId: string;
    name?: string;
    parentId?: string;
    attributes?: Record<string, any>;
  }): Promise<MCPResponse<void>> {
    return this.callTool('update-group', groupData);
  }

  async deleteGroup(realm: string, groupId: string): Promise<MCPResponse<void>> {
    return this.callTool('delete-group', { realm, groupId });
  }

  async listGroups(realm: string, options?: {
    name?: string;
    parentId?: string;
    first?: number;
    max?: number;
  }): Promise<MCPResponse<KeycloakGroup[]>> {
    return this.callTool('list-groups', { realm, ...options });
  }

  async getGroup(realm: string, groupId: string): Promise<MCPResponse<KeycloakGroup>> {
    return this.callTool('get-group', { realm, groupId });
  }

  async getGroupMembers(realm: string, groupId: string, first?: number, max?: number): Promise<MCPResponse<KeycloakUser[]>> {
    return this.callTool('get-group-members', { realm, groupId, first, max });
  }

  async addUserToGroup(realm: string, userId: string, groupId: string): Promise<MCPResponse<void>> {
    return this.callTool('add-user-to-group', { realm, userId, groupId });
  }

  async removeUserFromGroup(realm: string, userId: string, groupId: string): Promise<MCPResponse<void>> {
    return this.callTool('remove-user-from-group', { realm, userId, groupId });
  }

  async getGroupRoles(realm: string, groupId: string): Promise<MCPResponse<KeycloakRole[]>> {
    return this.callTool('get-group-roles', { realm, groupId });
  }

  async getGroupHierarchy(realm: string, groupId?: string): Promise<MCPResponse<KeycloakGroup[]>> {
    return this.callTool('get-group-hierarchy', { realm, groupId });
  }

  // ===== ROLE MANAGEMENT OPERATIONS =====

  async createRole(roleData: {
    realm: string;
    name: string;
    description?: string;
    composite?: boolean;
    clientRole?: boolean;
    clientId?: string;
  }): Promise<MCPResponse<{ roleId: string }>> {
    return this.callTool('create-role', roleData);
  }

  async updateRole(roleData: {
    realm: string;
    roleId: string;
    name?: string;
    description?: string;
    composite?: boolean;
  }): Promise<MCPResponse<void>> {
    return this.callTool('update-role', roleData);
  }

  async deleteRole(realm: string, roleId: string): Promise<MCPResponse<void>> {
    return this.callTool('delete-role', { realm, roleId });
  }

  async listRoles(realm: string, options?: {
    name?: string;
    clientRole?: boolean;
    clientId?: string;
    first?: number;
    max?: number;
  }): Promise<MCPResponse<KeycloakRole[]>> {
    return this.callTool('list-roles', { realm, ...options });
  }

  async getRole(realm: string, roleId: string): Promise<MCPResponse<KeycloakRole>> {
    return this.callTool('get-role', { realm, roleId });
  }

  async getRoleUsers(realm: string, roleId: string, first?: number, max?: number): Promise<MCPResponse<KeycloakUser[]>> {
    return this.callTool('get-role-users', { realm, roleId, first, max });
  }

  async getRoleGroups(realm: string, roleId: string, first?: number, max?: number): Promise<MCPResponse<KeycloakGroup[]>> {
    return this.callTool('get-role-groups', { realm, roleId, first, max });
  }

  async assignRoleToUser(realm: string, userId: string, roleId: string): Promise<MCPResponse<void>> {
    return this.callTool('assign-role-to-user', { realm, userId, roleId });
  }

  async removeRoleFromUser(realm: string, userId: string, roleId: string): Promise<MCPResponse<void>> {
    return this.callTool('remove-role-from-user', { realm, userId, roleId });
  }

  async assignRoleToGroup(realm: string, groupId: string, roleId: string): Promise<MCPResponse<void>> {
    return this.callTool('assign-role-to-group', { realm, groupId, roleId });
  }

  async removeRoleFromGroup(realm: string, groupId: string, roleId: string): Promise<MCPResponse<void>> {
    return this.callTool('remove-role-from-group', { realm, groupId, roleId });
  }

  async getRoleComposites(realm: string, roleId: string): Promise<MCPResponse<KeycloakRole[]>> {
    return this.callTool('get-role-composites', { realm, roleId });
  }

  async addCompositeRole(realm: string, roleId: string, compositeRoleId: string): Promise<MCPResponse<void>> {
    return this.callTool('add-composite-role', { realm, roleId, compositeRoleId });
  }

  async removeCompositeRole(realm: string, roleId: string, compositeRoleId: string): Promise<MCPResponse<void>> {
    return this.callTool('remove-composite-role', { realm, roleId, compositeRoleId });
  }

  // ===== EVENT MANAGEMENT OPERATIONS =====

  async listAdminEvents(realm: string, options?: {
    fromDate?: string;
    toDate?: string;
    eventType?: string;
    resourceType?: string;
    resourcePath?: string;
    clientId?: string;
    userId?: string;
    success?: boolean;
    sortBy?: 'time' | 'eventType' | 'resourceType' | 'clientId';
    sortOrder?: 'asc' | 'desc';
    first?: number;
    max?: number;
  }): Promise<MCPResponse<KeycloakAdminEvent[]>> {
    return this.callTool('list-admin-events', { realm, ...options });
  }

  async listUserEvents(realm: string, options?: {
    fromDate?: string;
    toDate?: string;
    type?: string;
    clientId?: string;
    userId?: string;
    ipAddress?: string;
    sortBy?: 'time' | 'type' | 'clientId' | 'userId' | 'ipAddress';
    sortOrder?: 'asc' | 'desc';
    first?: number;
    max?: number;
  }): Promise<MCPResponse<KeycloakUserEvent[]>> {
    return this.callTool('list-user-events', { realm, ...options });
  }

  async getEventDetails(realm: string, eventId: string): Promise<MCPResponse<KeycloakAdminEvent | KeycloakUserEvent>> {
    return this.callTool('get-event-details', { realm, eventId });
  }

  async getEventTypes(realm: string): Promise<MCPResponse<string[]>> {
    return this.callTool('get-event-types', { realm });
  }

  async getResourceTypes(realm: string): Promise<MCPResponse<string[]>> {
    return this.callTool('get-resource-types', { realm });
  }

  async exportEvents(realm: string, options?: {
    fromDate?: string;
    toDate?: string;
    eventType?: string;
    resourceType?: string;
    format?: 'csv' | 'json';
    includeDetails?: boolean;
  }): Promise<MCPResponse<{ data: string; format: string }>> {
    return this.callTool('export-events', { realm, ...options });
  }

  // ===== METRICS AND MONITORING OPERATIONS =====

  async getMetrics(): Promise<MCPResponse<string>> {
    return this.callTool('get-metrics', {});
  }

  async getKeycloakServerInfo(): Promise<MCPResponse<KeycloakServerInfo>> {
    return this.callTool('get-server-info', {});
  }

  async getRealmStats(realm: string): Promise<MCPResponse<{
    userCount: number;
    enabledUsers: number;
    disabledUsers: number;
    groupCount: number;
    roleCount: number;
    clientCount: number;
  }>> {
    return this.callTool('get-realm-stats', { realm });
  }

  async getUserSessions(realm: string, clientId?: string, userId?: string): Promise<MCPResponse<KeycloakSession[]>> {
    return this.callTool('get-user-sessions', { realm, clientId, userId });
  }

  async getClientSessions(realm: string, clientId?: string, userId?: string): Promise<MCPResponse<KeycloakSession[]>> {
    return this.callTool('get-client-sessions', { realm, clientId, userId });
  }

  async getOfflineSessions(realm: string, clientId?: string, userId?: string): Promise<MCPResponse<KeycloakSession[]>> {
    return this.callTool('get-offline-sessions', { realm, clientId, userId });
  }

  async getRealmKeys(realm: string): Promise<MCPResponse<any[]>> {
    return this.callTool('get-realm-keys', { realm });
  }

  async getAuthenticationFlows(realm: string): Promise<MCPResponse<any[]>> {
    return this.callTool('get-authentication-flows', { realm });
  }

  async getIdentityProviders(realm: string): Promise<MCPResponse<any[]>> {
    return this.callTool('get-identity-providers', { realm });
  }

  async getClientScopes(realm: string): Promise<MCPResponse<any[]>> {
    return this.callTool('get-client-scopes', { realm });
  }

  // Convenience methods for common operations
  async findUserByUsername(username: string, realm: string = 'master'): Promise<MCPResponse<KeycloakUser | null>> {
    try {
      const response = await this.listUsers(realm, { username: username, max: 1 });
      
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
      const response = await this.getRealmStats(realm);
      
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
    const fromDate = new Date(Date.now() - (hours * 60 * 60 * 1000)).toISOString();
    
    return this.listAdminEvents(realm, {
      fromDate,
      max: 100
    });
  }
}