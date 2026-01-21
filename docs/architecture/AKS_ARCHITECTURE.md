# AKS Architecture (VibeCode)

This document describes the Azure Kubernetes Service (AKS) architecture used to run the VibeCode platform. It focuses on cluster layout, core services, networking, and operational dependencies.

## Goals

- Provide a single reference for AKS topology and service boundaries.
- Explain how workloads, data stores, and observability components fit together.
- Clarify dependencies required for production readiness.

## High-Level Topology

```
Azure Subscription
└── Resource Group
    ├── AKS Cluster
    │   ├── System node pool (kube-system)
    │   ├── Application node pool (vibecode workloads)
    │   ├── Ingress controller (NGINX)
    │   └── Monitoring agents (Datadog)
    ├── ACR (container registry)
    ├── PostgreSQL Flexible Server (pgvector)
    ├── Key Vault (secrets)
    └── Log Analytics / App Insights
```

## Core Components

### AKS Cluster
- **Control plane**: Managed by Azure.
- **Node pools**:
  - System pool for critical add-ons (CoreDNS, CNI, ingress, monitoring).
  - Application pool for VibeCode web, worker, and supporting services.
  - Optional database pool when running stateful services inside the cluster.

### Namespaces
- `vibecode-platform`: primary application workloads (web, API, workers).
- `monitoring`: Datadog agents, alerting, and observability stack.
- `ingress-nginx`: ingress controller resources.

### Container Registry (ACR)
- Stores application images (web, worker, supporting services).
- AKS pulls images via managed identity or ACR attachment.

### Data Layer
- **PostgreSQL Flexible Server** (recommended): managed pgvector storage.
- **Valkey/Redis**: caching layer for sessions and vector cache (in-cluster or managed).

### Observability
- **Datadog Agent** deployed via Helm with AKS-optimized values.
- APM + DBM integration for pgvector queries.
- Metrics, logs, and tracing for web + worker workloads.

## Networking

### Ingress
- NGINX ingress exposes the web UI and API.
- TLS termination at ingress, certificates from cert-manager or external provider.
- Public IP provisioned by AKS or pre-allocated for DNS stability.

### Service Connectivity
- Cluster IP services for internal traffic.
- Database connectivity via private endpoint or VNet peering when using managed PostgreSQL.

### DNS
- External DNS labels for `<label>.<region>.cloudapp.azure.com` or custom domain.
- Internal DNS handled by CoreDNS.

## Workload Layout

### Web + API
- `vibecode-webgui` deployment (Next.js) with horizontal scaling.
- Environment variables sourced from ConfigMaps + Secrets.
- Health checks for readiness/liveness.

### Background Workers
- Optional job/worker deployments for ingestion, maintenance, or queue processing.
- HPA policies tuned to CPU or queue length metrics.

### Supporting Services
- Valkey/Redis for cache and sessions.
- Optional vector ingestion pipelines if not handled externally.

## Data Flow (RAG)

```
User Request
  -> Web/API Deployment
  -> Embedding Provider (Azure/OpenAI/OpenRouter)
  -> PostgreSQL pgvector
  -> Cached results (Valkey)
  -> Response
```

## Scaling and Resilience

- **HPA** for web + worker deployments.
- **Node pool autoscaling** based on CPU/memory pressure.
- **Pod disruption budgets** for availability during upgrades.
- **Multi-zone** node pools for higher availability when enabled.

## Security

- Managed identity for AKS + ACR pull access.
- Secrets stored in Azure Key Vault and synced into Kubernetes Secrets.
- Network policies for intra-cluster traffic segmentation.
- RBAC for cluster access; least-privilege service accounts for workloads.

## Operational Dependencies

- Azure subscription with required quotas.
- ACR attached to the AKS cluster.
- PostgreSQL Flexible Server provisioned with pgvector extension enabled.
- Datadog API keys configured in secrets.
- DNS and TLS certificates configured for ingress endpoints.

## Related Documents

- `docs/azure-aks-deployment.md`
- `docs/aks-bootstrap-guide.md`
- `docs/aks-datadog-monitoring-guide.md`
- `docs/guides/DEPLOYMENT_STATUS.md`
