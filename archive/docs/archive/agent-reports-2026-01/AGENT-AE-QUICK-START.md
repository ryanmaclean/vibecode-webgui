# Agent AE: API Gateway & Service Mesh - Quick Start Guide

**Document**: Quick Start Guide
**Agent**: AE - API Gateway and Service Mesh Specialist
**Version**: 1.0
**Date**: January 5, 2026

---

## Overview

This guide provides step-by-step instructions to deploy the VibeCode API Gateway and Service Mesh infrastructure. The setup supports both Docker Compose (development) and Kubernetes (production) deployments.

---

## Prerequisites

### System Requirements
- Docker 20.10+ and Docker Compose 2.0+
- At least 4 CPU cores and 8GB RAM
- Linux/macOS (Windows with WSL2)
- 20GB free disk space

### For Kubernetes Deployment
- Kubernetes 1.21+
- kubectl configured
- Helm 3.0+
- At least 8 CPU cores and 16GB RAM

### Required Tools
```bash
# Check Docker installation
docker --version
docker-compose --version

# For Kubernetes
kubectl version --client
helm version
```

---

## Quick Start (5 minutes)

### 1. Clone and Navigate

```bash
cd /path/to/vibecode-webgui
ls -la traefik/ istio/ azure/
```

### 2. Run Setup Script

#### Development (Docker Compose)
```bash
./azure/api-gateway-setup.sh
```

#### Production (Kubernetes)
```bash
./azure/api-gateway-setup.sh --kubernetes --production
```

#### With Monitoring Stack
```bash
./azure/api-gateway-setup.sh --monitoring
```

### 3. Verify Deployment

```bash
# Check services are running
docker ps | grep traefik
docker ps | grep openvscode
docker ps | grep postgres

# Or for Kubernetes
kubectl get pods -A
kubectl get svc -A
```

### 4. Access Services

| Service | URL | Default Credentials |
|---------|-----|-------------------|
| API Dashboard | https://dashboard.api.local:8000 | admin:password |
| Traefik API | http://localhost:8000 | admin:password |
| OpenVSCode | https://vscode.api.local | (configured on first login) |
| API Docs | https://docs.api.local | Public |
| Prometheus | http://localhost:9090 | Public |
| Grafana | http://localhost:3000 | admin:admin |

---

## Detailed Setup Guide

### Docker Compose Deployment

#### Step 1: Configure Hosts File

```bash
# Add to /etc/hosts (requires sudo)
sudo tee -a /etc/hosts << EOF
127.0.0.1 api.vibecode.local
127.0.0.1 vscode.api.local
127.0.0.1 docs.api.local
127.0.0.1 dashboard.api.local
127.0.0.1 terminal.api.local
127.0.0.1 pgadmin.api.local
EOF
```

#### Step 2: Create Environment File

```bash
cat > .env.api-gateway << 'EOF'
# Traefik Configuration
TRAEFIK_VERSION=v2.10
TRAEFIK_DASHBOARD_USER=admin
TRAEFIK_DASHBOARD_PASSWORD=securepassword123

# TLS/SSL
TLS_EMAIL=admin@vibecode.local
TLS_CERT_RESOLVER=letsencrypt

# Services
OPENVSCODE_PORT=8080
POSTGRESQL_PORT=5432
VALKEY_PORT=6379
SSH_PORT=22

# Rate Limiting
RATE_LIMIT_STANDARD=100
RATE_LIMIT_PREMIUM=1000
RATE_LIMIT_ENTERPRISE=10000

# JWT Secret
JWT_SECRET=$(openssl rand -base64 32)
OAUTH_CLIENT_ID=vibecode-client
OAUTH_CLIENT_SECRET=$(openssl rand -base64 32)

# Monitoring
PROMETHEUS_RETENTION=15d
GRAFANA_ADMIN_PASSWORD=securepassword456

# Environment
ENVIRONMENT=development
LOG_LEVEL=INFO
EOF

# Protect environment file
chmod 600 .env.api-gateway
```

#### Step 3: Start Services

```bash
# Start Traefik and basic services
docker-compose -f traefik/docker-compose.yaml up -d

# Start application services
docker-compose -f docker-compose.api-gateway.yaml up -d

# Verify all services
docker ps
docker-compose ps
```

#### Step 4: Validate Endpoints

```bash
# Health check
curl -k https://dashboard.api.local:8000/health

# Check service connectivity
docker exec traefik-api-gateway \
  curl -s http://openvscode-server:8080/health

# View logs
docker logs traefik-api-gateway
docker logs prometheus
docker logs grafana
```

---

### Kubernetes Deployment

#### Step 1: Create Namespaces

```bash
kubectl create namespace traefik
kubectl create namespace default
kubectl create namespace istio-system
kubectl create namespace monitoring

# Label namespace for sidecar injection
kubectl label namespace default istio-injection=enabled
```

#### Step 2: Install Traefik with Helm

```bash
# Add Helm repository
helm repo add traefik https://helm.traefik.io
helm repo update

# Create values file
cat > /tmp/traefik-values.yaml << 'EOF'
image:
  repository: traefik
  tag: v2.10

ingressRoute:
  dashboard:
    enabled: true
    entryPoints:
      - websecure

metrics:
  prometheus:
    addEntryPointsLabels: true
    addServicesLabels: true

pilot:
  enabled: false

ports:
  web:
    port: 80
  websecure:
    port: 443
    tls:
      enabled: true

providers:
  kubernetesIngress:
    enabled: true
  kubernetesIngressClass:
    enabled: true
  kubeconfig: {}
EOF

# Install Traefik
helm install traefik traefik/traefik \
  --namespace traefik \
  --values /tmp/traefik-values.yaml
```

#### Step 3: Install Istio

```bash
# Download Istio
curl -L https://istio.io/downloadIstio | ISTIO_VERSION=1.18.0 sh -
cd istio-1.18.0

# Install Istio
./bin/istioctl install --set profile=production -y

# Verify installation
kubectl get pods -n istio-system
```

#### Step 4: Deploy Services

```bash
# Apply service mesh policies
kubectl apply -f istio/config/mtls-policy.yaml
kubectl apply -f istio/config/traffic-management.yaml
kubectl apply -f istio/config/rate-limiting.yaml

# Deploy application services
kubectl apply -f kubernetes/deployments/

# Verify deployments
kubectl get deployments
kubectl get pods
```

#### Step 5: Configure DNS/Ingress

```bash
# Get Traefik service IP/LoadBalancer
kubectl get svc -n traefik

# Create IngressRoute for API Gateway
cat > api-ingressroute.yaml << 'EOF'
apiVersion: traefik.containo.us/v1alpha1
kind: IngressRoute
metadata:
  name: api-gateway
  namespace: default
spec:
  entryPoints:
    - websecure
  routes:
    - kind: Rule
      match: "Host(`api.vibecode.local`)"
      services:
        - name: api-gateway
          port: 8000
  tls:
    certResolver: letsencrypt
EOF

kubectl apply -f api-ingressroute.yaml
```

---

## Configuration

### Adding Routes

Edit `traefik/config/dynamic/routers.yaml`:

```yaml
http:
  routers:
    my-service:
      rule: "Host(`my-service.api.local`)"
      service: my-service
      entryPoints:
        - websecure
      middlewares:
        - security-headers
        - rate-limit-standard
        - auth-jwt
```

### Rate Limiting Configuration

Edit `traefik/config/dynamic/middlewares.yaml`:

```yaml
http:
  middlewares:
    rate-limit-custom:
      rateLimit:
        average: 50        # Requests per second
        burst: 100         # Burst capacity
        period: "1m"       # Time window
```

### Middleware Stack

View and modify `traefik/config/dynamic/middlewares.yaml`:
- Security headers
- Authentication (JWT/OAuth)
- CORS
- Compression
- Logging

---

## API Usage

### Authentication

#### Obtain JWT Token

```bash
# Login to get JWT
curl -X POST https://auth.vibecode.local/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user@vibecode.local",
    "password": "password"
  }'

# Response:
# {
#   "token": "eyJhbGciOiJIUzI1NiIs...",
#   "expires_in": 3600
# }
```

#### Use Token in API Calls

```bash
TOKEN="your_jwt_token_here"

# Make authenticated request
curl -H "Authorization: Bearer $TOKEN" \
  https://api.vibecode.local/api/v1/editor/workspace
```

### Example API Calls

#### List Workspaces

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://api.vibecode.local/api/v1/editor/workspace
```

#### Execute Database Query

```bash
curl -X POST https://api.vibecode.local/api/v1/database/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "SELECT * FROM users LIMIT 10",
    "timeout": 5000
  }'
```

#### Cache Operations

```bash
# Set cache value
curl -X POST https://api.vibecode.local/api/v1/cache/set \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "my_key",
    "value": "my_value",
    "ttl": 3600
  }'

# Get cache value
curl https://api.vibecode.local/api/v1/cache/get?key=my_key \
  -H "Authorization: Bearer $TOKEN"
```

#### Open Terminal

```bash
# Create session
curl -X POST https://api.vibecode.local/api/v1/terminal/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "host": "ssh.vibecode.local",
    "username": "user"
  }'

# Response includes websocket_url for real-time terminal
```

---

## Monitoring

### Access Monitoring Stack

```bash
# Prometheus (metrics)
open http://localhost:9090

# Grafana (dashboards)
open http://localhost:3000

# Jaeger (tracing)
open http://localhost:6831

# Kiali (service mesh visualization)
open http://localhost:20001
```

### Key Dashboards

1. **API Gateway Dashboard**: Request rates, latency, errors
2. **Service Health**: Individual service status and metrics
3. **Rate Limiting**: Rate limit exceeded counts per tier
4. **Service Mesh**: mTLS adoption, traffic flows, circuit breaker status
5. **Infrastructure**: CPU, memory, disk usage

### Useful Queries

```bash
# Top 10 endpoints by request count
curl -s http://localhost:9090/api/v1/query?query='topk(10, sum(rate(http_requests_total[5m])) by (path))'

# Error rate percentage
curl -s http://localhost:9090/api/v1/query?query='sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))'

# P99 latency
curl -s http://localhost:9090/api/v1/query?query='histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))'
```

---

## Troubleshooting

### Services Won't Start

```bash
# Check Docker resources
docker stats

# View container logs
docker logs traefik-api-gateway
docker logs openvscode-server
docker logs postgresql

# Restart services
docker-compose down
docker-compose up -d
```

### Certificate Errors

```bash
# For self-signed certificates
# Add to curl: -k (insecure)
curl -k https://dashboard.api.local:8000

# Or import certificate:
# Mac: open -a Keychain\ Access /path/to/cert
# Linux: sudo cp cert /usr/local/share/ca-certificates/
```

### High Latency

```bash
# Check Traefik metrics
curl http://localhost:8000/metrics | grep latency

# Check individual service response times
docker exec traefik-api-gateway \
  curl -w "@-" -o /dev/null -s http://openvscode-server:8080/health

# Review service logs
docker logs --tail 100 openvscode-server
```

### Rate Limiting Not Working

```bash
# Verify middleware is active
curl -v https://api.vibecode.local/api/v1/editor/workspace 2>&1 | grep X-RateLimit

# Test rate limiting with Apache Bench
ab -n 200 -c 10 https://api.vibecode.local/health

# Check rate limit metrics
curl http://localhost:9090/api/v1/query?query='rate_limit_exceeded'
```

---

## Common Commands

### Docker Compose

```bash
# View all services
docker-compose ps

# View logs
docker-compose logs -f traefik
docker-compose logs -f openvscode-server

# Restart specific service
docker-compose restart traefik

# Stop all services
docker-compose down

# Remove volumes (WARNING: deletes data)
docker-compose down -v
```

### Kubernetes

```bash
# View all resources
kubectl get all -A

# View pod logs
kubectl logs pod/openvscode-server-xyz

# Port forward for local access
kubectl port-forward svc/traefik 8000:8000 -n traefik

# Exec into container
kubectl exec -it deployment/openvscode-server -- /bin/sh

# Check resource usage
kubectl top nodes
kubectl top pods
```

---

## Security Considerations

### Default Passwords

**CHANGE THESE IMMEDIATELY:**

```bash
# Traefik Dashboard
# Default: admin:password

# PostgreSQL
# Default: postgres:postgres

# Valkey
# Default: no password

# Grafana
# Default: admin:admin
```

### JWT Secret

```bash
# Generate strong JWT secret
openssl rand -base64 32

# Update in .env.api-gateway
JWT_SECRET=your_generated_secret
```

### Enable HTTPS

Certificates are auto-generated for development. For production:

```bash
# Use Let's Encrypt
# Update TRAEFIK_TLS_EMAIL in .env.api-gateway

# Or provide your own certificates
cp /path/to/cert.crt traefik/certs/
cp /path/to/key.key traefik/certs/
```

---

## Performance Tuning

### Increase Rate Limits

Edit `traefik/config/dynamic/middlewares.yaml`:

```yaml
rate-limit-standard:
  rateLimit:
    average: 200      # Increase from 100
    burst: 400        # Increase from 200
    period: "1m"
```

### Connection Pooling

Edit `istio/config/traffic-management.yaml`:

```yaml
trafficPolicy:
  connectionPool:
    tcp:
      maxConnections: 200    # Increase from 100
    http:
      http1MaxPendingRequests: 100  # Increase from 50
```

### Memory Limits

```bash
# Docker
docker run -m 2g traefik:v2.10

# Kubernetes - Update deployment resources
kubectl set resources deployment traefik \
  --limits=memory=2Gi,cpu=2000m \
  --requests=memory=1Gi,cpu=1000m
```

---

## Next Steps

1. **Deploy to Production**
   - Follow `AGENT-AE-SECURITY-GUIDE.md`
   - Enable HTTPS with real certificates
   - Configure OAuth provider

2. **Enable Advanced Features**
   - Set up WAF rules
   - Configure DDoS protection
   - Enable tracing and profiling

3. **Integrate Monitoring**
   - Create custom dashboards
   - Configure alerting
   - Set up log aggregation

4. **API Development**
   - Use OpenAPI spec from `api-documentation.yaml`
   - Implement client SDKs
   - Write integration tests

---

## Support & Resources

- **API Documentation**: `/api/docs` (Swagger UI)
- **OpenAPI Spec**: `api-documentation.yaml`
- **Architecture Guide**: `AGENT-AE-API-GATEWAY-DESIGN.md`
- **Security Guide**: `AGENT-AE-SECURITY-GUIDE.md`
- **Traefik Docs**: https://doc.traefik.io/
- **Istio Docs**: https://istio.io/latest/docs/

---

**Quick Start Guide - Complete**

For detailed information, refer to the full documentation.
