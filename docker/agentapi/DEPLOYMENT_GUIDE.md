# AgentAPI Deployment Guide

Quick reference for deploying AgentAPI in various environments.

## Prerequisites

- Docker 20.10+ or Kubernetes 1.24+
- Code-server container already deployed
- Persistent storage for workspaces
- (Optional) Datadog agent for monitoring

## Deployment Options

### 1. Docker Compose (Local Development)

**Fastest way to test AgentAPI integration**

```bash
# Navigate to project root
cd /path/to/vibecode-webgui

# Start services
docker-compose -f docker/docker-compose.agentapi.yml up -d

# Check status
docker-compose -f docker/docker-compose.agentapi.yml ps

# View logs
docker-compose -f docker/docker-compose.agentapi.yml logs -f agentapi

# Test API
curl http://localhost:3284/health
curl http://localhost:3284/v1/agents
```

**Access**:
- Code-server IDE: http://localhost:8765
- AgentAPI: http://localhost:3284

### 2. Kubernetes (Kind Local)

**Test in local Kubernetes cluster**

```bash
# Create kind cluster
kind create cluster --config k8s/kind-vibecode-local.yaml

# Create namespace
kubectl create namespace vibecode-platform

# Create secrets
kubectl create secret generic code-server-config \
  --from-literal=password=changeme \
  -n vibecode-platform

# Deploy
kubectl apply -f k8s/code-server-agentapi.yaml

# Check deployment
kubectl get pods -n vibecode-platform -w

# Port forward for testing
kubectl port-forward -n vibecode-platform \
  deployment/code-server-workspace 8765:8765 3284:3284

# Test
curl http://localhost:3284/health
```

### 3. Kubernetes (Production)

**Deploy to production cluster**

```bash
# Create namespace
kubectl create namespace vibecode-platform

# Create secrets (use real values)
kubectl create secret generic code-server-config \
  --from-literal=password=$(openssl rand -base64 32) \
  -n vibecode-platform

# Optional: Datadog API key
kubectl create secret generic datadog-secret \
  --from-literal=api-key=$DD_API_KEY \
  -n vibecode-platform

# Deploy with production settings
kubectl apply -f k8s/code-server-agentapi.yaml

# Verify deployment
kubectl get pods -n vibecode-platform
kubectl logs -f deployment/code-server-workspace -c agentapi -n vibecode-platform

# Check health
kubectl exec -n vibecode-platform deployment/code-server-workspace -c agentapi -- \
  curl -f http://127.0.0.1:3284/health
```

### 4. Helm Chart

**Using Helm for templated deployment**

```bash
# Add values for agentapi
cat >> helm/code-server-cloud/values.yaml <<EOF
agentapi:
  enabled: true
  image:
    repository: ghcr.io/ryanmaclean/vibecode-agentapi
    tag: latest
  resources:
    requests:
      cpu: 250m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 2Gi
EOF

# Install chart
helm install vibecode-workspace helm/code-server-cloud \
  --namespace vibecode-platform \
  --create-namespace \
  --set auth.password=changeme

# Upgrade existing installation
helm upgrade vibecode-workspace helm/code-server-cloud \
  --namespace vibecode-platform \
  --reuse-values \
  --set agentapi.enabled=true
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENTAPI_HOST` | `0.0.0.0` | Host to bind to |
| `AGENTAPI_PORT` | `3284` | Port to listen on |
| `AGENTAPI_TERMINAL_DIR` | `/tmp/terminals` | Terminal session directory |
| `AGENTAPI_MAX_CONCURRENT_AGENTS` | `5` | Max concurrent agents |
| `AGENTAPI_AGENT_TIMEOUT` | `300` | Agent timeout (seconds) |
| `AGENTAPI_LOG_LEVEL` | `info` | Log level (debug/info/warn/error) |
| `AGENTAPI_ALLOWED_ORIGINS` | `*` | CORS allowed origins |

### Docker Compose Override

Create `docker-compose.override.yml`:

```yaml
version: '3.9'

services:
  agentapi:
    environment:
      AGENTAPI_LOG_LEVEL: debug
      AGENTAPI_MAX_CONCURRENT_AGENTS: 10
    volumes:
      - ./custom-config.yaml:/home/coder/.agentapi/config.yaml:ro
```

### Kubernetes ConfigMap

```bash
kubectl create configmap agentapi-custom-config \
  --from-file=config.yaml=custom-config.yaml \
  -n vibecode-platform
```

## Verification Steps

### 1. Health Check

```bash
# Docker Compose
curl http://localhost:3284/health

# Kubernetes
kubectl exec -n vibecode-platform deployment/code-server-workspace -c agentapi -- \
  curl http://127.0.0.1:3284/health
```

Expected output:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "agents_active": 0,
  "agents_max": 5,
  "terminal_dir_accessible": true,
  "uptime_seconds": 42.5
}
```

### 2. Start Test Agent

```bash
curl -X POST http://localhost:3284/v1/agents/start \
  -H "Content-Type: application/json" \
  -d '{
    "agent_type": "aider",
    "workspace": "/home/coder/workspace",
    "task": "help"
  }'
```

Expected output:
```json
{
  "agent_id": "aider-abc123",
  "status": "running",
  "terminal_id": "term-xyz789",
  "pid": 12345,
  "command": "aider --model claude-3-5-sonnet --yes --message help"
}
```

### 3. Check Metrics

```bash
curl http://localhost:3284/metrics | grep agentapi
```

Expected output:
```
agentapi_agents_active 1
agentapi_agents_total 1
agentapi_agent_failures_total 0
agentapi_http_requests_total 5
```

## Monitoring

### Prometheus

Add scrape config:

```yaml
scrape_configs:
  - job_name: 'agentapi'
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names:
            - vibecode-platform
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        regex: code-server
        action: keep
      - source_labels: [__meta_kubernetes_pod_container_name]
        regex: agentapi
        action: keep
      - source_labels: [__meta_kubernetes_pod_ip]
        target_label: __address__
        replacement: ${1}:3284
```

### Grafana Dashboard

Import dashboard from `monitoring/grafana/agentapi-dashboard.json`

Key panels:
- Active agents gauge
- Agent start/failure rates
- HTTP request latency (P95, P99)
- Memory and CPU usage
- Terminal session count

### Datadog

Enable Datadog sidecar in Docker Compose:

```bash
docker-compose -f docker/docker-compose.agentapi.yml --profile monitoring up -d
```

Or in Kubernetes, add Datadog agent container to deployment.

## Troubleshooting

### Agent fails to start

**Symptom**: HTTP 500 when starting agent

**Solutions**:
1. Check agent is installed:
   ```bash
   docker exec vibecode-agentapi aider --version
   ```

2. Check workspace permissions:
   ```bash
   docker exec vibecode-agentapi ls -la /home/coder/workspace
   ```

3. View detailed logs:
   ```bash
   docker logs vibecode-agentapi --tail 100
   ```

### Health check fails

**Symptom**: Container shows unhealthy status

**Solutions**:
1. Run health check manually:
   ```bash
   docker exec vibecode-agentapi /home/coder/.agentapi/health-check.sh
   ```

2. Check if HTTP server is running:
   ```bash
   docker exec vibecode-agentapi ps aux | grep python3
   ```

3. Verify port is listening:
   ```bash
   docker exec vibecode-agentapi netstat -tlnp | grep 3284
   ```

### High resource usage

**Symptom**: Container consuming excessive CPU/memory

**Solutions**:
1. Check active agent count:
   ```bash
   curl http://localhost:3284/v1/agents
   ```

2. Stop agents if needed:
   ```bash
   curl -X POST http://localhost:3284/v1/agents/{agent_id}/stop
   ```

3. Lower concurrent agent limit:
   ```bash
   docker exec vibecode-agentapi env AGENTAPI_MAX_CONCURRENT_AGENTS=3
   ```

### Connection refused

**Symptom**: Cannot connect to AgentAPI from code-server

**Solutions**:
1. Check network connectivity:
   ```bash
   docker exec vibecode-codeserver curl http://127.0.0.1:3284/health
   ```

2. Verify shared network (Docker Compose):
   ```bash
   docker network inspect vibecode_vibecode-network
   ```

3. Check service is running (Kubernetes):
   ```bash
   kubectl get svc -n vibecode-platform
   ```

## Upgrading

### Docker Compose

```bash
# Pull latest image
docker-compose -f docker/docker-compose.agentapi.yml pull agentapi

# Restart service
docker-compose -f docker/docker-compose.agentapi.yml up -d agentapi
```

### Kubernetes

```bash
# Update image version
kubectl set image deployment/code-server-workspace \
  agentapi=ghcr.io/ryanmaclean/vibecode-agentapi:v0.2.0 \
  -n vibecode-platform

# Monitor rollout
kubectl rollout status deployment/code-server-workspace -n vibecode-platform

# Rollback if needed
kubectl rollout undo deployment/code-server-workspace -n vibecode-platform
```

## Security Considerations

### Production Checklist

- [ ] Change default password for code-server
- [ ] Enable authentication for AgentAPI endpoints
- [ ] Configure CORS allowed origins (not *)
- [ ] Use network policies to restrict access
- [ ] Enable TLS/HTTPS via Ingress
- [ ] Set resource limits on containers
- [ ] Run security scanning on images
- [ ] Enable audit logging
- [ ] Use secrets management (Vault, Sealed Secrets)
- [ ] Implement rate limiting on API endpoints

### Network Policy

Apply network policy to restrict access:

```bash
kubectl apply -f k8s/networkpolicy-agentapi.yaml
```

### API Authentication

Add basic auth to Ingress:

```bash
# Create htpasswd
htpasswd -c auth agentapi-user

# Create secret
kubectl create secret generic agentapi-basic-auth \
  --from-file=auth \
  -n vibecode-platform

# Update Ingress with annotation:
# nginx.ingress.kubernetes.io/auth-type: basic
# nginx.ingress.kubernetes.io/auth-secret: agentapi-basic-auth
```

## Performance Tuning

### Resource Optimization

Adjust based on workload:

```yaml
# Light workload (1-2 concurrent agents)
resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 1Gi

# Medium workload (3-5 concurrent agents)
resources:
  requests:
    cpu: 250m
    memory: 512Mi
  limits:
    cpu: 1000m
    memory: 2Gi

# Heavy workload (5-10 concurrent agents)
resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: 2000m
    memory: 4Gi
```

### Scaling

Enable HorizontalPodAutoscaler:

```bash
kubectl autoscale deployment code-server-workspace \
  --cpu-percent=80 \
  --min=1 \
  --max=10 \
  -n vibecode-platform
```

## Support

- Documentation: `/Users/ryan.maclean/vibecode-webgui/claudedocs/AGENTAPI_DEPLOYMENT_ARCHITECTURE.md`
- API Reference: `/Users/ryan.maclean/vibecode-webgui/docker/agentapi/README.md`
- Issues: GitHub repository issues
- Metrics: http://localhost:3284/metrics
- Health: http://localhost:3284/health
