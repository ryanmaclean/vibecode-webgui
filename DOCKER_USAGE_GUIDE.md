# Docker Usage Guide - VibeCode Unified VM

## Overview
The VibeCode Unified VM now includes a full Docker daemon, allowing you to run Docker containers inside the VM and control them from your macOS host using the standard `docker` command-line tool.

## Quick Start

### 1. Start the VM
```bash
open /path/to/UnifiedServicesVibeCodeApp.app
```

Wait for the VM to boot (usually 30-60 seconds). You'll know it's ready when the status changes to "Running".

### 2. Configure Docker Client on Host
Set the Docker host environment variable to point to the VM:

```bash
export DOCKER_HOST=tcp://localhost:2375
```

To make this permanent, add it to your shell profile:

```bash
# For bash
echo 'export DOCKER_HOST=tcp://localhost:2375' >> ~/.bash_profile

# For zsh
echo 'export DOCKER_HOST=tcp://localhost:2375' >> ~/.zshrc
```

### 3. Verify Docker Connection
```bash
docker version
```

You should see output showing both Client and Server information:
```
Client:
 Version:           24.0.7
 API version:       1.43
 ...

Server:
 Engine:
  Version:          27.4.1
  API version:      1.47
  ...
```

### 4. Test Docker
Run the hello-world container:
```bash
docker run hello-world
```

## Basic Docker Commands

### Image Management
```bash
# Pull an image
docker pull alpine:latest

# List images
docker images

# Remove an image
docker rmi alpine:latest
```

### Container Management
```bash
# Run a container
docker run -d --name my-nginx -p 8080:80 nginx:alpine

# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# Stop a container
docker stop my-nginx

# Start a stopped container
docker start my-nginx

# Remove a container
docker rm my-nginx

# View container logs
docker logs my-nginx

# Execute command in running container
docker exec -it my-nginx sh
```

### Volume Management
```bash
# Create a volume
docker volume create my-data

# List volumes
docker volume ls

# Run container with volume
docker run -d -v my-data:/data alpine:latest

# Remove a volume
docker volume rm my-data
```

### Network Management
```bash
# List networks
docker network ls

# Create a network
docker network create my-network

# Run container on custom network
docker run -d --network my-network alpine:latest

# Remove a network
docker network rm my-network
```

## Port Mapping

To access services running in Docker containers from your macOS host, you need to publish ports when running containers.

### Example: Run a Web Server
```bash
# Run nginx and map port 8080 (host) to port 80 (container)
docker run -d --name web -p 8080:80 nginx:alpine

# Access from macOS browser
open http://localhost:8080
```

### Example: Run PostgreSQL
```bash
# Run PostgreSQL and map port 5433 (to avoid conflict with VM's PostgreSQL on 5432)
docker run -d --name postgres \
  -e POSTGRES_PASSWORD=mysecretpassword \
  -p 5433:5432 \
  postgres:alpine

# Connect from macOS
psql -h localhost -p 5433 -U postgres
```

### Example: Run Redis
```bash
# Run Redis and map port 6380 (to avoid conflict with VM's Valkey on 6379)
docker run -d --name redis -p 6380:6379 redis:alpine

# Test from macOS
redis-cli -p 6380 ping
```

## Data Persistence

Docker data is stored in `/mnt/persistent/docker` inside the VM, which means:

- ✅ **Images persist** across VM restarts
- ✅ **Containers persist** across VM restarts
- ✅ **Volumes persist** across VM restarts
- ⚠️ **Data is lost** if you delete the VM's persistent storage disk

### Checking Disk Usage
```bash
# Check Docker disk usage
docker system df

# View detailed usage
docker system df -v
```

### Cleaning Up
```bash
# Remove unused containers
docker container prune

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Remove everything unused (CAUTION!)
docker system prune -a
```

## Docker Compose

Docker Compose is not included in the VM by default, but you can use it from your macOS host if you have Docker Desktop installed, or install the standalone `docker-compose` CLI.

### Using Docker Compose
```bash
# Install docker-compose (if not already installed)
brew install docker-compose

# Set Docker host
export DOCKER_HOST=tcp://localhost:2375

# Run docker-compose
cd /path/to/your/project
docker-compose up -d
```

### Example docker-compose.yml
```yaml
version: '3.8'

services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
    volumes:
      - ./html:/usr/share/nginx/html

  api:
    image: node:alpine
    working_dir: /app
    volumes:
      - ./app:/app
    command: npm start
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
```

## Advanced Usage

### Building Images
You can build Docker images inside the VM:

```bash
# Create a Dockerfile
cat > Dockerfile << 'EOF'
FROM alpine:latest
RUN apk add --no-cache nginx
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF

# Build the image
docker build -t my-nginx:latest .

# Run the image
docker run -d -p 8080:80 my-nginx:latest
```

### Multi-Stage Builds
```dockerfile
# Build stage
FROM golang:alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o main .

# Runtime stage
FROM alpine:latest
COPY --from=builder /app/main /app/main
CMD ["/app/main"]
```

### Docker Registry
You can push/pull from Docker Hub and other registries:

```bash
# Login to Docker Hub
docker login

# Tag an image
docker tag my-app:latest username/my-app:latest

# Push to registry
docker push username/my-app:latest

# Pull from registry
docker pull username/my-app:latest
```

## Monitoring and Debugging

### View Docker Daemon Logs
```bash
# SSH into the VM
ssh root@localhost -p 2222
# Password: vibecode

# View Docker daemon logs
tail -f /tmp/docker.log

# View containerd logs
tail -f /tmp/containerd.log
```

### Check Docker Service Status
```bash
# Check if Docker is running (from VM)
ssh root@localhost -p 2222 "ps aux | grep dockerd"

# Check Docker info
docker info

# Check Docker system events
docker events
```

### Container Stats
```bash
# View container resource usage
docker stats

# View specific container stats
docker stats my-container
```

### Inspect Containers
```bash
# Inspect container configuration
docker inspect my-container

# View container processes
docker top my-container

# View container port mappings
docker port my-container
```

## Troubleshooting

See `DOCKER_TROUBLESHOOTING.md` for detailed troubleshooting steps.

### Quick Diagnostics

```bash
# Test Docker connectivity
docker version

# If you get "Cannot connect to the Docker daemon":
# 1. Check if VM is running
# 2. Check DOCKER_HOST environment variable
echo $DOCKER_HOST  # Should be: tcp://localhost:2375

# 3. Check if port 2375 is accessible
nc -z localhost 2375

# 4. Check VM logs for Docker startup
ssh root@localhost -p 2222 "tail -50 /tmp/docker.log"
```

## Performance Tips

1. **Use Alpine-based images** - Smaller, faster downloads
2. **Layer caching** - Order Dockerfile commands from least to most frequently changing
3. **Multi-stage builds** - Reduce final image size
4. **Volume mounts** - Use volumes instead of COPY for development
5. **Resource limits** - Set memory/CPU limits for containers:
   ```bash
   docker run -d --memory="512m" --cpus="1.0" nginx:alpine
   ```

## Security Notes

⚠️ **IMPORTANT SECURITY WARNING**

The current Docker setup uses **unencrypted TCP on port 2375**, which is:
- ✅ Acceptable for local development
- ❌ **NOT secure for production use**
- ❌ **NOT secure on shared/public networks**

### Security Recommendations
1. **Only use on trusted networks** (home/office)
2. **Never expose port 2375 externally**
3. **Use SSH tunnel** for remote access:
   ```bash
   ssh -L 2375:localhost:2375 remote-host
   ```
4. **For production**: Enable TLS (see `DOCKER_TROUBLESHOOTING.md`)

## Integration with Other VM Services

The VM runs multiple services that you can access from your Docker containers:

### Access VM PostgreSQL from Container
```bash
# Get VM IP (usually 192.168.64.x)
VM_IP=$(docker network inspect bridge | jq -r '.[0].IPAM.Config[0].Gateway')

# Run container that connects to VM PostgreSQL
docker run -it --rm postgres:alpine psql -h host.docker.internal -p 5432 -U postgres
```

### Access VM Valkey from Container
```bash
docker run -it --rm redis:alpine redis-cli -h host.docker.internal -p 6379
```

### Access Container from OpenVSCode
From OpenVSCode running in the VM, you can access containers using their names or IPs on the Docker bridge network (172.17.0.x).

## Best Practices

1. **Tag your images** with meaningful versions, not just `latest`
2. **Use .dockerignore** to exclude unnecessary files from build context
3. **One process per container** - Don't run multiple services in one container
4. **Health checks** - Define health checks in Dockerfile
5. **Graceful shutdown** - Handle SIGTERM properly
6. **Logs to stdout** - Don't write logs to files inside containers
7. **Immutable containers** - Don't modify running containers, rebuild instead
8. **Environment variables** - Use env vars for configuration, not hardcoded values

## Example Projects

### Static Website
```bash
# Create project directory
mkdir my-website && cd my-website
echo '<h1>Hello from Docker!</h1>' > index.html

# Run nginx to serve it
docker run -d --name website -p 8080:80 -v $(pwd):/usr/share/nginx/html:ro nginx:alpine

# Access it
open http://localhost:8080
```

### Node.js API
```bash
# Create project
mkdir my-api && cd my-api
cat > package.json << 'EOF'
{
  "name": "my-api",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {"start": "node index.js"},
  "dependencies": {"express": "^4.18.0"}
}
EOF

cat > index.js << 'EOF'
const express = require('express');
const app = express();
app.get('/', (req, res) => res.json({message: 'Hello from Docker!'}));
app.listen(3000, () => console.log('API listening on port 3000'));
EOF

# Run with live reload
docker run -d --name api -p 3000:3000 -v $(pwd):/app -w /app node:alpine sh -c "npm install && npm start"

# Test it
curl http://localhost:3000
```

## Resources

- Docker Documentation: https://docs.docker.com/
- Docker Hub: https://hub.docker.com/
- Dockerfile Reference: https://docs.docker.com/engine/reference/builder/
- Docker Compose: https://docs.docker.com/compose/
- Best Practices: https://docs.docker.com/develop/dev-best-practices/

## Getting Help

1. Check `DOCKER_TROUBLESHOOTING.md` for common issues
2. View Docker daemon logs: `ssh root@localhost -p 2222 "tail -f /tmp/docker.log"`
3. Check container logs: `docker logs <container-name>`
4. Inspect container: `docker inspect <container-name>`
5. Docker events: `docker events --since 5m`

## Summary

You now have a full Docker environment running inside your VibeCode VM! This allows you to:
- ✅ Run any Docker container
- ✅ Build Docker images
- ✅ Use Docker Compose
- ✅ Access containers from macOS
- ✅ Persist data across restarts
- ✅ Integrate with VM services (PostgreSQL, Valkey, OpenVSCode)

Happy containerizing! 🐳
