# AGENT-AB: Container and Kubernetes Optimization Architecture

**Agent**: AB - Container & Kubernetes Optimization
**Date**: 2026-01-05
**Status**: Design Phase - Containerization & Cloud-Native Strategy

## Executive Summary

This document outlines the comprehensive strategy for transforming VibeCode from a VM-based deployment (vfkit/QEMU) to a cloud-native, container-based architecture with full Kubernetes support. The transformation enables multi-cloud deployment, horizontal scaling, and enterprise-grade orchestration.

### Current State
- VM-based deployment using vfkit/QEMU
- Single-node monolithic system
- 47MB+ initramfs footprint
- Limited scalability
- No Kubernetes support

### Target State
- Container-first architecture
- Microservices separation (4 core services)
- <100MB per container image
- Multi-cloud Kubernetes deployment
- Enterprise scaling and resilience
- Production-grade observability

## Architecture Overview

### 4 Core Services

The VibeCode unified services are containerized as:

1. **VibeCode WebGUI** - Main application server (Node.js/Next.js)
   - REST API endpoints
   - WebSocket support
   - RAG/AI integration
   - Authentication & session management

2. **PostgreSQL with pgvector** - Vector database
   - Persistent data storage
   - Vector embeddings
   - Full-text search
   - Datadog integration

3. **Valkey** - In-memory cache & session store
   - Session management
   - Cache layer
   - Real-time data
   - High-speed operations

4. **OpenVSCode Server** - Code editor service (optional)
   - IDE-as-a-service
   - Terminal access
   - Real-time collaboration
   - Extension ecosystem

## Container Strategy

### Image Size Optimization

Target: **<100MB per service**

#### WebGUI Service (~80-95MB)
```
Base: node:24-alpine (170MB)
  ├── Remove dev dependencies (npm ci --only=production)
  ├── Remove cache, build artifacts
  ├── Remove source maps (unless debugging)
  ├── Use multi-stage build pattern
  └── Final: ~90MB

Production optimizations:
  - Alpine Linux base (5MB vs 85MB for debian)
  - Standalone Next.js build (npm run build)
  - Node modules pruning
  - Non-root user execution
```

#### PostgreSQL Service (~100-200MB)
```
Base: pgvector/pgvector:pg16-alpine (~200MB)
  ├── Use alpine variant
  ├── Initialize with custom schema
  ├── Datadog agent sidecar
  └── Health check configuration

Note: pgvector requires full PostgreSQL, minimal optimization possible
```

#### Valkey Service (~50-70MB)
```
Base: valkey:alpine (~50MB)
  ├── Custom configuration
  ├── Persistence setup
  ├── Memory limits
  └── Health monitoring
```

#### OpenVSCode Server (~150-200MB)
```
Base: codercom/code-server:latest
  ├── Lightweight runtime
  ├── Essential extensions only
  ├── No unnecessary dependencies
  └── Memory-limited execution
```

### Multi-Stage Build Pattern

Example structure for Node.js service:

```dockerfile
# Stage 1: Dependencies
FROM node:24-alpine AS deps
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Stage 2: Build
FROM node:24-alpine AS builder
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Runtime
FROM node:24-alpine AS production
COPY --from=builder /app/.next ./
COPY --from=deps /app/node_modules ./node_modules
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs
USER nodejs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s CMD node healthcheck.js
CMD ["node", "server.js"]
```

## Kubernetes Architecture

### Deployment Model

```
Kubernetes Cluster
├── Namespace: vibecode (production)
├── Namespace: vibecode-staging (staging)
├── Namespace: vibecode-dev (development)
│
├── Deployments (Stateless)
│   ├── vibecode-app (3-5 replicas)
│   └── openvscode-server (optional, 1-2 replicas)
│
├── StatefulSets (Stateful)
│   ├── postgres (1 replica + persistent storage)
│   └── valkey (1 replica + persistent storage)
│
├── Services
│   ├── ClusterIP (internal)
│   │   ├── postgres-svc (port 5432)
│   │   ├── valkey-svc (port 6379)
│   │   └── vibecode-app-svc (port 3000)
│   └── LoadBalancer (external)
│       └── vibecode-ingress-lb
│
├── ConfigMaps
│   ├── vibecode-config (app config)
│   ├── postgres-init (SQL init scripts)
│   └── nginx-config (reverse proxy)
│
├── Secrets
│   ├── postgres-credentials
│   ├── valkey-credentials
│   ├── api-keys
│   └── tls-certificates
│
├── PersistentVolumeClaims
│   ├── postgres-data (100GB)
│   ├── valkey-data (20GB)
│   └── uploads (50GB)
│
├── HorizontalPodAutoscaler
│   └── vibecode-app-hpa (2-10 replicas, 70% CPU)
│
├── PodDisruptionBudgets
│   ├── vibecode-app-pdb (minAvailable: 1)
│   └── postgres-pdb (maxUnavailable: 0)
│
└── Ingress
    ├── vibecode-ingress (NGINX)
    ├── TLS termination
    └── Host-based routing
```

### High-Availability Design

```
Load Balancer
    ↓
Ingress Controller (NGINX)
    ↓
Service (ClusterIP)
    ↓
┌─────────────────────────────────────┐
│   VibeCode Deployment (3 replicas)  │
├──────────┬──────────┬──────────────┤
│ Pod 1    │ Pod 2    │ Pod 3        │
│ Running  │ Running  │ Running      │
├──────────┼──────────┼──────────────┤
│ App      │ App      │ App          │
│ Health✓  │ Health✓  │ Health✓      │
└──────────┴──────────┴──────────────┘
    │           │           │
    └───────────┴───────────┘
            ↓
    Service Registry
    (DNS: app.default.svc.cluster.local)

Each Pod:
  - Liveness probe (TCP/HTTP every 30s)
  - Readiness probe (HTTP /health every 10s)
  - Startup probe (optional, 5 attempts)
  - Resource limits (CPU: 500m, Memory: 512Mi)
  - Resource requests (CPU: 250m, Memory: 256Mi)
```

## Cloud-Native Features

### 1. Health Checks (3-Tier)

```yaml
livenessProbe:
  httpGet:
    path: /api/health/live
    port: 3000
    scheme: HTTP
  initialDelaySeconds: 30
  periodSeconds: 30
  timeoutSeconds: 5
  successThreshold: 1
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /api/health/ready
    port: 3000
    scheme: HTTP
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  successThreshold: 1
  failureThreshold: 2

startupProbe:
  httpGet:
    path: /api/health/startup
    port: 3000
    scheme: HTTP
  initialDelaySeconds: 0
  periodSeconds: 10
  timeoutSeconds: 5
  successThreshold: 1
  failureThreshold: 30
```

### 2. Resource Management

```yaml
# Pod resource requests and limits
resources:
  requests:
    cpu: "250m"           # Guaranteed minimum
    memory: "256Mi"       # Guaranteed minimum
  limits:
    cpu: "1000m"          # Maximum usage allowed
    memory: "1Gi"         # Maximum memory allowed

# HPA configuration
autoscaling:
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80
```

### 3. Pod Disruption Budgets

```yaml
# VibeCode App PDB (allow 1 disruption)
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: vibecode-app-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: vibecode-app

# PostgreSQL PDB (no disruptions during maintenance)
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: postgres-pdb
spec:
  maxUnavailable: 0
  selector:
    matchLabels:
      app: postgres
```

### 4. Network Policies

```yaml
# Allow ingress from nginx controller only
kind: NetworkPolicy
metadata:
  name: vibecode-network-policy
spec:
  podSelector:
    matchLabels:
      app: vibecode-app
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: valkey
    ports:
    - protocol: TCP
      port: 6379
```

### 5. Service Mesh Integration (Istio)

```yaml
# VirtualService for traffic management
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: vibecode-app
spec:
  hosts:
  - vibecode-app.default.svc.cluster.local
  http:
  - match:
    - headers:
        x-user-type:
          exact: "premium"
    route:
    - destination:
        host: vibecode-app.default.svc.cluster.local
        port:
          number: 3000
      weight: 100
    timeout: 30s
    retries:
      attempts: 3
      perTryTimeout: 10s

# DestinationRule for load balancing
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: vibecode-app
spec:
  host: vibecode-app.default.svc.cluster.local
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 100
        h2UpgradePolicy: UPGRADE
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
```

### 6. GitOps Workflow (ArgoCD)

```yaml
# ArgoCD Application manifest
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: vibecode-app
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/vibecode/vibecode-webgui
    targetRevision: HEAD
    path: helm/unified-services
    helm:
      releaseName: vibecode
      values: |
        image:
          repository: ghcr.io/vibecode/webgui
          tag: v1.0.0
        replicas: 3
  destination:
    server: https://kubernetes.default.svc
    namespace: vibecode
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
```

## Storage Architecture

### StatefulSet Pattern for PostgreSQL

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres
  replicas: 1
  volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      storageClassName: "fast-ssd"
      resources:
        requests:
          storage: 100Gi
  template:
    spec:
      containers:
      - name: postgres
        image: pgvector/pgvector:pg16-alpine
        ports:
        - containerPort: 5432
          name: postgres
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
        livenessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - pg_isready -U $POSTGRES_USER
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - pg_isready -U $POSTGRES_USER
          initialDelaySeconds: 5
          periodSeconds: 10
```

### Backup Strategy (Velero)

```yaml
# Velero backup schedule
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: vibecode-daily-backup
  namespace: velero
spec:
  schedule: "0 2 * * *"  # 2 AM UTC daily
  template:
    includedNamespaces:
    - vibecode
    ttl: 720h  # 30 days retention
    storageLocation: aws-s3
    volumeSnapshotLocations:
    - aws-ebs
    hooks:
      resources:
      - name: postgres-backup
        includedNamespaces:
        - vibecode
        includedResources:
        - statefulsets
        pre:
        - exec:
            container: postgres
            command: ["/bin/sh", "-c", "pg_dump -U $POSTGRES_USER > /backup/dump.sql"]
```

## Multi-Cloud Deployment

### EKS (AWS)

```bash
# Create cluster
eksctl create cluster \
  --name vibecode-prod \
  --region us-east-1 \
  --nodes 3 \
  --node-type t3.xlarge

# Add storage class
kubectl apply -f - <<EOF
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: ebs-gp3
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
EOF
```

### AKS (Azure)

```bash
# Create cluster
az aks create \
  --resource-group vibecode \
  --name vibecode-prod \
  --node-count 3 \
  --vm-set-type VirtualMachineScaleSets \
  --zones 1 2 3

# Add managed identity for key vault
az aks identity assign \
  --resource-group vibecode \
  --name vibecode-prod \
  --role "Key Vault Secrets Officer"
```

### GKE (Google Cloud)

```bash
# Create cluster
gcloud container clusters create vibecode-prod \
  --region us-central1 \
  --num-nodes 3 \
  --machine-type e2-standard-4 \
  --enable-autoscaling \
  --min-nodes 2 \
  --max-nodes 10
```

### On-Premises (k3s)

```bash
# Install k3s master
curl -sfL https://get.k3s.io | sh -

# Join agents
curl -sfL https://get.k3s.io | K3S_URL=https://master-ip:6443 \
  K3S_TOKEN=<token> sh -

# Use local storage
kubectl apply -f - <<EOF
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: local-path
provisioner: rancher.io/local-path
EOF
```

## Helm Chart Structure

```
helm/unified-services/
├── Chart.yaml                 # Chart metadata
├── values.yaml               # Default values
├── values-dev.yaml           # Development overrides
├── values-prod.yaml          # Production overrides
│
├── charts/                   # Sub-charts
│   ├── vibecode-app/
│   │   ├── Chart.yaml
│   │   ├── templates/
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   ├── hpa.yaml
│   │   │   ├── pdb.yaml
│   │   │   ├── ingress.yaml
│   │   │   └── configmap.yaml
│   │   └── values.yaml
│   │
│   ├── postgres/
│   │   ├── Chart.yaml
│   │   ├── templates/
│   │   │   ├── statefulset.yaml
│   │   │   ├── service.yaml
│   │   │   ├── pvc.yaml
│   │   │   ├── configmap.yaml
│   │   │   └── secret.yaml
│   │   └── values.yaml
│   │
│   ├── valkey/
│   │   ├── Chart.yaml
│   │   ├── templates/
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   └── configmap.yaml
│   │   └── values.yaml
│   │
│   └── openvscode/
│       ├── Chart.yaml
│       ├── templates/
│       │   ├── deployment.yaml
│       │   ├── service.yaml
│       │   └── ingress.yaml
│       └── values.yaml
│
├── templates/
│   ├── namespace.yaml
│   ├── rbac.yaml
│   ├── network-policy.yaml
│   ├── ingress.yaml
│   └── monitoring.yaml
│
└── README.md
```

## CI/CD Pipeline

### Docker Image Building

```yaml
name: Build and Push Images
on:
  push:
    branches: [ main ]
    paths:
      - 'src/**'
      - 'Dockerfile*'
      - '.github/workflows/**'

jobs:
  build-webgui:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/webgui:latest
            ghcr.io/${{ github.repository }}/webgui:v${{ github.run_number }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Kubernetes Deployment

```yaml
name: Deploy to Kubernetes
on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure kubectl
        run: |
          mkdir -p $HOME/.kube
          echo "${{ secrets.KUBECONFIG }}" | base64 -d > $HOME/.kube/config

      - name: Helm Deploy
        run: |
          helm repo add vibecode https://charts.vibecode.io
          helm repo update
          helm upgrade --install vibecode vibecode/unified-services \
            --namespace vibecode \
            --values helm/unified-services/values-prod.yaml \
            --version ${{ github.run_number }}
```

## Performance Metrics

### Container Startup Times (Target)
- WebGUI: <3 seconds
- PostgreSQL: <5 seconds
- Valkey: <1 second
- OpenVSCode: <5 seconds

### Resource Utilization
- WebGUI: 250m CPU / 256Mi RAM request, 1 CPU / 1Gi limit
- PostgreSQL: 500m CPU / 512Mi RAM request, 2 CPU / 4Gi limit
- Valkey: 100m CPU / 128Mi RAM request, 500m CPU / 512Mi limit
- OpenVSCode: 250m CPU / 512Mi RAM request, 1 CPU / 2Gi limit

### Network Performance
- API latency: <100ms p95
- Database query latency: <10ms p95
- Cache hit ratio: >90%

## Security Posture

### Image Security
- Minimal base images (Alpine)
- Non-root user execution
- No secret embedding in images
- Regular vulnerability scanning
- Signed container images (Cosign)

### Runtime Security
- Network policies (ingress/egress)
- RBAC (Role-Based Access Control)
- Pod Security Standards
- Secrets management (Sealed Secrets / Vault)
- Encrypted inter-pod communication (mTLS via Istio)

### Supply Chain Security
- SBOM generation (Syft)
- Build attestations (Sigstore)
- Provenance tracking
- Dependency scanning

## Success Criteria

1. **Containers**
   - All services containerized
   - Images <100MB (except PostgreSQL/OpenVSCode)
   - Multi-stage builds implemented
   - Published to GHCR/Docker Hub

2. **Kubernetes**
   - All services deployable on K8s
   - Health checks configured
   - Auto-scaling functional
   - Persistent data management

3. **Helm**
   - Unified chart for all services
   - Configurable deployments
   - Version control
   - Published to Helm repository

4. **Cloud-Native Features**
   - Horizontal scaling tested
   - Multi-cloud deployments validated
   - Monitoring/observability active
   - GitOps workflow functional

5. **Documentation**
   - Complete deployment guides
   - Quick-start instructions
   - Troubleshooting guides
   - Best practices documented

## Implementation Timeline

| Phase | Tasks | Duration |
|-------|-------|----------|
| 1 | Containerization (Dockerfiles) | 1-2 days |
| 2 | Docker Compose setup | 1 day |
| 3 | K8s manifests | 2-3 days |
| 4 | Helm charts | 2-3 days |
| 5 | Documentation | 1-2 days |
| 6 | Testing & validation | 2-3 days |
| 7 | CI/CD pipeline | 1-2 days |

**Total: 10-16 days**

## References

- [Kubernetes Best Practices](https://kubernetes.io/docs/)
- [Helm Documentation](https://helm.sh/docs/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Istio Service Mesh](https://istio.io/latest/docs/)
- [Velero Backup & Restore](https://velero.io/docs/)
- [ArgoCD GitOps](https://argo-cd.readthedocs.io/)

---

**Next Steps**:
1. Create optimized Dockerfiles for each service
2. Set up docker-compose for local development
3. Build Kubernetes manifests
4. Develop Helm charts
5. Document deployment procedures
