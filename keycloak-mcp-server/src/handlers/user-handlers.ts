import { KeycloakClientService } from '../services/keycloak-client.js';
import { 
  CreateUserSchema, 
  UpdateUserSchema, 
  DeleteUserSchema, 
  ListUsersSchema 
} from '../types/index.js';

export class UserHandlers {
  constructor(private keycloakService: KeycloakClientService) {}

  async createUser(data: typeof CreateUserSchema._type): Promise<{ userId: string }> {
    try {
      const userId = await this.keycloakService.createUser(data);
      return { userId };
    } catch (error) {
      throw new Error(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateUser(data: typeof UpdateUserSchema._type): Promise<void> {
    try {
      await this.keycloakService.updateUser(data);
    } catch (error) {
      throw new Error(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteUser(data: typeof DeleteUserSchema._type): Promise<void> {
    try {
      await this.keycloakService.deleteUser(data);
    } catch (error) {
      throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listUsers(data: typeof ListUsersSchema._type): Promise<any[]> {
    try {
      return await this.keycloakService.listUsers(data);
    } catch (error) {
      throw new Error(`Failed to list users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUser(userId: string, realm: string): Promise<any> {
    try {
      return await this.keycloakService.getUser(userId, realm);
    } catch (error) {
      throw new Error(`Failed to get user '${userId}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async resetUserPassword(realm: string, userId: string, newPassword: string, temporary: boolean = true): Promise<void> {
    try {
      await this.keycloakService.resetUserPassword(realm, userId, newPassword, temporary);
    } catch (error) {
      throw new Error(`Failed to reset user password: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendVerificationEmail(realm: string, userId: string): Promise<void> {
    try {
      await this.keycloakService.sendVerificationEmail(realm, userId);
    } catch (error) {
      throw new Error(`Failed to send verification email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUserGroups(realm: string, userId: string): Promise<any[]> {
    try {
      return await this.keycloakService.getUserGroups(realm, userId);
    } catch (error) {
      throw new Error(`Failed to get user groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUserRoles(realm: string, userId: string): Promise<any[]> {
    try {
      return await this.keycloakService.getUserRoles(realm, userId);
    } catch (error) {
      throw new Error(`Failed to get user roles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
