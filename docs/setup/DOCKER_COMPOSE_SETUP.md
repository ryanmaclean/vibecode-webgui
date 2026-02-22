# Docker Compose Setup Guide

Complete guide to running VibeCode with Docker Compose across all deployment scenarios.

## Quick Start

### Development Environment
```bash
# Clone repository
git clone https://github.com/yourusername/vibecode.git
cd vibecode

# Create environment file
cp .env.example .env

# Edit .env with your values
export POSTGRES_PASSWORD="your-secure-password"

# Start development stack
docker-compose -f config/docker/docker-compose.dev.yml up -d

# View logs
docker-compose -f config/docker/docker-compose.dev.yml logs -f

# Access at http://localhost:3000
```

---

## Table of Contents

1. [Development Setup](#development-setup)
2. [Production Deployment](#production-deployment)
3. [NAS Deployment](#nas-deployment-qnap-synology)
4. [Multi-Architecture Setup](#multi-architecture-setup)
5. [Database Configurations](#database-configurations)
6. [AI Gateway Setup](#ai-gateway-setup)
7. [LiteLLM Integration](#litellm-integration)
8. [Common Operations](#common-operations)
9. [Troubleshooting](#troubleshooting)

---

## Development Setup

### Standard Development Stack

**File:** `config/docker/docker-compose.dev.yml`

**Services Included:**
- VibeCode Web Application (with hot reload)
- PostgreSQL with pgvector
- Valkey (Redis-compatible cache)
- Docker-in-Docker
- Dropbear SSH

#### Prerequisites
```bash
# Install Docker and Docker Compose
# macOS
brew install docker docker-compose

# Linux (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y docker.io docker-compose

# Verify installation
docker --version
docker-compose --version
```

#### Environment Configuration

Create `.env` file in project root:

```bash
# Database
POSTGRES_PASSWORD=secure_password_here

# Datadog (optional)
DD_SERVICE=vibecode-webgui
DD_ENV=development
DD_VERSION=0.1.0
NEXT_PUBLIC_DD_APPLICATION_ID=your_app_id
NEXT_PUBLIC_DD_CLIENT_TOKEN=your_client_token
```

#### Start Development Environment

```bash
# Start all services
docker-compose -f config/docker/docker-compose.dev.yml up -d

# Start specific services
docker-compose -f config/docker/docker-compose.dev.yml up -d vibecode-dev postgres valkey

# Rebuild and start
docker-compose -f config/docker/docker-compose.dev.yml up -d --build

# View logs
docker-compose -f config/docker/docker-compose.dev.yml logs -f vibecode-dev
```

#### Service Access

| Service | URL | Credentials |
|---------|-----|-------------|
| VibeCode App | http://localhost:3000 | - |
| PostgreSQL | localhost:5432 | vibecode / your_password |
| Valkey | localhost:6379 | - |
| Docker API | localhost:2375 | - |
| SSH | localhost:2222 | Configure SSH keys |

#### Hot Reload Configuration

The development setup includes:
- Source code bind mount at `.:/app`
- Anonymous volumes for `node_modules` and `.next`
- `NODE_ENV=development` for Next.js hot reload

**Critical:** Don't delete the anonymous volumes or hot reload will break!

---

## Production Deployment

### Production Stack (Basic)

**File:** `config/docker/docker-compose.prod.yml`

Optimized for x86-64 production deployment.

```bash
# Set production environment
export NODE_ENV=production
export BUILD_VERSION=1.0.0

# Start production stack
docker-compose -f config/docker/docker-compose.prod.yml up -d

# Access at http://localhost:3000
```

### Production Stack (Full)

**File:** `config/docker/docker-compose.production.yml`

Complete production deployment with all services.

**Services Included:**
- VibeCode App (production build)
- PostgreSQL with pgvector
- Redis cache
- NGINX reverse proxy
- Code Server
- Prometheus + Grafana (optional)
- Dropbear SSH

#### Environment Configuration

```bash
# .env.production
NODE_ENV=production
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secret-here
OPENROUTER_API_KEY=your-key-here
POSTGRES_PASSWORD=secure-password
CODE_SERVER_PASSWORD=secure-password
GRAFANA_PASSWORD=secure-password

# Datadog
DD_SERVICE=vibecode-webgui
DD_ENV=production
DD_VERSION=1.0.0
NEXT_PUBLIC_DD_APPLICATION_ID=your-app-id
NEXT_PUBLIC_DD_CLIENT_TOKEN=your-token
```

#### Deployment Commands

```bash
# Load production environment
source .env.production

# Start core services only
docker-compose -f config/docker/docker-compose.production.yml up -d

# Start with monitoring
docker-compose -f config/docker/docker-compose.production.yml --profile monitoring up -d

# Check service health
docker-compose -f config/docker/docker-compose.production.yml ps

# View service logs
docker-compose -f config/docker/docker-compose.production.yml logs -f vibecode-app
```

#### Production Access

| Service | Port | URL |
|---------|------|-----|
| NGINX (HTTP) | 80 | http://your-domain.com |
| NGINX (HTTPS) | 443 | https://your-domain.com |
| VibeCode App | 3000 | http://localhost:3000 |
| Code Server | 8080 | http://localhost:8080 |
| Prometheus | 9090 | http://localhost:9090 |
| Grafana | 3001 | http://localhost:3001 |

#### SSL/TLS Configuration

1. **Generate SSL certificates:**
```bash
# Self-signed (development)
mkdir -p docker/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/nginx.key \
  -out docker/nginx/ssl/nginx.crt

# Let's Encrypt (production)
sudo certbot certonly --standalone -d your-domain.com
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/nginx/ssl/
cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/nginx/ssl/
```

2. **Configure NGINX:**
Place SSL configuration in `docker/nginx/nginx.conf`

---

## NAS Deployment (QNAP, Synology)

**File:** `config/docker/docker-compose.nas.yml`

Optimized for NAS devices with minimal configuration.

### QNAP Container Station

#### Using Container Station UI

1. **Open Container Station**
   - QTS/QuTS: Main Menu → Container Station

2. **Create Application**
   - Click "Create" → "Create Application"
   - Name: `vibecode`

3. **Upload Configuration**
   - Upload `config/docker/docker-compose.nas.yml`
   - Or paste contents directly

4. **Configure Environment**

Create `nas.env` file:
```bash
# API Keys
OPENAI_API_KEY=sk-your-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here
OPENROUTER_API_KEY=sk-or-your-key-here

# Code Server
CODE_SERVER_PASSWORD=secure-password-here

# Datadog (optional)
DD_API_KEY=your-dd-api-key
DD_SITE=datadoghq.com
```

5. **Start Application**
   - Click "Create and Run"
   - Wait for images to download

#### Access

| Service | Port | URL |
|---------|------|-----|
| VibeCode | 3000 | http://[NAS-IP]:3000 |
| Code Server | 8443 | https://[NAS-IP]:8443 |

#### Using SSH (Advanced)

```bash
# SSH into QNAP
ssh admin@your-nas-ip

# Navigate to Container directory
cd /share/Container

# Create project directory
mkdir vibecode && cd vibecode

# Create nas.env file
cat > nas.env <<EOF
CODE_SERVER_PASSWORD=your-password
OPENAI_API_KEY=your-key
EOF

# Download docker-compose file
wget https://raw.githubusercontent.com/yourrepo/vibecode/main/config/docker/docker-compose.nas.yml

# Start services
docker-compose -f docker-compose.nas.yml up -d

# View logs
docker-compose -f docker-compose.nas.yml logs -f
```

### Synology NAS

#### Using Docker UI

1. **Open Docker Package**
   - DSM: Main Menu → Docker

2. **Registry**
   - Search for `vibecode/webgui`
   - Download image

3. **Create Container**
   - Image: `vibecode/webgui:latest`
   - Container Name: `vibecode-app`
   - Port Settings:
     - Local: 3000 → Container: 3000

4. **Environment Variables**
```
NODE_ENV=production
OPENAI_API_KEY=your-key
CODE_SERVER_PASSWORD=your-password
```

5. **Volume Mounts**
   - `/docker/vibecode/workspace` → `/home/coder/workspace`
   - `/docker/vibecode/settings` → `/home/coder/.local/share/code-server/User`

#### Using SSH

```bash
# SSH into Synology
ssh admin@synology-ip

# Navigate to docker directory
cd /volume1/docker

# Create directory
sudo mkdir -p vibecode && cd vibecode

# Create docker-compose.yml
sudo nano docker-compose.nas.yml
# Paste contents from config/docker/docker-compose.nas.yml

# Create environment file
sudo nano nas.env
# Add your environment variables

# Start services
sudo docker-compose -f docker-compose.nas.yml up -d
```

---

## Multi-Architecture Setup

**File:** `config/docker/docker-compose.multiarch.yml`

Supports both AMD64 and ARM64 (Apple Silicon, Raspberry Pi, ARM servers).

### Architecture Detection

```bash
# Check your architecture
uname -m
# x86_64 = AMD64
# arm64/aarch64 = ARM64
```

### Apple Silicon (M1/M2/M3/M4)

```bash
# Set platform
export DOCKER_DEFAULT_PLATFORM=linux/arm64

# Start services
docker-compose -f config/docker/docker-compose.multiarch.yml up -d

# Verify architecture
docker inspect vibecode-app-multiarch | grep Architecture
```

### Using Profiles

The multiarch setup supports different deployment profiles:

#### Development Profile
```bash
docker-compose -f config/docker/docker-compose.multiarch.yml \
  --profile development up -d

# Includes: vibecode-dev, valkey, postgres, docker
```

#### Production Profile
```bash
docker-compose -f config/docker/docker-compose.multiarch.yml \
  --profile production up -d

# Includes: vibecode-app, valkey, nginx
```

#### Full Monitoring Stack
```bash
docker-compose -f config/docker/docker-compose.multiarch.yml \
  --profile development \
  --profile monitoring up -d

# Includes: dev services + prometheus + grafana
```

#### Database Profile
```bash
docker-compose -f config/docker/docker-compose.multiarch.yml \
  --profile database up -d

# Includes: postgres only
```

### Resource Limits

The multiarch compose includes resource management:

```yaml
deploy:
  resources:
    limits:
      memory: 1G
    reservations:
      memory: 256M
```

---

## Database Configurations

### PostgreSQL with pgvector

**File:** `config/docker/docker-compose.pgvector.yml`

Dedicated PostgreSQL setup with pgvector extension for vector embeddings.

```bash
# Start database stack
docker-compose -f config/docker/docker-compose.pgvector.yml up -d

# Access pgAdmin
open http://localhost:5050

# pgAdmin credentials
Email: admin@vibecode.dev (or PGADMIN_EMAIL from .env)
Password: from PGADMIN_PASSWORD env var
```

#### Database Connection

```bash
# Connection string
postgresql://vibecode:your-password@localhost:5432/vibecode

# Using psql
docker exec -it vibecode-pgvector psql -U vibecode -d vibecode

# Check pgvector extension
psql> SELECT * FROM pg_extension WHERE extname = 'vector';
```

#### Creating Vector Indexes

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Create table with vector column
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  content TEXT,
  embedding vector(1536)
);

-- Create index for similarity search
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops);
```

#### Health Checks

```bash
# Check database health
docker-compose -f config/docker/docker-compose.pgvector.yml ps

# View health check logs
docker inspect vibecode-pgvector --format='{{json .State.Health}}'
```

---

## AI Gateway Setup

**File:** `config/docker/docker-compose.ai-gateway.yml`

Unified AI provider gateway with OpenRouter, OpenAI, Azure, Ollama support.

### Profiles Available

| Profile | Services |
|---------|----------|
| `core` | AI Gateway + Redis |
| `full` | Core + all dependencies |
| `ollama` | Local Ollama runtime |
| `obs-demo` | Full stack + OpenWebUI + observability |

### Quick Start

```bash
# Start core gateway
docker-compose -f config/docker/docker-compose.ai-gateway.yml \
  --profile core up -d

# Start with local Ollama
docker-compose -f config/docker/docker-compose.ai-gateway.yml \
  --profile core \
  --profile ollama up -d

# Start full observability demo
docker-compose -f config/docker/docker-compose.ai-gateway.yml \
  --profile obs-demo up -d
```

### Environment Configuration

```bash
# .env.ai-gateway
# Core
API_KEYS=vbai_your_key_1,vbai_your_key_2
JWT_SECRET=your-jwt-secret
PROVIDERS_ENABLED=openrouter,openai,ollama
FORCE_PROVIDER=  # Leave empty for auto-selection
ALLOW_PROVIDER_FALLBACK=true

# OpenRouter
OPENROUTER_API_KEY=sk-or-v1-your-key
OPENROUTER_REFERRER=https://vibecode.dev
OPENROUTER_TITLE=VibeCode AI Gateway

# OpenAI
OPENAI_API_KEY=sk-your-key

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_DEPLOYMENTS=gpt-4,gpt-35-turbo

# Ollama (uses local service)
OLLAMA_HOST=http://ollama:11434

# Tracing
ENABLE_TRACING=true
DD_ENV=production
DD_SERVICE=vibecode-ai-gateway
```

### API Usage

```bash
# Test AI Gateway
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer vbai_your_key_1" \
  -d '{
    "model": "openai/gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

# Check health
curl http://localhost:3001/health
```

### Ollama Setup

```bash
# Start Ollama service
docker-compose -f config/docker/docker-compose.ai-gateway.yml \
  --profile ollama up -d ollama

# Pull a model
docker exec -it ollama ollama pull llama2

# List available models
docker exec -it ollama ollama list

# Test locally
curl http://localhost:11434/api/generate -d '{
  "model": "llama2",
  "prompt": "Why is the sky blue?"
}'
```

### OpenWebUI Access

When running `obs-demo` profile:

```bash
# Access OpenWebUI
open http://localhost:3002

# First time setup
1. Create admin account
2. Configure Ollama connection (pre-configured)
3. Select model and start chatting
```

---

## LiteLLM Integration

**File:** `config/docker/docker-compose.litellm.yml`

Complete LiteLLM proxy with UI, database, and monitoring.

### Services Included

- **litellm-proxy**: Main proxy server (port 4000)
- **litellm-ui**: Web dashboard (port 4001)
- **litellm-postgres**: PostgreSQL database
- **litellm-redis**: Redis cache
- **litellm-datadog-agent**: Monitoring (optional)

### Initial Setup

#### 1. Create Configuration

```bash
# Create LiteLLM config directory
mkdir -p config/docker/litellm

# Create config.yaml
cat > config/docker/litellm/config.yaml <<EOF
model_list:
  - model_name: gpt-4
    litellm_params:
      model: openai/gpt-4
      api_key: os.environ/OPENAI_API_KEY

  - model_name: claude-3
    litellm_params:
      model: anthropic/claude-3-opus-20240229
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: llama-2
    litellm_params:
      model: ollama/llama2
      api_base: http://ollama:11434

litellm_settings:
  drop_params: true
  set_verbose: true
  request_timeout: 600

  # Caching
  cache: true
  cache_params:
    type: redis
    host: litellm-redis
    port: 6379

  # Cost tracking
  success_callback: ["langfuse"]

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
EOF
```

#### 2. Generate Secrets

```bash
# Generate master key
export LITELLM_MASTER_KEY=$(openssl rand -base64 32)

# Generate salt key
export LITELLM_SALT_KEY=$(openssl rand -base64 32)

# Set database password
export LITELLM_POSTGRES_PASSWORD=$(openssl rand -base64 16)

# Set UI credentials
export LITELLM_UI_USERNAME=admin
export LITELLM_UI_PASSWORD=$(openssl rand -base64 16)

# Save to .env.litellm
cat > .env.litellm <<EOF
LITELLM_MASTER_KEY=$LITELLM_MASTER_KEY
LITELLM_SALT_KEY=$LITELLM_SALT_KEY
LITELLM_POSTGRES_PASSWORD=$LITELLM_POSTGRES_PASSWORD
LITELLM_UI_USERNAME=$LITELLM_UI_USERNAME
LITELLM_UI_PASSWORD=$LITELLM_UI_PASSWORD

# Model API Keys
OPENAI_API_KEY=sk-your-key
ANTHROPIC_API_KEY=sk-ant-your-key
EOF

# Load environment
source .env.litellm
```

#### 3. Initialize Database

```bash
# Create init script
cat > config/docker/litellm/init-litellm-db.sql <<EOF
-- LiteLLM database initialization
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tables will be created automatically by LiteLLM
-- This script ensures proper character encoding
SET client_encoding = 'UTF8';
EOF
```

#### 4. Start LiteLLM Stack

```bash
# Load environment
source .env.litellm

# Start services
docker-compose -f config/docker/docker-compose.litellm.yml up -d

# Wait for services to be healthy
docker-compose -f config/docker/docker-compose.litellm.yml ps

# View logs
docker-compose -f config/docker/docker-compose.litellm.yml logs -f litellm-proxy
```

### LiteLLM UI Access

```bash
# Open UI
open http://localhost:4001

# Login
Username: admin (or your LITELLM_UI_USERNAME)
Password: from LITELLM_UI_PASSWORD

# Features:
- View API usage
- Manage API keys
- Monitor costs
- Configure models
- View logs
```

### API Usage

```bash
# Create virtual key
curl -X POST http://localhost:4000/key/generate \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "models": ["gpt-4", "claude-3"],
    "duration": "30d"
  }'

# Use virtual key
curl -X POST http://localhost:4000/chat/completions \
  -H "Authorization: Bearer sk-litellm-your-virtual-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

# Check health
curl http://localhost:4000/health/liveliness
```

### Monitoring with Datadog

```bash
# Set Datadog API key
export DD_API_KEY=your-datadog-api-key

# Restart services
docker-compose -f config/docker/docker-compose.litellm.yml restart litellm-datadog-agent

# View APM traces in Datadog
# Navigate to: APM → Services → litellm-proxy
```

---

## Common Operations

### Starting Services

```bash
# Start in background
docker-compose -f <compose-file> up -d

# Start specific service
docker-compose -f <compose-file> up -d <service-name>

# Start with logs
docker-compose -f <compose-file> up

# Force recreate
docker-compose -f <compose-file> up -d --force-recreate
```

### Stopping Services

```bash
# Stop all services
docker-compose -f <compose-file> down

# Stop but keep volumes
docker-compose -f <compose-file> stop

# Stop specific service
docker-compose -f <compose-file> stop <service-name>

# Remove volumes (WARNING: deletes data!)
docker-compose -f <compose-file> down -v
```

### Viewing Logs

```bash
# All services
docker-compose -f <compose-file> logs -f

# Specific service
docker-compose -f <compose-file> logs -f <service-name>

# Last 100 lines
docker-compose -f <compose-file> logs --tail=100

# Since timestamp
docker-compose -f <compose-file> logs --since 2024-01-01T00:00:00
```

### Rebuilding Images

```bash
# Rebuild all services
docker-compose -f <compose-file> build

# Rebuild specific service
docker-compose -f <compose-file> build <service-name>

# Rebuild without cache
docker-compose -f <compose-file> build --no-cache

# Rebuild and restart
docker-compose -f <compose-file> up -d --build
```

### Scaling Services

```bash
# Scale specific service
docker-compose -f <compose-file> up -d --scale <service-name>=3

# Example: Scale AI workers
docker-compose -f config/docker/docker-compose.ai-gateway.yml \
  --scale ai-gateway=3 up -d
```

### Executing Commands

```bash
# Run command in service
docker-compose -f <compose-file> exec <service-name> <command>

# Example: PostgreSQL shell
docker-compose -f config/docker/docker-compose.dev.yml \
  exec postgres psql -U vibecode

# Example: Redis CLI
docker-compose -f config/docker/docker-compose.dev.yml \
  exec valkey valkey-cli

# Run one-off command
docker-compose -f <compose-file> run --rm <service-name> <command>
```

### Health Checks

```bash
# Check service status
docker-compose -f <compose-file> ps

# Detailed health status
docker inspect <container-name> --format='{{json .State.Health}}'

# All health statuses
for container in $(docker-compose -f <compose-file> ps -q); do
  echo "Container: $(docker inspect $container --format='{{.Name}}')"
  docker inspect $container --format='{{json .State.Health.Status}}'
done
```

### Backup and Restore

#### Database Backup
```bash
# PostgreSQL backup
docker-compose -f <compose-file> exec -T postgres \
  pg_dump -U vibecode vibecode > backup-$(date +%Y%m%d).sql

# Compress backup
gzip backup-$(date +%Y%m%d).sql
```

#### Database Restore
```bash
# Extract backup
gunzip backup-20240214.sql.gz

# Restore
docker-compose -f <compose-file> exec -T postgres \
  psql -U vibecode vibecode < backup-20240214.sql
```

#### Volume Backup
```bash
# Backup volume to tar
docker run --rm \
  -v vibecode_postgres-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres-data-$(date +%Y%m%d).tar.gz /data

# Restore volume from tar
docker run --rm \
  -v vibecode_postgres-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/postgres-data-20240214.tar.gz -C /
```

---

## Troubleshooting

### Port Already in Use

**Error:** `Bind for 0.0.0.0:3000 failed: port is already allocated`

**Solution:**
```bash
# Find process using port
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yml
ports:
  - "3001:3000"  # Use different host port
```

### Permission Denied

**Error:** `permission denied while trying to connect to Docker daemon`

**Solution:**
```bash
# Add user to docker group (Linux)
sudo usermod -aG docker $USER
newgrp docker

# Fix socket permissions
sudo chmod 666 /var/run/docker.sock

# Restart Docker (macOS)
# Docker Desktop → Preferences → Restart
```

### Out of Memory

**Error:** `Container killed: OOMKilled`

**Solution:**
```bash
# Increase Docker memory limit
# Docker Desktop → Preferences → Resources → Memory

# Add memory limits to service
services:
  vibecode-app:
    deploy:
      resources:
        limits:
          memory: 2G

# Clear unused resources
docker system prune -a --volumes
```

### Image Pull Failures

**Error:** `Error response from daemon: pull access denied`

**Solution:**
```bash
# Login to Docker Hub
docker login

# Pull specific version
docker pull vibecode/webgui:v1.0.0

# Use local build instead
docker-compose -f <compose-file> build
docker-compose -f <compose-file> up -d
```

### Container Won't Start

**Symptoms:** Container exits immediately after starting

**Debugging:**
```bash
# View exit code
docker-compose -f <compose-file> ps

# Check logs
docker-compose -f <compose-file> logs <service-name>

# Inspect container
docker inspect <container-name>

# Run container interactively
docker-compose -f <compose-file> run --rm <service-name> sh

# Check environment
docker-compose -f <compose-file> config
```

### Database Connection Errors

**Error:** `ECONNREFUSED` or `connection refused`

**Solutions:**
```bash
# 1. Check database is running
docker-compose -f <compose-file> ps postgres

# 2. Check database health
docker-compose -f <compose-file> exec postgres pg_isready

# 3. Verify connection string
docker-compose -f <compose-file> exec vibecode-app env | grep DATABASE_URL

# 4. Test connection
docker-compose -f <compose-file> exec postgres \
  psql -U vibecode -d vibecode -c "SELECT 1"

# 5. Check network
docker network ls
docker network inspect <network-name>

# 6. Wait for database to be ready
depends_on:
  postgres:
    condition: service_healthy
```

### Volume Mount Issues

**Error:** Bind mount path doesn't exist

**Solution:**
```bash
# Create directory first
mkdir -p /path/to/mount

# Check permissions
ls -la /path/to/mount

# Fix permissions
chmod 755 /path/to/mount
chown -R $(id -u):$(id -g) /path/to/mount

# Use named volumes instead
volumes:
  - postgres-data:/var/lib/postgresql/data  # Named volume
  # Instead of:
  # - /host/path:/container/path  # Bind mount
```

### DNS Resolution Problems

**Error:** `Could not resolve host`

**Solution:**
```bash
# Use Docker's internal DNS
networks:
  vibecode-network:
    driver: bridge

# Use service names
DATABASE_URL=postgresql://vibecode:pass@postgres:5432/vibecode
#                                        ^^^^^^^^ service name

# Test DNS
docker-compose -f <compose-file> exec vibecode-app ping postgres

# Configure custom DNS
services:
  vibecode-app:
    dns:
      - 8.8.8.8
      - 8.8.4.4
```

### Environment Variables Not Loading

**Problem:** Variables in `.env` file not being used

**Solution:**
```bash
# 1. Place .env in same directory as docker-compose.yml
ls -la .env

# 2. Use env_file directive
services:
  vibecode-app:
    env_file:
      - .env
      - .env.local

# 3. Load variables manually
source .env
docker-compose -f <compose-file> up -d

# 4. Pass explicitly
docker-compose -f <compose-file> up -d \
  -e DATABASE_URL=$DATABASE_URL

# 5. Verify variables
docker-compose -f <compose-file> config
```

### Hot Reload Not Working

**Problem:** Code changes not reflected in development mode

**Solution:**
```bash
# 1. Ensure volumes are correct
volumes:
  - .:/app  # Source code
  - /app/node_modules  # Don't override
  - /app/.next  # Don't override

# 2. Check file permissions
chmod -R 755 .

# 3. Rebuild
docker-compose -f config/docker/docker-compose.dev.yml down
docker-compose -f config/docker/docker-compose.dev.yml up -d --build

# 4. Clear Next.js cache
rm -rf .next
docker-compose -f config/docker/docker-compose.dev.yml restart

# 5. Use polling (macOS/Windows)
environment:
  - CHOKIDAR_USEPOLLING=true
```

### SSL Certificate Issues

**Error:** `unable to verify the first certificate`

**Solution:**
```bash
# 1. Use self-signed for development
NODE_TLS_REJECT_UNAUTHORIZED=0  # Development only!

# 2. Add certificate to container
COPY ./certs/ca-cert.pem /usr/local/share/ca-certificates/
RUN update-ca-certificates

# 3. Use Let's Encrypt for production
certbot certonly --standalone -d your-domain.com
```

### Resource Cleanup

```bash
# Remove stopped containers
docker-compose -f <compose-file> rm

# Remove all unused resources
docker system prune

# Remove volumes (WARNING: deletes data!)
docker volume prune

# Remove specific volume
docker volume rm <volume-name>

# Full cleanup (DANGER!)
docker-compose -f <compose-file> down -v
docker system prune -a --volumes
```

### Debug Mode

```bash
# Enable Docker Compose debug output
docker-compose -f <compose-file> --verbose up

# Enable service debug logging
environment:
  - DEBUG=*
  - NODE_ENV=development
  - LOG_LEVEL=debug

# Access container shell
docker-compose -f <compose-file> exec <service-name> sh
```

### Getting Help

```bash
# Check Docker Compose version
docker-compose --version

# Validate compose file
docker-compose -f <compose-file> config

# Get service information
docker-compose -f <compose-file> ps
docker-compose -f <compose-file> top

# Export configuration
docker-compose -f <compose-file> config > resolved-config.yml
```

---

## Best Practices

### Security

1. **Never commit secrets:**
```bash
# Use .env files (gitignored)
echo ".env" >> .gitignore
echo ".env.*" >> .gitignore

# Or use Docker secrets
secrets:
  db_password:
    file: ./secrets/db_password.txt
```

2. **Use read-only mounts:**
```yaml
volumes:
  - ./config.yml:/app/config.yml:ro  # read-only
```

3. **Run as non-root:**
```yaml
user: "1000:1000"
```

4. **Limit capabilities:**
```yaml
cap_drop:
  - ALL
cap_add:
  - NET_BIND_SERVICE
```

### Performance

1. **Use build cache:**
```bash
docker-compose build --build-arg BUILDKIT_INLINE_CACHE=1
```

2. **Optimize images:**
- Use multi-stage builds
- Minimize layers
- Use .dockerignore

3. **Resource limits:**
```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      memory: 512M
```

### Monitoring

1. **Health checks:**
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

2. **Logging:**
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

3. **Metrics:**
```bash
# Enable metrics endpoint
docker-compose -f <compose-file> --profile monitoring up -d
```

---

## Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [VibeCode Docker Deployment Guide](../DOCKER_DEPLOYMENT.md)
- [Environment Variables Reference](../ENVIRONMENT_VARIABLES.md)
- [Production Deployment Checklist](../PRODUCTION_CHECKLIST.md)

---

**Need Help?**
- GitHub Issues: https://github.com/vibecode/issues
- Discord: https://discord.gg/vibecode
- Documentation: https://docs.vibecode.dev
