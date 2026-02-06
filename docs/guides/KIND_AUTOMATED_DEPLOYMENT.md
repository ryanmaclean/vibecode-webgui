# KIND Cluster Automated Deployment Guide

Complete automation guide for deploying KIND clusters with full Datadog observability including Data Streams Monitoring (DSM).

## Quick Start (New Mac Mini M4)

```bash
# On a fresh Mac Mini M4, run the setup script first:
./scripts/mac-mini-m4-setup.sh

# Then bootstrap the cluster:
export DD_API_KEY="your-api-key"  # Or it reads from ~/.datadog/api_key
./scripts/kind-tundra-bootstrap.sh tundra-dome
```

## Quick Start (Existing Setup)

```bash
# Set your Datadog API key
export DD_API_KEY="your-api-key"

# Run the Tundra bootstrap (recommended)
./scripts/kind-tundra-bootstrap.sh tundra-dome

# Or run full automation with Prometheus/Grafana
./scripts/kind-full-automation.sh
```

## Scripts Overview

| Script | Purpose |
|--------|---------|
| `mac-mini-m4-setup.sh` | Fresh Mac setup (Homebrew, Docker, KIND, kubectl, Helm) |
| `kind-tundra-bootstrap.sh` | Create KIND cluster with Tundra Dome + Datadog DSM |
| `kind-full-automation.sh` | Full stack with Prometheus/Grafana (more resources) |

## Prerequisites

- Docker Desktop (40GB+ disk recommended)
- KIND installed (`brew install kind`)
- kubectl installed (`brew install kubectl`)
- Helm installed (`brew install helm`)

## Cluster Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Local Network Deployment                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  kind-tundra-dome│  │  kind-gastown    │  │kind-vibecode-local│ │
│  │  ───────────────│  │  ────────────── │  │  ────────────────│  │
│  │  OpenLineage:    │  │  OpenLineage:    │  │  OpenLineage:     │  │
│  │  tundra-dome     │  │  gastown         │  │  vibecode-local   │  │
│  │                  │  │                  │  │                   │  │
│  │  DSM: enabled    │  │  DSM: enabled    │  │  DSM: enabled     │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬──────────┘  │
│           │                     │                     │              │
│           └──────────────┬──────┴─────────────────────┘              │
│                          │                                           │
│                          ▼                                           │
│             ┌────────────────────────┐                              │
│             │   Datadog Platform     │                              │
│             │  - Data Observability  │                              │
│             │  - APM / Traces        │                              │
│             │  - DSM (Kafka)         │                              │
│             │  - Logs                │                              │
│             └────────────────────────┘                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Configuration Components

### 1. Datadog Agent with DSM

The Datadog Helm values file includes DSM configuration:

```yaml
# platforms/kubernetes/k8s/datadog-values-kind.yaml
datadog:
  dataStreamsMonitoring:
    enabled: true
  env:
    - name: DD_DATA_STREAMS_ENABLED
      value: "true"
    - name: DD_APM_FEATURES
      value: "appsec,profiling,ci_visibility,data_streams_enabled"
```

### 2. Application Instrumentation

All Kafka-consuming applications must include dd-trace:

```javascript
// Required at the top of your entry file
require('dd-trace').init({
  service: process.env.DD_SERVICE || 'my-service',
  env: process.env.DD_ENV || 'local',
  version: process.env.DD_VERSION || '0.1.0',
  logInjection: true
});
```

### 3. Required Environment Variables

Applications need these environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `DD_SERVICE` | Service name for Datadog | `tundra-observer` |
| `DD_ENV` | Environment tag | `kind` |
| `DD_DATA_STREAMS_ENABLED` | Enable DSM | `true` |
| `DD_TRACE_REMOVE_INTEGRATION_SERVICE_NAMES_ENABLED` | Clean service names | `true` |
| `DD_AGENT_HOST` | Datadog agent service | `datadog-agent-apm.datadog.svc.cluster.local` |

### 4. Service Connectivity

Create an APM service if the default `datadog` service has no endpoints:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: datadog-agent-apm
  namespace: datadog
spec:
  selector:
    app: datadog-agent  # Match running agent pods
  ports:
  - name: dogstatsd
    port: 8125
    targetPort: 8125
    protocol: UDP
  - name: apm
    port: 8126
    targetPort: 8126
    protocol: TCP
```

## Deploying a New Cluster

### Step 1: Create KIND Cluster

```bash
kind create cluster --name my-cluster --config infrastructure/kind/cluster-config.yaml
```

### Step 2: Install Datadog

```bash
helm repo add datadog https://helm.datadoghq.com
helm repo update

kubectl create secret generic datadog-secret \
  --from-literal=api-key="$DD_API_KEY" \
  --namespace=datadog

helm install datadog datadog/datadog \
  --namespace datadog \
  --create-namespace \
  --values platforms/kubernetes/k8s/datadog-values-kind.yaml
```

### Step 3: Create APM Service (if needed)

```bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: datadog-agent-apm
  namespace: datadog
spec:
  selector:
    app: datadog-agent
  ports:
  - name: dogstatsd
    port: 8125
    protocol: UDP
  - name: apm
    port: 8126
    protocol: TCP
EOF
```

### Step 4: Deploy Tundra Dome Services

```bash
kubectl create namespace tundra-dome
kubectl apply -f platforms/kubernetes/k8s/tundra-dome/
```

### Step 5: Verify DSM is Working

```bash
# Check agent is receiving traces
kubectl exec -it $(kubectl get pods -n datadog -l app=datadog-agent -o jsonpath='{.items[0].metadata.name}') \
  -n datadog -c agent -- agent status | grep -A20 "APM Agent"

# Should show "Traces received" with non-zero counts
```

## Troubleshooting

### No traces in Datadog

1. **Check connectivity**:
   ```bash
   kubectl exec deployment/tundra-observer -n tundra-dome -- \
     curl -s http://datadog-agent-apm.datadog.svc.cluster.local:8126/info
   ```

2. **Check service endpoints**:
   ```bash
   kubectl get endpoints -n datadog
   ```

3. **Verify dd-trace is installed**:
   ```bash
   kubectl exec deployment/tundra-observer -n tundra-dome -- \
     npm list dd-trace
   ```

### DSM not showing services

1. **Enable DSM on agent**:
   ```bash
   kubectl set env daemonset/datadog-agent -n datadog \
     DD_DATA_STREAMS_ENABLED=true \
     DD_APM_FEATURES=data_streams_enabled
   ```

2. **Enable DSM on application**:
   ```bash
   kubectl set env deployment/my-app -n my-namespace \
     DD_DATA_STREAMS_ENABLED=true
   ```

### Pod can't reach Datadog agent

Create the APM service as shown in Step 3 above, ensuring the selector matches your running agent pods' labels.

## Verification Checklist

- [ ] KIND cluster is running: `kind get clusters`
- [ ] Datadog agent pods are healthy: `kubectl get pods -n datadog`
- [ ] APM service has endpoints: `kubectl get endpoints -n datadog`
- [ ] Applications can reach agent: curl test from pod
- [ ] Agent is receiving traces: check agent status
- [ ] DSM services appear in Datadog UI

## Files Reference

| File | Purpose |
|------|---------|
| `scripts/kind-full-automation.sh` | Complete bootstrap script |
| `platforms/kubernetes/k8s/datadog-values-kind.yaml` | Datadog Helm values with DSM |
| `infrastructure/kind/cluster-config.yaml` | KIND cluster configuration |
| `docs/guides/DATADOG_OPENLINEAGE_INTEGRATION.md` | OpenLineage setup guide |

---

**Last Updated**: 2026-02-05
