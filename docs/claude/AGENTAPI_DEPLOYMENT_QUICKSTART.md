# AgentAPI Deployment Quick Start Guide

**For**: DevOps Engineers, Release Managers
**Last Updated**: 2025-10-02

---

## Prerequisites Checklist

Before deploying, ensure:

- [ ] Kubernetes cluster access configured (`kubectl get nodes`)
- [ ] GitHub Container Registry access (`docker login ghcr.io`)
- [ ] Required secrets created (see Secret Management section)
- [ ] Helm 3.x installed (optional, for Helm deployments)
- [ ] Docker installed and running
- [ ] `jq` installed for JSON processing

---

## Quick Start: Deploy to Dev

```bash
# 1. Clone repository
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui

# 2. Set up environment
export ENVIRONMENT=dev
export IMAGE_TAG=latest

# 3. Create secrets (first time only)
./scripts/manage-secrets.sh create dev

# 4. Deploy AgentAPI
./scripts/deploy-agentapi.sh dev $IMAGE_TAG

# 5. Verify deployment
kubectl get pods -n vibecode-dev -l app=code-server
kubectl logs -n vibecode-dev -l app=code-server -c agentapi --tail=50
```

**Expected Output**:
```
✓ Prerequisites check passed
✓ Image verified: ghcr.io/ryanmaclean/vibecode-agentapi:latest
✓ Green deployment created
✓ Smoke tests passed
✓ Traffic switched to green
✓ Error rate monitoring passed
✓ Deployment completed successfully!
```

---

## Common Operations

### Deploy to Specific Environment

```bash
# Development
./scripts/deploy-agentapi.sh dev v1.2.3

# Staging
./scripts/deploy-agentapi.sh staging v1.2.3

# Production (requires approval)
./scripts/deploy-agentapi.sh prod v1.2.3
```

### Manual Rollback

```bash
# Rollback to previous version
./scripts/rollback-agentapi.sh staging

# Rollback to specific revision
./scripts/rollback-agentapi.sh staging 3

# View rollout history
kubectl rollout history deployment/code-server-workspace -n vibecode-staging
```

### Secret Management

```bash
# Create all secrets for environment
./scripts/manage-secrets.sh create dev

# Rotate API keys
./scripts/manage-secrets.sh rotate staging

# View secrets (names only)
./scripts/manage-secrets.sh view prod

# Backup secrets (encrypted)
./scripts/manage-secrets.sh backup prod

# Validate required secrets exist
./scripts/manage-secrets.sh validate dev
```

### Run Tests Locally

```bash
# All tests
./scripts/run-agentapi-tests.sh all

# Specific test suite
./scripts/run-agentapi-tests.sh unit
./scripts/run-agentapi-tests.sh integration
./scripts/run-agentapi-tests.sh e2e
```

---

## GitHub Actions Deployment

### Automatic Deployment

Deployments trigger automatically on:
- **Push to `develop`** → Deploys to `dev`
- **Push to `main`** → Deploys to `staging` → `production` (with approval)

### Manual Deployment

```bash
# Using GitHub CLI
gh workflow run agentapi-cicd.yml \
  -f deploy_env=staging

# Or via GitHub UI:
# Actions → AgentAPI CI/CD Pipeline → Run workflow
```

---

## Monitoring & Verification

### Check Deployment Status

```bash
# Get pod status
kubectl get pods -n vibecode-dev -l app=code-server

# Check deployment rollout status
kubectl rollout status deployment/code-server-workspace -n vibecode-dev

# View recent logs
kubectl logs -n vibecode-dev -l app=code-server -c agentapi --tail=100

# Check service endpoints
kubectl get svc -n vibecode-dev
```

### Health Checks

```bash
# Port-forward to test locally
kubectl port-forward -n vibecode-dev svc/code-server-agentapi 3284:3284

# Test health endpoint
curl http://localhost:3284/health

# Test metrics endpoint
curl http://localhost:3284/metrics

# Test agents list
curl http://localhost:3284/v1/agents
```

### View Deployment Metrics

```bash
# Resource usage
kubectl top pods -n vibecode-dev -l app=code-server

# Deployment events
kubectl get events -n vibecode-dev --sort-by='.lastTimestamp'

# Describe deployment
kubectl describe deployment code-server-workspace -n vibecode-dev
```

---

## Troubleshooting

### Deployment Fails

```bash
# Check pod status
kubectl get pods -n vibecode-dev -l app=code-server

# View pod logs
POD=$(kubectl get pod -n vibecode-dev -l app=code-server -o jsonpath='{.items[0].metadata.name}')
kubectl logs -n vibecode-dev $POD -c agentapi

# Describe pod for events
kubectl describe pod -n vibecode-dev $POD

# Check deployment status
kubectl describe deployment code-server-workspace -n vibecode-dev
```

### Health Check Fails

```bash
# Exec into container
kubectl exec -it -n vibecode-dev $POD -c agentapi -- /bin/bash

# Test health endpoint from inside pod
curl http://127.0.0.1:3284/health

# Check config file
cat /etc/agentapi/config.yaml

# Check health check script
/etc/agentapi/health-check.sh
```

### Image Pull Errors

```bash
# Verify image exists
docker manifest inspect ghcr.io/ryanmaclean/vibecode-agentapi:latest

# Check image pull secret
kubectl get secret -n vibecode-dev

# Verify registry authentication
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=$GITHUB_USER \
  --docker-password=$GITHUB_TOKEN \
  --namespace=vibecode-dev
```

### High Error Rate

```bash
# Check recent errors
kubectl logs -n vibecode-dev -l app=code-server -c agentapi --tail=100 | grep ERROR

# Monitor error rate in real-time
kubectl logs -n vibecode-dev -l app=code-server -c agentapi -f | grep ERROR

# Check agent status
kubectl exec -n vibecode-dev $POD -c agentapi -- curl http://127.0.0.1:3284/v1/agents
```

---

## Emergency Procedures

### Emergency Rollback

```bash
# Immediate rollback
kubectl rollout undo deployment/code-server-workspace -n vibecode-prod

# Wait for rollback to complete
kubectl rollout status deployment/code-server-workspace -n vibecode-prod

# Verify health
kubectl get pods -n vibecode-prod -l app=code-server
```

### Emergency Hotfix

```bash
# 1. Build hotfix image
docker build -t ghcr.io/ryanmaclean/vibecode-agentapi:hotfix-<issue> .
docker push ghcr.io/ryanmaclean/vibecode-agentapi:hotfix-<issue>

# 2. Deploy hotfix (skip tests - USE CAUTIOUSLY)
gh workflow run agentapi-cicd.yml \
  -f deploy_env=prod \
  -f skip_tests=true

# 3. Monitor deployment
kubectl rollout status deployment/code-server-workspace -n vibecode-prod
```

### Scale Down (Maintenance)

```bash
# Scale to 0 replicas
kubectl scale deployment code-server-workspace -n vibecode-prod --replicas=0

# Maintenance operations...

# Scale back up
kubectl scale deployment code-server-workspace -n vibecode-prod --replicas=3
```

---

## Configuration Reference

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `AGENTAPI_HOST` | Listen address | `127.0.0.1` | Yes |
| `AGENTAPI_PORT` | Listen port | `3284` | Yes |
| `AGENTAPI_LOG_LEVEL` | Log level | `info` | No |
| `AGENTAPI_MAX_CONCURRENT_AGENTS` | Max agents | `10` | No |
| `AGENTAPI_AGENT_TIMEOUT` | Agent timeout (seconds) | `300` | No |

### Resource Limits

```yaml
# AgentAPI Container
resources:
  requests:
    cpu: 250m
    memory: 512Mi
  limits:
    cpu: 1000m
    memory: 2Gi

# Code-Server Container
resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: 2000m
    memory: 4Gi
```

---

## Security Best Practices

1. **Secrets Management**
   - Never commit secrets to Git
   - Use Kubernetes secrets for sensitive data
   - Rotate secrets quarterly
   - Use RBAC for secret access

2. **Container Security**
   - Run as non-root user (UID 1000)
   - Drop all capabilities
   - Use read-only root filesystem where possible
   - Scan images for vulnerabilities

3. **Network Security**
   - Use NetworkPolicies to restrict traffic
   - Enable TLS for all external communication
   - Restrict ingress to necessary ports only

4. **Access Control**
   - Use RBAC for cluster access
   - Implement least privilege principle
   - Audit access logs regularly

---

## Performance Tuning

### Optimize for High Load

```bash
# Increase replica count
kubectl scale deployment code-server-workspace -n vibecode-prod --replicas=10

# Increase resource limits
kubectl set resources deployment code-server-workspace -n vibecode-prod \
  --limits=cpu=2000m,memory=4Gi \
  --requests=cpu=500m,memory=1Gi \
  -c agentapi

# Adjust max concurrent agents
kubectl set env deployment/code-server-workspace -n vibecode-prod \
  AGENTAPI_MAX_CONCURRENT_AGENTS=20 -c agentapi
```

### Monitor Performance

```bash
# CPU/Memory usage
kubectl top pods -n vibecode-prod -l app=code-server

# Metrics from Prometheus endpoint
kubectl port-forward -n vibecode-prod svc/code-server-agentapi 9090:9090
curl http://localhost:9090/metrics

# Horizontal Pod Autoscaler (optional)
kubectl autoscale deployment code-server-workspace -n vibecode-prod \
  --min=3 --max=10 --cpu-percent=70
```

---

## Useful Commands

### Quick Status Check

```bash
# One-liner to check everything
kubectl get pods,svc,deploy -n vibecode-dev -l app=code-server
```

### Watch Deployment

```bash
# Watch pods in real-time
watch -n 2 'kubectl get pods -n vibecode-dev -l app=code-server'
```

### Tail Logs

```bash
# Follow logs from all pods
kubectl logs -n vibecode-dev -l app=code-server -c agentapi -f --max-log-requests=10
```

### Copy Files

```bash
# Copy file from pod
kubectl cp vibecode-dev/$POD:/tmp/debug.log ./debug.log -c agentapi

# Copy file to pod
kubectl cp ./config.yaml vibecode-dev/$POD:/tmp/config.yaml -c agentapi
```

---

## Support & Escalation

### Documentation

- Full implementation: `claudedocs/AGENTAPI_CICD_IMPLEMENTATION.md`
- Testing strategy: `claudedocs/AGENTAPI_TESTING_STRATEGY.md`
- Architecture: `claudedocs/AGENTAPI_DEPLOYMENT_ARCHITECTURE.md`

### Support Contacts

- **DevOps Team**: devops@vibecode.io
- **On-Call**: PagerDuty escalation
- **Security**: security@vibecode.io

### Incident Response

1. Assess severity (P0-P4)
2. Open incident ticket
3. Follow runbook procedures
4. Escalate if needed
5. Post-mortem after resolution

---

**Document Version**: 1.0
**Maintained By**: DevOps Team
**Next Review**: 2025-11-02
