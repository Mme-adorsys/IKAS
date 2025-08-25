import { KeycloakClientService } from '../services/keycloak-client.js';
import { 
  AdminEventFilterSchema, 
  UserEventFilterSchema, 
  GetEventDetailsSchema,
  type AdminEventFilterParams,
  type UserEventFilterParams
} from '../types/index.js';

export class EventHandlers {
  constructor(private keycloakService: KeycloakClientService) {}

  async listAdminEvents(params: AdminEventFilterParams): Promise<any[]> {
    try {
      return await this.keycloakService.listAdminEvents(params);
    } catch (error) {
      throw new Error(`Failed to list admin events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listUserEvents(params: UserEventFilterParams): Promise<any[]> {
    try {
      return await this.keycloakService.listUserEvents(params);
    } catch (error) {
      throw new Error(`Failed to list user events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getEventDetails(data: typeof GetEventDetailsSchema._type): Promise<any> {
    try {
      return await this.keycloakService.getEventDetails(data);
    } catch (error) {
      throw new Error(`Failed to get event details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getEventTypes(realm: string): Promise<string[]> {
    try {
      // This would need to be implemented in the KeycloakClientService
      // For now, we'll return a list of common event types
      return [
        'LOGIN',
        'LOGOUT',
        'REGISTER',
        'RESET_PASSWORD',
        'UPDATE_PROFILE',
        'DELETE_ACCOUNT',
        'CREATE',
        'UPDATE',
        'DELETE'
      ];
    } catch (error) {
      throw new Error(`Failed to get event types: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getResourceTypes(realm: string): Promise<string[]> {
    try {
      // This would need to be implemented in the KeycloakClientService
      // For now, we'll return a list of common resource types
      return [
        'USER',
        'CLIENT',
        'GROUP',
        'ROLE',
        'REALM',
        'IDENTITY_PROVIDER',
        'AUTHENTICATION_FLOW',
        'CLIENT_SCOPE'
      ];
    } catch (error) {
      throw new Error(`Failed to get resource types: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async exportEvents(
    realm: string, 
    fromDate?: string, 
    toDate?: string, 
    eventType?: string, 
    resourceType?: string, 
    format: 'csv' | 'json' = 'json',
    includeDetails: boolean = false
  ): Promise<string> {
    try {
      // This would need to be implemented in the KeycloakClientService
      // For now, we'll throw an error indicating it's not implemented
      throw new Error('Event export functionality not yet implemented');
    } catch (error) {
      throw new Error(`Failed to export events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
