# Next.js Documentation Site Deployment Pipeline

**Last Updated:** 2025-10-01
**Owners:** Docs Infrastructure Team
**Status:** Production Ready
**Related:** GitHub Issue #405

## Overview

This runbook describes the complete deployment pipeline for the VibeCode Next.js documentation site to Azure Web App for Containers. The pipeline supports server-side rendering, API routes, and full observability with Datadog and OpenTelemetry.

## Architecture Decision

**Platform Choice:** Azure Web App for Containers
**Reasoning:**
- Existing Azure infrastructure with ACR (Azure Container Registry)
- Native integration with Azure Key Vault for secret management
- Built-in health monitoring and auto-scaling
- Cost-effective for documentation workloads (P1v3 tier)
- Datadog APM integration already established
- Blue-green deployment via staging slots

**Alternative Considered:** Azure Container Apps
- Lower cost for serverless workloads
- IaC templates exist in `infrastructure/opentofu/container-app/`
- Trade-off: Less control over scaling and networking

## Prerequisites

### Required Access
- GitHub repository write access for workflow execution
- Azure subscription contributor role
- ACR push permissions
- Azure Key Vault secrets officer role

### Required Secrets (GitHub Environment)

Create GitHub environments: `docs-next-staging` and `docs-next-production`

**Azure Authentication:**
```bash
# Required for OIDC authentication
AZURE_CLIENT_ID=<app-registration-client-id>
AZURE_TENANT_ID=<azure-tenant-id>
AZURE_SUBSCRIPTION_ID=<subscription-id>
```

**Container Registry:**
```bash
ACR_NAME=<registry-name>  # e.g., vibecodecr
AZURE_RESOURCE_GROUP=<resource-group>  # e.g., rg-vibecode-docs
AZURE_WEBAPP_NAME=<webapp-name>  # e.g., vibecode-docs-next
```

**Application Secrets (Azure Key Vault):**
```bash
# NextAuth Configuration
NEXTAUTH_URL=https://docs.vibecode.dev
NEXTAUTH_SECRET=<32-char-random-string>

# Datadog Observability
DD_API_KEY=<datadog-api-key>
DD_APP_KEY=<datadog-app-key>
DD_SITE=datadoghq.com
DD_ENV=production
DD_SERVICE=vibecode-docs-next
DD_VERSION=<git-sha>

# RUM (Real User Monitoring)
NEXT_PUBLIC_DD_APPLICATION_ID=<rum-app-id>
NEXT_PUBLIC_DD_CLIENT_TOKEN=<rum-client-token>
NEXT_PUBLIC_DD_SITE=datadoghq.com

# AI Provider Keys (if docs include AI features)
OPENAI_API_KEY=<openai-key>
ANTHROPIC_API_KEY=<anthropic-key>

# Optional: Custom health check URL
DOCS_NEXT_HEALTHCHECK_URL=https://docs.vibecode.dev/api/readyz
```

## Deployment Pipeline

### Workflow: `.github/workflows/deploy-next-docs.yml`

**Triggers:**
- Push to `main` branch (paths: `src/app/wiki/**`, `content/wiki/**`, config files)
- Manual workflow dispatch with environment selection
- Daily cron at 06:00 UTC

**Pipeline Stages:**

#### 1. Build Artifact
```bash
npm ci --legacy-peer-deps
npm run build  # Creates .next/standalone output
```

Artifacts created:
- `.next/standalone/` - Node.js server bundle
- `.next/static/` - Static assets (CSS, JS, images)
- `public/` - Public assets
- `content/wiki/` - Markdown content

#### 2. Build Container Image
```dockerfile
# docker/Dockerfile.docs-next
FROM node:20-slim AS runner
ENV NODE_ENV=production PORT=3000
WORKDIR /app

# Install tini for signal handling
RUN apt-get update && apt-get install -y --no-install-recommends tini

COPY next-standalone/ ./
RUN chown -R nextjs:nextjs /app

USER nextjs
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
```

Image naming: `{ACR_LOGIN_SERVER}/vibecode/docs-next:{GIT_SHA}`

#### 3. Deploy to Azure Web App
```bash
az webapp config container set \
  -g $AZURE_RESOURCE_GROUP \
  -n $AZURE_WEBAPP_NAME \
  --docker-custom-image-name "$IMAGE"

az webapp restart -g $AZURE_RESOURCE_GROUP -n $AZURE_WEBAPP_NAME
```

#### 4. Smoke Test
Polls `/api/readyz` endpoint:
- 5 retry attempts
- Increasing backoff: 15s, 30s, 45s, 60s, 75s
- Total timeout: ~225 seconds

## Infrastructure Setup

### Option 1: Azure CLI (Quick Setup)

```bash
# 1. Create resource group
az group create \
  --name rg-vibecode-docs \
  --location eastus2

# 2. Create App Service plan
az appservice plan create \
  --name plan-vibecode-docs \
  --resource-group rg-vibecode-docs \
  --sku P1v3 \
  --is-linux

# 3. Create Web App
az webapp create \
  --name vibecode-docs-next \
  --plan plan-vibecode-docs \
  --resource-group rg-vibecode-docs \
  --deployment-container-image-name mcr.microsoft.com/appsvc/staticsite:latest

# 4. Configure health check
az webapp config set \
  --resource-group rg-vibecode-docs \
  --name vibecode-docs-next \
  --health-check-path "/api/readyz"

# 5. Enable system-assigned managed identity
az webapp identity assign \
  --resource-group rg-vibecode-docs \
  --name vibecode-docs-next

# 6. Configure staging slot for blue-green deployment
az webapp deployment slot create \
  --name vibecode-docs-next \
  --resource-group rg-vibecode-docs \
  --slot staging \
  --configuration-source vibecode-docs-next
```

### Option 2: Bicep IaC

Create `azure/docs-next-appservice.bicep`:

```bicep
@description('Location for all resources')
param location string = resourceGroup().location

@description('App Service plan name')
param planName string = 'plan-vibecode-docs'

@description('Web App name')
param appName string = 'vibecode-docs-next'

@description('Container image to deploy')
param containerImage string

@description('Key Vault name for secrets')
param keyVaultName string

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  sku: {
    name: 'P1v3'
    tier: 'PremiumV3'
    capacity: 1
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${containerImage}'
      alwaysOn: true
      healthCheckPath: '/api/readyz'
      http20Enabled: true
      ftpsState: 'Disabled'
      appSettings: [
        {
          name: 'WEBSITES_PORT'
          value: '3000'
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'DD_SERVICE'
          value: 'vibecode-docs-next'
        }
        {
          name: 'DD_ENV'
          value: 'production'
        }
        {
          name: 'NEXTAUTH_URL'
          value: 'https://${appName}.azurewebsites.net'
        }
        // Secrets from Key Vault
        {
          name: 'NEXTAUTH_SECRET'
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}.vault.azure.net/secrets/NEXTAUTH-SECRET/)'
        }
        {
          name: 'DD_API_KEY'
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}.vault.azure.net/secrets/DD-API-KEY/)'
        }
      ]
    }
  }
}

// Create staging slot for blue-green deployments
resource stagingSlot 'Microsoft.Web/sites/slots@2023-12-01' = {
  parent: app
  name: 'staging'
  location: location
  kind: 'app,linux,container'
  properties: {
    serverFarmId: plan.id
    siteConfig: app.properties.siteConfig
  }
}

output appUrl string = 'https://${app.properties.defaultHostName}'
output stagingUrl string = 'https://${stagingSlot.properties.defaultHostName}'
```

Deploy:
```bash
az deployment group create \
  --resource-group rg-vibecode-docs \
  --template-file azure/docs-next-appservice.bicep \
  --parameters \
    containerImage='vibecodecr.azurecr.io/vibecode/docs-next:latest' \
    keyVaultName='kv-vibecode-docs'
```

## Secret Management

### Azure Key Vault Setup

```bash
# 1. Create Key Vault
az keyvault create \
  --name kv-vibecode-docs \
  --resource-group rg-vibecode-docs \
  --location eastus2 \
  --enable-rbac-authorization false

# 2. Grant Web App access to Key Vault
WEBAPP_IDENTITY=$(az webapp identity show \
  --name vibecode-docs-next \
  --resource-group rg-vibecode-docs \
  --query principalId -o tsv)

az keyvault set-policy \
  --name kv-vibecode-docs \
  --object-id $WEBAPP_IDENTITY \
  --secret-permissions get list

# 3. Store secrets
az keyvault secret set --vault-name kv-vibecode-docs --name NEXTAUTH-SECRET --value "<secret>"
az keyvault secret set --vault-name kv-vibecode-docs --name DD-API-KEY --value "<key>"
az keyvault secret set --vault-name kv-vibecode-docs --name DD-APP-KEY --value "<key>"
az keyvault secret set --vault-name kv-vibecode-docs --name OPENAI-API-KEY --value "<key>"
```

### Environment Variable Configuration

Web App references Key Vault secrets using:
```bash
@Microsoft.KeyVault(SecretUri=https://kv-vibecode-docs.vault.azure.net/secrets/NEXTAUTH-SECRET/)
```

Update app settings:
```bash
az webapp config appsettings set \
  --resource-group rg-vibecode-docs \
  --name vibecode-docs-next \
  --settings \
    NEXTAUTH_SECRET='@Microsoft.KeyVault(SecretUri=https://kv-vibecode-docs.vault.azure.net/secrets/NEXTAUTH-SECRET/)' \
    DD_API_KEY='@Microsoft.KeyVault(SecretUri=https://kv-vibecode-docs.vault.azure.net/secrets/DD-API-KEY/)'
```

## Deployment Strategies

### Blue-Green Deployment (Recommended)

```bash
# 1. Deploy to staging slot
az webapp deployment slot swap \
  --name vibecode-docs-next \
  --resource-group rg-vibecode-docs \
  --slot staging \
  --target-slot production \
  --action preview

# 2. Validate staging
curl https://vibecode-docs-next-staging.azurewebsites.net/api/readyz

# 3. Swap to production
az webapp deployment slot swap \
  --name vibecode-docs-next \
  --resource-group rg-vibecode-docs \
  --slot staging \
  --target-slot production

# 4. Rollback if needed
az webapp deployment slot swap \
  --name vibecode-docs-next \
  --resource-group rg-vibecode-docs \
  --slot production \
  --target-slot staging
```

### Canary Deployment (Traffic Splitting)

```bash
# Route 10% traffic to staging slot
az webapp traffic-routing set \
  --name vibecode-docs-next \
  --resource-group rg-vibecode-docs \
  --distribution staging=10

# Monitor metrics, then increase gradually
az webapp traffic-routing set \
  --name vibecode-docs-next \
  --resource-group rg-vibecode-docs \
  --distribution staging=50

# Complete rollout
az webapp deployment slot swap \
  --name vibecode-docs-next \
  --resource-group rg-vibecode-docs \
  --slot staging \
  --target-slot production
```

## Monitoring & Observability

### Health Endpoints

**Readiness:** `/api/readyz`
```json
{
  "status": "ready",
  "timestamp": "2025-10-01T00:00:00.000Z"
}
```

**Liveness:** `/api/healthz`
```json
{
  "status": "healthy",
  "timestamp": "2025-10-01T00:00:00.000Z"
}
```

**Detailed Health:** `/api/health`
```json
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```

### Datadog Monitoring

**Dashboards:**
- Navigate to Datadog → Dashboards → "VibeCode Docs Next"
- Metrics tracked:
  - `azure.app_service.http.5xx` - Error rate
  - `azure.app_service.cpu.usage` - CPU utilization
  - `azure.app_service.memory.usage` - Memory usage
  - `trace.next.render` - SSR performance
  - `trace.next.api` - API route latency

**Monitors:**
1. **High Error Rate**
   - Alert: 5xx rate > 5% for 5 minutes
   - Notify: #docs-infra-alerts

2. **Slow Response Time**
   - Alert: P95 latency > 2s for 10 minutes
   - Notify: #docs-infra-alerts

3. **Health Check Failures**
   - Alert: `/api/readyz` returns non-200 for 3 consecutive checks
   - Notify: #docs-infra-oncall

**Create Monitors:**
```bash
# Using Datadog Terraform provider
cat > datadog-monitors.tf <<'EOF'
resource "datadog_monitor" "docs_next_errors" {
  name    = "Next Docs - High Error Rate"
  type    = "metric alert"
  message = "{{#is_alert}}5xx error rate is above threshold{{/is_alert}} @slack-docs-infra-alerts"

  query = "sum(last_5m):sum:azure.app_service.http.5xx{resource_group:rg-vibecode-docs}.as_count() > 50"

  monitor_thresholds {
    critical = 50
    warning  = 25
  }

  tags = ["service:vibecode-docs-next", "env:production"]
}
EOF

terraform apply
```

### Application Logs

**Stream logs:**
```bash
az webapp log tail \
  --name vibecode-docs-next \
  --resource-group rg-vibecode-docs
```

**Download logs:**
```bash
az webapp log download \
  --name vibecode-docs-next \
  --resource-group rg-vibecode-docs \
  --log-file docs-next-logs.zip
```

**Configure log retention:**
```bash
az webapp log config \
  --name vibecode-docs-next \
  --resource-group rg-vibecode-docs \
  --application-logging filesystem \
  --level verbose \
  --web-server-logging filesystem
```

## Manual Deployment

For emergency deployments or testing:

```bash
# 1. Build locally
npm ci --legacy-peer-deps
npm run build

# 2. Prepare standalone bundle
mkdir -p next-standalone
rsync -a .next/standalone/ next-standalone/
rsync -a .next/static/ next-standalone/.next/static/
rsync -a public/ next-standalone/public/

# 3. Build container
docker build -f docker/Dockerfile.docs-next -t vibecode-docs-next:local .

# 4. Test locally
docker run -p 3000:3000 \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -e NODE_ENV=production \
  vibecode-docs-next:local

# 5. Push to ACR
az acr login --name vibecodecr
docker tag vibecode-docs-next:local vibecodecr.azurecr.io/vibecode/docs-next:manual-$(date +%Y%m%d-%H%M%S)
docker push vibecodecr.azurecr.io/vibecode/docs-next:manual-$(date +%Y%m%d-%H%M%S)

# 6. Deploy
az webapp config container set \
  --resource-group rg-vibecode-docs \
  --name vibecode-docs-next \
  --docker-custom-image-name vibecodecr.azurecr.io/vibecode/docs-next:manual-20251001-120000
```

## Rollback Procedures

### Immediate Rollback (Staging Slot)

```bash
# Swap back to previous version
az webapp deployment slot swap \
  --name vibecode-docs-next \
  --resource-group rg-vibecode-docs \
  --slot production \
  --target-slot staging
```

### Rollback to Specific Image

```bash
# 1. List recent images
az acr repository show-tags \
  --name vibecodecr \
  --repository vibecode/docs-next \
  --orderby time_desc \
  --top 10

# 2. Deploy specific image
az webapp config container set \
  --resource-group rg-vibecode-docs \
  --name vibecode-docs-next \
  --docker-custom-image-name vibecodecr.azurecr.io/vibecode/docs-next:<previous-sha>

# 3. Restart app
az webapp restart \
  --name vibecode-docs-next \
  --resource-group rg-vibecode-docs
```

### Rollback via GitHub Artifacts

```bash
# 1. Download previous successful build
gh run list --workflow=deploy-next-docs.yml --status=success --limit=5
gh run download <previous-run-id> --name next-docs-standalone

# 2. Extract and rebuild
tar -xzf next-standalone.tar.gz
docker build -f docker/Dockerfile.docs-next -t rollback .

# 3. Deploy
docker tag rollback vibecodecr.azurecr.io/vibecode/docs-next:rollback-$(date +%s)
docker push vibecodecr.azurecr.io/vibecode/docs-next:rollback-$(date +%s)
```

## Performance Optimization

### CDN Integration

```bash
# 1. Create Azure CDN profile
az cdn profile create \
  --name cdn-vibecode-docs \
  --resource-group rg-vibecode-docs \
  --sku Standard_Microsoft

# 2. Create endpoint
az cdn endpoint create \
  --name docs-vibecode \
  --profile-name cdn-vibecode-docs \
  --resource-group rg-vibecode-docs \
  --origin vibecode-docs-next.azurewebsites.net \
  --origin-host-header vibecode-docs-next.azurewebsites.net

# 3. Configure caching rules
az cdn endpoint rule add \
  --name docs-vibecode \
  --profile-name cdn-vibecode-docs \
  --resource-group rg-vibecode-docs \
  --order 1 \
  --rule-name CacheStaticAssets \
  --match-variable UrlPath \
  --operator BeginsWith \
  --match-values "/_next/static/" \
  --action-name CacheExpiration \
  --cache-behavior SetIfMissing \
  --cache-duration 365
```

### Auto-Scaling Configuration

```bash
az monitor autoscale create \
  --resource-group rg-vibecode-docs \
  --resource vibecode-docs-next \
  --resource-type Microsoft.Web/sites \
  --name autoscale-docs-next \
  --min-count 1 \
  --max-count 5 \
  --count 2

az monitor autoscale rule create \
  --resource-group rg-vibecode-docs \
  --autoscale-name autoscale-docs-next \
  --condition "CpuPercentage > 70 avg 5m" \
  --scale out 1

az monitor autoscale rule create \
  --resource-group rg-vibecode-docs \
  --autoscale-name autoscale-docs-next \
  --condition "CpuPercentage < 30 avg 5m" \
  --scale in 1
```

## Troubleshooting

### Container Won't Start

1. Check application logs:
```bash
az webapp log tail --name vibecode-docs-next --resource-group rg-vibecode-docs
```

2. Verify container settings:
```bash
az webapp config show \
  --name vibecode-docs-next \
  --resource-group rg-vibecode-docs \
  --query "{image:siteConfig.linuxFxVersion, port:siteConfig.appSettings[?name=='WEBSITES_PORT'].value}"
```

3. Test image locally:
```bash
docker pull vibecodecr.azurecr.io/vibecode/docs-next:latest
docker run -p 3000:3000 vibecodecr.azurecr.io/vibecode/docs-next:latest
```

### Health Check Failures

1. Verify endpoint accessibility:
```bash
curl -v https://vibecode-docs-next.azurewebsites.net/api/readyz
```

2. Check health check configuration:
```bash
az webapp config show \
  --name vibecode-docs-next \
  --resource-group rg-vibecode-docs \
  --query "siteConfig.healthCheckPath"
```

3. Increase warmup time:
```bash
az webapp config set \
  --name vibecode-docs-next \
  --resource-group rg-vibecode-docs \
  --startup-time 300
```

### Slow Performance

1. Review Datadog APM traces
2. Check database query performance
3. Verify CDN caching is working
4. Scale up App Service plan:
```bash
az appservice plan update \
  --name plan-vibecode-docs \
  --resource-group rg-vibecode-docs \
  --sku P2v3
```

## Environment URLs

**Production:** https://vibecode-docs-next.azurewebsites.net
**Staging:** https://vibecode-docs-next-staging.azurewebsites.net

Custom domain (when configured): https://docs.vibecode.dev

## Validation Checklist

- [ ] GitHub workflow runs successfully
- [ ] Container image pushed to ACR
- [ ] Web App restarts without errors
- [ ] Health endpoint returns 200 OK
- [ ] Static assets load with proper caching
- [ ] Datadog traces appear within 5 minutes
- [ ] RUM (Real User Monitoring) active
- [ ] No errors in application logs
- [ ] SSL certificate valid
- [ ] Custom domain DNS configured (if applicable)

## Escalation

**Primary Contact:** #docs-infra-alerts (Slack)
**On-Call:** #docs-infra-oncall (PagerDuty)
**GitHub Issue:** #405

**Escalation Path:**
1. Docs Infrastructure Team
2. Platform Engineering (for Azure issues)
3. Observability Team (for monitoring issues)

## References

- GitHub Workflow: `.github/workflows/deploy-next-docs.yml`
- Dockerfile: `docker/Dockerfile.docs-next`
- Next.js Config: `next.config.mjs`
- Azure Bicep: `azure/docs-next-appservice.bicep`
- Issue Tracker: GitHub Issue #405
