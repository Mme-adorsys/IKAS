FROM node:18-alpine

# Set working directory
WORKDIR /keycloak-mcp-server

# Copy package files
COPY package*.json ./
# Copy source code
COPY . .

# Install ALL dependencies (including dev dependencies for build)
#RUN npm ci && npm cache clean --force
RUN npm install --include=dev --no-audit --no-fund && npm cache clean --force


# Build TypeScript
RUN npm run build

# Environment variables
ENV NODE_ENV=production
ENV PORT=8001
ENV KEYCLOAK_URL=http://keycloak:8080
ENV KEYCLOAK_ADMIN=admin
ENV KEYCLOAK_ADMIN_PASSWORD=admin

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8001/health', (res) => { \
    process.exit(res.statusCode === 200 ? 0 : 1); \
  }).on('error', () => process.exit(1));"

# Start the HTTP server
CMD ["node", "dist/simple-http-server.js"]