import { z } from 'zod';

// Common schemas
export const RealmSchema = z.object({
  realm: z.string().describe("The realm name")
});

export const PaginationSchema = z.object({
  first: z.number().optional().describe("First result to return"),
  max: z.number().optional().describe("Maximum number of results to return")
});

export const SortSchema = z.object({
  sortBy: z.string().optional().describe("Field to sort by"),
  sortOrder: z.enum(['asc', 'desc']).optional().describe("Sort order")
});

export const DateRangeSchema = z.object({
  fromDate: z.string().optional().describe("Start date (ISO format)"),
  toDate: z.string().optional().describe("End date (ISO format)")
});

// User schemas
export const CreateUserSchema = z.object({
  realm: z.string().describe("The realm name"),
  username: z.string().describe("Username for the new user"),
  email: z.string().email().describe("Email address for the user"),
  firstName: z.string().describe("First name of the user"),
  lastName: z.string().describe("Last name of the user"),
  enabled: z.boolean().optional().describe("Whether the user is enabled"),
  emailVerified: z.boolean().optional().describe("Whether the email is verified")
});

export const UpdateUserSchema = z.object({
  realm: z.string().describe("The realm name"),
  userId: z.string().describe("ID of the user to update"),
  username: z.string().optional().describe("New username"),
  email: z.string().email().optional().describe("New email address"),
  firstName: z.string().optional().describe("New first name"),
  lastName: z.string().optional().describe("New last name"),
  enabled: z.boolean().optional().describe("Whether the user is enabled"),
  emailVerified: z.boolean().optional().describe("Whether the email is verified")
});

export const DeleteUserSchema = z.object({
  realm: z.string().describe("The realm name"),
  userId: z.string().describe("ID of the user to delete")
});

export const ListUsersSchema = z.object({
  realm: z.string().describe("The realm name"),
  username: z.string().optional().describe("Filter by username"),
  email: z.string().optional().describe("Filter by email"),
  firstName: z.string().optional().describe("Filter by first name"),
  lastName: z.string().optional().describe("Filter by last name"),
  enabled: z.boolean().optional().describe("Filter by enabled status"),
  emailVerified: z.boolean().optional().describe("Filter by email verification status")
}).merge(PaginationSchema).merge(SortSchema);

// Client schemas
export const CreateClientSchema = z.object({
  realm: z.string().describe("The realm name"),
  clientId: z.string().describe("Client ID"),
  name: z.string().describe("Client name"),
  description: z.string().optional().describe("Client description"),
  enabled: z.boolean().optional().describe("Whether the client is enabled"),
  publicClient: z.boolean().optional().describe("Whether this is a public client"),
  standardFlowEnabled: z.boolean().optional().describe("Whether standard flow is enabled"),
  implicitFlowEnabled: z.boolean().optional().describe("Whether implicit flow is enabled"),
  directAccessGrantsEnabled: z.boolean().optional().describe("Whether direct access grants are enabled"),
  serviceAccountsEnabled: z.boolean().optional().describe("Whether service accounts are enabled")
});

export const UpdateClientSchema = z.object({
  realm: z.string().describe("The realm name"),
  clientId: z.string().describe("Client ID to update"),
  name: z.string().optional().describe("New client name"),
  description: z.string().optional().describe("New client description"),
  enabled: z.boolean().optional().describe("Whether the client is enabled"),
  publicClient: z.boolean().optional().describe("Whether this is a public client"),
  standardFlowEnabled: z.boolean().optional().describe("Whether standard flow is enabled"),
  implicitFlowEnabled: z.boolean().optional().describe("Whether implicit flow is enabled"),
  directAccessGrantsEnabled: z.boolean().optional().describe("Whether direct access grants are enabled"),
  serviceAccountsEnabled: z.boolean().optional().describe("Whether service accounts are enabled")
});

export const DeleteClientSchema = z.object({
  realm: z.string().describe("The realm name"),
  clientId: z.string().describe("Client ID to delete")
});

export const ListClientsSchema = z.object({
  realm: z.string().describe("The realm name"),
  clientId: z.string().optional().describe("Filter by client ID"),
  name: z.string().optional().describe("Filter by client name"),
  enabled: z.boolean().optional().describe("Filter by enabled status")
}).merge(PaginationSchema).merge(SortSchema);

// Group schemas
export const CreateGroupSchema = z.object({
  realm: z.string().describe("The realm name"),
  name: z.string().describe("Group name"),
  parentId: z.string().optional().describe("Parent group ID (for nested groups)")
});

export const UpdateGroupSchema = z.object({
  realm: z.string().describe("The realm name"),
  groupId: z.string().describe("ID of the group to update"),
  name: z.string().optional().describe("New group name"),
  parentId: z.string().optional().describe("New parent group ID")
});

export const DeleteGroupSchema = z.object({
  realm: z.string().describe("The realm name"),
  groupId: z.string().describe("ID of the group to delete")
});

export const ListGroupsSchema = z.object({
  realm: z.string().describe("The realm name"),
  name: z.string().optional().describe("Filter by group name"),
  parentId: z.string().optional().describe("Filter by parent group ID")
}).merge(PaginationSchema).merge(SortSchema);

// Role schemas
export const CreateRoleSchema = z.object({
  realm: z.string().describe("The realm name"),
  name: z.string().describe("Role name"),
  description: z.string().optional().describe("Role description"),
  composite: z.boolean().optional().describe("Whether this is a composite role"),
  clientRole: z.boolean().optional().describe("Whether this is a client role"),
  clientId: z.string().optional().describe("Client ID for client roles")
});

export const UpdateRoleSchema = z.object({
  realm: z.string().describe("The realm name"),
  roleId: z.string().describe("ID of the role to update"),
  name: z.string().optional().describe("New role name"),
  description: z.string().optional().describe("New role description"),
  composite: z.boolean().optional().describe("Whether this is a composite role")
});

export const DeleteRoleSchema = z.object({
  realm: z.string().describe("The realm name"),
  roleId: z.string().describe("ID of the role to delete")
});

export const ListRolesSchema = z.object({
  realm: z.string().describe("The realm name"),
  name: z.string().optional().describe("Filter by role name"),
  clientRole: z.boolean().optional().describe("Filter by client role status"),
  clientId: z.string().optional().describe("Filter by client ID for client roles")
}).merge(PaginationSchema).merge(SortSchema);

// Event schemas
export const AdminEventFilterSchema = z.object({
  realm: z.string().describe("The realm name"),
  eventType: z.string().optional().describe("Filter by event type"),
  resourceType: z.string().optional().describe("Filter by resource type"),
  resourcePath: z.string().optional().describe("Filter by resource path"),
  clientId: z.string().optional().describe("Filter by client ID"),
  userId: z.string().optional().describe("Filter by user ID"),
  success: z.boolean().optional().describe("Filter by success status")
}).merge(DateRangeSchema).merge(PaginationSchema).merge(SortSchema);

export const UserEventFilterSchema = z.object({
  realm: z.string().describe("The realm name"),
  type: z.string().optional().describe("Filter by event type"),
  clientId: z.string().optional().describe("Filter by client ID"),
  userId: z.string().optional().describe("Filter by user ID"),
  ipAddress: z.string().optional().describe("Filter by IP address")
}).merge(DateRangeSchema).merge(PaginationSchema).merge(SortSchema);

export const GetEventDetailsSchema = z.object({
  realm: z.string().describe("The realm name"),
  eventId: z.string().describe("ID of the event to retrieve")
});

// Export all schemas
export const Schemas = {
  // Common
  Realm: RealmSchema,
  Pagination: PaginationSchema,
  Sort: SortSchema,
  DateRange: DateRangeSchema,
  
  // Users
  CreateUser: CreateUserSchema,
  UpdateUser: UpdateUserSchema,
  DeleteUser: DeleteUserSchema,
  ListUsers: ListUsersSchema,
  
  // Clients
  CreateClient: CreateClientSchema,
  UpdateClient: UpdateClientSchema,
  DeleteClient: DeleteClientSchema,
  ListClients: ListClientsSchema,
  
  // Groups
  CreateGroup: CreateGroupSchema,
  UpdateGroup: UpdateGroupSchema,
  DeleteGroup: DeleteGroupSchema,
  ListGroups: ListGroupsSchema,
  
  // Roles
  CreateRole: CreateRoleSchema,
  UpdateRole: UpdateRoleSchema,
  DeleteRole: DeleteRoleSchema,
  ListRoles: ListRolesSchema,
  
  // Events
  AdminEventFilter: AdminEventFilterSchema,
  UserEventFilter: UserEventFilterSchema,
  GetEventDetails: GetEventDetailsSchema
};

// Common interfaces
export interface PaginationParams {
  first?: number;
  max?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DateRangeParams {
  fromDate?: string;
  toDate?: string;
}

export interface BaseFilterParams extends PaginationParams, SortParams {}

export interface AdminEventFilterParams extends BaseFilterParams, DateRangeParams {
  eventType?: string;
  resourceType?: string;
  resourcePath?: string;
  clientId?: string;
  userId?: string;
  success?: boolean;
}

export interface UserEventFilterParams extends BaseFilterParams, DateRangeParams {
  type?: string;
  clientId?: string;
  userId?: string;
  ipAddress?: string;
}
