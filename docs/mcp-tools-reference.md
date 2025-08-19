# IKAS MCP Tools Reference
## Available Tools from Keycloak and Neo4j MCP Servers

This document provides a comprehensive reference of all available tools from both MCP servers that IKAS can orchestrate.

---

## 🔐 Keycloak MCP Server Tools

**Base URL**: `http://localhost:8001` (development)  
**Transport**: HTTP/stdio  
**Server Name**: `keycloak-admin`  
**Version**: `0.0.1`

### User Management Tools

#### 1. `create-user`
**Description**: Create a new user in a specific realm  
**Parameters**:
- `realm` (string, required): Target realm name
- `username` (string, required): Username for the new user
- `email` (string, required): Email address (validated)
- `firstName` (string, required): User's first name
- `lastName` (string, required): User's last name

**Example Usage**:
```json
{
  "realm": "master",
  "username": "john.doe",
  "email": "john.doe@example.com",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### 2. `delete-user`
**Description**: Delete a user from a specific realm  
**Parameters**:
- `realm` (string, required): Target realm name
- `userId` (string, required): Unique user ID to delete

**Example Usage**:
```json
{
  "realm": "master",
  "userId": "8c5f3b7a-9d2e-4f1c-b6a8-3e5d7c9f1b2a"
}
```

#### 3. `list-users`
**Description**: List users in a specific realm  
**Parameters**:
- `realm` (string, required): Target realm name

**Example Usage**:
```json
{
  "realm": "master"
}
```

### Realm Management Tools

#### 4. `list-realms`
**Description**: List all available realms  
**Parameters**: None

**Example Usage**:
```json
{}
```

### Event Monitoring Tools

#### 5. `list-admin-events`
**Description**: List admin events with filtering and sorting options  
**Parameters**:
- `realm` (string, required): Target realm name
- `fromDate` (string, optional): ISO date string for start time
- `toDate` (string, optional): ISO date string for end time
- `eventType` (string, optional): Filter by event type
- `resourceType` (string, optional): Filter by resource type
- `resourcePath` (string, optional): Filter by resource path
- `clientId` (string, optional): Filter by client ID
- `userId` (string, optional): Filter by user ID
- `ipAddress` (string, optional): Filter by IP address
- `success` (boolean, optional): Filter by success status
- `sortBy` (enum, optional): Sort field - one of: `time`, `eventType`, `resourceType`, `clientId`
- `sortOrder` (enum, optional): Sort direction - `asc` or `desc`
- `first` (number, optional): Pagination start
- `max` (number, optional): Maximum results

**Example Usage**:
```json
{
  "realm": "master",
  "fromDate": "2024-01-01T00:00:00Z",
  "sortBy": "time",
  "sortOrder": "desc",
  "max": 50
}
```

#### 6. `get-event-details`
**Description**: Get detailed information about a specific event  
**Parameters**:
- `realm` (string, required): Target realm name
- `eventId` (string, required): Unique event ID

**Example Usage**:
```json
{
  "realm": "master",
  "eventId": "abc123-def456-ghi789"
}
```

#### 7. `list-user-events`
**Description**: List user events with filtering and sorting options  
**Parameters**:
- `realm` (string, required): Target realm name
- `fromDate` (string, optional): ISO date string for start time
- `toDate` (string, optional): ISO date string for end time
- `clientId` (string, optional): Filter by client ID
- `userId` (string, optional): Filter by user ID
- `ipAddress` (string, optional): Filter by IP address
- `type` (string, optional): Filter by event type
- `sortBy` (enum, optional): Sort field - one of: `time`, `type`, `clientId`, `userId`, `ipAddress`
- `sortOrder` (enum, optional): Sort direction - `asc` or `desc`
- `first` (number, optional): Pagination start
- `max` (number, optional): Maximum results

### System Monitoring Tools

#### 8. `get-metrics`
**Description**: Get Keycloak server metrics in Prometheus format  
**Parameters**: None

**Example Usage**:
```json
{}
```

---

## 📊 Neo4j MCP Server Tools

**Base URL**: `http://localhost:8002` (development)  
**Transport**: HTTP/stdio  
**Server Name**: `mcp-neo4j-cypher`  
**Version**: Latest  
**Namespace Support**: Yes (configurable prefix)

### Schema Management Tools

#### 1. `get_neo4j_schema`
**Description**: List all nodes, their attributes and their relationships to other nodes in the neo4j database. Requires APOC plugin.  
**Parameters**: None  
**Annotations**:
- `readOnlyHint`: true
- `destructiveHint`: false
- `idempotentHint`: true

**Example Usage**:
```json
{}
```

**Example Response**:
```json
{
  "User": {
    "type": "node",
    "count": 150,
    "properties": {
      "id": {"type": "String", "indexed": true},
      "username": {"type": "String"},
      "email": {"type": "String", "indexed": true}
    },
    "relationships": {
      "HAS_ROLE": {
        "direction": "OUT",
        "labels": ["Role"]
      }
    }
  }
}
```

### Query Execution Tools

#### 2. `read_neo4j_cypher`
**Description**: Execute read-only Cypher queries against the Neo4j database  
**Parameters**:
- `query` (string, required): Cypher query to execute
- `parameters` (object, optional): Query parameters

**Example Usage**:
```json
{
  "query": "MATCH (u:User) WHERE u.enabled = $enabled RETURN u.username, u.email LIMIT $limit",
  "parameters": {
    "enabled": true,
    "limit": 10
  }
}
```

#### 3. `write_neo4j_cypher`
**Description**: Execute write Cypher queries against the Neo4j database (CREATE, MERGE, SET, DELETE operations)  
**Parameters**:
- `query` (string, required): Cypher query to execute
- `parameters` (object, optional): Query parameters

**Example Usage**:
```json
{
  "query": "MERGE (u:User {id: $userId}) SET u.username = $username, u.lastSync = datetime()",
  "parameters": {
    "userId": "user-123",
    "username": "john.doe"
  }
}
```

---

## 🎯 IKAS Orchestration Patterns

### Common Use Cases

#### 1. User Listing with Fresh Data
```
User: "Hey Keycloak, zeige mir alle Benutzer"

Strategy: KEYCLOAK_FRESH_DATA
Tools Called:
1. keycloak.list-users (realm: "master")
```

#### 2. Compliance Analysis
```
User: "Analysiere die Compliance"

Strategy: SYNC_THEN_ANALYZE
Tools Called:
1. keycloak.list-users (realm: "master")
2. neo4j.write_neo4j_cypher (sync users to graph)
3. neo4j.read_neo4j_cypher (analyze compliance patterns)
```

#### 3. Duplicate User Detection
```
User: "Finde doppelte Benutzer"

Strategy: NEO4J_ANALYSIS_ONLY (if data is fresh) or SYNC_THEN_ANALYZE
Tools Called:
1. neo4j.read_neo4j_cypher (find similar users)
Query: "MATCH (u1:User), (u2:User) WHERE u1.email = u2.email AND u1.id <> u2.id RETURN u1, u2"
```

#### 4. System Health Check
```
User: "Wie ist der System-Status?"

Strategy: COORDINATED_MULTI_MCP
Tools Called:
1. keycloak.get-metrics
2. neo4j.get_neo4j_schema (to verify connectivity)
3. keycloak.list-realms (to verify functionality)
```

### Data Synchronization Patterns

#### Keycloak → Neo4j User Sync
```cypher
// Clear existing users
MATCH (u:User {realm: $realm}) DETACH DELETE u

// Import users from Keycloak
UNWIND $users as userData
CREATE (u:User {
    id: userData.id,
    username: userData.username,
    email: userData.email,
    firstName: userData.firstName,
    lastName: userData.lastName,
    enabled: userData.enabled,
    realm: $realm,
    lastSync: datetime()
})

// Update metadata
MERGE (m:Metadata {type: 'users', realm: $realm})
SET m.lastUpdated = datetime(),
    m.userCount = size($users)
```

#### Compliance Analysis Patterns
```cypher
// Find users with weak usernames
MATCH (u:User)
WHERE u.username IN ['admin', 'test', 'root']
   OR u.username =~ '.*test.*'
RETURN u.username as violating_username

// Find potential duplicates
MATCH (u1:User), (u2:User)
WHERE u1.id < u2.id
  AND (u1.email = u2.email 
       OR (u1.firstName = u2.firstName AND u1.lastName = u2.lastName))
RETURN u1.username, u2.username, 'Potential duplicate' as issue

// Find users without roles
MATCH (u:User)
WHERE NOT (u)-[:HAS_ROLE]->()
RETURN u.username as userWithoutRole
```

---

## 🔧 Integration Notes

### Authentication
- **Keycloak MCP**: Uses admin credentials from environment variables
- **Neo4j MCP**: Uses Neo4j auth from environment variables

### Error Handling
- Both MCPs return structured error responses
- Circuit breakers should be implemented for resilience
- Fallback strategies should be prepared for each tool

### Performance Considerations
- Keycloak tools: Direct API calls, relatively fast
- Neo4j tools: Can be slow for large datasets, implement caching
- Batch operations recommended for large data syncs

### Security Notes
- All operations are logged and auditable
- User data synchronization follows GDPR compliance
- Sensitive data (passwords) are never transferred
- Audit trails maintained for all admin operations