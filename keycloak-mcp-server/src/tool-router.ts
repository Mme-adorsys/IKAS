import { KeycloakClientService } from './services/keycloak-client.js';
import { RealmHandlers } from './handlers/realm-handlers.js';
import { UserHandlers } from './handlers/user-handlers.js';
import { ClientHandlers } from './handlers/client-handlers.js';
import { GroupHandlers } from './handlers/group-handlers.js';
import { RoleHandlers } from './handlers/role-handlers.js';
import { EventHandlers } from './handlers/event-handlers.js';
import { MetricsHandlers } from './handlers/metrics-handlers.js';

export class ToolRouter {
  private keycloakService: KeycloakClientService;
  private realmHandlers: RealmHandlers;
  private userHandlers: UserHandlers;
  private clientHandlers: ClientHandlers;
  private groupHandlers: GroupHandlers;
  private roleHandlers: RoleHandlers;
  private eventHandlers: EventHandlers;
  private metricsHandlers: MetricsHandlers;

  constructor(keycloakService: KeycloakClientService) {
    this.keycloakService = keycloakService;
    this.realmHandlers = new RealmHandlers(keycloakService);
    this.userHandlers = new UserHandlers(keycloakService);
    this.clientHandlers = new ClientHandlers(keycloakService);
    this.groupHandlers = new GroupHandlers(keycloakService);
    this.roleHandlers = new RoleHandlers(keycloakService);
    this.eventHandlers = new EventHandlers(keycloakService);
    this.metricsHandlers = new MetricsHandlers(keycloakService);
  }

  async handleToolCall(toolName: string, arguments_: any): Promise<any> {
    try {
      return await this.dispatchTool(toolName, arguments_);
    } catch (error) {
      if (KeycloakClientService.isAuthError(error)) {
        console.log(`🔄 Tool '${toolName}' hit auth error, forcing reauth and retrying once`);
        try {
          await this.keycloakService.forceReauth();
        } catch (reauthError) {
          const reauthMsg = reauthError instanceof Error ? reauthError.message : 'Unknown error';
          throw new Error(`Tool execution failed for '${toolName}': reauth after 401 failed: ${reauthMsg}`);
        }
        try {
          return await this.dispatchTool(toolName, arguments_);
        } catch (retryError) {
          const retryMsg = retryError instanceof Error ? retryError.message : 'Unknown error';
          throw new Error(`Tool execution failed for '${toolName}': ${retryMsg}`);
        }
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Tool execution failed for '${toolName}': ${message}`);
    }
  }

  private async dispatchTool(toolName: string, arguments_: any): Promise<any> {
    switch (toolName) {
        // Realm operations
        case 'list-realms':
          return await this.realmHandlers.listRealms();
        
        case 'get-realm':
          return await this.realmHandlers.getRealm(arguments_.realm);
        
        case 'create-realm':
          return await this.realmHandlers.createRealm(arguments_);
        
        case 'update-realm':
          const { realm, ...updateData } = arguments_;
          return await this.realmHandlers.updateRealm(realm, updateData);
        
        case 'delete-realm':
          return await this.realmHandlers.deleteRealm(arguments_.realm);

        // User operations
        case 'create-user':
          return await this.userHandlers.createUser(arguments_);
        
        case 'update-user':
          return await this.userHandlers.updateUser(arguments_);
        
        case 'delete-user':
          return await this.userHandlers.deleteUser(arguments_);
        
        case 'list-users':
          return await this.userHandlers.listUsers(arguments_);
        
        case 'get-user':
          return await this.userHandlers.getUser(arguments_.userId, arguments_.realm);
        
        case 'reset-user-password':
          return await this.userHandlers.resetUserPassword(
            arguments_.realm, 
            arguments_.userId, 
            arguments_.newPassword, 
            arguments_.temporary
          );
        
        case 'send-verification-email':
          return await this.userHandlers.sendVerificationEmail(arguments_.realm, arguments_.userId);

        case 'get-user-groups':
          return await this.userHandlers.getUserGroups(arguments_.realm, arguments_.userId);

        case 'get-user-roles':
          return await this.userHandlers.getUserRoles(arguments_.realm, arguments_.userId);

        // Client operations
        case 'create-client':
          return await this.clientHandlers.createClient(arguments_);
        
        case 'update-client':
          return await this.clientHandlers.updateClient(arguments_);
        
        case 'delete-client':
          return await this.clientHandlers.deleteClient(arguments_);
        
        case 'list-clients':
          return await this.clientHandlers.listClients(arguments_);
        
        case 'get-client':
          return await this.clientHandlers.getClient(arguments_.clientId, arguments_.realm);
        
        case 'get-client-secret':
          return await this.clientHandlers.getClientSecret(arguments_.realm, arguments_.clientId);
        
        case 'regenerate-client-secret':
          return await this.clientHandlers.regenerateClientSecret(arguments_.realm, arguments_.clientId);
        
        case 'get-client-roles':
          return await this.clientHandlers.getClientRoles(arguments_.realm, arguments_.clientId);

        case 'get-client-users':
          return await this.clientHandlers.getClientUsers(
            arguments_.realm, 
            arguments_.clientId, 
            arguments_.first, 
            arguments_.max
          );

        // Group operations
        case 'create-group':
          return await this.groupHandlers.createGroup(arguments_);
        
        case 'update-group':
          return await this.groupHandlers.updateGroup(arguments_);
        
        case 'delete-group':
          return await this.groupHandlers.deleteGroup(arguments_);
        
        case 'list-groups':
          return await this.groupHandlers.listGroups(arguments_);
        
        case 'get-group':
          return await this.groupHandlers.getGroup(arguments_.groupId, arguments_.realm);
        
        case 'get-group-members':
          return await this.groupHandlers.getGroupMembers(
            arguments_.realm, 
            arguments_.groupId, 
            arguments_.first, 
            arguments_.max
          );
        
        case 'add-user-to-group':
          return await this.groupHandlers.addUserToGroup(
            arguments_.realm, 
            arguments_.userId, 
            arguments_.groupId
          );
        
        case 'remove-user-from-group':
          return await this.groupHandlers.removeUserFromGroup(
            arguments_.realm, 
            arguments_.userId, 
            arguments_.groupId
          );
        
        case 'get-group-roles':
          return await this.groupHandlers.getGroupRoles(arguments_.realm, arguments_.groupId);

        case 'get-group-hierarchy':
          return await this.groupHandlers.getGroupHierarchy(arguments_.realm, arguments_.groupId);

        // Role operations
        case 'create-role':
          return await this.roleHandlers.createRole(arguments_);
        
        case 'update-role':
          return await this.roleHandlers.updateRole(arguments_);
        
        case 'delete-role':
          return await this.roleHandlers.deleteRole(arguments_);
        
        case 'list-roles':
          return await this.roleHandlers.listRoles(arguments_);
        
        case 'get-role':
          return await this.roleHandlers.getRole(arguments_.roleId, arguments_.realm);
        
        case 'get-role-users':
          return await this.roleHandlers.getRoleUsers(
            arguments_.realm, 
            arguments_.roleId, 
            arguments_.first, 
            arguments_.max
          );
        
        case 'get-role-groups':
          return await this.roleHandlers.getRoleGroups(
            arguments_.realm, 
            arguments_.roleId, 
            arguments_.first, 
            arguments_.max
          );
        
        case 'assign-role-to-user':
          return await this.roleHandlers.assignRoleToUser(
            arguments_.realm, 
            arguments_.userId, 
            arguments_.roleId
          );
        
        case 'remove-role-from-user':
          return await this.roleHandlers.removeRoleFromUser(
            arguments_.realm, 
            arguments_.userId, 
            arguments_.roleId
          );
        
        case 'assign-role-to-group':
          return await this.roleHandlers.assignRoleToGroup(
            arguments_.realm, 
            arguments_.groupId, 
            arguments_.roleId
          );
        
        case 'remove-role-from-group':
          return await this.roleHandlers.removeRoleFromGroup(
            arguments_.realm, 
            arguments_.groupId, 
            arguments_.roleId
          );

        case 'get-role-composites':
          return await this.roleHandlers.getRoleComposites(arguments_.realm, arguments_.roleId);

        case 'add-composite-role':
          return await this.roleHandlers.addCompositeRole(
            arguments_.realm, 
            arguments_.roleId, 
            arguments_.compositeRoleId
          );

        case 'remove-composite-role':
          return await this.roleHandlers.removeCompositeRole(
            arguments_.realm, 
            arguments_.roleId, 
            arguments_.compositeRoleId
          );

        // Event operations
        case 'list-admin-events':
          return await this.eventHandlers.listAdminEvents(arguments_);
        
        case 'list-user-events':
          return await this.eventHandlers.listUserEvents(arguments_);
        
        case 'get-event-details':
          return await this.eventHandlers.getEventDetails(arguments_);
        
        case 'get-event-types':
          return await this.eventHandlers.getEventTypes(arguments_.realm);
        
        case 'get-resource-types':
          return await this.eventHandlers.getResourceTypes(arguments_.realm);
        
        case 'export-events':
          return await this.eventHandlers.exportEvents(
            arguments_.realm,
            arguments_.fromDate,
            arguments_.toDate,
            arguments_.eventType,
            arguments_.resourceType,
            arguments_.format,
            arguments_.includeDetails
          );

        // Metrics operations
        case 'get-metrics':
          return await this.metricsHandlers.getMetrics();
        
        case 'get-server-info':
          return await this.metricsHandlers.getServerInfo();
        
        case 'get-realm-stats':
          return await this.metricsHandlers.getRealmStats(arguments_.realm);
        
        case 'get-user-sessions':
          return await this.metricsHandlers.getUserSessions(
            arguments_.realm, 
            arguments_.clientId, 
            arguments_.userId
          );
        
        case 'get-client-sessions':
          return await this.metricsHandlers.getClientSessions(
            arguments_.realm, 
            arguments_.clientId, 
            arguments_.userId
          );
        
        case 'get-offline-sessions':
          return await this.metricsHandlers.getOfflineSessions(
            arguments_.realm, 
            arguments_.clientId, 
            arguments_.userId
          );
        
        case 'get-realm-keys':
          return await this.metricsHandlers.getRealmKeys(arguments_.realm);
        
        case 'get-authentication-flows':
          return await this.metricsHandlers.getAuthenticationFlows(arguments_.realm);
        
        case 'get-identity-providers':
          return await this.metricsHandlers.getIdentityProviders(arguments_.realm);
        
        case 'get-client-scopes':
          return await this.metricsHandlers.getClientScopes(arguments_.realm);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
