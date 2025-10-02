# Production Deployment Runbook

**Document Owner**: SRE Team
**Last Updated**: 2025-10-02
**Version**: 1.0.0
**Review Cycle**: Monthly

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Procedures](#deployment-procedures)
3. [Blue-Green Deployment](#blue-green-deployment)
4. [Canary Release](#canary-release)
5. [Rollback Procedures](#rollback-procedures)
6. [Post-Deployment Validation](#post-deployment-validation)
7. [Emergency Procedures](#emergency-procedures)

---

## Pre-Deployment Checklist

### Environment Verification

**Target Environment**:
- [ ] Environment name confirmed: `______________`
- [ ] Cluster context verified: `kubectl config current-context`
- [ ] Access credentials validated
- [ ] Backup window scheduled
- [ ] Change control ticket approved: `______________`

**Infrastructure Health**:
```bash
# Verify cluster health
kubectl get nodes
kubectl top nodes

# Check resource availability
kubectl describe nodes | grep -A 5 "Allocated resources"

# Verify storage provisioner
kubectl get storageclass
kubectl get pv,pvc --all-namespaces
```

Expected: All nodes Ready, >30% CPU/memory available, storage provisioner active

### Security Scan

**Container Image Scanning**:
```bash
# Scan container images for vulnerabilities
docker scan ghcr.io/vibecode/webgui:${VERSION}
docker scan ghcr.io/vibecode/agentapi:${VERSION}

# Verify image signatures
cosign verify ghcr.io/vibecode/webgui:${VERSION}
```

**Critical Criteria**: No HIGH or CRITICAL vulnerabilities, valid signatures

**Secret Management**:
```bash
# Verify secrets exist in target namespace
kubectl get secrets -n vibecode

# Required secrets:
# - database-credentials
# - redis-credentials
# - openai-api-key
# - datadog-api-key
# - jwt-secret
```

### Test Coverage

**Unit Tests**:
```bash
npm run test:unit
# Exit code 0, >80% coverage required
```

**Integration Tests**:
```bash
npm run test:integration
# All critical paths passing
```

**Performance Baseline**:
```bash
# Capture baseline metrics (last 24h)
curl -s "http://localhost:3000/api/monitoring/metrics" | jq '.performance'

# Document baseline:
# - Response time P95: _____ ms
# - Throughput: _____ req/s
# - Error rate: _____ %
# - CPU usage: _____ %
# - Memory usage: _____ GB
```

### Database Migration

**Backup Database**:
```bash
# PostgreSQL backup
kubectl exec -n vibecode postgres-0 -- pg_dump -U vibecode vibecode_db > backup-$(date +%Y%m%d-%H%M%S).sql

# Verify backup
ls -lh backup-*.sql
```

**Test Migration (Staging)**:
```bash
# Apply migration to staging
kubectl exec -n vibecode-staging postgres-0 -- psql -U vibecode vibecode_db < migrations/${VERSION}.sql

# Verify schema
kubectl exec -n vibecode-staging postgres-0 -- psql -U vibecode -d vibecode_db -c "\d"
```

### Deployment Artifacts

**Version Information**:
```bash
# Document versions
echo "WebGUI Version: $(cat package.json | jq -r '.version')"
echo "AgentAPI Version: $(cat docker/agentapi/VERSION)"
echo "Tauri Version: $(cat src-tauri/Cargo.toml | grep '^version' | cut -d'"' -f2)"
echo "Git Commit: $(git rev-parse HEAD)"
```

**Build Artifacts**:
- [ ] Docker images pushed to registry
- [ ] Helm charts packaged: `helm package k8s/vibecode-chart`
- [ ] Release notes prepared
- [ ] Deployment plan reviewed

### Notification Preparation

**Stakeholder Communication**:
```bash
# Send deployment notification
cat <<EOF | slack-notify
🚀 Production Deployment Starting
Version: ${VERSION}
Deployer: ${USER}
Estimated Duration: 30 minutes
Rollback Plan: Blue-Green via Helm
Status Updates: #deployments channel
EOF
```

**On-Call Setup**:
- [ ] Primary on-call engineer notified
- [ ] Backup on-call engineer available
- [ ] PagerDuty maintenance window scheduled (optional)
- [ ] Runbook links shared with team

---

## Deployment Procedures

### Standard Rolling Deployment

**Use Case**: Low-risk updates, gradual rollout, automated health checks

**Procedure**:

```bash
# 1. Set deployment version
export VERSION="1.2.3"
export NAMESPACE="vibecode"

# 2. Update Helm values
cat <<EOF > values-production.yaml
image:
  repository: ghcr.io/vibecode/webgui
  tag: ${VERSION}
  pullPolicy: IfNotPresent

replicaCount: 6

strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0

resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: 2000m
    memory: 4Gi

autoscaling:
  enabled: true
  minReplicas: 6
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70
EOF

# 3. Dry-run deployment
helm upgrade vibecode k8s/vibecode-chart \
  --namespace ${NAMESPACE} \
  --values values-production.yaml \
  --dry-run --debug

# 4. Execute deployment
helm upgrade vibecode k8s/vibecode-chart \
  --namespace ${NAMESPACE} \
  --values values-production.yaml \
  --timeout 10m \
  --wait

# 5. Monitor rollout
kubectl rollout status deployment/vibecode-webgui -n ${NAMESPACE}
watch kubectl get pods -n ${NAMESPACE}

# 6. Verify health
kubectl get pods -n ${NAMESPACE} -l app=vibecode-webgui
kubectl logs -n ${NAMESPACE} -l app=vibecode-webgui --tail=50
```

**Health Check Monitoring**:
```bash
# Monitor during rollout
while true; do
  kubectl get pods -n ${NAMESPACE} -l app=vibecode-webgui -o json | \
    jq -r '.items[] | "\(.metadata.name) \(.status.phase) Ready:\(.status.conditions[] | select(.type=="Ready") | .status)"'
  sleep 5
done
```

**Success Criteria**:
- All pods reach Running state
- Readiness probes passing
- No increase in error rate (Datadog)
- Response time within baseline +10%

**Duration**: 15-20 minutes for 6 replicas with maxSurge=1

---

## Blue-Green Deployment

**Use Case**: Zero-downtime deployments, instant rollback capability, high-risk changes

### Architecture

```
┌─────────────────────────────────────────────────┐
│              Load Balancer (Ingress)            │
│              traffic-weight: configurable       │
└─────────────────┬───────────────────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
    ┌────▼────┐       ┌────▼────┐
    │  Blue   │       │  Green  │
    │ (Stable)│       │  (New)  │
    └─────────┘       └─────────┘
```

### Procedure

**Phase 1: Deploy Green Environment**

```bash
export VERSION="1.2.3"
export NAMESPACE="vibecode"

# 1. Deploy green environment (parallel to blue)
helm install vibecode-green k8s/vibecode-chart \
  --namespace ${NAMESPACE} \
  --values values-production.yaml \
  --set nameOverride=vibecode-green \
  --set image.tag=${VERSION} \
  --set service.selector.version=green \
  --wait

# 2. Verify green environment health
kubectl get pods -n ${NAMESPACE} -l version=green
kubectl logs -n ${NAMESPACE} -l version=green --tail=50

# 3. Run smoke tests against green
export GREEN_URL="http://vibecode-green.vibecode.svc.cluster.local"
npm run test:production:smoke -- --base-url=${GREEN_URL}
```

**Phase 2: Traffic Shift (10% → 50% → 100%)**

```bash
# Stage 1: 10% traffic to green
kubectl patch ingress vibecode -n ${NAMESPACE} --type=json -p='[
  {
    "op": "add",
    "path": "/metadata/annotations/nginx.ingress.kubernetes.io~1canary",
    "value": "true"
  },
  {
    "op": "add",
    "path": "/metadata/annotations/nginx.ingress.kubernetes.io~1canary-weight",
    "value": "10"
  }
]'

# Monitor for 15 minutes
echo "Monitoring 10% traffic for 15 minutes..."
sleep 900

# Check metrics
curl -s "http://localhost:3000/api/monitoring/metrics?version=green" | jq '.error_rate'

# Stage 2: 50% traffic (if metrics healthy)
kubectl annotate ingress vibecode -n ${NAMESPACE} \
  nginx.ingress.kubernetes.io/canary-weight=50 --overwrite

echo "Monitoring 50% traffic for 15 minutes..."
sleep 900

# Stage 3: 100% traffic (full cutover)
kubectl patch service vibecode -n ${NAMESPACE} --type=json -p='[
  {
    "op": "replace",
    "path": "/spec/selector/version",
    "value": "green"
  }
]'

# Remove canary annotations
kubectl annotate ingress vibecode -n ${NAMESPACE} \
  nginx.ingress.kubernetes.io/canary- \
  nginx.ingress.kubernetes.io/canary-weight-
```

**Phase 3: Cleanup Old Blue Environment**

```bash
# Wait 1 hour for traffic drain and session completion
echo "Waiting 1 hour for traffic drain..."
sleep 3600

# Scale down blue environment
kubectl scale deployment vibecode-blue -n ${NAMESPACE} --replicas=1

# Wait 24 hours, then delete if stable
# helm delete vibecode-blue -n ${NAMESPACE}
```

**Rollback Procedure** (if issues detected):
```bash
# Instant rollback: switch service selector back to blue
kubectl patch service vibecode -n ${NAMESPACE} --type=json -p='[
  {
    "op": "replace",
    "path": "/spec/selector/version",
    "value": "blue"
  }
]'

# Verify traffic back on blue
kubectl logs -n ${NAMESPACE} -l version=blue --tail=100 --follow
```

**Success Criteria**:
- Green environment passes all smoke tests
- Error rate <0.5% during 10% traffic
- P95 response time within baseline +10%
- No critical alerts during 50% traffic
- Zero errors during final cutover

**Duration**: 90 minutes (30min deploy + 60min gradual traffic shift)

---

## Canary Release

**Use Case**: High-risk features, subset user testing, gradual confidence building

### Procedure

```bash
export VERSION="1.2.3"
export NAMESPACE="vibecode"

# 1. Deploy canary with 1 replica
helm install vibecode-canary k8s/vibecode-chart \
  --namespace ${NAMESPACE} \
  --values values-production.yaml \
  --set replicaCount=1 \
  --set image.tag=${VERSION} \
  --set nameOverride=vibecode-canary \
  --wait

# 2. Configure canary routing (by header)
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: vibecode-canary
  namespace: ${NAMESPACE}
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-by-header: "X-Canary-Version"
    nginx.ingress.kubernetes.io/canary-by-header-value: "${VERSION}"
spec:
  rules:
  - host: vibecode.eastus2.cloudapp.azure.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: vibecode-canary
            port:
              number: 3000
EOF

# 3. Test canary with specific users
curl -H "X-Canary-Version: ${VERSION}" https://vibecode.eastus2.cloudapp.azure.com/api/health

# 4. Monitor canary metrics
kubectl logs -n ${NAMESPACE} -l app=vibecode-canary --follow

# 5. Gradually increase canary weight (10% → 25% → 50%)
for weight in 10 25 50; do
  kubectl annotate ingress vibecode-canary -n ${NAMESPACE} \
    nginx.ingress.kubernetes.io/canary-weight=${weight} --overwrite
  echo "Canary weight: ${weight}%"
  sleep 600  # 10 minutes observation
done

# 6. Promote canary to stable (update main deployment)
kubectl set image deployment/vibecode-webgui -n ${NAMESPACE} \
  webgui=ghcr.io/vibecode/webgui:${VERSION}

# 7. Delete canary deployment
helm delete vibecode-canary -n ${NAMESPACE}
```

**Automated Canary Analysis** (with Flagger):
```yaml
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: vibecode-webgui
  namespace: vibecode
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: vibecode-webgui
  progressDeadlineSeconds: 600
  service:
    port: 3000
  analysis:
    interval: 1m
    threshold: 5
    maxWeight: 50
    stepWeight: 10
    metrics:
    - name: request-success-rate
      thresholdRange:
        min: 99
      interval: 1m
    - name: request-duration
      thresholdRange:
        max: 500
      interval: 1m
  webhooks:
    - name: load-test
      url: http://flagger-loadtester/
      metadata:
        cmd: "hey -z 1m -q 10 -c 2 http://vibecode-canary:3000/api/health"
```

**Success Criteria**:
- Canary request success rate >99%
- P95 latency <500ms
- No increase in errors compared to stable
- Manual testing passes for canary users

**Duration**: 60-90 minutes (progressive traffic increase)

---

## Rollback Procedures

### Automated Rollback Triggers

**Datadog Monitor Triggers**:
```yaml
# Alert configuration that triggers automatic rollback
monitors:
  - name: "Production Error Rate Spike"
    query: "avg(last_5m):sum:trace.web.request.errors{env:production}/sum:trace.web.request.hits{env:production} > 0.05"
    message: |
      Error rate exceeded 5% threshold
      @webhook-rollback-automation
    tags:
      - "service:vibecode"
      - "env:production"

  - name: "Production P95 Latency Degradation"
    query: "avg(last_5m):p95:trace.web.request.duration{env:production} > 2000"
    message: |
      P95 latency exceeded 2000ms (baseline: 800ms)
      @webhook-rollback-automation
```

**Webhook Handler** (`/webhook/rollback`):
```bash
#!/bin/bash
# Rollback automation script
set -e

ALERT_TYPE=$1
NAMESPACE="vibecode"

echo "Automated rollback triggered: ${ALERT_TYPE}"

# Get previous stable version
PREVIOUS_VERSION=$(helm history vibecode -n ${NAMESPACE} --max 2 -o json | \
  jq -r '.[-2].app_version')

# Rollback via Helm
helm rollback vibecode -n ${NAMESPACE} --wait --timeout 5m

# Notify team
slack-notify "🚨 Automated rollback to ${PREVIOUS_VERSION} due to ${ALERT_TYPE}"

# Create incident
datadog-incident create \
  --title "Production rollback: ${ALERT_TYPE}" \
  --severity "high" \
  --customer-impact "Deployment rolled back automatically"
```

### Manual Rollback Procedure

**Helm Rollback** (fastest):
```bash
# 1. Check release history
helm history vibecode -n vibecode

# 2. Identify last stable release
helm history vibecode -n vibecode -o json | jq -r '.[-2]'

# 3. Rollback to previous release
helm rollback vibecode -n vibecode --wait

# 4. Verify rollback
kubectl rollout status deployment/vibecode-webgui -n vibecode
kubectl get pods -n vibecode -l app=vibecode-webgui
```

**Kubernetes Rollback**:
```bash
# View deployment history
kubectl rollout history deployment/vibecode-webgui -n vibecode

# Rollback to previous revision
kubectl rollout undo deployment/vibecode-webgui -n vibecode

# Rollback to specific revision
kubectl rollout undo deployment/vibecode-webgui -n vibecode --to-revision=5
```

**Database Rollback**:
```bash
# 1. Identify database backup
ls -lt backup-*.sql | head -5

# 2. Stop application traffic (optional, for safety)
kubectl scale deployment vibecode-webgui -n vibecode --replicas=0

# 3. Restore database
kubectl exec -n vibecode postgres-0 -- psql -U vibecode vibecode_db < backup-20251002-143000.sql

# 4. Verify restoration
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db -c "\d"

# 5. Restart application
kubectl scale deployment vibecode-webgui -n vibecode --replicas=6
```

**Emergency Rollback** (traffic rerouting):
```bash
# Point ingress to backup environment immediately
kubectl patch ingress vibecode -n vibecode --type=json -p='[
  {
    "op": "replace",
    "path": "/spec/rules/0/http/paths/0/backend/service/name",
    "value": "vibecode-backup"
  }
]'
```

### Rollback Validation

**Health Checks**:
```bash
# Application health
curl -f https://vibecode.eastus2.cloudapp.azure.com/api/health

# Database connectivity
kubectl exec -n vibecode postgres-0 -- pg_isready

# Redis connectivity
kubectl exec -n vibecode redis-0 -- redis-cli ping

# All pods running
kubectl get pods -n vibecode | grep -c Running
```

**Smoke Tests**:
```bash
npm run test:production:smoke -- --base-url=https://vibecode.eastus2.cloudapp.azure.com
```

**Metrics Verification**:
```bash
# Check error rate dropped
curl -s "https://vibecode.eastus2.cloudapp.azure.com/api/monitoring/metrics" | \
  jq '.error_rate'

# Check response time back to normal
curl -s "https://vibecode.eastus2.cloudapp.azure.com/api/monitoring/metrics" | \
  jq '.response_time_p95'
```

**Expected Results**:
- All health checks passing
- Error rate <0.5%
- P95 response time within baseline
- No critical Datadog alerts

**Duration**: 5-10 minutes for Helm rollback

---

## Post-Deployment Validation

### Smoke Tests

**Critical Path Testing**:
```bash
#!/bin/bash
# smoke-tests.sh
set -e

BASE_URL="https://vibecode.eastus2.cloudapp.azure.com"

echo "Running production smoke tests..."

# 1. Health endpoint
echo "Test 1: Health check"
curl -f ${BASE_URL}/api/health || exit 1

# 2. Authentication
echo "Test 2: Authentication"
TOKEN=$(curl -s -X POST ${BASE_URL}/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"smoketest","password":"'${SMOKE_TEST_PASSWORD}'"}' | \
  jq -r '.token')
[ ! -z "$TOKEN" ] || exit 1

# 3. Workspace creation
echo "Test 3: Workspace creation"
WORKSPACE_ID=$(curl -s -X POST ${BASE_URL}/api/workspaces \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name":"smoke-test-'$(date +%s)'"}' | \
  jq -r '.id')
[ ! -z "$WORKSPACE_ID" ] || exit 1

# 4. Agent API connectivity
echo "Test 4: Agent API"
curl -f ${BASE_URL}/api/agents/health || exit 1

# 5. Database connectivity
echo "Test 5: Database query"
curl -f ${BASE_URL}/api/workspaces/${WORKSPACE_ID} \
  -H "Authorization: Bearer ${TOKEN}" || exit 1

# 6. Redis connectivity
echo "Test 6: Session management"
curl -f ${BASE_URL}/api/auth/verify \
  -H "Authorization: Bearer ${TOKEN}" || exit 1

# Cleanup
echo "Cleanup: Deleting test workspace"
curl -X DELETE ${BASE_URL}/api/workspaces/${WORKSPACE_ID} \
  -H "Authorization: Bearer ${TOKEN}"

echo "✅ All smoke tests passed"
```

**Execution**:
```bash
export SMOKE_TEST_PASSWORD="$(kubectl get secret smoke-test-credentials -n vibecode -o jsonpath='{.data.password}' | base64 -d)"
./smoke-tests.sh
```

### Performance Validation

**Load Test** (5 minutes baseline):
```bash
# Install k6 if not available: brew install k6

k6 run - <<EOF
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up
    { duration: '3m', target: 50 },   // Stay at 50 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],  // 95% < 1s
    http_req_failed: ['rate<0.01'],     // Error rate < 1%
  },
};

export default function () {
  let res = http.get('https://vibecode.eastus2.cloudapp.azure.com/api/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  sleep(1);
}
EOF
```

**Real User Monitoring** (Datadog RUM):
```bash
# Check Core Web Vitals
curl -s "https://api.datadoghq.com/api/v1/rum/query" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  -d '{
    "filter": {
      "query": "@type:view AND env:production",
      "from": "now-15m",
      "to": "now"
    },
    "compute": [
      {"aggregation": "pc95", "metric": "@view.largest_contentful_paint"},
      {"aggregation": "pc95", "metric": "@view.first_input_delay"},
      {"aggregation": "pc95", "metric": "@view.cumulative_layout_shift"}
    ]
  }' | jq '.'
```

**Expected Metrics**:
- LCP (Largest Contentful Paint): <2.5s
- FID (First Input Delay): <100ms
- CLS (Cumulative Layout Shift): <0.1
- P95 API response time: <800ms
- Error rate: <0.5%

### Monitoring Dashboard Verification

**Datadog Dashboard**:
```bash
# Open deployment dashboard
open "https://app.datadoghq.com/dashboard/abc-123-deployment"

# Verify key metrics visible:
# - Request rate (increasing to expected traffic)
# - Error rate (below 0.5%)
# - P50/P95/P99 latency (within baseline)
# - Apdex score (>0.95)
# - Pod count and health
# - Database connection pool
```

**Grafana Dashboard**:
```bash
# Open application dashboard
open "http://monitoring.vibecode.com/d/vibecode-production"

# Verify panels:
# - Application throughput
# - CPU and memory usage
# - Database query performance
# - Redis hit rate
# - Container resource utilization
```

### Alert Verification

**Test Alert Routing**:
```bash
# Trigger test alert
curl -X POST https://api.datadoghq.com/api/v1/events \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -d '{
    "title": "Deployment test alert",
    "text": "Testing alert routing post-deployment",
    "priority": "normal",
    "tags": ["env:production", "service:vibecode", "test:true"],
    "alert_type": "info"
  }'

# Verify alert received:
# - Slack #deployments channel
# - PagerDuty (if configured)
# - Datadog Events feed
```

### Feature Flag Validation

**Verify Feature Toggles**:
```bash
# Check feature flag state
curl -s ${BASE_URL}/api/features | jq '.'

# Expected:
# - New features: disabled (until explicit enable)
# - Breaking changes: gated behind flags
# - Rollout percentage: controlled
```

### Documentation Update

- [ ] Deployment log updated with version, timestamp, deployer
- [ ] Known issues documented
- [ ] Rollback tested and validated
- [ ] Monitoring dashboards updated with new version
- [ ] On-call runbook updated if procedures changed

---

## Emergency Procedures

### Complete Service Outage

**Symptoms**: All health checks failing, 5xx errors, no response

**Immediate Actions** (within 5 minutes):
```bash
# 1. Declare incident
datadog-incident create --title "Production Outage" --severity "critical"

# 2. Notify all hands
slack-notify --channel emergency "🚨 PRODUCTION OUTAGE - All hands"

# 3. Check cluster status
kubectl cluster-info
kubectl get nodes

# 4. Check core services
kubectl get pods -n vibecode
kubectl get pods -n kube-system

# 5. If cluster down, fail over to backup region
# (See DISASTER_RECOVERY.md)

# 6. If specific service down, scale up from zero
kubectl scale deployment vibecode-webgui -n vibecode --replicas=6

# 7. Check recent changes
kubectl rollout history deployment/vibecode-webgui -n vibecode
helm history vibecode -n vibecode

# 8. Emergency rollback if deployment-related
helm rollback vibecode -n vibecode --wait
```

### Database Connection Exhaustion

**Symptoms**: "too many connections" errors, slow queries

```bash
# 1. Check connection count
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -c \
  "SELECT count(*) FROM pg_stat_activity;"

# 2. Kill idle connections
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < now() - interval '5 minutes';"

# 3. Scale up database (if needed)
kubectl scale statefulset postgres -n vibecode --replicas=3

# 4. Increase connection pool limits (temporary)
kubectl set env deployment/vibecode-webgui -n vibecode \
  DATABASE_POOL_MAX=50
```

### Memory Leak / OOMKilled Pods

**Symptoms**: Pods restarting frequently, OOMKilled status

```bash
# 1. Identify OOMKilled pods
kubectl get pods -n vibecode -o json | \
  jq -r '.items[] | select(.status.containerStatuses[].lastState.terminated.reason=="OOMKilled") | .metadata.name'

# 2. Check memory usage
kubectl top pods -n vibecode

# 3. Increase memory limits (emergency)
kubectl set resources deployment vibecode-webgui -n vibecode \
  --limits=memory=8Gi

# 4. Restart affected pods
kubectl rollout restart deployment/vibecode-webgui -n vibecode

# 5. Enable heap dump for investigation
kubectl set env deployment/vibecode-webgui -n vibecode \
  NODE_OPTIONS="--max-old-space-size=4096 --heapsnapshot-signal=SIGUSR2"
```

### Certificate Expiration

**Symptoms**: TLS errors, "certificate has expired"

```bash
# 1. Check certificate expiration
echo | openssl s_client -connect vibecode.eastus2.cloudapp.azure.com:443 2>/dev/null | \
  openssl x509 -noout -dates

# 2. Renew cert (cert-manager)
kubectl delete certificaterequest -n vibecode --all
kubectl delete certificate vibecode-tls -n vibecode
kubectl apply -f k8s/tls/certificate.yaml

# 3. Verify renewal
kubectl get certificate -n vibecode
kubectl describe certificate vibecode-tls -n vibecode

# 4. Restart ingress controller if needed
kubectl rollout restart deployment nginx-ingress-controller -n ingress-nginx
```

### Contact Information

**On-Call Escalation**:
1. Primary On-Call: PagerDuty auto-escalate
2. Engineering Manager: [Contact Info]
3. VP Engineering: [Contact Info]
4. CTO: [Contact Info]

**External Vendors**:
- Datadog Support: support@datadoghq.com
- Azure Support: [Portal]
- MongoDB Atlas: [Support Portal]

---

## Appendix

### Deployment Log Template

```markdown
## Deployment: ${VERSION}

**Date**: 2025-10-02 14:30 UTC
**Deployer**: ryan.maclean
**Type**: Rolling Update
**Duration**: 18 minutes

### Changes
- Feature: New AI model integration
- Fix: Memory leak in session management
- Update: Datadog agent to 7.48.0

### Pre-Deployment
- [x] All tests passed
- [x] Security scan: No high vulnerabilities
- [x] Database backup: backup-20251002-143000.sql
- [x] Stakeholders notified

### Deployment Timeline
- 14:30 - Deployment started
- 14:35 - First pod ready
- 14:42 - 50% pods updated
- 14:48 - All pods updated
- 14:50 - Smoke tests passed

### Post-Deployment Metrics
- Error rate: 0.3% (baseline: 0.4%)
- P95 latency: 780ms (baseline: 820ms)
- Throughput: 1,200 req/s (baseline: 1,150 req/s)
- CPU usage: 42% (baseline: 45%)

### Issues
- None

### Rollback Tested
- [x] Helm rollback verified in staging
- [x] Rollback time: <5 minutes

**Sign-off**: [Deployer]
```

### Metrics Glossary

- **P95 Latency**: 95th percentile response time
- **Apdex**: Application Performance Index (0-1 scale)
- **Error Rate**: Percentage of 5xx responses
- **Throughput**: Requests per second
- **Availability**: Percentage of successful requests (SLI)

### Common Kubectl Commands

```bash
# Get pod logs
kubectl logs -n vibecode <pod-name> --tail=100 --follow

# Describe pod for events
kubectl describe pod -n vibecode <pod-name>

# Execute command in pod
kubectl exec -it -n vibecode <pod-name> -- /bin/bash

# Port forward to service
kubectl port-forward -n vibecode svc/vibecode-webgui 3000:3000

# Get pod metrics
kubectl top pod -n vibecode <pod-name>

# View deployment rollout status
kubectl rollout status deployment/vibecode-webgui -n vibecode

# View events
kubectl get events -n vibecode --sort-by='.lastTimestamp'
```

---

**Document Version**: 1.0.0
**Last Reviewed**: 2025-10-02
**Next Review**: 2025-11-02
**Owner**: SRE Team
