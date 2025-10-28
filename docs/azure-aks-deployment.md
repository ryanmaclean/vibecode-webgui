# Azure AKS Deployment Guide

Complete guide for deploying VibeCode WebGUI to Azure Kubernetes Service (AKS) with production-grade configuration, monitoring, and security.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Infrastructure Setup](#infrastructure-setup)
- [Application Deployment](#application-deployment)
- [Configuration](#configuration)
- [Monitoring & Observability](#monitoring--observability)
- [Security](#security)
- [Operations](#operations)
- [Troubleshooting](#troubleshooting)
- [Cost Optimization](#cost-optimization)

## Prerequisites

### Required Tools

```bash
# Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl && sudo mv kubectl /usr/local/bin/

# Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Terraform (optional, for infrastructure automation)
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform
```

### Azure Setup

1. **Azure Subscription**: Active Azure subscription with sufficient quotas
2. **Service Principal**: For Terraform automation (optional)
3. **Resource Quotas**: Verify quotas for VMs, storage, and networking
4. **Permissions**: Contributor access to subscription or resource group

### Environment Variables

Create `.env.azure` file:

```bash
# Azure Configuration
RESOURCE_GROUP=vibecode-rg
CLUSTER_NAME=vibecode-aks
ACR_NAME=vibecodecr
LOCATION=eastus

# Database Configuration
POSTGRES_PASSWORD=your_secure_postgres_password_here
DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgresql:5432/vibecode

# Authentication
NEXTAUTH_SECRET=your_nextauth_secret_here
NEXTAUTH_URL=https://vibecode.eastus.cloudapp.azure.com

# AI Services
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Datadog Configuration
DD_API_KEY=your_datadog_api_key_here
DD_APP_KEY=your_datadog_app_key_here
DD_SITE=datadoghq.com

# Application Configuration
NODE_ENV=production
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=secure_admin_password
```

## Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/vibecode/webgui.git
cd vibecode-webgui
cp .env.azure.example .env.azure
# Edit .env.azure with your values
```

### 2. Azure Login

```bash
az login
az account set --subscription "your-subscription-id"
```

### 3. Deploy Infrastructure (Option A: Terraform)

```bash
cd infrastructure/terraform/aks
terraform init
terraform plan -var-file="production.tfvars"
terraform apply -var-file="production.tfvars"
```

### 4. Deploy Infrastructure (Option B: Azure CLI)

```bash
# Create resource group
az group create --name vibecode-rg --location eastus

# Create AKS cluster
az aks create \
  --resource-group vibecode-rg \
  --name vibecode-aks \
  --node-count 3 \
  --enable-addons monitoring \
  --enable-managed-identity \
  --generate-ssh-keys \
  --kubernetes-version 1.28 \
  --network-plugin azure \
  --network-policy azure

# Create ACR
az acr create --resource-group vibecode-rg --name vibecodecr --sku Premium
az aks update --resource-group vibecode-rg --name vibecode-aks --attach-acr vibecodecr
```

### 5. Bootstrap Application

```bash
# Get AKS credentials
az aks get-credentials --resource-group vibecode-rg --name vibecode-aks

# Run bootstrap script
./scripts/aks-bootstrap.sh
```

## Infrastructure Setup

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Azure Subscription                          │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│ │   Resource      │ │    Key Vault    │ │       ACR       │    │
│ │     Group       │ │   (Secrets)     │ │  (Container     │    │
│ │                 │ │                 │ │   Registry)     │    │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│                        Virtual Network                          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                    AKS Cluster                              │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │ │
│ │ │   System    │ │ Application │ │      Database           │ │ │
│ │ │ Node Pool   │ │ Node Pool   │ │    Node Pool            │ │ │
│ │ │             │ │             │ │   (Optional)            │ │ │
│ │ └─────────────┘ └─────────────┘ └─────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│ │  Log Analytics  │ │ Application     │ │    Storage      │    │
│ │   Workspace     │ │   Insights      │ │   Account       │    │
│ │  (Monitoring)   │ │     (APM)       │ │   (Backups)     │    │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Node Pool Configuration

#### System Node Pool
- **Purpose**: Kubernetes system workloads
- **VM Size**: Standard_D4s_v3 (4 vCPU, 16 GB RAM)
- **Count**: 3-6 nodes (auto-scaling)
- **Taints**: `CriticalAddonsOnly=true:NoSchedule`

#### Application Node Pool
- **Purpose**: Application workloads
- **VM Size**: Standard_D4s_v3 (4 vCPU, 16 GB RAM)
- **Count**: 3-10 nodes (auto-scaling)
- **Labels**: `nodepool-type=application`

#### Database Node Pool (Optional)
- **Purpose**: Database workloads
- **VM Size**: Standard_D8s_v3 (8 vCPU, 32 GB RAM)
- **Count**: 2-4 nodes (auto-scaling)
- **Taints**: `database=true:NoSchedule`
- **Storage**: Premium SSD

### Storage Classes

```yaml
# Premium SSD for databases
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: managed-csi-premium
provisioner: disk.csi.azure.com
parameters:
  skuName: Premium_LRS
  cachingmode: ReadOnly
  kind: Managed
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true

# Azure Files for shared storage
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: azurefile-csi-premium
provisioner: file.csi.azure.com
parameters:
  skuName: Premium_LRS
reclaimPolicy: Delete
volumeBindingMode: Immediate
allowVolumeExpansion: true
```

## Application Deployment

### 1. Build and Push Images

```bash
# Build production image
docker build -f Dockerfile.production -t vibecodecr.azurecr.io/vibecode-webgui:latest .

# Push to ACR
az acr login --name vibecodecr
docker push vibecodecr.azurecr.io/vibecode-webgui:latest
```

### 2. Deploy PostgreSQL with pgvector

```bash
# Deploy PostgreSQL StatefulSet
kubectl apply -f k8s/postgresql-aks-statefulset.yaml

# Wait for readiness
kubectl -n vibecode-platform wait --for=condition=Ready pod -l app=postgresql --timeout=300s

# Verify pgvector extension
kubectl -n vibecode-platform exec postgresql-0 -- psql -U postgres -d vibecode -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"
```

### 3. Deploy Application

```bash
# Create secrets in Key Vault (recommended)
az keyvault secret set --vault-name vibecode-kv --name "DATABASE-URL" --value "$DATABASE_URL"
az keyvault secret set --vault-name vibecode-kv --name "NEXTAUTH-SECRET" --value "$NEXTAUTH_SECRET"
az keyvault secret set --vault-name vibecode-kv --name "OPENROUTER-API-KEY" --value "$OPENROUTER_API_KEY"

# Deploy using Helm
helm upgrade --install vibecode-app ./charts/vibecode \
  --namespace vibecode-platform \
  --values charts/vibecode/values-aks.yaml \
  --set image.repository="vibecodecr.azurecr.io/vibecode-webgui" \
  --set image.tag="latest" \
  --set ingress.hostname="vibecode.eastus.cloudapp.azure.com"
```

### 4. Configure Ingress and DNS

```bash
# Get external IP
kubectl -n vibecode-platform get service vibecode-app

# Configure DNS (example for Azure DNS)
az network dns record-set a add-record \
  --resource-group dns-rg \
  --zone-name yourdomain.com \
  --record-set-name vibecode \
  --ipv4-address <EXTERNAL-IP>
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `NEXTAUTH_SECRET` | NextAuth.js secret key | Yes |
| `NEXTAUTH_URL` | Application URL | Yes |
| `DD_API_KEY` | Datadog API key | Yes |
| `DD_APP_KEY` | Datadog application key | No |
| `DD_LLMOBS_ENABLED` | Turns on Datadog LLM Observability auto-tracing | Yes |
| `DD_LLMOBS_AGENTLESS_ENABLED` | Sends LLM spans directly to Datadog intake (set to `1` when no agent) | No |
| `DD_LLMOBS_PROJECT` | Project name used for LLM Observability in Datadog | Yes |
| `DD_LLMOBS_ML_APP` | (Legacy) ML application tag kept for backward compatibility | No |
| `OPENROUTER_API_KEY` | OpenRouter API key | Yes |
| `NODE_ENV` | Environment (production) | Yes |

### Helm Values

Key configuration options in `charts/vibecode/values-aks.yaml`:

```yaml
# Resource allocation
resources:
  limits:
    cpu: 2000m
    memory: 4Gi
  requests:
    cpu: 500m
    memory: 1Gi

# Auto-scaling
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

# Storage
persistence:
  enabled: true
  storageClass: "managed-csi"
  size: 50Gi

# Security
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
```

## Monitoring & Observability

### Datadog Integration

1. **Install Datadog Agent**:
```bash
helm repo add datadog https://helm.datadoghq.com
helm upgrade --install datadog-agent datadog/datadog \
  --namespace datadog \
  --values k8s/datadog-values-aks.yaml \
  --set datadog.apiKey="$DD_API_KEY"
# For staging clusters replace the values file with k8s/datadog-values-aks-staging.yaml
```

2. **Enable Dynamic Instrumentation**:
- Source maps are automatically included in production builds
- Set `DD_DYNAMIC_INSTRUMENTATION_ENABLED=true`
- Configure redaction rules in Datadog UI

3. **Enable LLM Observability**:
- Terraform/Helm set `DD_LLMOBS_ENABLED=1`, `DD_LLMOBS_AGENTLESS_ENABLED=1`, and `DD_LLMOBS_PROJECT=vibecode-code-server-ai-cli` on every application pod. Export `DD_LLMOBS_ML_APP` only if older services still depend on it.
- Check pod logs for `Datadog LLM Observability enabled for OpenAI spans` to confirm tracer registration.
- Run `/api/ai/chat` (or trigger an AI workflow) and verify `llm.workflow.*` spans within Datadog APM under `vibecode-webgui-openai`.

4. **Key Metrics**:
- Application performance (latency, throughput)
- Infrastructure metrics (CPU, memory, disk)
- Custom business metrics
- Error rates and traces

### Log Aggregation

```yaml
# Application logging configuration
logging:
  level: info
  format: json
  outputs:
    - stdout
    - /app/logs/application.log
```

### Health Checks

```yaml
# Kubernetes health probes
livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 60
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
```

## Security

### Network Security

1. **Network Policies**:
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: vibecode-network-policy
spec:
  podSelector:
    matchLabels:
      app: vibecode
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              name: vibecode-platform
```

2. **Pod Security Standards**:
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: vibecode-platform
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### Secret Management

1. **Azure Key Vault Integration**:
```yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: vibecode-keyvault-secrets
spec:
  provider: azure
  parameters:
    keyvaultName: vibecode-kv
    objects: |
      array:
        - |
          objectName: DATABASE-URL
          objectType: secret
        - |
          objectName: NEXTAUTH-SECRET
          objectType: secret
```

2. **Workload Identity**:
```bash
# Enable workload identity
az aks update --resource-group vibecode-rg --name vibecode-aks --enable-workload-identity --enable-oidc-issuer

# Create managed identity
az identity create --name vibecode-workload-identity --resource-group vibecode-rg

# Create service account
kubectl create serviceaccount vibecode-app --namespace vibecode-platform
kubectl annotate serviceaccount vibecode-app --namespace vibecode-platform azure.workload.identity/client-id="$CLIENT_ID"
```

## Operations

### Backup and Restore

1. **PostgreSQL Backup**:
```bash
# Create backup job
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: postgres-backup
            image: postgres:16-alpine
            command:
            - /bin/bash
            - -c
            - |
              pg_dump $DATABASE_URL | gzip > /backup/backup-$(date +%Y%m%d-%H%M%S).sql.gz
              az storage blob upload --file /backup/backup-$(date +%Y%m%d-%H%M%S).sql.gz --container-name backups --name postgres/backup-$(date +%Y%m%d-%H%M%S).sql.gz
```

2. **Application Data Backup**:
```bash
# Backup persistent volumes
kubectl create -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: backup-pod
spec:
  containers:
  - name: backup
    image: alpine:latest
    command: ["tar", "czf", "/backup/uploads-$(date +%Y%m%d).tar.gz", "/data"]
    volumeMounts:
    - name: uploads
      mountPath: /data
    - name: backup
      mountPath: /backup
  volumes:
  - name: uploads
    persistentVolumeClaim:
      claimName: vibecode-app-uploads
  - name: backup
    azureFile:
      secretName: azure-file-secret
      shareName: backups
EOF
```

### Scaling

1. **Horizontal Pod Autoscaler**:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: vibecode-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: vibecode-app
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

2. **Vertical Pod Autoscaler** (optional):
```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: vibecode-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: vibecode-app
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: vibecode
      maxAllowed:
        cpu: 4000m
        memory: 8Gi
      minAllowed:
        cpu: 200m
        memory: 256Mi
```

### Rolling Updates

```bash
# Update application
helm upgrade vibecode-app ./charts/vibecode \
  --namespace vibecode-platform \
  --values charts/vibecode/values-aks.yaml \
  --set image.tag="v1.1.0"

# Monitor rollout
kubectl -n vibecode-platform rollout status deployment/vibecode-app

# Rollback if needed
kubectl -n vibecode-platform rollout undo deployment/vibecode-app
```

## Troubleshooting

### Common Issues

1. **Pod Startup Issues**:
```bash
# Check pod status
kubectl -n vibecode-platform get pods

# View pod logs
kubectl -n vibecode-platform logs -f deployment/vibecode-app

# Describe pod for events
kubectl -n vibecode-platform describe pod <pod-name>
```

2. **Database Connection Issues**:
```bash
# Test database connectivity
kubectl -n vibecode-platform run -it --rm debug --image=postgres:16-alpine --restart=Never -- psql "$DATABASE_URL"

# Check PostgreSQL logs
kubectl -n vibecode-platform logs -f postgresql-0

# Verify pgvector extension
kubectl -n vibecode-platform exec postgresql-0 -- psql -U postgres -d vibecode -c "SELECT extname FROM pg_extension;"
```

3. **Ingress/DNS Issues**:
```bash
# Check ingress status
kubectl -n vibecode-platform get ingress

# Test internal service
kubectl -n vibecode-platform port-forward svc/vibecode-app 3000:80

# Check external DNS resolution
nslookup vibecode.eastus.cloudapp.azure.com
```

4. **Resource Issues**:
```bash
# Check resource usage
kubectl top nodes
kubectl top pods -n vibecode-platform

# Check resource quotas
kubectl -n vibecode-platform describe quota

# Check persistent volume status
kubectl -n vibecode-platform get pv,pvc
```

### Debugging Commands

```bash
# Get cluster info
kubectl cluster-info

# Check node status
kubectl get nodes -o wide

# View all resources in namespace
kubectl -n vibecode-platform get all

# Check events
kubectl -n vibecode-platform get events --sort-by='.lastTimestamp'

# Access pod shell
kubectl -n vibecode-platform exec -it <pod-name> -- /bin/bash

# Port forward for local debugging
kubectl -n vibecode-platform port-forward deployment/vibecode-app 3000:3000
```

## Cost Optimization

### Resource Right-Sizing

1. **Monitor Resource Usage**:
```bash
# Install metrics server (if not present)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Check resource utilization
kubectl top nodes
kubectl top pods --all-namespaces --sort-by=cpu
kubectl top pods --all-namespaces --sort-by=memory
```

2. **Optimize Node Pools**:
- Use spot instances for non-critical workloads
- Right-size VM types based on actual usage
- Enable cluster autoscaler
- Use reserved instances for predictable workloads

3. **Storage Optimization**:
- Use appropriate storage classes (Standard vs Premium)
- Enable storage autoscaling
- Implement lifecycle policies for backups
- Monitor storage usage and clean up unused volumes

### Cost Monitoring

```bash
# Azure Cost Management
az consumption usage list --start-date 2024-01-01 --end-date 2024-01-31

# Resource tagging for cost allocation
az resource tag --tags Environment=production Project=vibecode --ids <resource-id>
```

### Estimated Monthly Costs

| Component | Configuration | Estimated Cost |
|-----------|---------------|----------------|
| AKS Cluster Management | Managed service | Free |
| System Node Pool | 3x Standard_D4s_v3 | $450/month |
| Application Node Pool | 3-10x Standard_D4s_v3 | $450-1500/month |
| Database Node Pool | 2x Standard_D8s_v3 | $600/month |
| Azure Container Registry | Premium | $500/month |
| Log Analytics | 5GB/day | $10/month |
| Storage | 500GB Premium | $75/month |
| **Total Estimate** | | **$2,085-2,635/month** |

*Note: Costs vary by region and actual usage. Use Azure Pricing Calculator for accurate estimates.*

## Next Steps

1. **Production Readiness**:
   - [ ] Configure SSL certificates (cert-manager)
   - [ ] Set up monitoring alerts
   - [ ] Implement backup testing
   - [ ] Configure disaster recovery

2. **Security Hardening**:
   - [ ] Enable Azure Defender for containers
   - [ ] Implement network segmentation
   - [ ] Set up vulnerability scanning
   - [ ] Configure compliance monitoring

3. **Performance Optimization**:
   - [ ] Implement caching strategies
   - [ ] Optimize database queries
   - [ ] Configure CDN
   - [ ] Set up performance testing

4. **Operational Excellence**:
   - [ ] Automate deployments (GitOps)
   - [ ] Implement chaos engineering
   - [ ] Set up runbooks
   - [ ] Train operations team

For additional support and advanced configurations, refer to the [Azure AKS documentation](https://docs.microsoft.com/en-us/azure/aks/) and [Kubernetes documentation](https://kubernetes.io/docs/).
