# AGENT-AB: Kubernetes Deployment Guide

**Agent**: AB - Container & Kubernetes Optimization
**Document**: Complete Kubernetes Deployment for VibeCode
**Date**: 2026-01-05

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Cluster Setup](#cluster-setup)
3. [Image Registry Setup](#image-registry-setup)
4. [Deploying VibeCode](#deploying-vibecode)
5. [Verification & Monitoring](#verification--monitoring)
6. [Scaling & Management](#scaling--management)
7. [Production Hardening](#production-hardening)
8. [Troubleshooting](#troubleshooting)
9. [Multi-Cloud Deployment](#multi-cloud-deployment)

---

## Prerequisites

### Required Tools

```bash
# Kubernetes client
kubectl (v1.24+)

# Helm (package manager for Kubernetes)
helm (v3.10+)

# Container tools
docker (v20.10+)
buildx (for multi-platform builds)

# Optional but recommended
kubectx      # Easy cluster switching
kubens       # Easy namespace switching
krew         # kubectl plugin manager
k9s          # Kubernetes dashboard
lens         # IDE for Kubernetes
```

### Installation

```bash
# macOS
brew install kubectl helm docker
brew tap FairwindsOps/tap
brew install kubectx
brew install kubens
brew install krew

# Linux
sudo apt-get install -y kubectl helm docker.io
sudo usermod -aG docker $USER
newgrp docker

# kubectl plugins
kubectl krew install ctx
kubectl krew install ns
```

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 4 cores | 8 cores |
| Memory | 8 GB | 16 GB |
| Disk | 50 GB | 100 GB |
| Network | 10 Mbps | 100 Mbps |

---

## Cluster Setup

### Option 1: Local Development (KIND - Kubernetes in Docker)

```bash
# Install KIND
brew install kind

# Create cluster with ingress support
cat > kind-config.yaml << 'EOF'
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: vibecode
nodes:
- role: control-plane
  ports:
  - containerPort: 80
    hostPort: 80
  - containerPort: 443
    hostPort: 443
  extraPortMappings:
  - containerPort: 5432
    hostPort: 5432
  - containerPort: 6379
    hostPort: 6379
- role: worker
- role: worker

kubeadmConfigPatches:
- |
  kind: InitConfiguration
  nodeRegistration:
    kubeletExtraArgs:
      node-labels: "ingress-ready=true"

containerdConfigPatches:
- |-
  [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc]
    runtime_engine = ""
    runtime_root = ""
    privileged_without_host_devices = false
    base_runtime_spec = ""
    privileged_without_host_devices_cgroup_policy = ""
EOF

# Create cluster
kind create cluster --config kind-config.yaml

# Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# Wait for ingress to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s
```

### Option 2: Cloud-Hosted (EKS, AKS, GKE)

#### EKS (AWS)

```bash
# Install eksctl
brew install eksctl

# Create EKS cluster
eksctl create cluster \
  --name vibecode-prod \
  --version 1.28 \
  --region us-east-1 \
  --nodegroup-name standard-workers \
  --node-type t3.xlarge \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 10 \
  --managed \
  --with-oidc \
  --enable-ssm

# Configure kubectl
aws eks update-kubeconfig \
  --region us-east-1 \
  --name vibecode-prod

# Install EBS CSI Driver for persistent volumes
eksctl utils associate-iam-oidc-provider \
  --region us-east-1 \
  --cluster vibecode-prod \
  --approve

eksctl create addon \
  --name aws-ebs-csi-driver \
  --cluster vibecode-prod
```

#### AKS (Azure)

```bash
# Install Azure CLI
brew install azure-cli

# Login
az login

# Create resource group
az group create \
  --name vibecode \
  --location eastus

# Create AKS cluster
az aks create \
  --resource-group vibecode \
  --name vibecode-prod \
  --node-count 3 \
  --vm-set-type VirtualMachineScaleSets \
  --zones 1 2 3 \
  --enable-managed-identity \
  --generate-ssh-keys

# Get credentials
az aks get-credentials \
  --resource-group vibecode \
  --name vibecode-prod
```

#### GKE (Google Cloud)

```bash
# Install gcloud CLI
brew install --cask google-cloud-sdk

# Initialize
gcloud init

# Create GKE cluster
gcloud container clusters create vibecode-prod \
  --region us-central1 \
  --num-nodes 3 \
  --machine-type e2-standard-4 \
  --enable-autoscaling \
  --min-nodes 2 \
  --max-nodes 10 \
  --enable-ip-alias

# Get credentials
gcloud container clusters get-credentials vibecode-prod \
  --region us-central1
```

---

## Image Registry Setup

### GitHub Container Registry (GHCR)

```bash
# Create personal access token at https://github.com/settings/tokens
# Scopes: write:packages, read:packages

# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io \
  -u <github-username> \
  --password-stdin

# Build and push image
docker build -t ghcr.io/vibecode/webgui:latest .
docker push ghcr.io/vibecode/webgui:latest

# Create secret for Kubernetes
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=<github-username> \
  --docker-password=$GITHUB_TOKEN \
  --docker-email=<email> \
  -n vibecode
```

### Docker Hub

```bash
# Build and push image
docker build -t vibecode/webgui:latest .
docker tag vibecode/webgui:latest vibecode/webgui:v1.0.0
docker push vibecode/webgui:latest
docker push vibecode/webgui:v1.0.0

# Create secret for Kubernetes
kubectl create secret docker-registry docker-hub-secret \
  --docker-server=docker.io \
  --docker-username=<docker-username> \
  --docker-password=<docker-password> \
  --docker-email=<email> \
  -n vibecode
```

---

## Deploying VibeCode

### Step 1: Create Namespace and Secrets

```bash
# Create namespaces
kubectl apply -f k8s-manifests/namespace.yaml

# Create secrets (update values first!)
kubectl create secret generic vibecode-secrets \
  --from-literal=database.url="postgresql://vibecode:vibecode123@postgres-service:5432/vibecode" \
  --from-literal=redis.url="redis://valkey-service:6379" \
  --from-literal=nextauth.secret="$(openssl rand -hex 32)" \
  --from-literal=jwt.secret="$(openssl rand -hex 32)" \
  -n vibecode

# Create image pull secrets if using private registry
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=<username> \
  --docker-password=<token> \
  -n vibecode
```

### Step 2: Apply Manifests

```bash
# Create storage classes
kubectl apply -f k8s-manifests/storage-class.yaml

# Deploy PostgreSQL
kubectl apply -f k8s-manifests/postgres-statefulset.yaml

# Wait for PostgreSQL
kubectl wait --for=condition=ready pod \
  -l app=postgres \
  -n vibecode \
  --timeout=300s

# Deploy Valkey
kubectl apply -f k8s-manifests/valkey-deployment.yaml

# Wait for Valkey
kubectl wait --for=condition=ready pod \
  -l app=valkey \
  -n vibecode \
  --timeout=60s

# Deploy VibeCode App
kubectl apply -f k8s-manifests/vibecode-app-deployment.yaml

# Wait for VibeCode
kubectl wait --for=condition=ready pod \
  -l app=vibecode-app \
  -n vibecode \
  --timeout=180s
```

### Step 3: Configure Ingress

```bash
# Create ingress resource
kubectl apply -f - << 'EOF'
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: vibecode-ingress
  namespace: vibecode
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - vibecode.example.com
    secretName: vibecode-tls
  rules:
  - host: vibecode.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: vibecode-app-service
            port:
              number: 3000
EOF
```

### Step 4: Deploy with Helm (Recommended for Production)

```bash
# Create values file
cat > values.yaml << 'EOF'
vibecodeApp:
  replicaCount: 3
  image:
    repository: ghcr.io/vibecode/webgui
    tag: latest
  resources:
    requests:
      cpu: 250m
      memory: 256Mi
    limits:
      cpu: 1000m
      memory: 1Gi
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70

postgres:
  enabled: true
  image:
    repository: pgvector/pgvector
    tag: pg16-alpine
  storage:
    size: 100Gi
    storageClassName: fast-ssd

valkey:
  enabled: true
  image:
    repository: valkey
    tag: latest-alpine
  storage:
    size: 20Gi
    storageClassName: standard

ingress:
  enabled: true
  className: nginx
  hosts:
  - host: vibecode.example.com
    paths:
    - path: /
      pathType: Prefix
  tls:
  - secretName: vibecode-tls
    hosts:
    - vibecode.example.com
EOF

# Deploy with Helm
helm repo add vibecode https://charts.vibecode.io
helm repo update
helm install vibecode vibecode/unified-services \
  -f values.yaml \
  -n vibecode
```

---

## Verification & Monitoring

### Verify Deployment Status

```bash
# Check namespace
kubectl get ns | grep vibecode

# Check all resources
kubectl get all -n vibecode

# Check pods
kubectl get pods -n vibecode -o wide

# Check services
kubectl get svc -n vibecode

# Check ingress
kubectl get ingress -n vibecode

# Check persistent volumes
kubectl get pv,pvc -n vibecode

# Check node status
kubectl get nodes -o wide
```

### View Logs

```bash
# Follow app logs
kubectl logs -f deployment/vibecode-app -n vibecode --tail=50

# PostgreSQL logs
kubectl logs -f statefulset/postgres -n vibecode

# Valkey logs
kubectl logs -f deployment/valkey -n vibecode

# Previous logs (if pod crashed)
kubectl logs -p pod/<pod-name> -n vibecode

# Logs from all pods in label selector
kubectl logs -f -l app=vibecode-app -n vibecode --all-containers=true
```

### Access Services

```bash
# Port forward to access locally
kubectl port-forward svc/vibecode-app-service 3000:3000 -n vibecode
# Access at http://localhost:3000

# Port forward database
kubectl port-forward svc/postgres-service 5432:5432 -n vibecode
# Connect with: psql -h localhost -U vibecode -d vibecode

# Port forward cache
kubectl port-forward svc/valkey-service 6379:6379 -n vibecode
# Test with: valkey-cli -h localhost ping

# Access via Ingress (if configured)
curl https://vibecode.example.com
```

### Monitoring & Observability

```bash
# Install Prometheus and Grafana
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  -n vibecode

# Install metrics-server (for HPA)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Check HPA status
kubectl get hpa -n vibecode -o wide
kubectl describe hpa vibecode-app-hpa -n vibecode

# View metrics
kubectl top nodes
kubectl top pods -n vibecode

# Install K9s for interactive monitoring
brew install k9s
k9s -n vibecode
```

---

## Scaling & Management

### Horizontal Pod Autoscaling

```bash
# HPA is configured automatically
# Monitor autoscaling
kubectl get hpa -n vibecode --watch

# Trigger scaling by load
kubectl run -i --tty load-generator --rm --image=busybox --restart=Never -- \
  /bin/sh -c "while sleep 0.01; do wget -q -O- http://vibecode-app-service:3000; done"

# Check scaling events
kubectl describe deployment vibecode-app -n vibecode | grep -A5 "Events:"
```

### Manual Scaling

```bash
# Scale VibeCode app
kubectl scale deployment/vibecode-app --replicas=5 -n vibecode

# Check scaling progress
kubectl rollout status deployment/vibecode-app -n vibecode
```

### Update Deployment

```bash
# Update image
kubectl set image deployment/vibecode-app \
  vibecode-app=ghcr.io/vibecode/webgui:v1.1.0 \
  -n vibecode

# Monitor rollout
kubectl rollout status deployment/vibecode-app -n vibecode

# Rollback if needed
kubectl rollout undo deployment/vibecode-app -n vibecode
```

### Backup & Restore

```bash
# Install Velero for backup/restore
curl https://sh.velero.io | bash
velero install --provider aws --plugins velero/velero-plugin-for-aws:v1.8.0 \
  --bucket vibecode-backup \
  --secret-file ./credentials-velero

# Create backup schedule
velero schedule create vibecode-daily \
  --schedule="0 2 * * *" \
  --include-namespaces vibecode \
  --ttl 720h

# Manual backup
velero backup create vibecode-$(date +%Y%m%d) \
  --include-namespaces vibecode

# List backups
velero backup get

# Restore
velero restore create --from-backup vibecode-20240105
```

---

## Production Hardening

### Security Enhancements

```bash
# 1. Pod Security Standards
kubectl label namespace vibecode pod-security.kubernetes.io/enforce=baseline

# 2. Network Policies (restrict traffic)
kubectl apply -f - << 'EOF'
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: vibecode-network-policy
  namespace: vibecode
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
EOF

# 3. Resource Quotas
kubectl apply -f - << 'EOF'
apiVersion: v1
kind: ResourceQuota
metadata:
  name: vibecode-quota
  namespace: vibecode
spec:
  hard:
    requests.cpu: "10"
    requests.memory: "20Gi"
    limits.cpu: "20"
    limits.memory: "40Gi"
    persistentvolumeclaims: "5"
    pods: "50"
EOF

# 4. RBAC - Service Account permissions
kubectl apply -f - << 'EOF'
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: vibecode-app-role
  namespace: vibecode
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get"]
EOF
```

### TLS/SSL Certificates

```bash
# Install cert-manager
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace

# Create ClusterIssuer for Let's Encrypt
kubectl apply -f - << 'EOF'
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

### Monitoring & Alerts

```bash
# Create PrometheusRule for alerts
kubectl apply -f - << 'EOF'
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: vibecode-alerts
  namespace: vibecode
spec:
  groups:
  - name: vibecode.rules
    interval: 30s
    rules:
    - alert: VibecodeAppHighErrorRate
      expr: rate(http_requests_total{app="vibecode-app", status=~"5.."}[5m]) > 0.05
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "High error rate detected"
    - alert: PodCrashLooping
      expr: rate(kube_pod_container_status_restarts_total{namespace="vibecode"}[5m]) > 0.1
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Pod is crash looping"
EOF
```

---

## Troubleshooting

### Common Issues & Solutions

#### Pods Not Starting

```bash
# Check pod status and events
kubectl describe pod <pod-name> -n vibecode

# Check logs for errors
kubectl logs <pod-name> -n vibecode --previous

# Check resource availability
kubectl describe nodes
kubectl top nodes

# Check PVC binding
kubectl get pvc -n vibecode
kubectl describe pvc <pvc-name> -n vibecode
```

#### Database Connection Issues

```bash
# Test connectivity
kubectl run -it --rm debug --image=busybox --restart=Never -- \
  sh -c "nc -zv postgres-service 5432"

# Check database pod
kubectl describe pod -l app=postgres -n vibecode

# Check logs
kubectl logs -l app=postgres -n vibecode
```

#### Memory/CPU Issues

```bash
# Check current usage
kubectl top pods -n vibecode

# Check limits
kubectl get pods -o json | jq '.items[] | {name: .metadata.name, limits: .spec.containers[].resources.limits}'

# Increase limits if needed
kubectl set resources deployment vibecode-app \
  -n vibecode \
  --limits=cpu=2000m,memory=2Gi \
  --requests=cpu=500m,memory=512Mi
```

#### Storage Issues

```bash
# Check PV status
kubectl get pv
kubectl describe pv <pv-name>

# Check PVC status
kubectl get pvc -n vibecode
kubectl describe pvc <pvc-name> -n vibecode

# Reclaim space
kubectl delete pvc <old-pvc> -n vibecode
```

---

## Multi-Cloud Deployment

### Unified Deployment Across Clouds

```bash
# Create separate contexts for each cloud
kubectl config set-context vibecode-eks \
  --cluster=vibecode-prod \
  --user=aws-user
kubectl config set-context vibecode-aks \
  --cluster=vibecode-prod \
  --user=azure-user
kubectl config set-context vibecode-gke \
  --cluster=vibecode-prod \
  --user=gcp-user

# Switch between clusters
kubectl config use-context vibecode-eks
kubectl config use-context vibecode-aks
kubectl config use-context vibecode-gke

# Deploy to all clusters
for context in vibecode-eks vibecode-aks vibecode-gke; do
  kubectl --context=$context apply -f k8s-manifests/
done
```

### Cloud-Specific Configuration

```bash
# EKS specific storage
kubectl apply -f - << 'EOF'
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

# AKS specific storage
kubectl apply -f - << 'EOF'
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: azure-managed-disk
provisioner: kubernetes.io/azure-disk
parameters:
  kind: Managed
  storageaccounttype: Standard_LRS
EOF

# GKE specific storage
kubectl apply -f - << 'EOF'
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gce-pd-ssd
provisioner: kubernetes.io/gce-pd
parameters:
  type: pd-ssd
  replication-type: regional-pd
EOF
```

---

## Quick Reference Commands

```bash
# Cluster Info
kubectl cluster-info
kubectl get nodes
kubectl version

# Namespace Management
kubectl create namespace vibecode
kubectl get namespaces
kubectl config set-context --current --namespace=vibecode

# Deployment Management
kubectl apply -f manifest.yaml
kubectl delete -f manifest.yaml
kubectl get deployments
kubectl scale deployment/vibecode-app --replicas=5
kubectl set image deployment/vibecode-app app=image:v2

# Pod Management
kubectl get pods
kubectl describe pod <pod-name>
kubectl logs <pod-name>
kubectl exec -it <pod-name> -- /bin/bash
kubectl port-forward pod/<pod-name> 3000:3000

# Monitoring
kubectl get events -n vibecode --sort-by='.lastTimestamp'
kubectl top pods
kubectl top nodes
kubectl get hpa --watch

# Debugging
kubectl debug pod/<pod-name> -it --image=busybox
kubectl attach pod/<pod-name> -c <container>
kubectl port-forward pod/<pod-name> 6379:6379
```

---

## References

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Kind Documentation](https://kind.sigs.k8s.io/)
- [EKS Documentation](https://docs.aws.amazon.com/eks/)
- [AKS Documentation](https://docs.microsoft.com/azure/aks/)
- [GKE Documentation](https://cloud.google.com/kubernetes-engine/docs)
- [Helm Charts](https://helm.sh/docs/chart_template_guide/)
- [Cert-Manager](https://cert-manager.io/docs/)
- [Velero Backup](https://velero.io/docs/)

---

**Next Steps**:
1. Deploy VibeCode on your chosen Kubernetes cluster
2. Verify all services are running and healthy
3. Set up monitoring and alerting
4. Configure auto-scaling policies
5. Implement backup/restore procedures
6. Test failover scenarios
