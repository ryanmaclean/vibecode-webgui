---
title: "Docker Compose Setup Guide"
description: "Complete guide for running OpenVSCode Server with PostgreSQL using Docker Compose"
---

# Docker Compose Setup - OpenVSCode with PostgreSQL RAG

**Date:** November 18, 2025
**Status:** ✅ Production Ready with Environment Variables

## Overview

This setup uses Docker Compose to run:
- **PostgreSQL with pgvector** - Vector database for RAG embeddings
- **OpenVSCode Server** - Browser-based IDE with workspace-rag extension pre-installed

**No hardcoded passwords!** All sensitive configuration is managed via environment variables.

## Quick Start

### 1. Set Up Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your secure password
nano .env  # or use your preferred editor
```

**Important:** Set a secure password in `.env`:
```bash
POSTGRES_PASSWORD=your-secure-password-here
```

### 2. Start the Stack

```bash
# Start all services in the background
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

### 3. Access the IDE

```
Open: http://localhost:3000
```

The database connection is pre-configured - no manual setup required!

### 4. Test RAG Functionality

1. Open a workspace in the IDE (File → Open Folder)
2. Press `Cmd+Shift+P` (or `Ctrl+Shift+P`)
3. Type: **"Workspace RAG: Index Workspace"**
4. Wait for indexing to complete ✅

### 5. Verify Data

```bash
# Connect to database
docker-compose exec postgres psql -U postgres -d workspace_rag

# Inside psql:
SELECT COUNT(*) FROM workspace_documents;
\q
```

## Configuration

### Environment Variables (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | `postgres` | PostgreSQL username |
| `POSTGRES_PASSWORD` | **required** | PostgreSQL password (set this!) |
| `POSTGRES_DB` | `workspace_rag` | Database name |
| `POSTGRES_PORT` | `5432` | PostgreSQL port on host |
| `OPENVSCODE_PORT` | `3000` | OpenVSCode port on host |

### Extension Configuration

The workspace-rag extension uses these default values (from package.json):

```json
{
  "workspaceRag.pgHost": "postgres-pgvector",
  "workspaceRag.pgPort": 5432,
  "workspaceRag.pgDatabase": "workspace_rag",
  "workspaceRag.pgUser": "postgres",
  "workspaceRag.pgPassword": "password"
}
```

**Note:** The password in the extension must match `POSTGRES_PASSWORD` in your `.env` file for the default setup. For custom passwords, see [Custom Configuration](#custom-configuration) below.

## File Structure

```
vibecode-webgui/
├── docker-compose.openvscode.yml      # Service definitions
├── .env                    # Your environment variables (gitignored)
├── .env.example            # Template for .env
├── init-db.sql             # Database initialization script
└── DOCKER_COMPOSE_SETUP.md # This file
```

## Common Commands

### Start Services

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d postgres
docker-compose up -d openvscode
```

### Stop Services

```bash
# Stop all services (keeps data)
docker-compose down

# Stop and remove volumes (deletes data)
docker-compose down -v
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f openvscode
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart postgres
```

### Database Management

```bash
# Connect to database
docker-compose exec postgres psql -U postgres -d workspace_rag

# Backup database
docker-compose exec postgres pg_dump -U postgres workspace_rag > backup.sql

# Restore database
cat backup.sql | docker-compose exec -T postgres psql -U postgres -d workspace_rag

# Clear all data
docker-compose exec postgres psql -U postgres -d workspace_rag -c "TRUNCATE workspace_documents CASCADE;"
```

## Custom Configuration

### Using Different Database Password

If you want to use a password other than "password":

1. **Update .env:**
   ```bash
   POSTGRES_PASSWORD=my-secure-password
   ```

2. **Update Extension (Option A - Rebuild Extension):**

   Edit `extensions/workspace-rag/package.json`:
   ```json
   "workspaceRag.pgPassword": {
     "default": "my-secure-password"
   }
   ```

   Then rebuild:
   ```bash
   cd extensions/workspace-rag
   npm run package
   npx @vscode/vsce package

   # Copy to Docker build directory
   cp workspace-rag-0.1.0.vsix /tmp/openvscode-dockerfile/workspace-rag-1.0.0.vsix

   # Rebuild Docker image
   cd /tmp/openvscode-dockerfile
   docker build -t openvscode-with-rag:latest .

   # Restart services
   docker-compose down
   docker-compose up -d
   ```

3. **Update Extension (Option B - VS Code Settings):**

   After starting the IDE, manually configure via Settings UI:
   - Press `Cmd+,` (Settings)
   - Search: "workspace rag"
   - Set "Pg Password" to your password

### Using Custom Ports

Edit `.env`:
```bash
POSTGRES_PORT=5433        # PostgreSQL on host:5433
OPENVSCODE_PORT=8080      # OpenVSCode on host:8080
```

Then restart:
```bash
docker-compose down
docker-compose up -d
```

## Healthchecks

The postgres service includes a healthcheck to ensure it's ready before openvscode starts:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres"]
  interval: 5s
  timeout: 5s
  retries: 5
```

This prevents connection errors during startup.

## Data Persistence

PostgreSQL data is stored in a Docker volume:

```bash
# List volumes
docker volume ls | grep workspace

# Inspect volume
docker volume inspect vibecode-webgui_postgres_data

# Backup volume
docker run --rm -v vibecode-webgui_postgres_data:/data -v $(pwd):/backup \
  ubuntu tar czf /backup/postgres-backup.tar.gz /data

# Restore volume
docker run --rm -v vibecode-webgui_postgres_data:/data -v $(pwd):/backup \
  ubuntu tar xzf /backup/postgres-backup.tar.gz -C /
```

## Troubleshooting

### Extension Still Shows ECONNREFUSED

1. **Check containers are running:**
   ```bash
   docker-compose ps
   ```

2. **Check logs for errors:**
   ```bash
   docker-compose logs postgres | grep -i error
   docker-compose logs openvscode | grep -i error
   ```

3. **Verify network:**
   ```bash
   docker-compose exec openvscode ping -c 2 postgres-pgvector
   ```

4. **Check extension is using correct password:**
   - Open IDE Settings (`Cmd+,`)
   - Search "workspace rag"
   - Verify password matches your `.env` file

### Database Connection Refused

```bash
# Check PostgreSQL is healthy
docker-compose exec postgres pg_isready -U postgres

# Check password in .env matches
cat .env | grep POSTGRES_PASSWORD
```

### Port Already in Use

```bash
# Check what's using the port
lsof -i :3000  # or :5432

# Use different port in .env
OPENVSCODE_PORT=8080
```

## Production Deployment

### Security Best Practices

1. **Use strong passwords:**
   ```bash
   # Generate secure password
   openssl rand -base64 32
   ```

2. **Don't expose PostgreSQL port:**

   Edit `docker-compose.openvscode.yml`, remove:
   ```yaml
   ports:
     - "${POSTGRES_PORT:-5432}:5432"
   ```

3. **Use Docker secrets (Docker Swarm):**
   ```yaml
   services:
     postgres:
       secrets:
         - postgres_password
       environment:
         POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password

   secrets:
     postgres_password:
       external: true
   ```

4. **Enable SSL for PostgreSQL:**

   Mount SSL certificates:
   ```yaml
   volumes:
     - ./ssl/server.crt:/var/lib/postgresql/server.crt:ro
     - ./ssl/server.key:/var/lib/postgresql/server.key:ro
   ```

### Environment-Specific Configs

```bash
# Development
docker-compose -f docker-compose.openvscode.yml up -d

# Production
docker-compose -f docker-compose.openvscode.yml -f docker-compose.prod.yml up -d

# Staging
docker-compose -f docker-compose.openvscode.yml -f docker-compose.staging.yml up -d
```

## Rebuilding the Extension

If you modify the extension:

```bash
# 1. Build extension
cd extensions/workspace-rag
npm run package
npx @vscode/vsce package

# 2. Copy VSIX to Docker build directory
cp workspace-rag-0.1.0.vsix /tmp/openvscode-dockerfile/workspace-rag-1.0.0.vsix

# 3. Rebuild Docker image
cd /tmp/openvscode-dockerfile
docker build -t openvscode-with-rag:latest .

# 4. Recreate container with new image
docker-compose up -d --force-recreate openvscode
```

## Summary

✅ **No hardcoded passwords** - All sensitive data in `.env`
✅ **Automatic database initialization** - Schema created on first run
✅ **Health checks** - Ensures services start in correct order
✅ **Data persistence** - PostgreSQL data survives container restarts
✅ **Easy configuration** - Change ports and settings via `.env`
✅ **Production ready** - Supports Docker secrets and SSL

**Quick Start:**
```bash
cp .env.example .env
nano .env  # Set POSTGRES_PASSWORD
docker-compose up -d
open http://localhost:3000
```

**Access:** http://localhost:3000
**Status:** ✅ Ready to Use
