import { KeycloakClientService } from '../services/keycloak-client.js';

export class RealmHandlers {
  constructor(private keycloakService: KeycloakClientService) {}

  async listRealms(): Promise<any[]> {
    try {
      return await this.keycloakService.listRealms();
    } catch (error) {
      throw new Error(`Failed to list realms: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRealm(realm: string): Promise<any> {
    try {
      return await this.keycloakService.getRealm(realm);
    } catch (error) {
      throw new Error(`Failed to get realm '${realm}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createRealm(realmData: any): Promise<void> {
    try {
      await this.keycloakService.createRealm(realmData);
    } catch (error) {
      throw new Error(`Failed to create realm: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateRealm(realm: string, realmData: any): Promise<void> {
    try {
      await this.keycloakService.updateRealm(realm, realmData);
    } catch (error) {
      throw new Error(`Failed to update realm '${realm}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteRealm(realm: string): Promise<void> {
    try {
      await this.keycloakService.deleteRealm(realm);
    } catch (error) {
      throw new Error(`Failed to delete realm '${realm}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRealmConfig(realm: string): Promise<any> {
    try {
      return await this.keycloakService.getRealmConfig(realm);
    } catch (error) {
      throw new Error(`Failed to get realm config '${realm}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getPasswordPolicy(realm: string): Promise<any> {
    try {
      return await this.keycloakService.getPasswordPolicy(realm);
    } catch (error) {
      throw new Error(`Failed to get password policy '${realm}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getBruteForceDetection(realm: string): Promise<any> {
    try {
      return await this.keycloakService.getBruteForceDetection(realm);
    } catch (error) {
      throw new Error(`Failed to get brute-force settings '${realm}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getOtpPolicy(realm: string): Promise<any> {
    try {
      return await this.keycloakService.getOtpPolicy(realm);
    } catch (error) {
      throw new Error(`Failed to get OTP policy '${realm}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getEventsConfig(realm: string): Promise<any> {
    try {
      return await this.keycloakService.getEventsConfig(realm);
    } catch (error) {
      throw new Error(`Failed to get events config '${realm}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
