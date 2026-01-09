# Agent AE: Quick Reference Guide

**Agent**: AE - API Gateway and Service Mesh Specialist
**Purpose**: Quick reference for API Gateway and Service Mesh configuration
**Last Updated**: January 5, 2026

---

## Files at a Glance

### Configuration Files

| File | Lines | Purpose |
|------|-------|---------|
| `traefik/config/traefik.yaml` | 180 | Traefik main configuration |
| `traefik/config/dynamic/routers.yaml` | 190 | Route definitions (4 services) |
| `traefik/config/dynamic/middlewares.yaml` | 520 | Middleware stack (18 middlewares) |
| `istio/config/mtls-policy.yaml` | 180 | mTLS and RBAC policies |
| `istio/config/traffic-management.yaml` | 380 | Service routing and policies |
| `istio/config/rate-limiting.yaml` | 150 | Rate limiting policies |

### Documentation Files

| File | Words | Purpose |
|------|-------|---------|
| `AGENT-AE-API-GATEWAY-DESIGN.md` | 6,500 | Architecture & design |
| `AGENT-AE-QUICK-START.md` | 3,500 | Deployment guide |
| `AGENT-AE-SECURITY-GUIDE.md` | 4,500 | Security best practices |
| `AGENT-AE-DELIVERY-SUMMARY.md` | 2,000 | Completion summary |
| `api-documentation.yaml` | 420 lines | OpenAPI 3.0.3 spec |

### Scripts

| File | Lines | Purpose |
|------|-------|---------|
| `azure/api-gateway-setup.sh` | 600+ | Automated deployment |

---

## Quick Commands

### Setup & Deployment

```bash
# Docker Compose (development)
./azure/api-gateway-setup.sh

# Kubernetes (production)
./azure/api-gateway-setup.sh --kubernetes --production

# With monitoring
./azure/api-gateway-setup.sh --monitoring

# Dry run (show what would happen)
./azure/api-gateway-setup.sh --dry-run
```

### Docker Operations

```bash
# View services
docker-compose ps
docker ps | grep traefik

# View logs
docker-compose logs -f traefik
docker logs traefik-api-gateway

# Restart services
docker-compose restart traefik
docker restart traefik-api-gateway

# Stop services
docker-compose down

# Cleanup (WARNING: deletes data)
docker-compose down -v
```

### Kubernetes Operations

```bash
# View resources
kubectl get pods -A
kubectl get svc -A
kubectl get ingress -A

# View logs
kubectl logs -n traefik deployment/traefik
kubectl logs -n default deployment/openvscode-server

# Port forward
kubectl port-forward svc/traefik 8000:8000 -n traefik
kubectl port-forward svc/api-gateway 443:443

# Check mTLS
kubectl get peerAuthentication -A
kubectl get destinationrules -A
```

---

## Access Points

### Development

| Service | URL | Credentials |
|---------|-----|-------------|
| Traefik Dashboard | http://localhost:8000 | admin:password |
| API Gateway | https://dashboard.api.local:8000 | admin:password |
| OpenVSCode | https://vscode.api.local | (first login) |
| API Docs | https://docs.api.local/api/docs | Public |
| Prometheus | http://localhost:9090 | Public |
| Grafana | http://localhost:3000 | admin:admin |
| Jaeger | http://localhost:6831 | Public |
| Kiali | http://localhost:20001 | Public |

---

## Key Configuration Areas

### Rate Limiting

Located in: `traefik/config/dynamic/middlewares.yaml`

```yaml
# Standard tier: 100 req/sec
rate-limit-standard:
  rateLimit:
    average: 100
    burst: 200
    period: "1m"

# Premium tier: 1000 req/sec
rate-limit-premium:
  rateLimit:
    average: 1000
    burst: 2000
```

### Routes

Located in: `traefik/config/dynamic/routers.yaml`

```yaml
routers:
  openvscode:
    rule: "Host(`vscode.api.local`)"
    service: openvscode
    middlewares:
      - security-headers
      - rate-limit-standard
      - auth-jwt
```

### mTLS

Located in: `istio/config/mtls-policy.yaml`

```yaml
spec:
  mtls:
    mode: STRICT  # Enforce mTLS
```

### Traffic Management

Located in: `istio/config/traffic-management.yaml`

```yaml
# Canary deployment: 90% to v1, 10% to v2
virtualService:
  http:
    - route:
        - destination:
            subset: v1
          weight: 90
        - destination:
            subset: v2
          weight: 10
```

---

## Middleware Stack

Total: 18 middleware definitions

### Security (3)
- `security-headers` - HSTS, CSP, X-Frame-Options, etc.
- `auth-jwt` - JWT token validation
- `auth-oauth` - OAuth forwarding
- `ip-whitelist` - IP filtering
- `waf-modsecurity` - Web Application Firewall

### Rate Limiting (4)
- `rate-limit-standard` - Standard tier (100 req/sec)
- `rate-limit-premium` - Premium tier (1000 req/sec)
- `rate-limit-unlimited` - No limits (internal)
- `rate-limit-strict` - Strict limits (10 req/sec)

### Transformation (3)
- `request-headers` - Add request headers
- `response-headers` - Add response headers
- `strip-prefix` - Remove path prefix
- `rewrite-paths` - Rewrite paths

### Features (8)
- `compress` - Gzip compression
- `cors` - CORS headers
- `request-logger` - Access logging
- `circuit-breaker` - Circuit breaker
- `retry-policy` - Retry on failure
- `cache-responses` - Response caching
- `websocket-upgrade` - WebSocket support
- `error-handler` - Error handling

---

## Service Routing Summary

### OpenVSCode Editor
- **Route**: `Host('vscode.api.local') || Path('/editor')`
- **Port**: 8080
- **Protocol**: HTTP → HTTPS
- **Health Check**: `/health`
- **Load Balancing**: Least connections
- **Session Affinity**: Enabled

### PostgreSQL Database
- **Route**: `Path('/api/v1/database/*')`
- **Port**: 5432
- **Protocol**: TCP/TLS
- **Health Check**: TCP ping
- **Load Balancing**: Round-robin
- **Circuit Breaker**: 3 consecutive 5xx errors

### Valkey Cache
- **Route**: `Path('/api/v1/cache/*')`
- **Port**: 6379
- **Protocol**: TCP/TLS
- **Health Check**: PING command
- **Load Balancing**: IP hash (affinity)
- **Circuit Breaker**: 5 consecutive 5xx errors

### SSH Terminal
- **Route**: `Path('/api/v1/terminal/*')`
- **Port**: 22
- **Protocol**: SSH over WebSocket
- **Health Check**: TCP ping
- **Load Balancing**: Least connections
- **Max Connections**: 100

---

## Rate Limiting Tiers

### Tier 1: Global
- **Limit**: 1000 req/sec (sliding window)
- **Burst**: 5000 req/sec
- **Duration**: 1 minute
- **Applies To**: All clients

### Tier 2: Standard User
- **Limit**: 100 req/sec
- **Daily Quota**: 100,000 requests
- **Burst**: 200 req/sec (10 seconds)
- **Cost**: Free

### Tier 3: Premium User
- **Limit**: 1000 req/sec
- **Daily Quota**: 1,000,000 requests
- **Burst**: 2000 req/sec
- **Cost**: Paid

### Tier 4: Enterprise
- **Limit**: 10,000 req/sec
- **Daily Quota**: Unlimited
- **Burst**: 50,000 req/sec
- **Cost**: Custom

---

## Security Features

### Authentication
- JWT (HS256, RS256)
- OAuth 2.0 / OIDC
- Basic authentication (admin)
- Service-to-service (mTLS)

### Encryption
- TLS 1.2+ (edge)
- TLS 1.3 (modern profile)
- mTLS (service-to-service)
- AES-256 (at rest)

### WAF Rules
1. SQL Injection
2. XSS Attacks
3. Command Injection
4. Path Traversal
5. Custom rules (OWASP CRS)

### DDoS Protection
- Rate limiting (sliding window)
- Connection limits
- Geo-blocking
- IP reputation filtering

---

## Environment Variables

### Critical (Must Change)

```bash
JWT_SECRET=<generate with: openssl rand -base64 32>
OAUTH_CLIENT_SECRET=<from OAuth provider>
POSTGRES_PASSWORD=<strong-password>
TRAEFIK_DASHBOARD_PASSWORD=<hashed with: openssl passwd>
GRAFANA_ADMIN_PASSWORD=<strong-password>
```

### Optional

```bash
TRAEFIK_VERSION=v2.10
ISTIO_VERSION=1.18.0
ENVIRONMENT=production
LOG_LEVEL=INFO
```

---

## Troubleshooting Checklist

### Services Won't Start
```bash
docker logs traefik-api-gateway
docker stats
docker ps -a
```

### High Latency
```bash
curl -w "@/dev/stdout" -o /dev/null http://localhost:8080/health
docker exec traefik-api-gateway curl -v http://openvscode-server:8080/health
```

### Rate Limiting Not Working
```bash
ab -n 200 -c 10 http://localhost:8080/health
curl http://localhost:9090/api/v1/query?query='rate_limit_exceeded'
```

### Certificate Issues
```bash
curl -k https://dashboard.api.local:8000  # Ignore cert errors
openssl s_client -connect dashboard.api.local:443
```

---

## Performance Optimization

### Increase Rate Limits
```yaml
# Edit: traefik/config/dynamic/middlewares.yaml
rate-limit-standard:
  average: 200      # from 100
  burst: 400        # from 200
```

### Increase Connection Pool
```yaml
# Edit: istio/config/traffic-management.yaml
connectionPool:
  tcp:
    maxConnections: 200      # from 100
  http:
    http1MaxPendingRequests: 100  # from 50
```

### Enable Caching
```yaml
# Traefik automatically caches GET requests
# Configure in: traefik/config/dynamic/middlewares.yaml
cache-responses:
  cacheTtl: "3600"  # Cache for 1 hour
```

---

## Monitoring Commands

### Prometheus Queries

```bash
# Error rate
rate(http_requests_total{status=~"5.."}[5m])

# P99 latency
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Top endpoints
topk(10, sum(rate(http_requests_total[5m])) by (path))

# Rate limit exceeded count
increase(rate_limit_exceeded_total[5m])
```

### Log Analysis

```bash
# View recent Traefik logs
docker logs -f traefik-api-gateway | jq '.'

# Count requests by status
docker logs traefik-api-gateway | jq '.status' | sort | uniq -c

# Find slow requests (>1s)
docker logs traefik-api-gateway | jq 'select(.response_time_ms > 1000)'
```

---

## Common Tasks

### Add New Route

Edit `traefik/config/dynamic/routers.yaml`:
```yaml
my-service:
  rule: "Host(`my-service.api.local`)"
  service: my-service
  middlewares:
    - security-headers
    - rate-limit-standard
```

### Change Rate Limit

Edit `traefik/config/dynamic/middlewares.yaml`:
```yaml
rate-limit-standard:
  average: 200      # Change this
  burst: 400        # And this
```

### Enable WAF Rule

Edit `traefik/config/dynamic/middlewares.yaml`:
```yaml
# Uncomment rule or add new
SecRule ARGS "@rx pattern" "id:1006,deny"
```

### Check mTLS Status

```bash
kubectl get peerAuthentication -A
kubectl get destinationrules -A
istioctl analyze
```

---

## Support & Resources

### Documentation
- Full Architecture: `AGENT-AE-API-GATEWAY-DESIGN.md`
- Getting Started: `AGENT-AE-QUICK-START.md`
- Security: `AGENT-AE-SECURITY-GUIDE.md`
- API Spec: `api-documentation.yaml`

### Official Docs
- Traefik: https://doc.traefik.io/
- Istio: https://istio.io/latest/docs/
- Kubernetes: https://kubernetes.io/docs/

### Communities
- Traefik Community: https://community.traefik.io/
- Istio Community: https://istio.io/latest/get-involved/
- CNCF Slack: https://cloud-native.slack.com

---

**Quick Reference - Always at Your Fingertips**

Print this guide or bookmark for quick access to configuration details.
