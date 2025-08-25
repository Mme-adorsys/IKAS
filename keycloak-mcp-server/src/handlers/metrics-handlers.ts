import { KeycloakClientService } from '../services/keycloak-client.js';

export class MetricsHandlers {
  constructor(private keycloakService: KeycloakClientService) {}

  async getMetrics(): Promise<string> {
    try {
      return await this.keycloakService.getMetrics();
    } catch (error) {
      throw new Error(`Failed to get metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getServerInfo(): Promise<any> {
    try {
      return await this.keycloakService.getServerInfo();
    } catch (error) {
      throw new Error(`Failed to get server info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRealmStats(realm: string): Promise<any> {
    try {
      return await this.keycloakService.getRealmStats(realm);
    } catch (error) {
      throw new Error(`Failed to get realm stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUserSessions(realm: string, clientId?: string, userId?: string): Promise<any[]> {
    try {
      return await this.keycloakService.getUserSessions(realm, clientId, userId);
    } catch (error) {
      throw new Error(`Failed to get user sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getClientSessions(realm: string, clientId?: string, userId?: string): Promise<any[]> {
    try {
      return await this.keycloakService.getClientSessions(realm, clientId, userId);
    } catch (error) {
      throw new Error(`Failed to get client sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getOfflineSessions(realm: string, clientId?: string, userId?: string): Promise<any[]> {
    try {
      return await this.keycloakService.getOfflineSessions(realm, clientId, userId);
    } catch (error) {
      throw new Error(`Failed to get offline sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRealmKeys(realm: string): Promise<any> {
    try {
      return await this.keycloakService.getRealmKeys(realm);
    } catch (error) {
      throw new Error(`Failed to get realm keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAuthenticationFlows(realm: string): Promise<any> {
    try {
      return await this.keycloakService.getAuthenticationFlows(realm);
    } catch (error) {
      throw new Error(`Failed to get authentication flows: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getIdentityProviders(realm: string): Promise<any[]> {
    try {
      return await this.keycloakService.getIdentityProviders(realm);
    } catch (error) {
      throw new Error(`Failed to get identity providers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getClientScopes(realm: string): Promise<any[]> {
    try {
      return await this.keycloakService.getClientScopes(realm);
    } catch (error) {
      throw new Error(`Failed to get client scopes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
