import { KeycloakClientService } from '../services/keycloak-client.js';
import { 
  CreateGroupSchema, 
  UpdateGroupSchema, 
  DeleteGroupSchema, 
  ListGroupsSchema 
} from '../types/index.js';

export class GroupHandlers {
  constructor(private keycloakService: KeycloakClientService) {}

  async createGroup(data: typeof CreateGroupSchema._type): Promise<{ groupId: string }> {
    try {
      const groupId = await this.keycloakService.createGroup(data);
      return { groupId };
    } catch (error) {
      throw new Error(`Failed to create group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateGroup(data: typeof UpdateGroupSchema._type): Promise<void> {
    try {
      await this.keycloakService.updateGroup(data);
    } catch (error) {
      throw new Error(`Failed to update group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteGroup(data: typeof DeleteGroupSchema._type): Promise<void> {
    try {
      await this.keycloakService.deleteGroup(data);
    } catch (error) {
      throw new Error(`Failed to delete group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listGroups(data: typeof ListGroupsSchema._type): Promise<any[]> {
    try {
      return await this.keycloakService.listGroups(data);
    } catch (error) {
      throw new Error(`Failed to list groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getGroup(groupId: string, realm: string): Promise<any> {
    try {
      return await this.keycloakService.getGroup(groupId, realm);
    } catch (error) {
      throw new Error(`Failed to get group '${groupId}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getGroupMembers(realm: string, groupId: string, first?: number, max?: number): Promise<any[]> {
    try {
      return await this.keycloakService.getGroupMembers(realm, groupId, first, max);
    } catch (error) {
      throw new Error(`Failed to get group members: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async addUserToGroup(realm: string, userId: string, groupId: string): Promise<void> {
    try {
      await this.keycloakService.addUserToGroup(realm, userId, groupId);
    } catch (error) {
      throw new Error(`Failed to add user to group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async removeUserFromGroup(realm: string, userId: string, groupId: string): Promise<void> {
    try {
      await this.keycloakService.removeUserFromGroup(realm, userId, groupId);
    } catch (error) {
      throw new Error(`Failed to remove user from group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getGroupRoles(realm: string, groupId: string): Promise<any[]> {
    try {
      return await this.keycloakService.getGroupRoles(realm, groupId);
    } catch (error) {
      throw new Error(`Failed to get group roles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getGroupHierarchy(realm: string, groupId?: string): Promise<any[]> {
    try {
      return await this.keycloakService.getGroupHierarchy(realm, groupId);
    } catch (error) {
      throw new Error(`Failed to get group hierarchy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
