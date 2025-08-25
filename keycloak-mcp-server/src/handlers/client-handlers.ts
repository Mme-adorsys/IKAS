import { KeycloakClientService } from '../services/keycloak-client.js';
import { 
  CreateClientSchema, 
  UpdateClientSchema, 
  DeleteClientSchema, 
  ListClientsSchema 
} from '../types/index.js';

export class ClientHandlers {
  constructor(private keycloakService: KeycloakClientService) {}

  async createClient(data: typeof CreateClientSchema._type): Promise<{ clientId: string }> {
    try {
      const clientId = await this.keycloakService.createClient(data);
      return { clientId };
    } catch (error) {
      throw new Error(`Failed to create client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateClient(data: typeof UpdateClientSchema._type): Promise<void> {
    try {
      await this.keycloakService.updateClient(data);
    } catch (error) {
      throw new Error(`Failed to update client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteClient(data: typeof DeleteClientSchema._type): Promise<void> {
    try {
      await this.keycloakService.deleteClient(data);
    } catch (error) {
      throw new Error(`Failed to delete client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listClients(data: typeof ListClientsSchema._type): Promise<any[]> {
    try {
      return await this.keycloakService.listClients(data);
    } catch (error) {
      throw new Error(`Failed to list clients: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getClient(clientId: string, realm: string): Promise<any> {
    try {
      return await this.keycloakService.getClient(clientId, realm);
    } catch (error) {
      throw new Error(`Failed to get client '${clientId}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getClientSecret(realm: string, clientId: string): Promise<any> {
    try {
      return await this.keycloakService.getClientSecret(realm, clientId);
    } catch (error) {
      throw new Error(`Failed to get client secret: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async regenerateClientSecret(realm: string, clientId: string): Promise<any> {
    try {
      return await this.keycloakService.regenerateClientSecret(realm, clientId);
    } catch (error) {
      throw new Error(`Failed to regenerate client secret: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getClientRoles(realm: string, clientId: string): Promise<any[]> {
    try {
      return await this.keycloakService.getClientRoles(realm, clientId);
    } catch (error) {
      throw new Error(`Failed to get client roles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getClientUsers(realm: string, clientId: string, first?: number, max?: number): Promise<any[]> {
    try {
      return await this.keycloakService.getClientUsers(realm, clientId, first, max);
    } catch (error) {
      throw new Error(`Failed to get client users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
