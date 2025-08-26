export interface PromptTemplate {
  id: string;
  title: string;
  description?: string;
  content: string; // Markdown content
  category: PromptCategory;
  tags: string[];
  isFavorite: boolean;
  variables: PromptVariable[];
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  lastUsed?: Date;
}

export interface PromptVariable {
  name: string;
  description?: string;
  defaultValue?: string;
  required: boolean;
  type: 'text' | 'select' | 'realm' | 'user';
  options?: string[]; // For select type
}

export type PromptCategory = 
  | 'sync'
  | 'compliance' 
  | 'analysis'
  | 'management'
  | 'monitoring'
  | 'reporting'
  | 'custom';

export interface PromptExecution {
  id: string;
  promptId: string;
  executedAt: Date;
  variables: Record<string, string>;
  success: boolean;
  duration?: number;
  error?: string;
}

export interface PromptFilter {
  category?: PromptCategory;
  tags?: string[];
  search?: string;
  favoritesOnly?: boolean;
}

export interface PromptUsage {
  promptId: string;
  count: number;
  lastUsed: Date;
}

// Pre-defined prompt templates
export const DEFAULT_PROMPT_TEMPLATES: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>[] = [
  {
    title: 'Full Realm Sync',
    description: 'Synchronize all data from Keycloak to Neo4j with comprehensive relationship mapping',
    content: `# Full Realm Synchronization

Synchronize **all users, groups, roles, and clients** from Keycloak realm \`{{realm}}\` to Neo4j graph database.

## Tasks to Perform:
- ✅ Export all users with their attributes
- ✅ Export all groups and subgroups  
- ✅ Export all roles (realm and client roles)
- ✅ Export all clients and their configurations
- ✅ Create comprehensive relationship mappings:
  - User ↔ Group memberships
  - User ↔ Role assignments  
  - Client ↔ Role mappings
  - Organizational hierarchy

## Expected Output:
Generate a **detailed summary report** showing:
- Number of entities synchronized
- Relationship counts
- Any conflicts or issues encountered
- Data integrity verification results`,
    category: 'sync',
    tags: ['sync', 'neo4j', 'realm', 'comprehensive'],
    isFavorite: true,
    variables: [
      {
        name: 'realm',
        description: 'Target Keycloak realm to synchronize',
        defaultValue: 'master',
        required: true,
        type: 'realm'
      }
    ]
  },
  {
    title: 'Compliance Audit',
    description: 'Comprehensive security and compliance audit with automated remediation recommendations',
    content: `# Compliance Security Audit

Perform a **comprehensive compliance audit** on realm \`{{realm}}\`.

## Security Checks to Perform:

### 🔍 User Account Analysis
- **Orphaned Users**: Users without group assignments
- **Excessive Privileges**: Users with more than {{max_roles}} roles
- **Inactive Users**: Disabled users with active role assignments
- **External Access**: Contractors/external users with internal privileges

### 🔍 Access Control Violations
- **Segregation of Duties**: Users with conflicting role combinations
- **Administrative Access**: Non-admin users with admin privileges
- **Service Accounts**: Improperly configured service accounts

### 🔍 Credential Management
- **Password Policies**: Compliance with organizational standards
- **Multi-Factor Authentication**: MFA enrollment status
- **Session Management**: Unusual session patterns

## Expected Output:
Generate a **detailed compliance report** with:
- 📊 Executive summary with risk scores
- 📋 Detailed findings by category
- 🚨 Critical issues requiring immediate attention  
- 💡 Automated remediation recommendations
- 📈 Compliance trend analysis`,
    category: 'compliance',
    tags: ['compliance', 'security', 'audit', 'risk-assessment'],
    isFavorite: true,
    variables: [
      {
        name: 'realm',
        description: 'Target realm for compliance audit',
        defaultValue: 'master',
        required: true,
        type: 'realm'
      },
      {
        name: 'max_roles',
        description: 'Maximum roles per user threshold',
        defaultValue: '3',
        required: false,
        type: 'text'
      }
    ]
  },
  {
    title: 'User Deep Analysis',
    description: 'Detailed analysis of a specific user including access patterns and security assessment',
    content: `# User Analysis Report: {{username}}

Perform **comprehensive analysis** of user \`{{username}}\` in realm \`{{realm}}\`.

## Analysis Areas:

### 👤 User Profile
- Basic information and attributes
- Account status and configuration
- Contact information and metadata

### 🔑 Access Rights & Permissions
- **Current Roles**: All assigned roles with descriptions
- **Group Memberships**: Direct and inherited group memberships
- **Client Access**: Applications and services accessible
- **Effective Permissions**: Calculated permission matrix

### 📊 Activity Patterns
- **Authentication History**: Login patterns and frequency
- **Session Analysis**: Session duration and patterns
- **Geographic Access**: Login locations and anomalies
- **Device Usage**: Registered devices and access patterns

### ⚡ Recent Events
- Administrative actions performed
- Password changes and security events
- Permission modifications
- Suspicious activities or alerts

### 🎯 Security Assessment
- **Risk Score**: Calculated based on access and activity
- **Compliance Status**: Policy adherence check
- **Recommendations**: Security improvements suggested

## Output Format:
Provide results in structured format with:
- 📈 Visual risk assessment
- 📋 Detailed findings table
- ⚠️ Security recommendations
- 🔄 Historical trend analysis`,
    category: 'analysis',
    tags: ['user-analysis', 'security', 'deep-dive', 'risk-assessment'],
    isFavorite: false,
    variables: [
      {
        name: 'username',
        description: 'Username to analyze',
        required: true,
        type: 'user'
      },
      {
        name: 'realm',
        description: 'Realm containing the user',
        defaultValue: 'master',
        required: true,
        type: 'realm'
      }
    ]
  },
  {
    title: 'System Health Check',
    description: 'Monitor system health and performance metrics across all IKAS services',
    content: `# System Health & Performance Check

Monitor **system health** and **performance metrics** across all IKAS services.

## Service Health Verification:

### 🏥 Core Services Status
- **AI Gateway**: Response time and availability
- **Keycloak MCP**: Tool availability and response time  
- **Neo4j MCP**: Database connectivity and query performance
- **WebSocket Server**: Connection stability and message throughput

### 📊 Performance Metrics
- **API Response Times**: Average, min, max for each service
- **Memory Usage**: Current usage and trends
- **CPU Utilization**: Load patterns and spikes
- **Database Performance**: Query execution times and connection pool status

### 🔄 Integration Health
- **MCP Tool Discovery**: Available tools and their status
- **Model Connectivity**: LLM provider availability and performance
- **Data Synchronization**: Last sync times and success rates

## Monitoring Areas:

### ⚡ Real-time Metrics
- Active user sessions
- Concurrent requests
- Error rates and patterns
- Queue depths and processing times

### 📈 Trend Analysis  
- Performance trends over last {{time_period}}
- Resource utilization patterns
- Error frequency analysis
- Capacity planning insights

## Expected Output:
- 🎯 Overall system health score
- 📊 Performance dashboard summary
- 🚨 Critical alerts and warnings
- 💡 Optimization recommendations
- 📅 Maintenance scheduling suggestions`,
    category: 'monitoring',
    tags: ['health-check', 'performance', 'monitoring', 'system-status'],
    isFavorite: true,
    variables: [
      {
        name: 'time_period',
        description: 'Time period for trend analysis',
        defaultValue: '24 hours',
        required: false,
        type: 'select',
        options: ['1 hour', '6 hours', '24 hours', '7 days', '30 days']
      }
    ]
  },
  {
    title: 'Role Permission Matrix',
    description: 'Generate comprehensive role-permission matrix for access control documentation',
    content: `# Role-Permission Matrix Report

Generate **comprehensive role-permission matrix** for realm \`{{realm}}\` access control documentation.

## Matrix Components:

### 🎭 Role Analysis
- **Realm Roles**: All realm-level roles and their definitions
- **Client Roles**: Application-specific roles by client
- **Composite Roles**: Roles that include other roles
- **Role Hierarchy**: Parent-child role relationships

### 🔐 Permission Mapping
- **Resource Access**: What resources each role can access
- **Action Permissions**: CRUD and custom action permissions
- **Scope Limitations**: Constraints and boundaries per role
- **Effective Permissions**: Calculated permissions including inherited

### 👥 Role Usage Statistics
- **Assignment Count**: How many users have each role
- **Most/Least Used**: Role usage frequency analysis
- **Orphaned Roles**: Roles not assigned to any users
- **Over-privileged Roles**: Roles with excessive permissions

## Documentation Output:

### 📊 Visual Matrix
- Interactive permission matrix table
- Color-coded permission levels
- Filterable by role type or client
- Exportable formats (CSV, Excel, PDF)

### 📋 Role Definitions
- **Role Name**: Clear, descriptive names
- **Purpose**: Business justification for each role
- **Permissions**: Detailed permission breakdown  
- **Assignment Guidelines**: When to assign this role

### ⚠️ Security Analysis
- **Privilege Escalation Risks**: Dangerous role combinations
- **Segregation Violations**: Roles that conflict with compliance
- **Recommendations**: Role optimization suggestions

Generate output suitable for:
- 📄 Compliance documentation
- 👥 Security team reviews  
- 🎓 New user onboarding
- 📊 Access control audits`,
    category: 'reporting',
    tags: ['roles', 'permissions', 'matrix', 'documentation', 'access-control'],
    isFavorite: false,
    variables: [
      {
        name: 'realm',
        description: 'Target realm for role analysis',
        defaultValue: 'master',
        required: true,
        type: 'realm'
      }
    ]
  },
  {
    title: 'Data Export & Backup',
    description: 'Export and backup critical system data with verification',
    content: `# Data Export & Backup Operation

Perform **comprehensive data export** and **backup** of realm \`{{realm}}\` with verification.

## Export Scope:

### 📦 User Data
- **User Profiles**: Complete user information and attributes
- **Credentials**: Hashed passwords and credential metadata
- **User Settings**: Preferences and configuration
- **Custom Attributes**: Extended user properties

### 🏢 Organizational Data
- **Groups**: All groups with hierarchy and memberships
- **Roles**: Realm and client roles with compositions
- **Clients**: Application configurations and settings
- **Identity Providers**: External IdP configurations

### 🔄 Relationship Data
- **User-Group Mappings**: Direct and inherited memberships
- **Role Assignments**: User and group role assignments
- **Client Permissions**: Client-role mappings
- **Composite Relationships**: Complex role compositions

## Export Format Options:
{{export_format}}

## Verification Steps:

### ✅ Data Integrity
- **Record Counts**: Verify all entities exported
- **Relationship Integrity**: Check all references valid
- **Checksum Verification**: Generate and validate checksums
- **Schema Compliance**: Ensure data meets schema requirements

### 📊 Export Summary
- **Statistics**: Count of each entity type exported
- **File Sizes**: Export file sizes and compression ratios
- **Export Duration**: Time taken for each phase
- **Verification Results**: All integrity checks passed

## Security Considerations:
- 🔐 **Encryption**: All exports encrypted with {{encryption_method}}
- 👤 **Access Logging**: Export activity logged for audit
- 🚫 **Sensitive Data**: PII handling according to policies
- 🗑️ **Cleanup**: Temporary files securely deleted

Provide export suitable for:
- 💾 Disaster recovery
- 🔄 System migration
- 📊 Compliance archiving
- 🧪 Development/testing`,
    category: 'management',
    tags: ['export', 'backup', 'disaster-recovery', 'migration'],
    isFavorite: false,
    variables: [
      {
        name: 'realm',
        description: 'Realm to export',
        defaultValue: 'master',
        required: true,
        type: 'realm'
      },
      {
        name: 'export_format',
        description: 'Export format preference',
        defaultValue: 'JSON with relationship preservation',
        required: false,
        type: 'select',
        options: [
          'JSON with relationship preservation',
          'CSV tables with foreign keys',
          'XML with full schema',
          'Keycloak native format',
          'Neo4j Cypher scripts'
        ]
      },
      {
        name: 'encryption_method',
        description: 'Encryption method for export files',
        defaultValue: 'AES-256',
        required: false,
        type: 'select',
        options: ['AES-256', 'AES-128', 'RSA-2048', 'No encryption']
      }
    ]
  }
];