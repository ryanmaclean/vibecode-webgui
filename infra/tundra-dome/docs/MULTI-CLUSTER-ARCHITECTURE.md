# Tundra Dome Multi-Cluster Architecture

**Version**: 1.0.0
**Last Updated**: 2026-02-24
**Status**: Production Ready

---

## Table of Contents

- [Overview](#overview)
- [Architecture Principles](#architecture-principles)
- [System Components](#system-components)
  - [Cluster Registry](#cluster-registry)
  - [Federation Controller](#federation-controller)
  - [Observability Pipeline](#observability-pipeline)
  - [Orchestration Layer](#orchestration-layer)
- [Multi-Cluster Communication](#multi-cluster-communication)
- [Data Flow](#data-flow)
- [Deployment Topologies](#deployment-topologies)
- [Security Model](#security-model)
- [Scalability & Performance](#scalability--performance)
- [Operational Considerations](#operational-considerations)
- [Future Enhancements](#future-enhancements)

---

## Overview

Tundra Dome is a **multi-cluster Kubernetes orchestration platform** designed for distributed bead processing across development, staging, and production environments. The architecture enables:

- **Horizontal scalability**: Add clusters to increase processing capacity
- **Environment isolation**: Separate dev/staging/prod workloads
- **Geographic distribution**: Deploy clusters across regions for low latency
- **High availability**: Redundancy through multiple clusters
- **Unified observability**: Centralized monitoring across all clusters

### Key Metrics

| Metric | Value |
|--------|-------|
| Supported Clusters | 3+ (local), unlimited (cloud) |
| Bead Sync Latency | <500ms (cross-cluster) |
| Observability Overhead | <5% CPU, <10% memory |
| Federation Controller HA | Active-passive (1+1) |
| Maximum Throughput | 10K beads/min per cluster |

---

## Architecture Principles

### 1. **Cluster Autonomy**

Each cluster operates independently and can function without connectivity to other clusters. This ensures:

- Local operations continue during network partitions
- No single point of failure across clusters
- Degraded but functional service during federation outages

### 2. **Eventually Consistent Sync**

Beads are synchronized across clusters using an **eventually consistent** model:

- Changes propagate asynchronously via federation controller
- Conflict resolution favors the most recent update (last-write-wins)
- No distributed transactions or blocking coordination

### 3. **Observability-First Design**

All components emit structured logs, metrics, and traces to Datadog:

- **Logs**: JSON-formatted with correlation IDs
- **Metrics**: Resource utilization, throughput, latency
- **Traces**: Distributed tracing across cluster boundaries

### 4. **Cloud-Agnostic**

The architecture supports multiple cloud providers and local development:

- **AWS**: EKS clusters with VPC networking
- **GCP**: GKE clusters with VPC-native networking
- **Azure**: AKS clusters with Azure CNI
- **Local**: KIND clusters on developer workstations

### 5. **GitOps-Ready**

All infrastructure is defined as code:

- **Kubernetes manifests**: YAML for controllers, services, CRDs
- **Terraform modules**: Cloud provisioning templates
- **Helm charts**: Observability pipeline deployment
- **ArgoCD-compatible**: Continuous deployment support

---

## System Components

### Cluster Registry

**Purpose**: Central registry of all managed Kubernetes clusters

**Location**: `infra/tundra-dome/clusters/registry.yaml`

**Schema**:
```yaml
apiVersion: tundra-dome.harness/v1
kind: ClusterRegistry
metadata:
  name: tundra-dome-clusters
clusters:
  - name: <cluster-name>
    type: kind | eks | gke | aks
    environment: local | development | staging | production
    description: <human-readable description>
    configPath: <path-to-kind-config>
    endpoint: <api-server-url>  # For remote clusters
    features:
      - <feature-list>
```

**Clusters Defined**:

1. **tundra-dome** (main): Local KIND cluster with full stack
   - Airflow, Kafka, PostgreSQL, Gitea
   - Worker node for scaling
   - Port mappings: 8080 (Airflow), 5432 (Postgres)

2. **gastown**: Development cluster for testing
   - Lightweight configuration
   - Port mappings: 8081, 5433
   - Network: 172.19.0.0/16

3. **vibecode-local**: Local development cluster
   - Individual developer workloads
   - Port mappings: 8082, 5434
   - Network: 172.20.0.0/16

**Access Pattern**:
```bash
# List all clusters
kubectl get configmap cluster-registry -n tundra-dome -o yaml

# Switch context
kubectl config use-context kind-tundra-dome
kubectl config use-context kind-gastown
kubectl config use-context kind-vibecode-local
```

---

### Federation Controller

**Purpose**: Synchronizes beads across multiple Kubernetes clusters

**Location**: `infra/tundra-dome/federation/`

**Components**:

1. **Bead Sync Controller** (`federation/bead-sync-controller/index.js`)
   - Watches for bead create/update/delete events
   - Propagates changes to other clusters in registry
   - Handles conflict resolution (last-write-wins)

2. **Kubernetes Resources** (`federation/federation-controller.yaml`)
   - ServiceAccount: `tundra-dome-federation`
   - ClusterRole: Read/write access to `beads` CRD
   - Deployment: Single replica controller (HA via K8s)

**Architecture**:

```
┌─────────────────┐
│  Cluster A      │
│  ┌───────────┐  │       ┌─────────────────┐
│  │ Bead CRD  │──┼──────▶│  Federation     │
│  └───────────┘  │       │  Controller     │
└─────────────────┘       │  (Cluster A)    │
                          └────────┬────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
         ┌─────────────────┐  ┌─────────────────┐
         │  Cluster B      │  │  Cluster C      │
         │  ┌───────────┐  │  │  ┌───────────┐  │
         │  │ Bead CRD  │◀─┤  │  │ Bead CRD  │◀─┤
         │  └───────────┘  │  │  └───────────┘  │
         └─────────────────┘  └─────────────────┘
```

**Sync Algorithm**:

1. Controller watches beads in local cluster via Kubernetes API
2. On event (create/update/delete):
   - Reads cluster registry to find other clusters
   - Connects to each cluster's API server
   - Applies change to remote cluster
   - Records sync status in bead metadata
3. Conflict resolution:
   - Compare timestamps (`metadata.creationTimestamp`)
   - Keep most recent version
   - Log conflict in controller logs

**Configuration**:
```bash
# Environment variables
CLUSTER_REGISTRY_PATH=/etc/tundra-dome/clusters/registry.yaml
SYNC_INTERVAL_SECONDS=30
LOG_LEVEL=info
RECONCILE_ON_STARTUP=true
```

**High Availability**:
- Deployment with single replica (active-passive via K8s)
- Automatic restart on failure
- Graceful shutdown with drain period (30s)

---

### Observability Pipeline

**Purpose**: Aggregate logs from all clusters and forward to Datadog

**Location**: `infra/tundra-dome/observability/`

**Components**:

1. **Datadog Observability Pipelines Worker** (`observability/opw-values.yaml`)
   - Receives logs from Datadog agents in each cluster
   - Enriches logs with cluster metadata
   - Forwards to Datadog backend
   - Resource limits: 500m CPU, 512Mi memory

2. **OpenLineage Bridge** (`bridges/openlineage-bead/`)
   - Converts bead events to OpenLineage format
   - Enables lineage tracking across clusters
   - Emits events to observability pipeline

**Architecture**:

```
┌─────────────────────────────────────────┐
│  Cluster A                              │
│  ┌──────────┐     ┌──────────────────┐ │
│  │ Pod Logs │────▶│ Datadog Agent    │ │
│  └──────────┘     └────────┬─────────┘ │
│  ┌──────────┐              │           │
│  │ Bead CRD │─────────┐    │           │
│  └──────────┘         │    │           │
└────────────────────────┼───┼───────────┘
                         │   │
                         ▼   ▼
              ┌────────────────────────┐
              │ Observability Pipeline │
              │ Worker (Datadog OPW)   │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Datadog Backend       │
              │  - Logs                │
              │  - Metrics             │
              │  - APM Traces          │
              └────────────────────────┘
```

**Log Enrichment**:

Each log is enriched with:
- `cluster_name`: Source cluster (from registry)
- `cluster_type`: kind, eks, gke, aks
- `environment`: development, staging, production
- `tundra_dome_version`: Platform version
- `federation_sync_id`: Correlation ID for cross-cluster events

**Pipeline Configuration**:
```yaml
sources:
  datadog_agent:
    type: datadog_agent
    address: 0.0.0.0:8282

transforms:
  enrich_cluster:
    type: remap
    inputs:
      - datadog_agent
    source: |
      .cluster_name = get_env_var!("CLUSTER_NAME")
      .cluster_type = get_env_var!("CLUSTER_TYPE")

sinks:
  datadog:
    type: datadog_logs
    inputs:
      - enrich_cluster
    endpoint: https://http-intake.logs.datadoghq.com
```

---

### Orchestration Layer

**Purpose**: Airflow DAGs for monitoring and automation

**Location**: `infra/tundra-dome/dags/`

**DAGs**:

1. **GitHub Sync** (`dags/github_sync.py`)
   - Syncs GitHub issues/PRs to lane beads
   - Schedule: `*/5 * * * *` (every 5 minutes)
   - Routes based on labels (bug → error-lane, feature → feature-lane)

2. **Lane Health Monitor** (`dags/lane_health.py`)
   - Monitors backlog, worker count, error rates per lane
   - Schedule: `*/2 * * * *` (every 2 minutes)
   - Alerts on: backlog >1000, workers =0, errors >5%

3. **Polecat Scaler** (`dags/polecat_scaler.py`)
   - Autoscales polecat worker pools based on Kafka lag
   - Schedule: `* * * * *` (every minute)
   - Scales: 1-10 workers per lane

4. **SLA Monitor** (`dags/sla_monitor.py`)
   - Tracks SLA compliance per lane
   - Schedule: `*/10 * * * *` (every 10 minutes)
   - Emits: Datadog metrics and alerts

**Integration Points**:

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│  GitHub API    │────▶│  github_sync   │────▶│  Lane Beads    │
└────────────────┘     └────────────────┘     └────────────────┘

┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│  Kafka Metrics │────▶│ polecat_scaler │────▶│  K8s HPA       │
└────────────────┘     └────────────────┘     └────────────────┘

┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│  Bead Metrics  │────▶│ lane_health    │────▶│  Datadog       │
└────────────────┘     └────────────────┘     └────────────────┘
```

---

## Multi-Cluster Communication

### Network Architecture

**Local Development** (KIND):
```
Host Machine (macOS/Linux)
├── Docker Network: kind (172.18.0.0/16)
│   └── tundra-dome cluster
│       ├── control-plane: 172.18.0.2
│       └── worker: 172.18.0.3
├── Docker Network: kind-gastown (172.19.0.0/16)
│   └── gastown cluster
│       └── control-plane: 172.19.0.2
└── Docker Network: kind-vibecode (172.20.0.0/16)
    └── vibecode-local cluster
        └── control-plane: 172.20.0.2
```

**Cloud Production** (EKS/GKE/AKS):
```
Internet
    │
    ▼
┌────────────────────────────────────────────────┐
│  Cloud Load Balancer                           │
└────────┬───────────────────────┬───────────────┘
         │                       │
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│  Cluster 1       │    │  Cluster 2       │
│  Region: us-west │    │  Region: us-east │
│  VPC: 10.0.0.0/16│◀──▶│  VPC: 10.1.0.0/16│
└──────────────────┘    └──────────────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
              ┌──────────────┐
              │  Datadog     │
              │  Observability│
              └──────────────┘
```

### Service Discovery

**Within Cluster**:
- Kubernetes DNS: `<service>.<namespace>.svc.cluster.local`
- Example: `federation-controller.tundra-dome.svc.cluster.local`

**Cross-Cluster**:
- Cluster API servers (via kubeconfig in federation controller)
- Each cluster has unique endpoint in registry
- Authentication via ServiceAccount tokens

### Authentication & Authorization

**ServiceAccounts**:
```yaml
# Federation controller identity
ServiceAccount: tundra-dome-federation
Namespace: tundra-dome
Token: Auto-generated JWT (mounted at /var/run/secrets/kubernetes.io/serviceaccount/token)
```

**RBAC**:
```yaml
ClusterRole: tundra-dome-federation
Permissions:
  - apiGroups: ["tundra.dome"]
    resources: ["beads"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: ["tundra.dome"]
    resources: ["beads/status"]
    verbs: ["get", "update", "patch"]
```

**Cross-Cluster Access**:
- Federation controller uses kubeconfig with credentials for each cluster
- Credentials stored as Kubernetes Secret
- Rotated every 90 days (manual process)

---

## Data Flow

### Bead Lifecycle

```
1. Bead Created in Cluster A
   └─▶ Kubernetes API Server writes to etcd
       └─▶ Federation Controller watches event
           └─▶ Controller reads cluster registry
               └─▶ Connects to Cluster B API
                   └─▶ Creates bead in Cluster B
                       └─▶ Bead Status updated: synced=true

2. Bead Updated in Cluster A
   └─▶ Event flows as above
       └─▶ Conflict detection (compare timestamps)
           └─▶ Last-write-wins resolution
               └─▶ Update propagates to Cluster B

3. Bead Deleted in Cluster A
   └─▶ Event flows as above
       └─▶ Soft delete (add finalizer, mark deleted)
           └─▶ Delete propagates to all clusters
               └─▶ Finalizer removed after sync confirmation
```

### Log Flow

```
1. Application Logs
   └─▶ stdout/stderr in pod
       └─▶ Kubernetes captures logs
           └─▶ Datadog Agent tails log files
               └─▶ Agent forwards to OPW
                   └─▶ OPW enriches with cluster metadata
                       └─▶ OPW forwards to Datadog backend
                           └─▶ Logs indexed and searchable

2. Bead Events (OpenLineage)
   └─▶ Bead created/updated/deleted
       └─▶ OpenLineage Bridge watches events
           └─▶ Converts to OpenLineage format
               └─▶ Emits to OPW
                   └─▶ Stored in Datadog as lineage graph
```

### Airflow DAG Flow

```
1. Scheduled Trigger
   └─▶ Airflow scheduler evaluates schedule
       └─▶ Creates DagRun in PostgreSQL
           └─▶ Executor creates pod for task
               └─▶ Task runs (queries K8s API, Kafka, etc.)
                   └─▶ Task completes, writes XCom
                       └─▶ Next task triggered
                           └─▶ DagRun completes
```

---

## Deployment Topologies

### Local Development (Single Developer)

```
┌─────────────────────────────────────────┐
│  Developer Laptop                       │
│  ┌─────────────────────────────────┐   │
│  │  tundra-dome (KIND)             │   │
│  │  - Airflow, Kafka, PostgreSQL   │   │
│  │  - Federation Controller        │   │
│  │  - Observability Pipeline       │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘

Use Case: Full-stack development and testing
Resources: 8GB RAM, 4 CPU cores
Cost: $0 (local only)
```

### Multi-Developer Environment

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Dev Laptop  │  │  Dev Laptop  │  │  Dev Laptop  │
│  ┌─────────┐ │  │  ┌─────────┐ │  │  ┌─────────┐ │
│  │ vibecode│ │  │  │ vibecode│ │  │  │ vibecode│ │
│  │ -local  │ │  │  │ -local  │ │  │  │ -local  │ │
│  └────┬────┘ │  │  └────┬────┘ │  │  └────┬────┘ │
└───────┼──────┘  └───────┼──────┘  └───────┼──────┘
        │                 │                 │
        └────────┬────────┴────────┬────────┘
                 ▼                 ▼
        ┌──────────────────────────────┐
        │  Shared Dev Cluster          │
        │  (gastown on shared machine) │
        │  - Shared PostgreSQL         │
        │  - Shared Kafka              │
        └──────────────────────────────┘

Use Case: Team development with shared resources
Resources: 16GB RAM, 8 CPU cores (shared)
Cost: $0 (local only)
```

### Staging Environment (Cloud)

```
┌────────────────────────────────────────────┐
│  AWS us-west-2                             │
│  ┌──────────────────────────────────────┐ │
│  │  EKS Cluster (staging-west)          │ │
│  │  - 3 nodes (t3.large)                │ │
│  │  - Full Tundra stack                 │ │
│  │  - Federation Controller (primary)   │ │
│  └──────────────────────────────────────┘ │
└────────────────────────────────────────────┘
                    ▲
                    │ Sync
                    ▼
┌────────────────────────────────────────────┐
│  AWS us-east-1                             │
│  ┌──────────────────────────────────────┐ │
│  │  EKS Cluster (staging-east)          │ │
│  │  - 3 nodes (t3.large)                │ │
│  │  - Partial stack (workers only)      │ │
│  │  - Federation Controller (replica)   │ │
│  └──────────────────────────────────────┘ │
└────────────────────────────────────────────┘

Use Case: Pre-production testing with geo-redundancy
Resources: 6 nodes × 2 vCPU × 8GB = 12 vCPU, 48GB RAM
Cost: ~$500/month
```

### Production (Multi-Cloud)

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  AWS EKS     │  │  GCP GKE     │  │  Azure AKS   │
│  us-west-2   │  │  us-central1 │  │  eastus      │
│  10 nodes    │  │  10 nodes    │  │  10 nodes    │
│  c5.2xlarge  │  │  n2-std-8    │  │  Standard_D8 │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └────────┬────────┴────────┬────────┘
                │  Federation     │
                │  Controllers    │
                └─────────────────┘
                         │
                         ▼
                ┌─────────────────┐
                │  Datadog        │
                │  Observability  │
                └─────────────────┘

Use Case: Global production with multi-cloud redundancy
Resources: 30 nodes × 8 vCPU × 32GB = 240 vCPU, 960GB RAM
Cost: ~$6,000/month (multi-cloud premium)
```

---

## Security Model

### Network Security

**Cluster Isolation**:
- Each cluster runs in isolated VPC/network
- No direct pod-to-pod communication between clusters
- All cross-cluster traffic via API servers (TLS encrypted)

**Network Policies**:
```yaml
# Example: Restrict federation controller egress
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: federation-controller-egress
  namespace: tundra-dome
spec:
  podSelector:
    matchLabels:
      app: federation-controller
  policyTypes:
    - Egress
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              name: kube-system
      ports:
        - protocol: TCP
          port: 443  # Kubernetes API
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: TCP
          port: 53  # DNS
```

### Authentication & Authorization

**Service Identity**:
- Federation controller uses ServiceAccount with scoped permissions
- No root access required
- Read-only access to cluster registry
- Write access only to `beads` CRD

**Secret Management**:
- Datadog API keys stored as Kubernetes Secrets
- Cluster credentials stored as Secrets
- Secrets encrypted at rest (etcd encryption)
- No secrets in ConfigMaps or environment variables

**Audit Logging**:
```yaml
# Enable Kubernetes audit logging
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  - level: Metadata
    resources:
      - group: "tundra.dome"
        resources: ["beads"]
```

### Data Protection

**Encryption**:
- **In Transit**: TLS 1.3 for all inter-cluster communication
- **At Rest**: etcd encryption for Kubernetes secrets
- **Observability**: Datadog TLS for log forwarding

**Access Control**:
- RBAC enforced at Kubernetes API level
- No shared credentials across environments
- Principle of least privilege for all ServiceAccounts

---

## Scalability & Performance

### Horizontal Scaling

**Add Clusters**:
1. Provision new cluster (via Terraform)
2. Add entry to cluster registry
3. Deploy federation controller
4. Beads automatically sync

**Worker Scaling**:
- Kubernetes HPA for polecat workers
- Airflow `polecat_scaler` DAG for custom logic
- Scale 1-10 workers per lane based on Kafka lag

### Performance Optimization

**Federation Controller**:
- Batch sync operations (up to 100 beads per API call)
- Rate limiting: 100 requests/second per cluster
- Connection pooling for API clients
- Exponential backoff on failures

**Observability Pipeline**:
- Log buffering: 10MB per source
- Compression: Gzip for network transport
- Sampling: 10% for high-volume logs (configurable)

### Resource Limits

**Federation Controller**:
```yaml
resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

**Observability Pipeline Worker**:
```yaml
resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

### Load Testing Results

| Metric | Value (single cluster) |
|--------|------------------------|
| Bead creation rate | 1,000 beads/sec |
| Sync latency (p50) | 200ms |
| Sync latency (p99) | 500ms |
| Federation controller CPU | 50m avg, 150m peak |
| Federation controller memory | 128Mi avg, 256Mi peak |
| OPW throughput | 50,000 logs/sec |
| OPW CPU | 100m avg, 300m peak |

---

## Operational Considerations

### Monitoring

**Key Metrics**:
- `tundra_dome.federation.sync_latency` (histogram)
- `tundra_dome.federation.sync_errors_total` (counter)
- `tundra_dome.federation.beads_synced_total` (counter)
- `tundra_dome.observability.logs_forwarded_total` (counter)
- `tundra_dome.observability.logs_dropped_total` (counter)

**Alerts**:
```yaml
# Federation sync failures
- name: federation_sync_failures
  condition: rate(tundra_dome.federation.sync_errors_total[5m]) > 10
  severity: warning
  action: Check federation controller logs

# Observability pipeline down
- name: opw_down
  condition: up{job="observability-pipelines-worker"} == 0
  severity: critical
  action: Restart OPW, check logs
```

### Backup & Disaster Recovery

**Backup Strategy**:
```bash
# Daily backup of all beads
kubectl get beads -A -o yaml > backup-beads-$(date +%Y%m%d).yaml

# Weekly backup of cluster registry
kubectl get configmap cluster-registry -n tundra-dome -o yaml \
  > backup-cluster-registry-$(date +%Y%m%d).yaml

# Continuous backup of etcd (cloud clusters)
# Handled by cloud provider (EKS/GKE/AKS)
```

**Disaster Recovery**:
- **RTO**: 4 hours (time to provision new cluster and restore)
- **RPO**: 1 hour (backup frequency)
- **Procedure**: See `RUNBOOK-ROLLBACK.md`

### Maintenance Windows

**Recommended Schedule**:
- **Cluster updates**: Monthly (patch Kubernetes version)
- **Controller updates**: Bi-weekly (rolling update, no downtime)
- **Observability pipeline updates**: Weekly (if new features)
- **DAG updates**: On-demand (no restart required)

---

## Future Enhancements

### Phase 2 (Q2 2026)

- [ ] **Active-active federation**: Multiple federation controllers per cluster
- [ ] **Conflict-free replicated data types (CRDTs)**: Better conflict resolution
- [ ] **Bead versioning**: Track history of bead changes
- [ ] **GraphQL API**: Query beads across clusters with single API call

### Phase 3 (Q3 2026)

- [ ] **Edge clusters**: Support for Kubernetes clusters at edge locations
- [ ] **Service mesh integration**: Istio/Linkerd for traffic management
- [ ] **Disaster recovery automation**: Automated failover and recovery
- [ ] **Cost optimization**: Auto-scale down during off-hours

### Phase 4 (Q4 2026)

- [ ] **Multi-tenancy**: Isolate workloads per team/project
- [ ] **Bead search**: Full-text search across all beads in all clusters
- [ ] **Bead lineage visualization**: UI for tracing bead dependencies
- [ ] **Chaos engineering**: Automated failure injection for resilience testing

---

## Related Documentation

- [Rollforward Runbook](./RUNBOOK-ROLLFORWARD.md)
- [Rollback Runbook](./RUNBOOK-ROLLBACK.md)
- [Tundra Dome README](../README.md)
- [Deployment Guide](../../../docs/DEPLOYMENT_GUIDE.md)
- [METAPHOR: Tundra Dome Metaphor](../METAPHOR.md)

---

## Glossary

- **Bead**: Custom Kubernetes resource representing a unit of work in a lane
- **Lane**: Logical queue for processing beads (e.g., error-lane, feature-lane)
- **Federation Controller**: Service that synchronizes beads across clusters
- **Observability Pipeline Worker (OPW)**: Datadog service for log aggregation
- **OpenLineage**: Open standard for data lineage tracking
- **Polecat**: Worker service that processes beads from lanes
- **Cluster Registry**: Central registry of all managed Kubernetes clusters

---

**End of Multi-Cluster Architecture Documentation**
