# Docker Compose Healthchecks Documentation

This document describes the healthcheck configuration for all services in the VibeCode Docker Compose deployment.

## Overview

Healthchecks ensure proper orchestration and zero-downtime deployments by:
- Verifying services are ready before dependent services start
- Enabling automated restarts for unhealthy containers
- Providing visibility into service health status
- Supporting rolling updates with proper readiness checks

## Service Healthcheck Endpoints

### Application Services

#### webgui (Next.js Application)
- **Endpoint**: `http://localhost:3000/api/healthz`
- **Method**: GET
- **Healthcheck**: `wget --no-verbose --tries=1 --spider http://localhost:3000/api/healthz`
- **Interval**: 30s
- **Timeout**: 10s
- **Retries**: 3
- **Start Period**: 60s
- **Dependencies**: postgres, redis (must be healthy first)

**Health Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-02T12:00:00.000Z"
}
```

**Detailed Health Endpoint**: `http://localhost:3000/api/health`
```json
{
  "status": "healthy",
  "timestamp": "2025-10-02T12:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "memory": {
      "status": "healthy",
      "details": {
        "used": 150,
        "total": 512,
        "external": 10,
        "rss": 200
      }
    },
    "database": { "status": "healthy" },
    "valkey": { "status": "healthy" },
    "ai": { "status": "healthy" }
  }
}
```

#### free-llm-model-updater (Background Job)
- **Healthcheck**: File existence check for `/app/runtime/free-llm-models/models.txt`
- **Command**: `test -f /app/runtime/free-llm-models/models.txt`
- **Interval**: 60s
- **Timeout**: 5s
- **Retries**: 3
- **Start Period**: 120s (allows time for first update)
- **Dependencies**: webgui (must be healthy first)

### Database Services

#### postgres (PostgreSQL 16)
- **Healthcheck**: `pg_isready -U postgres -d vibecode`
- **Interval**: 10s
- **Timeout**: 5s
- **Retries**: 5
- **Start Period**: 10s
- **Port**: 5432

**pg_isready output**: Returns 0 if PostgreSQL is accepting connections

#### redis (Redis 7 Alpine)
- **Healthcheck**: `redis-cli ping`
- **Interval**: 10s
- **Timeout**: 5s
- **Retries**: 3
- **Start Period**: 5s
- **Port**: 6379

**redis-cli ping output**: Returns "PONG" if Redis is accepting connections

### Reverse Proxy

#### nginx (NGINX Alpine)
- **Endpoint**: `http://localhost:80/`
- **Healthcheck**: `wget --no-verbose --tries=1 --spider http://localhost:80/`
- **Interval**: 30s
- **Timeout**: 10s
- **Retries**: 3
- **Start Period**: 10s
- **Dependencies**: webgui (must be healthy first)

### Development Tools

#### code-server (VS Code Server)
- **Endpoint**: `http://localhost:8080/healthz`
- **Healthcheck**: `wget --no-verbose --tries=1 --spider http://localhost:8080/healthz`
- **Interval**: 30s
- **Timeout**: 10s
- **Retries**: 3
- **Start Period**: 30s
- **Port**: 8080

### Monitoring Services (Optional - Profile: monitoring)

#### prometheus
- **Endpoint**: `http://localhost:9090/-/healthy`
- **Healthcheck**: `wget --no-verbose --tries=1 --spider http://localhost:9090/-/healthy`
- **Interval**: 30s
- **Timeout**: 10s
- **Retries**: 3
- **Start Period**: 20s
- **Port**: 9090

#### grafana
- **Endpoint**: `http://localhost:3000/api/health`
- **Healthcheck**: `wget --no-verbose --tries=1 --spider http://localhost:3000/api/health`
- **Interval**: 30s
- **Timeout**: 10s
- **Retries**: 3
- **Start Period**: 30s
- **Port**: 3001 (mapped from container port 3000)

## Service Dependency Chain

```
postgres (healthy) ─┐
                    ├─→ webgui (healthy) ─┐
redis (healthy) ────┘                     ├─→ nginx (healthy)
                                          │
                                          └─→ free-llm-model-updater (healthy)
```

## Monitoring Health Status

### Check all service health
```bash
docker compose -f docker/docker-compose.yml ps
```

Output shows health status in the STATUS column:
- `healthy` - Service is responding correctly
- `unhealthy` - Service is not responding after retries
- `starting` - Service is in start_period, not yet checked

### Check specific service logs
```bash
docker compose -f docker/docker-compose.yml logs webgui
```

### Inspect health check details
```bash
docker inspect <container_id> | grep -A 10 Health
```

### Manual health endpoint testing
```bash
# Test webgui health
curl http://localhost:3000/api/healthz
curl http://localhost:3000/api/health  # Detailed health

# Test postgres health
docker exec vibecode-postgres pg_isready -U postgres -d vibecode

# Test redis health
docker exec vibecode-redis redis-cli ping
```

## Deployment Workflow

1. **Start services**: Dependencies start first due to `depends_on` conditions
   ```bash
   docker compose -f docker/docker-compose.yml up -d
   ```

2. **Monitor startup**: Watch services become healthy
   ```bash
   watch -n 2 'docker compose -f docker/docker-compose.yml ps'
   ```

3. **Verify health**: All services should show "healthy" status
   ```bash
   docker compose -f docker/docker-compose.yml ps | grep healthy
   ```

## Zero-Downtime Updates

Healthchecks enable zero-downtime deployments:

```bash
# Update with rolling restart
docker compose -f docker/docker-compose.yml up -d --no-deps --build webgui

# Service dependencies ensure proper order:
# 1. New webgui container starts
# 2. Healthcheck verifies it's ready
# 3. Old container stops only after new is healthy
# 4. Nginx continues routing to healthy container
```

## Troubleshooting

### Service stuck in "starting" state
- Check if start_period is too short
- Verify dependencies are healthy
- Check service logs for startup errors

### Service marked "unhealthy"
```bash
# Check health check logs
docker inspect <container_id> | jq '.[0].State.Health'

# Review service logs
docker compose logs <service_name> --tail 50

# Test health endpoint manually
curl -v http://localhost:<port>/api/healthz
```

### Dependency chain issues
- Ensure dependent services have `condition: service_healthy`
- Verify healthcheck is actually working for dependency
- Check network connectivity between containers

## Best Practices

1. **start_period**: Set longer than typical startup time to avoid false failures
2. **interval**: Balance between responsiveness and resource usage (30s is reasonable)
3. **retries**: Allow for transient failures (3 retries typical)
4. **timeout**: Match expected response time (10s for HTTP checks)
5. **endpoint selection**: Use lightweight endpoints (`/healthz`) for quick checks

## Configuration Files

- Main compose: `docker/docker-compose.yml`
- Production: `docker/docker-compose.production.yml`
- Health endpoints: `src/app/api/health/route.ts`, `src/app/api/healthz/route.ts`

## Related Documentation

- [Docker Compose Healthcheck Reference](https://docs.docker.com/compose/compose-file/compose-file-v3/#healthcheck)
- [Docker Container Health](https://docs.docker.com/engine/reference/builder/#healthcheck)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
