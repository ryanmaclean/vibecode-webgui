---
title: DATADOG MONITORING CONFIGURATION
description: DATADOG MONITORING CONFIGURATION documentation
---

# Datadog Monitoring Configuration for VibeCode

This document outlines the comprehensive Datadog monitoring setup across all environments (dev/stg/prd).

## 🎯 Monitoring Strategy

### Environment Parity
- **Development (KIND)**: Full monitoring stack with dummy credentials
- **Staging (Azure AKS)**: Production-like monitoring with staging tags
- **Production (Azure AKS)**: Full production monitoring with real credentials

### Key Monitoring Features
- ✅ **Application Performance Monitoring (APM)**
- ✅ **Infrastructure Monitoring**
- ✅ **Log Aggregation**
- ✅ **Database Monitoring**
- ✅ **Container Insights**
- ✅ **Network Monitoring**
- ✅ **Security Monitoring**

## ⚙️ Environment Variables Standardization

To ensure consistent configuration across app, infra, and docs:

- Prefer `DD_*` variables for all Datadog configuration.
- Legacy `DATADOG_*` variables are still supported as fallback.
- Frontend RUM uses public vars `NEXT_PUBLIC_DD_*` with fallback to legacy `NEXT_PUBLIC_DATADOG_*`.
- Centralized resolver: `src/lib/monitoring/datadog-env.ts` handles DD_* first with DATADOG_* fallback and safe mismatch warnings.

Examples:

```bash
# Backend (primary)
DD_API_KEY=...            # falls back to DATADOG_API_KEY if unset
DD_APP_KEY=...
DD_SITE=datadoghq.com
DD_ENV=production
DD_SERVICE=vibecode-webgui
DD_VERSION=1.0.0

# Frontend RUM (public)
NEXT_PUBLIC_DD_APPLICATION_ID=...
NEXT_PUBLIC_DD_CLIENT_TOKEN=...
NEXT_PUBLIC_DD_SITE=datadoghq.com
# Dev-only override (RUM is prod-only by default)
NEXT_PUBLIC_ENABLE_RUM_IN_DEV=false
```

### Environment Variables Summary

- __Core (server)__
  - `DD_API_KEY` (fallback: `DATADOG_API_KEY`)
  - `DD_APP_KEY` (fallback: `DATADOG_APP_KEY`)
  - `DD_SITE` default `datadoghq.com` (fallback: `DATADOG_SITE`)
  - `DD_ENV` default maps from `NODE_ENV` if unset (fallback: `DATADOG_ENV`)
  - `DD_SERVICE` default `vibecode-webgui` (fallback: `DATADOG_SERVICE`)
  - `DD_VERSION` default `npm_package_version` or `1.0.0` (fallback: `DATADOG_VERSION`)

- __RUM (client, public)__
  - `NEXT_PUBLIC_DD_APPLICATION_ID` (fallbacks: `NEXT_PUBLIC_DATADOG_APPLICATION_ID`, `NEXT_PUBLIC_DATADOG_RUM_APPLICATION_ID`)
  - `NEXT_PUBLIC_DD_CLIENT_TOKEN` (fallbacks: `NEXT_PUBLIC_DATADOG_CLIENT_TOKEN`, `NEXT_PUBLIC_DATADOG_RUM_CLIENT_TOKEN`)
  - `NEXT_PUBLIC_DD_SITE` default `datadoghq.com` (fallback: `NEXT_PUBLIC_DATADOG_SITE`)
  - `NEXT_PUBLIC_APP_VERSION` optional, default `1.0.0`
  - `NEXT_PUBLIC_ENABLE_RUM_IN_DEV` gate, default `false`

- __DB Monitoring (server)__
  - `DD_POSTGRES_USER` default `datadog`
  - `DD_POSTGRES_PASSWORD` (fallback: `DATADOG_POSTGRES_PASSWORD`)

- __Optional toggles__ (server and/or client gating used by code):
  - `OTEL_ENABLED` (default off)
  - `DD_ENABLED` (set to `false` to fully disable Datadog init)
  - `DD_ENABLE_GET_RUM_DATA` (experimental dd-trace getRumData)
  - `SKIP_MONITORING` (force-disable all monitoring)
  - `DOCKER_BUILD` (disable monitoring during image builds)

All resolution is centralized in `src/lib/monitoring/datadog-env.ts` and emits safe warnings when DD_* and DATADOG_* are both set and differ.

### Client-side RUM initialization and gating

- __Primary entry points__:
  - `src/components/monitoring/DatadogRUM.tsx` uses `getRUMPublicConfig()` and guards with `NODE_ENV==='production'` or `NEXT_PUBLIC_ENABLE_RUM_IN_DEV==='true'` before `datadogRum.init()`.
  - `src/app/providers.tsx` initializes RUM via `RUMMonitoring.initializeWithTracking()` and `@datadog/browser-logs` with the same gating.
- __PII-safe defaults__: `defaultPrivacyLevel: 'mask-user-input'`, production `sessionReplaySampleRate=20` (100 in dev).
- __Verification__:
  - Open browser console and confirm "Datadog RUM initialized." or 🐕 log from `providers.tsx`.
  - Run `datadogRum.getInternalContext()` in DevTools; expect `application_id` present when initialized.

### Server-side tracing initialization and gating

- __Where it's initialized__: `src/instrument.ts` dynamically requires `dd-trace`, resolves `{ env, service, version }` via `getServiceEnvVersion()` from `src/lib/monitoring/datadog-env.ts`, and calls `tracer.init({ ... })`.
- __Enabled by default__: Monitoring is enabled in production and development by default. It is only disabled when one of these explicit flags/contexts is set:
  - `DOCKER_BUILD==='true'`
  - `SKIP_MONITORING==='true'`
  - `CI==='true'` or `GITHUB_ACTIONS==='true'`
  - `OTEL_ENABLED==='false'`
  - `DD_ENABLED==='false'`
- __OpenTelemetry__: If `OTEL_ENABLED==='true'` and `NODE_ENV!=='test'`, `initializeOpenTelemetry()` from `src/lib/monitoring/opentelemetry.ts` runs before `dd-trace` initialization.
- __Sampling__: `sampleRate` is `0.1` in production and `1.0` otherwise.
- __Tags__: Global tags include `deployment.environment`, `service.name`, `service.version`, `git.commit.sha`, and `git.repository.url`.
- __Verification__:
  - Check the agent locally: `curl -f http://localhost:8126/info` (when running with a local agent).
  - Review application logs for tracer initialization.
  - In Datadog APM, filter by `service:vibecode-webgui` and appropriate `env`.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   KIND (Local)  │    │  Staging (AKS)  │    │Production (AKS) │
│                 │    │                 │    │                 │
│ ├─ Docs Service │    │ ├─ Docs Service │    │ ├─ Docs Service │
│ ├─ Main App     │    │ ├─ Main App     │    │ ├─ Main App     │
│ └─ Datadog      │    │ └─ Datadog      │    │ └─ Datadog      │
│    Agent        │    │    Agent        │    │    Agent        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                        ┌───────▼────────┐
                        │ Datadog Cloud  │
                        │   Dashboard    │
                        └────────────────┘
```

## 📊 Deployment Configurations

### 1. KIND (Local Development)

**Location**: `scripts/deploy-kind-with-monitoring.sh`

**Configuration**:
- Lightweight DaemonSet deployment
- Dummy API keys for local development
- Basic monitoring features enabled
- Resource limits: 256Mi memory, 100m CPU

**Tags**:
```yaml
- env:local
- cluster:kind
- project:vibecode
```

**Features Enabled**:
- ✅ Container monitoring
- ✅ Process monitoring
- ✅ Log collection
- ✅ APM tracing
- ❌ Network monitoring (disabled for performance)
- ❌ Database monitoring (no production DB in KIND)

### 2. Azure Staging/Production

**Location**: `infrastructure/terraform/azure/kubernetes-deployment.tf`

**Configuration**:
- Helm chart deployment (datadog/datadog)
- Production Datadog credentials from Key Vault
- Full monitoring stack enabled
- High availability configuration

**Features Enabled**:
- ✅ Container insights
- ✅ Database monitoring (PostgreSQL)
- ✅ APM tracing
- ✅ Log aggregation
- ✅ Network monitoring
- ✅ Security scanning
- ✅ Orchestrator explorer

## 🔧 Configuration Files

### KIND Configuration
```yaml
# File: k8s/datadog-values-kind.yaml
datadog:
  apiKeyExistingSecret: datadog-secret
  site: "datadoghq.com"
  clusterName: "vibecode-kind-local"
  logs:
    enabled: true
  apm:
    portEnabled: true
  tags:
    - "env:local"
    - "cluster:kind"
```

### Terraform Configuration
```hcl
# File: infrastructure/terraform/azure/kubernetes-deployment.tf
resource "helm_release" "datadog" {
  name       = "datadog"
  repository = "https://helm.datadoghq.com"
  chart      = "datadog"
  
  values = [
    yamlencode({
      datadog = {
        apiKeyExistingSecret = kubernetes_secret.datadog_config.metadata[0].name
        site                 = "datadoghq.com"
        clusterName          = azurerm_kubernetes_cluster.main.name
        dbm.enabled          = true
        logs.enabled         = true
        apm.portEnabled      = true
      }
    })
  ]
}
```

## 🚀 Deployment Process

### Automated Deployment

1. **KIND (Local)**:
   ```bash
   # Deploy with monitoring
   scripts/deploy-kind-with-monitoring.sh
   ```

2. **Azure (Terraform)**:
   ```bash
   # Deploy infrastructure with monitoring
   cd infrastructure/terraform/azure
   terraform apply
   ```

3. **CI/CD (GitHub Actions)**:
   - Automatically deploys monitoring in staging
   - Validates monitoring deployment
   - Tests Datadog agent connectivity

### Manual Verification

```bash
# Check Datadog deployment
kubectl get pods -n datadog
kubectl logs -l app=datadog-agent -n datadog

# Check monitoring metrics
kubectl top nodes
kubectl top pods -n vibecode
```

## ✅ CI/CD Validation

- __Workflow__: `.github/workflows/ci.yml`
  - Job: "Monitoring & Health Validation" builds and starts the app, then probes:
    - `GET /api/monitoring/dashboard` and checks `.health`
    - `GET /api/monitoring/metrics?config=true` and checks `.monitoring`
    - `GET /api/monitoring/otel-config` and `...action=health`
  - Also asserts existence of key files:
    - `src/lib/monitoring/enhanced-datadog-integration.ts`
    - `src/lib/monitoring/advanced-datadog-dashboards.ts`
    - `src/lib/monitoring/alerts-configuration.ts`
    - `scripts/setup-datadog-monitoring.ts`
    - `docs/DATADOG_MONITORING.md`

- __Synthetic tests__: `.github/workflows/synthetic-test.yml`
  - Runs Datadog Synthetic suite via `datadog-ci synthetics run-tests`.
  - Env vars required by datadog-ci: `DATADOG_API_KEY` and `DATADOG_APP_KEY` (secrets may be stored as `DD_*` and mapped), site `datadoghq.com`.

- __Production deployment__: `.github/workflows/production-deployment.yml`
  - Invokes `scripts/deploy-monitoring.sh -m kubernetes`.
  - Env: passes Datadog API key; script prefers `DD_API_KEY` with `DATADOG_API_KEY` as fallback.

- __Kubernetes rollout__: `.github/workflows/k8s-deploy.yml`
  - Uses `kubectl set image` and `kubectl rollout status` in `vibecode-staging` and `vibecode-platform` namespaces.
  - Health check curls `http://vibecode-service.vibecode-platform.svc.cluster.local:3000/api/health`.

### CI tips

- Ensure `.env` exists (CI auto-copies from `.env.example` when missing).
- Prefer setting `DD_*` secrets in repo/org settings; legacy `DATADOG_*` still work via fallback.
- For RUM in Playwright/E2E, set `NEXT_PUBLIC_ENABLE_RUM_IN_DEV=true` only if you need RUM during tests.

## 📈 Monitoring Dashboards

### Key Metrics Tracked

**Application Metrics**:
- Request latency (p50, p95, p99)
- Error rates
- Throughput (requests/second)
- Apdex scores

**Infrastructure Metrics**:
- CPU utilization
- Memory usage
- Disk I/O
- Network traffic

**Database Metrics**:
- Query performance
- Connection pool status
- Slow queries
- Lock contention

**Container Metrics**:
- Pod restart counts
- Resource utilization
- Image pull times
- Health check status

### Custom Dashboards

1. **VibeCode Application Overview**
   - Service map
   - Error tracking
   - Performance metrics

2. **Infrastructure Health**
   - Kubernetes cluster status
   - Node performance
   - Resource allocation

3. **Database Performance**
   - PostgreSQL metrics
   - Query performance
   - Connection monitoring

## 🔔 Alerting Configuration

### Critical Alerts

1. **Application Down**: Service unavailable > 1 minute
2. **High Error Rate**: Error rate > 5% for 5 minutes
3. **High Latency**: p95 latency > 2s for 5 minutes
4. **Resource Exhaustion**: CPU > 90% or Memory > 95%

### Warning Alerts

1. **Moderate Latency**: p95 latency > 1s for 10 minutes
2. **Increased Errors**: Error rate > 2% for 10 minutes
3. **Resource Pressure**: CPU > 70% or Memory > 80%

## 🔐 Security and Access

### API Key Management

**KIND (Local)**:
- Uses dummy credentials
- No sensitive data exposure
- Local development only

**Azure (Production)**:
- API keys stored in Azure Key Vault
- Workload identity authentication
- Encrypted in transit and at rest

### RBAC Configuration

```yaml
# Datadog agent permissions
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: datadog-agent
rules:
- apiGroups: [""]
  resources: ["services", "events", "endpoints", "pods", "nodes"]
  verbs: ["get", "list", "watch"]
```

## 🧪 Testing and Validation

### Automated Tests

1. **Deployment Test**: Validates Datadog agent deployment
2. **Connectivity Test**: Checks metric collection
3. **Integration Test**: Verifies dashboard data

### Manual Validation Checklist

- [ ] Datadog agent pods running
- [ ] Metrics appearing in Datadog dashboard
- [ ] Logs being collected
- [ ] APM traces visible
- [ ] Alerts configured and firing
- [ ] Custom dashboards populated

## 📚 Documentation Links

- [Datadog Kubernetes Integration](https://docs.datadoghq.com/integrations/kubernetes/)
- [Azure AKS Monitoring](https://docs.datadoghq.com/integrations/azure_aks/)
- [Helm Chart Configuration](https://github.com/DataDog/helm-charts/tree/main/charts/datadog)

## 🛠️ Troubleshooting

### Common Issues

1. **Agent Not Starting**:
   ```bash
   kubectl describe pod -l app=datadog-agent -n datadog
   kubectl logs -l app=datadog-agent -n datadog
   ```

2. **No Metrics in Dashboard**:
   - Check API key configuration
   - Verify network connectivity
   - Review agent logs

3. **High Resource Usage**:
   - Adjust resource limits
   - Disable unnecessary features
   - Optimize collection intervals

### Debug Commands

```bash
# Check agent status
kubectl exec -it datadog-agent-<pod> -n datadog -- agent status

# View agent configuration
kubectl exec -it datadog-agent-<pod> -n datadog -- agent config

# Test connectivity
kubectl exec -it datadog-agent-<pod> -n datadog -- agent check connectivity
```

## 📅 Maintenance

### Regular Tasks

1. **Weekly**: Review dashboard metrics and alerts
2. **Monthly**: Update agent versions
3. **Quarterly**: Review and optimize monitoring configuration

### Agent Updates

```bash
# Update Helm chart
helm repo update
helm upgrade datadog datadog/datadog -n datadog
```

---

**Last Updated**: August 13, 2025  
**Environment**: dev/stg/prd parity achieved ✅  
**Status**: Production ready with comprehensive monitoring