# Keycloak MCP Server

[![smithery badge](https://smithery.ai/badge/keycloak-model-context-protocol)](https://smithery.ai/server/keycloak-model-context-protocol)

A Model Context Protocol server for Keycloak administration, providing tools to manage users, realms, and events.

## Features

- Create new users in specific realms
- Delete users from realms
- List available realms
- List users in specific realms
- List and filter admin events
- List and filter user events
- Get detailed event information

## Installation

### Docker Setup (Recommended)

The easiest way to get started is using Docker Compose. This will set up:
- Keycloak 24.0.1
- PostgreSQL 16
- MailHog for email testing

```bash
# Start the services
docker-compose up -d

# Check the logs
docker-compose logs -f

# Stop the services
docker-compose down
```

After starting the services:
- Keycloak Admin Console: http://localhost:8080/admin
  - Username: admin
  - Password: admin
- MailHog Web UI: http://localhost:8025

### Installing via Smithery

To install Keycloak for Claude Desktop automatically via [Smithery](https://smithery.ai/server/keycloak-model-context-protocol):

```bash
npx -y @smithery/cli install keycloak-model-context-protocol --client claude
```

### Via NPM (Recommended)

The server is available as an NPM package:
```bash
# Direct usage with npx
npx -y keycloak-model-context-protocol

# Or global installation
npm install -g keycloak-model-context-protocol
keycloak-model-context-protocol
```

### Local Development Setup

If you want to develop or modify the server:

```bash
git clone <repository-url>
cd keycloak-mcp-server
npm install
npm run build

# Run locally
node dist/index.js
```

### IKAS Project Setup

For the IKAS project, the Keycloak MCP server is already configured and ready to use:

#### Quick Start
```bash
# 1. Install dependencies and build
cd keycloak-mcp-server
npm install

# 2. Start Docker services
docker-compose up -d

# 3. Create environment configuration (optional - defaults work)
cat > .env << EOF
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin
RESOURCES_FOLDER=/path/to/your/resources
EOF

# 4. Run the MCP server
node dist/index.js
```

#### Verification
After setup, verify the service is working:
- Keycloak Admin Console: http://localhost:8080/admin (admin/admin)
- MCP Server responds to JSON-RPC requests on stdio
- Performance: Basic operations complete in <500ms
- Resources: Automatically loads from resources/ folder

#### Test Commands
```bash
# Test MCP server functionality
npx @modelcontextprotocol/inspector node dist/index.js

# Check Docker services status
docker-compose ps

# View logs
docker-compose logs keycloak
```

## Configuration

The MCP server supports two authentication methods: **Service Account** (recommended for production) and **Admin User** (for development/testing).

### Authentication Methods

#### Service Account Authentication (Recommended)

For production use, configure a service account in Keycloak with limited permissions:

1. **Create a Service Account Client** in your Keycloak realm:
   - Set **Access Type** to `confidential`
   - Enable **Service Accounts Enabled**
   - Configure **Service Account Roles** with appropriate permissions

2. **Required Service Account Roles:**
   - `view-realm` - Read realm configuration
   - `view-users` - List and view user information  
   - `view-clients` - Access client configurations
   - `view-events` - Access audit events
   - `view-identity-providers` - Check identity provider settings

3. **Optional Roles** (based on your needs):
   - `manage-users` - For user management tools
   - `manage-clients` - For client configuration tools
   - `manage-realm` - For realm configuration changes

#### Admin User Authentication (Development/Testing)

Uses direct admin credentials - only recommended for development environments.

### Configuration Examples

#### Service Account Configuration (NPM Package)
```json
{
  "mcpServers": {
    "keycloak": {
      "command": "npx",
      "args": ["-y", "keycloak-model-context-protocol"],
      "env": {
        "KEYCLOAK_URL": "http://localhost:8080",
        "KEYCLOAK_CLIENT_ID": "mcp-service-account",
        "KEYCLOAK_CLIENT_SECRET": "your-client-secret-here",
        "KEYCLOAK_REALM_NAME": "your-realm",
        "RESOURCES_FOLDER": "./resources"
      }
    }
  }
}
```

#### Admin User Configuration (NPM Package)
```json
{
  "mcpServers": {
    "keycloak": {
      "command": "npx",
      "args": ["-y", "keycloak-model-context-protocol"],
      "env": {
        "KEYCLOAK_URL": "http://localhost:8080",
        "KEYCLOAK_ADMIN": "admin",
        "KEYCLOAK_ADMIN_PASSWORD": "admin",
        "KEYCLOAK_REALM_NAME": "master",
        "RESOURCES_FOLDER": "./resources"
      }
    }
  }
}
```

#### Service Account Configuration (Local Development)
```json
{
  "mcpServers": {
    "keycloak": {
      "command": "node",
      "args": ["path/to/keycloak-mcp-server/dist/index.js"],
      "env": {
        "KEYCLOAK_URL": "http://localhost:8080",
        "KEYCLOAK_CLIENT_ID": "mcp-service-account",
        "KEYCLOAK_CLIENT_SECRET": "your-client-secret-here",
        "KEYCLOAK_REALM_NAME": "your-realm",
        "RESOURCES_FOLDER": "./resources"
      }
    }
  }
}
```

#### Admin User Configuration (Local Development)
```json
{
  "mcpServers": {
    "keycloak": {
      "command": "node",
      "args": ["path/to/keycloak-mcp-server/dist/index.js"],
      "env": {
        "KEYCLOAK_URL": "http://localhost:8080",
        "KEYCLOAK_ADMIN": "admin",
        "KEYCLOAK_ADMIN_PASSWORD": "admin",
        "KEYCLOAK_REALM_NAME": "master",
        "RESOURCES_FOLDER": "./resources"
      }
    }
  }
}
```

## Available Tools

### User Management
- `create-user`: Creates a new user in a specified realm
- `delete-user`: Deletes a user from a specified realm
- `list-users`: Lists all users in a specified realm
- `list-realms`: Lists all available realms

### Event Management
- `list-admin-events`: Lists admin events with filtering and sorting options
  - Filter by date range, event type, resource type, client ID, user ID, IP address, and success status
  - Sort by time, event type, resource type, or client ID
  - Pagination support with first/max parameters

- `list-user-events`: Lists user events with filtering and sorting options
  - Filter by date range, client ID, user ID, IP address, and event type
  - Sort by time, type, client ID, user ID, or IP address
  - Pagination support with first/max parameters

- `get-event-details`: Get detailed information about a specific event
  - View complete event information including representation and error details

### System Tools
- `get-metrics`: Retrieve Keycloak server metrics in Prometheus format

## Development

### Building the Project

```bash
# Install dependencies
npm install

# Build the project (compiles TypeScript and sets executable permissions)
npm run build

# Watch for changes during development
npm run watch
```

### Important: Shebang Line

The project requires a [shebang line](https://en.wikipedia.org/wiki/Shebang_(Unix)) (`#!/usr/bin/env node`) at the top of the main entry file (`src/index.ts`) for proper execution via npx. This line tells the system to use Node.js to run the script.

**The shebang is already included** in the source file, but if you encounter issues, ensure the first line of `src/index.ts` is:
```typescript
#!/usr/bin/env node
```

After adding or modifying the shebang, rebuild the project:
```bash
npm run build
```

## Testing

### Using MCP Inspector

To test the server using MCP Inspector:

```bash
npx -y @modelcontextprotocol/inspector npx -y keycloak-model-context-protocol
```

### Local Testing

```bash
# Test the built server directly
node dist/index.js

# Test with service account authentication
KEYCLOAK_URL=http://localhost:8080 KEYCLOAK_CLIENT_ID=mcp-service-account KEYCLOAK_CLIENT_SECRET=your-secret KEYCLOAK_REALM_NAME=your-realm node dist/index.js

# Test with admin user authentication (development)
KEYCLOAK_URL=http://localhost:8080 KEYCLOAK_ADMIN=admin KEYCLOAK_ADMIN_PASSWORD=admin KEYCLOAK_REALM_NAME=master node dist/index.js
```

## Troubleshooting

### "import: command not found" Error

If you encounter errors like:
```bash
/path/to/keycloak-model-context-protocol: line 1: import: command not found
/path/to/keycloak-model-context-protocol: line 2: import: command not found
/path/to/keycloak-model-context-protocol: line 10: syntax error near unexpected token `;'
```

**Cause**: The executable script is missing the shebang line (`#!/usr/bin/env node`) or it's incorrect.

**Solution**:
1. Ensure the first line of `src/index.ts` contains: `#!/usr/bin/env node`
2. Rebuild the project: `npm run build`
3. If using the NPM package, update to the latest version:
   ```bash
   npm uninstall -g keycloak-model-context-protocol
   npm install -g keycloak-model-context-protocol
   ```

### Node.js Version Compatibility

- **Recommended**: Node.js 18.x or 20.x (LTS versions)
- **Current**: The project has been tested with Node.js 23.x but LTS versions are more stable
- **Minimum**: Node.js 18.x

If you encounter issues with newer Node.js versions, try switching to an LTS version:
```bash
# Using nvm (Node Version Manager)
nvm install 20
nvm use 20
```

### Module Not Found Errors

If you get module not found errors:
1. Ensure all dependencies are installed: `npm install`
2. Rebuild the project: `npm run build`
3. Check that the `dist/` directory exists and contains `index.js`

### Environment Variables

#### Required Variables
- `KEYCLOAK_URL`: URL to your Keycloak instance (default: http://localhost:8080)
- `RESOURCES_FOLDER`: Path to resources folder (default: ./resources)

#### Service Account Authentication (Recommended)
- `KEYCLOAK_CLIENT_ID`: Service account client ID
- `KEYCLOAK_CLIENT_SECRET`: Service account client secret  
- `KEYCLOAK_REALM_NAME`: Target realm name (default: master)

#### Admin User Authentication (Development/Testing)
- `KEYCLOAK_ADMIN`: Admin username (default: admin)
- `KEYCLOAK_ADMIN_PASSWORD`: Admin password (default: admin)
- `KEYCLOAK_REALM_NAME`: Target realm name (default: master)

**Note**: The server will automatically detect which authentication method to use based on the presence of `KEYCLOAK_CLIENT_ID` and `KEYCLOAK_CLIENT_SECRET` variables. If these are present, it will use service account authentication; otherwise, it will fall back to admin user authentication.

## Security Considerations

### Service Account Setup Guide

1. **Create Service Account Client:**
   ```bash
   # In Keycloak Admin Console:
   # 1. Go to Clients ? Create Client
   # 2. Set Client ID: mcp-service-account
   # 3. Set Client Type: OpenID Connect
   # 4. Enable Client authentication
   # 5. Disable Standard flow, Direct access grants
   # 6. Enable Service accounts roles
   ```

2. **Configure Permissions:**
   ```bash
   # Go to Clients ? mcp-service-account ? Service accounts roles
   # Add realm-level roles:
   # - view-realm, view-users, view-clients, view-events
   # 
   # For user management capabilities, also add:
   # - manage-users (if user creation/deletion is needed)
   ```

3. **Get Client Secret:**
   ```bash
   # Go to Clients ? mcp-service-account ? Credentials
   # Copy the Client Secret value
   ```

### Security Best Practices

- **Use Service Accounts in Production**: Never use admin credentials in production environments
- **Principle of Least Privilege**: Only assign roles that are actually needed
- **Rotate Secrets Regularly**: Change client secrets periodically
- **Monitor Access**: Review audit logs for service account activity
- **Environment Isolation**: Use different service accounts for different environments

### Troubleshooting Authentication

- **Service Account Issues**: Verify client secret and ensure service account is enabled
- **Permission Errors**: Check that required roles are assigned to the service account
- **Realm Access**: Ensure the service account has access to the target realm

## Deployment

### NPM Package

This project is automatically published to [NPM](https://www.npmjs.com/package/keycloak-model-context-protocol) via GitHub Actions when a new release is published on GitHub.

#### Publishing Steps for Maintainers

1. **Fix issues** (like missing shebang)
2. **Update version** in `package.json`:
   ```bash
   npm version patch  # or minor/major
   ```
3. **Build the project**:
   ```bash
   npm run build
   ```
4. **Test locally**:
   ```bash
   node dist/index.js
   ```
5. **Publish to NPM**:
   ```bash
   npm publish
   ```

#### Setup Requirements for Deployment

1. Create NPM account and get access token
2. Add NPM_TOKEN secret to GitHub repository
   - Go to repository Settings > Secrets
   - Add new secret named `NPM_TOKEN`
   - Paste your NPM access token as the value

## Prerequisites

- Node.js 18 or higher (LTS recommended)
- Running Keycloak instance
- Docker and Docker Compose (for Docker setup)

