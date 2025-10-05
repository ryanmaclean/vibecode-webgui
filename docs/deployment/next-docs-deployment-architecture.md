# Next.js Documentation Site - Production Deployment Architecture

**Document Version**: 1.0
**Last Updated**: 2025-10-01
**Issue Reference**: #405
**Owner**: Backend Architecture Team

---

## Executive Summary

This document defines the production deployment architecture for the VibeCode Next.js documentation application. After analyzing the existing infrastructure (Azure-focused with AKS/App Service, GitHub Actions CI/CD, Datadog monitoring, and Azure Key Vault secrets management), the recommended platform is **Azure Container Apps** with a blue-green deployment strategy.

**Key Decision**: Azure Container Apps over alternatives (Azure Web App, AKS, Vercel) provides the optimal balance of:
- Native container deployment with Next.js standalone support
- Cost-effective serverless scaling (scale-to-zero capability)
- Built-in integration with Azure Key Vault and managed identity
- Simplified blue-green deployments via traffic splitting
- Full Datadog APM/trace support without agent management

---

## 1. Platform Selection Analysis

### 1.1 Platform Comparison Matrix

| Criteria | Azure Container Apps | Azure Web App | AKS (Existing) | Vercel |
|----------|---------------------|---------------|----------------|--------|
| **Infrastructure Alignment** | ✅ Native Azure, existing ACR | ✅ Native Azure | ✅ Already deployed | ❌ External platform |
| **Deployment Complexity** | ⭐⭐⭐⭐⭐ Simple | ⭐⭐⭐⭐ Moderate | ⭐⭐ Complex | ⭐⭐⭐⭐⭐ Trivial |
| **Secrets Management** | ✅ Key Vault via managed identity | ✅ Key Vault integration | ✅ K8s secrets + KV CSI | ⚠️ Environment variables |
| **Cost Efficiency** | ⭐⭐⭐⭐⭐ Scale-to-zero | ⭐⭐⭐ Always-on P1v3 | ⭐⭐ Node pool overhead | ⭐⭐⭐ Usage-based |
| **Monitoring Integration** | ✅ Datadog APM/traces | ✅ Datadog APM/traces | ✅ Full observability stack | ⚠️ Limited Datadog RUM |
| **Blue-Green Deployment** | ✅ Native traffic splitting | ⚠️ Slot swaps | ✅ K8s native | ✅ Instant rollbacks |
| **Next.js Standalone Support** | ✅ Container-first | ✅ Container support | ✅ Full control | ✅ Optimized runtime |
| **Operational Overhead** | ⭐⭐⭐⭐⭐ Minimal | ⭐⭐⭐⭐ Low | ⭐⭐ High (K8s complexity) | ⭐⭐⭐⭐⭐ Vendor-managed |
| **Control & Customization** | ⭐⭐⭐⭐ High | ⭐⭐⭐ Moderate | ⭐⭐⭐⭐⭐ Full | ⭐⭐ Limited |

### 1.2 Recommendation: Azure Container Apps

**Primary Rationale**:
1. **Infrastructure Alignment**: Seamless integration with existing Azure Container Registry (ACR), Azure Key Vault, and managed identity infrastructure already deployed for the main WebGUI
2. **Cost Optimization**: Scale-to-zero capability for documentation workloads with bursty traffic patterns (documentation sites typically have low baseline traffic with spikes during releases)
3. **Operational Simplicity**: No Kubernetes cluster management overhead while maintaining container deployment benefits
4. **Native Blue-Green**: Built-in traffic splitting without custom ingress controllers or service mesh complexity
5. **Monitoring Continuity**: Full Datadog APM/trace integration using existing instrumentation (`dd-trace` in `instrument.ts`)

**Fallback Option**: Azure Web App for Containers remains viable if Container Apps scaling proves inadequate, with minimal migration effort (same container image, updated deployment target).

---

## 2. Architecture Design

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Actions CI/CD                         │
│  ┌──────────────┐   ┌──────────────┐   ┌───────────────┐      │
│  │ Build Stage  │──>│ Security     │──>│ Deploy Stage  │      │
│  │ (npm build)  │   │ Scan         │   │ (ACA update)  │      │
│  └──────────────┘   └──────────────┘   └───────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Azure Container Registry                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ vibecode/docs-next:sha-abc123 (production blue)          │  │
│  │ vibecode/docs-next:sha-def456 (production green)         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Azure Container Apps Environment                    │
│                                                                  │
│  ┌────────────────────────┐  ┌────────────────────────┐        │
│  │  Revision: blue        │  │  Revision: green       │        │
│  │  Traffic: 100%         │  │  Traffic: 0%           │        │
│  │  Image: sha-abc123     │  │  Image: sha-def456     │        │
│  │  ┌──────────────────┐  │  │  ┌──────────────────┐  │        │
│  │  │ Next.js Server   │  │  │  │ Next.js Server   │  │        │
│  │  │ (Node 20)        │  │  │  │ (Node 20)        │  │        │
│  │  │ Port: 3000       │  │  │  │ Port: 3000       │  │        │
│  │  └──────────────────┘  │  │  └──────────────────┘  │        │
│  └────────────────────────┘  └────────────────────────┘        │
│                                                                  │
│  Traffic Splitting: Ingress Layer (managed by ACA)              │
└─────────────────────────────────────────────────────────────────┘
                │                           │
                ▼                           ▼
┌────────────────────────┐    ┌───────────────────────────┐
│  Azure Key Vault       │    │  Datadog APM              │
│  ─────────────────     │    │  ─────────────            │
│  NEXTAUTH_SECRET       │    │  Trace Collection         │
│  DD_API_KEY            │    │  APM Service: docs-next   │
│  OPENAI_API_KEY        │    │  DD_ENV: production       │
│  ANTHROPIC_API_KEY     │    │  Metrics & Logs           │
└────────────────────────┘    └───────────────────────────┘
```

### 2.2 Component Details

#### 2.2.1 Container Image
- **Base Image**: `node:20-slim` (existing standard, matches `Dockerfile.docs-next`)
- **Build Output**: Next.js standalone mode (enabled in `next.config.js`: `output: 'standalone'`)
- **Artifact Structure**:
  ```
  /app/
  ├── server.js              # Next.js standalone server
  ├── .next/
  │   ├── standalone/        # Server bundle
  │   └── static/            # Static assets
  ├── public/                # Public assets
  └── content/wiki/          # Documentation content
  ```
- **Startup Command**: `node server.js` (PID 1 managed by `tini` for signal handling)
- **Health Probe**: `/api/readyz` endpoint (custom health check endpoint to be implemented)

#### 2.2.2 Container Apps Configuration
```yaml
properties:
  managedEnvironmentId: /subscriptions/{sub}/resourceGroups/rg-vibecode-docs/providers/Microsoft.App/managedEnvironments/env-vibecode-docs
  configuration:
    secrets:
      - name: nextauth-secret
        keyVaultUrl: https://kv-vibecode.vault.azure.net/secrets/NEXTAUTH-SECRET
      - name: dd-api-key
        keyVaultUrl: https://kv-vibecode.vault.azure.net/secrets/DD-API-KEY
      - name: openai-api-key
        keyVaultUrl: https://kv-vibecode.vault.azure.net/secrets/OPENAI-API-KEY
      - name: anthropic-api-key
        keyVaultUrl: https://kv-vibecode.vault.azure.net/secrets/ANTHROPIC-API-KEY
    ingress:
      external: true
      targetPort: 3000
      traffic:
        - revisionName: docs-next--blue
          weight: 100
        - revisionName: docs-next--green
          weight: 0
      customDomains:
        - name: docs.vibecode.dev
          certificateId: /subscriptions/{sub}/resourceGroups/rg-vibecode-docs/providers/Microsoft.App/managedEnvironments/env-vibecode-docs/certificates/docs-vibecode-dev
    registries:
      - server: {acr-name}.azurecr.io
        identity: /subscriptions/{sub}/resourceGroups/rg-vibecode-docs/providers/Microsoft.ManagedIdentity/userAssignedIdentities/mi-aca-docs
  template:
    revisionSuffix: blue
    containers:
      - name: docs-next
        image: {acr-name}.azurecr.io/vibecode/docs-next:sha-abc123
        env:
          - name: NODE_ENV
            value: production
          - name: PORT
            value: "3000"
          - name: NEXTAUTH_URL
            value: https://docs.vibecode.dev
          - name: NEXTAUTH_SECRET
            secretRef: nextauth-secret
          - name: DD_API_KEY
            secretRef: dd-api-key
          - name: DD_ENV
            value: production
          - name: DD_SERVICE
            value: docs-next
          - name: DD_VERSION
            value: sha-abc123
          - name: DD_SITE
            value: datadoghq.com
          - name: DD_TRACE_ENABLED
            value: "true"
          - name: DD_RUNTIME_METRICS_ENABLED
            value: "true"
          - name: DD_AGENTLESS_ENABLED
            value: "true"
          - name: OPENAI_API_KEY
            secretRef: openai-api-key
          - name: ANTHROPIC_API_KEY
            secretRef: anthropic-api-key
        resources:
          cpu: 1.0
          memory: 2Gi
        probes:
          liveness:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readiness:
            httpGet:
              path: /api/readyz
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
    scale:
      minReplicas: 1
      maxReplicas: 10
      rules:
        - name: http-scaling
          http:
            metadata:
              concurrentRequests: "50"
```

---

## 3. Secrets Management Architecture

### 3.1 Azure Key Vault Integration

**Secrets Required**:
1. `NEXTAUTH_SECRET` - NextAuth session encryption (32+ character random string)
2. `DD_API_KEY` - Datadog API key for agentless APM traces
3. `OPENAI_API_KEY` - OpenAI API key for AI-powered search/features
4. `ANTHROPIC_API_KEY` - Anthropic API key for Claude integrations

**Access Pattern**:
- **Managed Identity**: User-assigned managed identity `mi-aca-docs` with Key Vault Secrets User role
- **Secret References**: Container Apps native Key Vault integration (no code changes required)
- **Rotation**: Secrets rotated via Azure Key Vault automatic rotation policies, Container Apps automatically picks up new values on next revision deployment

### 3.2 GitHub Environments for Deployment

**GitHub Environment: `docs-next-production`**
- **Required Secrets**:
  - `AZURE_CLIENT_ID` - Service principal/managed identity for OIDC authentication
  - `AZURE_TENANT_ID` - Azure AD tenant ID
  - `AZURE_SUBSCRIPTION_ID` - Azure subscription ID
  - `ACR_NAME` - Azure Container Registry name
  - `AZURE_RESOURCE_GROUP` - Resource group name (e.g., `rg-vibecode-docs`)
  - `CONTAINER_APP_NAME` - Container App name (e.g., `docs-next`)
  - `CONTAINER_APP_ENVIRONMENT_NAME` - Container App environment name (e.g., `env-vibecode-docs`)
  - `DOCS_NEXT_HEALTHCHECK_URL` - Optional custom health check URL override

**GitHub Environment: `docs-next-staging`**
- Same secrets as production with staging-specific values

### 3.3 Secrets Flow Diagram

```
┌───────────────────────┐
│  GitHub Actions       │
│  (OIDC Auth)          │
└───────┬───────────────┘
        │ Azure CLI with
        │ Managed Identity
        ▼
┌───────────────────────┐
│  Azure Key Vault      │
│  ─────────────────    │
│  Secrets:             │
│  - NEXTAUTH_SECRET    │
│  - DD_API_KEY         │
│  - OPENAI_API_KEY     │
│  - ANTHROPIC_API_KEY  │
└───────┬───────────────┘
        │ Key Vault Reference
        │ (via Managed Identity)
        ▼
┌───────────────────────┐
│  Container App        │
│  ─────────────────    │
│  Environment Vars:    │
│  - NEXTAUTH_SECRET    │
│    (from Key Vault)   │
│  - DD_API_KEY         │
│    (from Key Vault)   │
└───────────────────────┘
```

---

## 4. Monitoring & Observability

### 4.1 Datadog Integration

**Configuration** (leverages existing `instrument.ts`):
- **APM Mode**: Agentless (`DD_AGENTLESS_ENABLED=true`) - traces sent directly to Datadog API
- **Trace Collection**: `dd-trace` library instruments Next.js requests, database queries, external API calls
- **Service Tagging**:
  - `DD_SERVICE=docs-next`
  - `DD_ENV=production`
  - `DD_VERSION={git-sha}`
  - Custom tags: `deployment.type=container-apps`, `platform=azure`

**Key Metrics**:
- `trace.next.render` - Next.js page render times
- `trace.http.request` - HTTP request latency
- `azure.containerapp.requests` - Container Apps ingress metrics
- `azure.containerapp.cpu.usage` - CPU utilization
- `azure.containerapp.memory.usage` - Memory utilization
- `azure.containerapp.replicas` - Active replica count

**Datadog Monitors** (to be created):
1. **Health Check Failure**: Alert when `/api/readyz` returns non-200 for 2 consecutive minutes
2. **5xx Error Rate**: Alert when 5xx error rate exceeds 1% over 5 minutes
3. **Response Time**: Alert when p95 latency exceeds 2 seconds for 5 minutes
4. **Container Restart**: Alert when container restarts more than 3 times in 10 minutes

### 4.2 Azure Container Apps Metrics

**Native Azure Monitoring**:
- Container Apps emits metrics to Azure Monitor
- Log Analytics workspace integration for container logs
- Application Insights integration for distributed tracing (optional, complements Datadog)

**Log Collection**:
- Container stdout/stderr → Azure Log Analytics
- Datadog log agent not required (agentless mode sends logs via API)
- Structured JSON logs from Next.js application

### 4.3 Observability Dashboard Structure

**Datadog Dashboard: "Docs Next - Production"**
- **Top Row**: Deployment status, active revision, traffic split percentage
- **Service Health**: Request rate, error rate, p50/p95/p99 latency
- **Infrastructure**: CPU usage, memory usage, replica count, scale events
- **Application**: Page render times, API route latency, external API call latency
- **Business Metrics**: Page views, search queries, documentation feedback submissions

---

## 5. Deployment Pipeline

### 5.1 CI/CD Workflow Architecture

**Workflow File**: `.github/workflows/deploy-next-docs.yml` (already exists, requires updates)

**Pipeline Stages**:

```
┌─────────────────────────────────────────────────────────────────┐
│ Stage 1: Build & Artifact                                        │
├─────────────────────────────────────────────────────────────────┤
│ 1. Checkout code                                                 │
│ 2. Setup Node.js 20                                              │
│ 3. Install dependencies (npm ci --legacy-peer-deps)             │
│ 4. Run build (npm run build)                                     │
│ 5. Prepare standalone bundle (rsync .next/standalone, static)    │
│ 6. Archive and upload artifact (next-docs-standalone.tar.gz)     │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 2: Security & Quality                                      │
├─────────────────────────────────────────────────────────────────┤
│ 1. Dependency vulnerability scan (npm audit)                     │
│ 2. Container image scan (Trivy/Snyk)                            │
│ 3. SAST analysis (CodeQL - optional)                            │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 3: Container Build & Push                                  │
├─────────────────────────────────────────────────────────────────┤
│ 1. Download standalone artifact                                  │
│ 2. Azure login (OIDC)                                           │
│ 3. ACR login (az acr login)                                     │
│ 4. Build container image (docker build -f Dockerfile.docs-next) │
│ 5. Tag image with SHA and latest                                │
│ 6. Push to ACR (docker push)                                    │
│ 7. Generate SBOM (Software Bill of Materials)                   │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 4: Deploy (Blue-Green)                                     │
├─────────────────────────────────────────────────────────────────┤
│ 1. Determine target revision (blue/green)                        │
│ 2. Create new Container App revision with new image              │
│ 3. Wait for revision to become healthy (max 5 min)              │
│ 4. Run smoke tests against new revision (internal URL)           │
│ 5. Update traffic split: new=10%, old=90% (canary)              │
│ 6. Monitor error rate for 2 minutes                             │
│ 7. If healthy: Update traffic split to new=100%, old=0%         │
│ 8. If unhealthy: Rollback to old=100%, new=0%                   │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 5: Validation & Notification                               │
├─────────────────────────────────────────────────────────────────┤
│ 1. Run full smoke test suite (Playwright)                        │
│ 2. Validate Datadog traces appear (check APM service)            │
│ 3. Send Datadog deployment event                                 │
│ 4. Update GitHub deployment status                               │
│ 5. Send Slack notification (success/failure)                     │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Deployment Strategy: Blue-Green with Canary

**Deployment Steps**:

1. **Pre-Deployment**:
   - Identify current active revision (blue or green)
   - Tag new container image with git SHA and timestamp
   - Push image to ACR

2. **Green Deployment** (new revision):
   - Create Container App revision with suffix `--green` and new image
   - Revision starts with 0% traffic
   - Health probes must pass before proceeding

3. **Canary Testing** (10% traffic shift):
   - Update traffic split: green=10%, blue=90%
   - Monitor for 2 minutes:
     - Error rate < 1%
     - p95 latency within 20% of baseline
     - No container restarts
   - If metrics degrade: immediate rollback to blue=100%

4. **Full Cutover** (100% traffic shift):
   - Update traffic split: green=100%, blue=0%
   - Blue revision remains running for 15 minutes (quick rollback capability)
   - After 15 minutes: deactivate blue revision (cost optimization)

5. **Rollback Procedure**:
   - Immediate: Revert traffic split to blue=100%, green=0%
   - Manual: `az containerapp revision set-mode --mode single --revision docs-next--blue`
   - Timeline: < 30 seconds for traffic shift, < 2 minutes for full rollback

### 5.3 Deployment Triggers

- **Automatic Deployment**:
  - Push to `main` branch with changes to:
    - `src/app/wiki/**`
    - `content/wiki/**`
    - `package.json`
    - `next.config.js`
    - `docker/Dockerfile.docs-next`
  - Nightly cron: `0 6 * * *` (rebuild with latest dependencies)

- **Manual Deployment**:
  - `workflow_dispatch` with inputs:
    - `environment`: `docs-next-staging` or `docs-next-production`
    - `image_tag`: Optional SHA override for deploying specific version

### 5.4 Rollback Strategy

**Automated Rollback Conditions**:
1. Health check fails for 2 consecutive minutes after deployment
2. Error rate exceeds 5% within 5 minutes of deployment
3. Container restart count exceeds 3 within 10 minutes

**Manual Rollback**:
```bash
# Immediate rollback to previous revision
az containerapp revision set-mode \
  --resource-group rg-vibecode-docs \
  --name docs-next \
  --mode single \
  --revision docs-next--blue

# Or revert traffic split
az containerapp ingress traffic set \
  --resource-group rg-vibecode-docs \
  --name docs-next \
  --revision-weight docs-next--blue=100 docs-next--green=0
```

**Rollback Testing**:
- Monthly rollback drills in staging environment
- Documented in runbook: `docs/runbooks/next-docs-deployment.md`

---

## 6. Implementation Roadmap

### Phase 1: Infrastructure Provisioning (Week 1)
**Owner**: Cloud Platform Team

- [ ] **Task 1.1**: Provision Azure Container Apps environment
  ```bash
  az containerapp env create \
    --name env-vibecode-docs \
    --resource-group rg-vibecode-docs \
    --location eastus2 \
    --logs-workspace-id <log-analytics-workspace-id>
  ```

- [ ] **Task 1.2**: Create managed identity for Container App
  ```bash
  az identity create \
    --name mi-aca-docs \
    --resource-group rg-vibecode-docs
  ```

- [ ] **Task 1.3**: Grant managed identity access to ACR
  ```bash
  az role assignment create \
    --assignee <mi-aca-docs-principal-id> \
    --role AcrPull \
    --scope /subscriptions/{sub}/resourceGroups/rg-vibecode-docs/providers/Microsoft.ContainerRegistry/registries/{acr-name}
  ```

- [ ] **Task 1.4**: Grant managed identity access to Key Vault
  ```bash
  az role assignment create \
    --assignee <mi-aca-docs-principal-id> \
    --role "Key Vault Secrets User" \
    --scope /subscriptions/{sub}/resourceGroups/rg-vibecode-docs/providers/Microsoft.KeyVault/vaults/kv-vibecode
  ```

- [ ] **Task 1.5**: Store secrets in Azure Key Vault
  ```bash
  az keyvault secret set --vault-name kv-vibecode --name NEXTAUTH-SECRET --value "<generated-secret>"
  az keyvault secret set --vault-name kv-vibecode --name DD-API-KEY --value "<datadog-api-key>"
  az keyvault secret set --vault-name kv-vibecode --name OPENAI-API-KEY --value "<openai-key>"
  az keyvault secret set --vault-name kv-vibecode --name ANTHROPIC-API-KEY --value "<anthropic-key>"
  ```

- [ ] **Task 1.6**: Create Container App (initial deployment)
  - Use Azure CLI or Bicep/Terraform template
  - Configure ingress, secrets, scaling rules
  - Attach custom domain `docs.vibecode.dev`

### Phase 2: CI/CD Pipeline Updates (Week 1-2)
**Owner**: DevOps/Platform Team

- [ ] **Task 2.1**: Update `.github/workflows/deploy-next-docs.yml`
  - Add Container Apps deployment stage
  - Implement blue-green traffic splitting logic
  - Add canary testing with health check validation

- [ ] **Task 2.2**: Create GitHub environments
  - `docs-next-staging` with staging secrets
  - `docs-next-production` with production secrets
  - Configure environment protection rules (required reviewers)

- [ ] **Task 2.3**: Implement health check endpoints
  - Create `/api/readyz` endpoint in Next.js app
  - Add Datadog service dependency checks (optional)
  - Return structured health status (DB, external APIs, memory)

- [ ] **Task 2.4**: Add deployment smoke tests
  - Playwright tests for critical user journeys
  - API endpoint validation
  - Datadog trace validation (verify spans appear)

### Phase 3: Monitoring Setup (Week 2)
**Owner**: Observability Team

- [ ] **Task 3.1**: Configure Datadog APM
  - Verify `instrument.ts` agentless configuration
  - Tag all traces with `deployment.type:container-apps`
  - Create service definition in Datadog service catalog

- [ ] **Task 3.2**: Create Datadog monitors
  - Health check monitor (alert on 2+ failures)
  - Error rate monitor (alert on >1% errors for 5 min)
  - Latency monitor (alert on p95 > 2s for 5 min)
  - Container restart monitor (alert on >3 restarts in 10 min)

- [ ] **Task 3.3**: Create Datadog dashboard
  - "Docs Next - Production" dashboard
  - Panels: deployment status, health metrics, infrastructure, application performance

- [ ] **Task 3.4**: Configure alert routing
  - Route alerts to `#docs-infra-alerts` Slack channel
  - Integrate with PagerDuty for production incidents

### Phase 4: Testing & Validation (Week 2-3)
**Owner**: QA/Test Engineering

- [ ] **Task 4.1**: Deploy to staging environment
  - Run full deployment pipeline
  - Validate blue-green switching
  - Test rollback procedure

- [ ] **Task 4.2**: Load testing
  - Simulate traffic patterns (baseline, spike)
  - Validate autoscaling behavior
  - Measure cold start latency (scale-from-zero)

- [ ] **Task 4.3**: Chaos engineering
  - Kill container during deployment
  - Simulate Key Vault unavailability
  - Test graceful degradation

- [ ] **Task 4.4**: Documentation updates
  - Update runbook: `docs/runbooks/next-docs-deployment.md`
  - Create troubleshooting guide
  - Document rollback procedures

### Phase 5: Production Deployment (Week 3-4)
**Owner**: Release Engineering

- [ ] **Task 5.1**: Pre-deployment checklist
  - Verify all secrets in Key Vault
  - Confirm Datadog monitors active
  - Schedule deployment window (low-traffic period)

- [ ] **Task 5.2**: Production cutover
  - Run deployment pipeline
  - Monitor metrics during canary phase
  - Complete full cutover to new platform

- [ ] **Task 5.3**: Post-deployment validation
  - Run smoke test suite
  - Verify Datadog traces
  - Confirm custom domain resolution
  - Validate SSL certificate

- [ ] **Task 5.4**: Decommission old platform
  - Keep Azure Web App running for 1 week (rollback safety)
  - Update DNS records (if applicable)
  - Archive deployment artifacts

### Phase 6: Optimization & Hardening (Week 4+)
**Owner**: Platform Optimization Team

- [ ] **Task 6.1**: Cost optimization
  - Analyze scaling patterns
  - Adjust min/max replicas based on traffic
  - Implement scale-to-zero for staging environment

- [ ] **Task 6.2**: Performance tuning
  - Optimize Next.js build output (bundle analysis)
  - Enable HTTP/2 and caching headers
  - Implement CDN for static assets (Azure Front Door)

- [ ] **Task 6.3**: Security hardening
  - Enable Web Application Firewall (WAF) rules
  - Implement rate limiting (Azure API Management or custom)
  - Regular security audits and dependency updates

---

## 7. Cost Analysis

### 7.1 Estimated Monthly Costs

**Azure Container Apps** (Production):
- **Compute**: ~$50-100/month
  - Base: 1 replica always-on (1 vCPU, 2 GB RAM) = ~$35/month
  - Burst: 10 replicas max during peak = ~$15-65/month (usage-based)
- **Container Apps Environment**: ~$30/month (shared across apps)
- **Networking**: ~$5/month (ingress bandwidth)
- **Total**: **~$85-135/month**

**Azure Container Apps** (Staging):
- **Compute**: ~$15-30/month
  - Base: Scale-to-zero (0 replicas idle) = $0/month
  - Testing: 1-2 replicas during testing = ~$15-30/month (usage-based)
- **Total**: **~$15-30/month**

**Supporting Services**:
- **Azure Container Registry**: ~$5/month (Standard tier, shared)
- **Azure Key Vault**: ~$3/month (10,000 secret operations)
- **Log Analytics**: ~$10/month (10 GB ingestion)
- **Datadog**: ~$15-31/month per host (APM + Infra, prorated)

**Total Estimated Cost**: **~$133-214/month** for production + staging

### 7.2 Cost Comparison

| Platform | Monthly Cost | Scaling Model | Notes |
|----------|--------------|---------------|-------|
| **Container Apps** | $133-214 | Usage-based, scale-to-zero | Recommended |
| **Azure Web App** (P1v3) | $146 | Always-on, fixed | Single instance, no scale-to-zero |
| **AKS** (existing cluster) | $220+ | Node pool fixed | Shared with other workloads, complex |
| **Vercel** (Pro) | $240 | Usage-based | $20/user/month + bandwidth |

**Cost Optimization Opportunities**:
1. Enable scale-to-zero for staging environment: Save ~$20/month
2. Use Azure Reserved Instances for Container Apps environment: Save ~15%
3. Implement CDN for static assets: Reduce egress bandwidth costs by ~60%

---

## 8. Security Considerations

### 8.1 Security Controls

**Authentication & Authorization**:
- NextAuth for user authentication (OAuth providers: GitHub, Google)
- Session tokens encrypted with `NEXTAUTH_SECRET` (32+ character random)
- Role-based access control (RBAC) for admin features (if applicable)

**Network Security**:
- HTTPS-only ingress (TLS 1.2+)
- Custom domain with managed certificate (Azure-managed or Let's Encrypt)
- Network isolation: Container App environment in dedicated subnet (optional VNET integration)
- Web Application Firewall (WAF) rules:
  - SQL injection protection
  - XSS protection
  - Rate limiting (1000 req/min per IP)

**Container Security**:
- Non-root user (UID 1001, user `nextjs`)
- Read-only root filesystem (except `/app/.next/cache`)
- Minimal base image (`node:20-slim`)
- Regular vulnerability scanning (Trivy/Snyk in CI/CD)
- No secrets in environment variables (Key Vault references only)

**Secrets Management**:
- Azure Key Vault for secret storage
- Managed identity for secret access (no API keys in code)
- Secret rotation via Key Vault automatic rotation
- Audit logging for secret access (Azure Monitor)

**Datadog Security**:
- Agentless mode (no agent running in container)
- API key stored in Key Vault
- Trace sampling configured (10% in production)
- PII scrubbing rules enabled (regex patterns for emails, tokens)

### 8.2 Compliance & Audit

**Audit Logging**:
- Azure Activity Log: Container App configuration changes
- Key Vault audit logs: Secret access events
- Datadog audit trail: APM configuration changes
- GitHub audit log: Deployment events

**Compliance Requirements**:
- SOC 2 Type II (Azure Container Apps certified)
- GDPR compliance (data residency: East US 2)
- HIPAA compliance (if handling sensitive data) - requires VNET integration and additional controls

---

## 9. Disaster Recovery & High Availability

### 9.1 High Availability Configuration

**Container Apps Availability**:
- Multi-zone deployment (automatically enabled in Container Apps)
- SLA: 99.95% uptime (3 nines with multi-zone)
- Health probes: liveness and readiness checks
- Automatic pod restarts on failure

**Data Persistence**:
- No stateful data in containers (stateless Next.js app)
- Configuration stored in Key Vault (replicated across regions)
- Container images in ACR (geo-replication enabled)

### 9.2 Disaster Recovery Plan

**RTO (Recovery Time Objective)**: 15 minutes
**RPO (Recovery Point Objective)**: 0 seconds (no data loss, stateless app)

**DR Procedures**:

1. **Region Failure** (East US 2 outage):
   - Manual failover to West US 2 region
   - Deploy Container App environment in secondary region
   - Update DNS record to point to secondary region
   - Estimated time: 15-20 minutes

2. **Container App Environment Failure**:
   - Create new environment in same region
   - Deploy latest container image
   - Update ingress configuration
   - Estimated time: 10-15 minutes

3. **ACR Outage**:
   - Use geo-replicated ACR secondary region
   - Pull images from backup registry
   - Estimated time: 5 minutes

4. **Key Vault Outage**:
   - Key Vault automatically fails over to paired region
   - No action required
   - Estimated time: < 2 minutes

**Testing Schedule**:
- Quarterly DR drills (test failover to secondary region)
- Monthly rollback tests (staging environment)
- Continuous health monitoring (Datadog monitors)

---

## 10. Success Metrics

### 10.1 Deployment Success Criteria

**Technical Metrics**:
- [ ] Deployment success rate: >99%
- [ ] Deployment time: <10 minutes (end-to-end)
- [ ] Rollback time: <2 minutes
- [ ] Zero-downtime deployments: 100%

**Performance Metrics**:
- [ ] p50 latency: <200ms
- [ ] p95 latency: <500ms
- [ ] p99 latency: <1000ms
- [ ] Error rate: <0.1%

**Reliability Metrics**:
- [ ] Uptime: >99.9%
- [ ] MTTR (Mean Time to Recovery): <15 minutes
- [ ] MTBF (Mean Time Between Failures): >30 days

**Cost Metrics**:
- [ ] Monthly cost: <$200 (production + staging)
- [ ] Cost per 1000 requests: <$0.10

### 10.2 Post-Deployment Monitoring (First 30 Days)

**Week 1**:
- Daily review of error logs and Datadog traces
- Monitor autoscaling behavior and cold start latency
- Validate health check reliability

**Week 2-4**:
- Weekly cost review (track actual vs. estimated)
- Performance tuning based on real traffic patterns
- Identify optimization opportunities

**Monthly Review**:
- Retrospective with stakeholders
- Document lessons learned
- Update runbooks based on operational experience

---

## 11. Alternative Scenarios

### 11.1 If Azure Container Apps Proves Insufficient

**Fallback Plan: Azure Web App for Containers**

**Migration Steps**:
1. Provision Azure Web App (Linux, P1v3 SKU)
2. Configure container settings (same image from ACR)
3. Update Key Vault references in App Settings
4. Configure deployment slots for blue-green (staging/production slots)
5. Update GitHub Actions workflow to target Web App
6. Estimated migration time: 4 hours

**Trade-offs**:
- **Cost**: Higher ($146/month vs. $85-135/month)
- **Scaling**: Manual scale-out (no autoscaling)
- **Complexity**: Deployment slots instead of native revisions

### 11.2 If Vercel Becomes Preferred Platform

**Migration Steps**:
1. Create Vercel project linked to GitHub repo
2. Configure environment variables in Vercel dashboard
3. Enable Datadog integration (Vercel marketplace)
4. Update custom domain DNS to point to Vercel
5. Estimated migration time: 2 hours

**Trade-offs**:
- **Cost**: Higher ($240/month vs. $133-214/month)
- **Control**: Less control over infrastructure
- **Vendor Lock-in**: Vercel-specific deployment patterns

### 11.3 If Kubernetes (AKS) Becomes Mandatory

**Migration Steps**:
1. Create Helm chart for docs-next deployment
2. Configure ingress controller (NGINX or Traefik)
3. Deploy Datadog agent as DaemonSet
4. Implement blue-green via Kubernetes native resources (Deployments + Services)
5. Estimated migration time: 8-12 hours

**Trade-offs**:
- **Cost**: Higher ($220+/month for shared cluster overhead)
- **Complexity**: Significantly higher operational complexity
- **Control**: Maximum control and flexibility

---

## 12. Action Items

### Immediate Actions (This Week)
- [ ] **Cloud Platform Team**: Provision Container Apps environment and managed identity
- [ ] **Security Team**: Generate and store secrets in Key Vault
- [ ] **DevOps Team**: Update `.github/workflows/deploy-next-docs.yml` with Container Apps deployment
- [ ] **Application Team**: Implement `/api/readyz` health check endpoint

### Short-term Actions (Next 2 Weeks)
- [ ] **Observability Team**: Create Datadog monitors and dashboard
- [ ] **QA Team**: Deploy to staging and run smoke tests
- [ ] **Documentation Team**: Update runbooks and deployment guides
- [ ] **Release Engineering**: Schedule production deployment window

### Long-term Actions (Month 2+)
- [ ] **Platform Optimization**: Implement CDN for static assets
- [ ] **Security Team**: Enable WAF rules and rate limiting
- [ ] **Finance Team**: Review actual costs vs. estimates and optimize

---

## 13. References

### Documentation
- [Azure Container Apps Documentation](https://learn.microsoft.com/en-us/azure/container-apps/)
- [Next.js Standalone Output](https://nextjs.org/docs/advanced-features/output-file-tracing)
- [Datadog APM for Node.js](https://docs.datadoghq.com/tracing/trace_collection/dd_libraries/nodejs/)
- [Azure Key Vault Integration with Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets)

### Internal Resources
- GitHub Repository: `vibecode-webgui`
- Existing Workflow: `.github/workflows/deploy-next-docs.yml`
- Dockerfile: `docker/Dockerfile.docs-next`
- Instrumentation: `src/instrument.ts`
- Runbook: `docs/runbooks/next-docs-deployment.md`

### Contacts
- **Cloud Platform Team**: `#cloud-platform` Slack channel
- **Observability Team**: `#observability-help` Slack channel
- **On-call**: `#docs-infra-alerts` for production incidents
- **Issue Tracking**: GitHub issue #405

---

## Appendix A: Azure CLI Commands

### Provision Container Apps Environment
```bash
# Create resource group
az group create \
  --name rg-vibecode-docs \
  --location eastus2

# Create Log Analytics workspace
az monitor log-analytics workspace create \
  --resource-group rg-vibecode-docs \
  --workspace-name law-vibecode-docs

# Get workspace ID
WORKSPACE_ID=$(az monitor log-analytics workspace show \
  --resource-group rg-vibecode-docs \
  --workspace-name law-vibecode-docs \
  --query customerId -o tsv)

# Create Container Apps environment
az containerapp env create \
  --name env-vibecode-docs \
  --resource-group rg-vibecode-docs \
  --location eastus2 \
  --logs-workspace-id $WORKSPACE_ID

# Create managed identity
az identity create \
  --name mi-aca-docs \
  --resource-group rg-vibecode-docs

# Get identity details
IDENTITY_ID=$(az identity show \
  --name mi-aca-docs \
  --resource-group rg-vibecode-docs \
  --query id -o tsv)

PRINCIPAL_ID=$(az identity show \
  --name mi-aca-docs \
  --resource-group rg-vibecode-docs \
  --query principalId -o tsv)

# Grant ACR pull access
ACR_ID=$(az acr show \
  --name <acr-name> \
  --query id -o tsv)

az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role AcrPull \
  --scope $ACR_ID

# Grant Key Vault access
KV_ID=$(az keyvault show \
  --name kv-vibecode \
  --query id -o tsv)

az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Key Vault Secrets User" \
  --scope $KV_ID
```

### Deploy Container App
```bash
# Create Container App
az containerapp create \
  --name docs-next \
  --resource-group rg-vibecode-docs \
  --environment env-vibecode-docs \
  --image <acr-name>.azurecr.io/vibecode/docs-next:latest \
  --user-assigned $IDENTITY_ID \
  --registry-server <acr-name>.azurecr.io \
  --registry-identity $IDENTITY_ID \
  --target-port 3000 \
  --ingress external \
  --cpu 1.0 \
  --memory 2Gi \
  --min-replicas 1 \
  --max-replicas 10 \
  --secrets \
    nextauth-secret=keyvaultref:https://kv-vibecode.vault.azure.net/secrets/NEXTAUTH-SECRET,identityref:$IDENTITY_ID \
    dd-api-key=keyvaultref:https://kv-vibecode.vault.azure.net/secrets/DD-API-KEY,identityref:$IDENTITY_ID \
    openai-api-key=keyvaultref:https://kv-vibecode.vault.azure.net/secrets/OPENAI-API-KEY,identityref:$IDENTITY_ID \
    anthropic-api-key=keyvaultref:https://kv-vibecode.vault.azure.net/secrets/ANTHROPIC-API-KEY,identityref:$IDENTITY_ID \
  --env-vars \
    NODE_ENV=production \
    PORT=3000 \
    NEXTAUTH_URL=https://docs.vibecode.dev \
    NEXTAUTH_SECRET=secretref:nextauth-secret \
    DD_API_KEY=secretref:dd-api-key \
    DD_ENV=production \
    DD_SERVICE=docs-next \
    DD_VERSION=sha-abc123 \
    DD_SITE=datadoghq.com \
    DD_TRACE_ENABLED=true \
    DD_RUNTIME_METRICS_ENABLED=true \
    DD_AGENTLESS_ENABLED=true \
    OPENAI_API_KEY=secretref:openai-api-key \
    ANTHROPIC_API_KEY=secretref:anthropic-api-key

# Get Container App URL
az containerapp show \
  --name docs-next \
  --resource-group rg-vibecode-docs \
  --query properties.configuration.ingress.fqdn -o tsv
```

### Blue-Green Deployment
```bash
# Create new revision (green)
az containerapp revision copy \
  --name docs-next \
  --resource-group rg-vibecode-docs \
  --from-revision docs-next--blue \
  --revision-suffix green \
  --image <acr-name>.azurecr.io/vibecode/docs-next:sha-def456

# Set traffic split (canary: 10% green, 90% blue)
az containerapp ingress traffic set \
  --name docs-next \
  --resource-group rg-vibecode-docs \
  --revision-weight docs-next--blue=90 docs-next--green=10

# Full cutover (100% green)
az containerapp ingress traffic set \
  --name docs-next \
  --resource-group rg-vibecode-docs \
  --revision-weight docs-next--green=100 docs-next--blue=0

# Deactivate old revision
az containerapp revision deactivate \
  --name docs-next \
  --resource-group rg-vibecode-docs \
  --revision docs-next--blue
```

---

## Appendix B: Health Check Endpoint Implementation

**File**: `src/app/api/readyz/route.ts`

```typescript
import { NextResponse } from 'next/server';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    name: string;
    status: 'pass' | 'fail';
    message?: string;
    latency?: number;
  }[];
}

export async function GET() {
  const startTime = Date.now();
  const checks: HealthCheckResult['checks'] = [];

  // Check 1: Memory usage
  const memoryUsage = process.memoryUsage();
  const memoryCheck = {
    name: 'memory',
    status: memoryUsage.heapUsed < memoryUsage.heapTotal * 0.9 ? 'pass' : 'fail' as const,
    message: `Heap: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
  };
  checks.push(memoryCheck);

  // Check 2: Datadog trace connectivity (optional)
  try {
    const ddTracer = (await import('dd-trace')).default;
    const ddCheck = {
      name: 'datadog',
      status: ddTracer ? 'pass' : 'fail' as const,
      message: 'Tracer initialized',
    };
    checks.push(ddCheck);
  } catch (error) {
    checks.push({
      name: 'datadog',
      status: 'fail',
      message: 'Tracer not available',
    });
  }

  // Check 3: Environment variables
  const requiredEnvVars = ['NEXTAUTH_URL', 'NEXTAUTH_SECRET', 'DD_API_KEY'];
  const envCheck = {
    name: 'environment',
    status: requiredEnvVars.every(v => process.env[v]) ? 'pass' : 'fail' as const,
    message: `${requiredEnvVars.filter(v => process.env[v]).length}/${requiredEnvVars.length} env vars present`,
  };
  checks.push(envCheck);

  // Determine overall status
  const failedChecks = checks.filter(c => c.status === 'fail');
  const status: HealthCheckResult['status'] =
    failedChecks.length === 0 ? 'healthy' :
    failedChecks.length < checks.length ? 'degraded' :
    'unhealthy';

  const result: HealthCheckResult = {
    status,
    timestamp: new Date().toISOString(),
    checks: checks.map(c => ({
      ...c,
      latency: Date.now() - startTime,
    })),
  };

  const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;

  return NextResponse.json(result, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
```

---

**END OF DOCUMENT**
