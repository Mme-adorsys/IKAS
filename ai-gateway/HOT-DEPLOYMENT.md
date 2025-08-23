# AI Gateway Hot Deployment Guide

This guide explains how to set up and use hot deployment for the IKAS AI Gateway using Docker containers.

## 🚀 Quick Start

### Option 1: Using NPM Scripts (Recommended)

```bash
# Build the development image
npm run docker:dev:build

# Start with hot reload in background
npm run docker:dev

# View logs
npm run docker:dev:logs

# Stop the service
npm run docker:dev:down
```

### Option 2: Using Helper Script

```bash
# Build development image
./scripts/docker-hot-deploy.sh build

# Start in foreground (with logs)
./scripts/docker-hot-deploy.sh start

# Start in background
./scripts/docker-hot-deploy.sh up

# View logs
./scripts/docker-hot-deploy.sh logs

# Check status
./scripts/docker-hot-deploy.sh status

# Stop service
./scripts/docker-hot-deploy.sh stop
```

### Option 3: Using Docker Compose Directly

```bash
# Navigate to docker directory
cd ../docker

# Start with hot reload profile
docker-compose -f docker-compose.dev.yml --profile hot-reload up ai-gateway-hot

# Or start in background
docker-compose -f docker-compose.dev.yml --profile hot-reload up -d ai-gateway-hot
```

## 📁 Hot Deployment Architecture

### Files Structure

```
ai-gateway/
├── Dockerfile              # Production build
├── Dockerfile.dev          # Development with hot reload
├── .dockerignore           # Optimized for development builds
├── .env.development        # Development environment variables
├── scripts/
│   └── docker-hot-deploy.sh # Helper script for development
└── src/                    # Source code (mounted as volume)

docker/
├── docker-compose.dev.yml           # Main development compose
└── docker-compose.dev-hotreload.yml # Hot reload specific overrides
```

### Volume Mounts

The hot reload setup uses the following volume mounts:

```yaml
volumes:
  # Source code (changes trigger reload)
  - ../ai-gateway/src:/app/src:cached
  
  # Configuration files (read-only)
  - ../ai-gateway/package.json:/app/package.json:ro
  - ../ai-gateway/tsconfig.json:/app/tsconfig.json:ro
  - ../ai-gateway/.env:/app/.env:ro
  
  # Logs directory (for real-time log access)
  - ../ai-gateway/logs:/app/logs:delegated
  
  # Node modules (named volume to avoid conflicts)
  - ai_gateway_dev_node_modules:/app/node_modules
```

## 🛠️ Development Workflow

### 1. Initial Setup

```bash
# Build the development image
npm run docker:dev:build

# Start the service
npm run docker:dev

# Verify it's working
curl http://localhost:8006/health
```

### 2. Making Changes

1. Edit any file in the `src/` directory
2. The `tsx watch` process will detect changes
3. TypeScript will recompile automatically
4. The application will restart with the new changes
5. Changes are reflected immediately without rebuilding the Docker image

### 3. Viewing Logs

```bash
# View logs in real-time
npm run docker:dev:logs

# Or using the script
./scripts/docker-hot-deploy.sh logs

# Or directly with Docker
docker logs -f ikas-ai-gateway-hot
```

### 4. Testing Changes

```bash
# Run tests in the hot reload container
./scripts/docker-hot-deploy.sh test

# Or manually
docker exec ikas-ai-gateway-hot npm test
```

### 5. Debugging

```bash
# Open a shell in the container
./scripts/docker-hot-deploy.sh shell

# Check container status
./scripts/docker-hot-deploy.sh status

# Restart if needed
./scripts/docker-hot-deploy.sh restart
```

## 🔧 Configuration

### Environment Variables

The hot reload setup uses development-specific environment variables:

- `NODE_ENV=development`
- `DEBUG=ikas:*` - Enable debug logging
- `TSX_WATCH=true` - Enable TypeScript watch mode
- `PORT=8005` - Internal container port
- External port: `8006` (to avoid conflicts with production container)

### Custom Configuration

You can customize the setup by:

1. **Environment Variables**: Create `.env.local` file for local overrides
2. **Docker Compose**: Modify `docker-compose.dev.yml` for container settings
3. **TypeScript**: Update `tsconfig.json` for compilation settings
4. **Watch Settings**: Modify the `tsx watch` command in `Dockerfile.dev`

## 🚨 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Check what's using the port
   lsof -i :8006
   
   # Kill the process or change the port in docker-compose.dev.yml
   ```

2. **File Changes Not Detected**
   ```bash
   # Check volume mounts
   docker inspect ikas-ai-gateway-hot | grep -A 20 "Mounts"
   
   # Restart the container
   ./scripts/docker-hot-deploy.sh restart
   ```

3. **Dependencies Issues**
   ```bash
   # Rebuild the image after package.json changes
   npm run docker:dev:build
   ```

4. **Permission Issues**
   ```bash
   # Fix file permissions
   sudo chown -R $(whoami):$(whoami) .
   ```

### Health Checks

```bash
# Check container health
docker ps | grep ikas-ai-gateway-hot

# Check application health
curl http://localhost:8006/health

# Check logs for errors
docker logs ikas-ai-gateway-hot --tail 50
```

## 📈 Performance Considerations

### Volume Mount Performance

- **macOS**: Uses `:cached` and `:delegated` flags for better performance
- **Linux**: Native performance, no special flags needed
- **Windows**: Consider using WSL2 for better performance

### Resource Usage

The development container uses:
- More CPU due to file watching and TypeScript compilation
- More memory due to development dependencies
- More disk I/O due to file system watching

### Optimization Tips

1. **Exclude unnecessary files** from watch patterns
2. **Use .dockerignore** to reduce build context
3. **Mount only required directories** as volumes
4. **Use named volumes** for node_modules to avoid sync overhead

## 🔄 Switching Between Development and Production

### Development Mode (Hot Reload)
```bash
npm run docker:dev
# Access at http://localhost:8006
```

### Production Mode (Built Image)
```bash
cd ../docker
docker-compose -f docker-compose.dev.yml up ai-gateway
# Access at http://localhost:8005
```

### Both Modes Simultaneously
```bash
cd ../docker
docker-compose -f docker-compose.dev.yml up ai-gateway ai-gateway-hot
# Production: http://localhost:8005
# Development: http://localhost:8006
```

## 📋 Available Commands

### NPM Scripts
- `npm run docker:dev` - Start hot reload development
- `npm run docker:dev:build` - Build development image
- `npm run docker:dev:logs` - View logs
- `npm run docker:dev:down` - Stop service
- `npm run docker:dev:restart` - Restart service

### Helper Script Commands
- `./scripts/docker-hot-deploy.sh build` - Build image
- `./scripts/docker-hot-deploy.sh start` - Start foreground
- `./scripts/docker-hot-deploy.sh up` - Start background
- `./scripts/docker-hot-deploy.sh stop` - Stop service
- `./scripts/docker-hot-deploy.sh restart` - Restart service
- `./scripts/docker-hot-deploy.sh logs` - View logs
- `./scripts/docker-hot-deploy.sh status` - Check status
- `./scripts/docker-hot-deploy.sh test` - Run tests
- `./scripts/docker-hot-deploy.sh shell` - Open shell
- `./scripts/docker-hot-deploy.sh cleanup` - Clean up resources

## 🎯 Next Steps

After setting up hot deployment:

1. **Verify the setup works** by making a small change to a source file
2. **Configure your IDE** to work with the mounted source code
3. **Set up debugging** if needed using VS Code Remote Containers
4. **Create additional npm scripts** for your specific workflow needs

Happy coding with hot deployment! 🔥