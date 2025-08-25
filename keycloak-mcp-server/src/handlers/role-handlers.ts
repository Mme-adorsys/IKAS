import { KeycloakClientService } from '../services/keycloak-client.js';
import { 
  CreateRoleSchema, 
  UpdateRoleSchema, 
  DeleteRoleSchema, 
  ListRolesSchema 
} from '../types/index.js';

export class RoleHandlers {
  constructor(private keycloakService: KeycloakClientService) {}

  async createRole(data: typeof CreateRoleSchema._type): Promise<{ roleId: string }> {
    try {
      const roleId = await this.keycloakService.createRole(data);
      return { roleId };
    } catch (error) {
      throw new Error(`Failed to create role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateRole(data: typeof UpdateRoleSchema._type): Promise<void> {
    try {
      await this.keycloakService.updateRole(data);
    } catch (error) {
      throw new Error(`Failed to update role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteRole(data: typeof DeleteRoleSchema._type): Promise<void> {
    try {
      await this.keycloakService.deleteRole(data);
    } catch (error) {
      throw new Error(`Failed to delete role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listRoles(data: typeof ListRolesSchema._type): Promise<any[]> {
    try {
      return await this.keycloakService.listRoles(data);
    } catch (error) {
      throw new Error(`Failed to list roles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRole(roleId: string, realm: string): Promise<any> {
    try {
      return await this.keycloakService.getRole(roleId, realm);
    } catch (error) {
      throw new Error(`Failed to get role '${roleId}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRoleUsers(realm: string, roleId: string, first?: number, max?: number): Promise<any[]> {
    try {
      return await this.keycloakService.getRoleUsers(realm, roleId, first, max);
    } catch (error) {
      throw new Error(`Failed to get role users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRoleGroups(realm: string, roleId: string, first?: number, max?: number): Promise<any[]> {
    try {
      return await this.keycloakService.getRoleGroups(realm, roleId, first, max);
    } catch (error) {
      throw new Error(`Failed to get role groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async assignRoleToUser(realm: string, userId: string, roleId: string): Promise<void> {
    try {
      await this.keycloakService.assignRoleToUser(realm, userId, roleId);
    } catch (error) {
      throw new Error(`Failed to assign role to user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async removeRoleFromUser(realm: string, userId: string, roleId: string): Promise<void> {
    try {
      await this.keycloakService.removeRoleFromUser(realm, userId, roleId);
    } catch (error) {
      throw new Error(`Failed to remove role from user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async assignRoleToGroup(realm: string, groupId: string, roleId: string): Promise<void> {
    try {
      await this.keycloakService.assignRoleToGroup(realm, groupId, roleId);
    } catch (error) {
      throw new Error(`Failed to assign role to group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async removeRoleFromGroup(realm: string, groupId: string, roleId: string): Promise<void> {
    try {
      await this.keycloakService.removeRoleFromGroup(realm, groupId, roleId);
    } catch (error) {
      throw new Error(`Failed to remove role from group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRoleComposites(realm: string, roleId: string): Promise<any[]> {
    try {
      return await this.keycloakService.getRoleComposites(realm, roleId);
    } catch (error) {
      throw new Error(`Failed to get role composites: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async addCompositeRole(realm: string, roleId: string, compositeRoleId: string): Promise<void> {
    try {
      await this.keycloakService.addCompositeRole(realm, roleId, compositeRoleId);
    } catch (error) {
      throw new Error(`Failed to add composite role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async removeCompositeRole(realm: string, roleId: string, compositeRoleId: string): Promise<void> {
    try {
      await this.keycloakService.removeCompositeRole(realm, roleId, compositeRoleId);
    } catch (error) {
      throw new Error(`Failed to remove composite role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
