# AGENT-AB: Container & Kubernetes Quick Start

**Agent**: AB - Container & Kubernetes Optimization
**Purpose**: Fast-track guide for containerized VibeCode deployment
**Time to First Success**: 15 minutes (local), 30 minutes (cloud)

## Quick Links

- [Local Development (Docker Compose)](#local-development-docker-compose)
- [Kubernetes Local (KIND)](#kubernetes-local-kind)
- [Kubernetes Cloud (EKS/AKS/GKE)](#kubernetes-cloud-eksaksge)
- [Troubleshooting](#troubleshooting)

---

## Local Development (Docker Compose)

### Fastest Path: 5 Minutes

```bash
# 1. Clone and enter repo
git clone https://github.com/vibecode/vibecode-webgui
cd vibecode-webgui

# 2. Copy environment file
cp .env.example .env
# Edit .env with your API keys

# 3. Create data directories
mkdir -p data/{postgres,valkey,uploads,rag,conversations}

# 4. Start all services
docker compose -f docker-compose-production.yml up -d

# 5. Wait for services to be healthy (1-2 minutes)
docker ps
docker compose -f docker-compose-production.yml logs

# 6. Access the application
# WebGUI: http://localhost:3000
# API: http://localhost:3000/api/health
# Code Server: http://localhost:8080 (if enabled)

# 7. Stop when done
docker compose -f docker-compose-production.yml down
```

### Verify Services

```bash
# Check status
docker ps

# Test API
curl http://localhost:3000/api/health

# Access PostgreSQL
docker exec -it vibecode-postgres psql -U vibecode -d vibecode -c "SELECT version();"

# Access Valkey
docker exec -it vibecode-valkey valkey-cli ping

# View logs
docker logs vibecode-app
docker logs vibecode-postgres
docker logs vibecode-valkey
```

### Development with Code Reloading

```bash
# Build and start with development mode
docker compose -f docker-compose-production.yml up -d \
  --profile with-code-server \
  --profile monitoring

# Access services
# WebGUI: http://localhost:3000 (with hot reload)
# Code Server: http://localhost:8080
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3001

# Rebuild after code changes
docker compose -f docker-compose-production.yml build vibecode-app
docker compose -f docker-compose-production.yml up -d vibecode-app
```

---

## Kubernetes Local (KIND)

### Setup Kind Cluster: 10 Minutes

```bash
# 1. Install tools
brew install kind kubectl helm

# 2. Create KIND cluster with ingress
cat > kind-cluster.yaml << 'EOF'
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
- role: worker
- role: worker
EOF

kind create cluster --config kind-cluster.yaml

# 3. Install NGINX Ingress
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s

# 4. Verify cluster
kubectl cluster-info
kubectl get nodes

# Cluster ready!
```

### Deploy VibeCode: 10 Minutes

```bash
# 1. Create namespace
kubectl create namespace vibecode

# 2. Create secrets (update values!)
kubectl create secret generic vibecode-secrets \
  --from-literal=database.url="postgresql://vibecode:vibecode123@postgres-service:5432/vibecode" \
  --from-literal=redis.url="redis://valkey-service:6379" \
  --from-literal=nextauth.secret="$(openssl rand -hex 32)" \
  -n vibecode

# 3. Deploy all services
kubectl apply -f k8s-manifests/namespace.yaml
kubectl apply -f k8s-manifests/postgres-statefulset.yaml
kubectl apply -f k8s-manifests/valkey-deployment.yaml
kubectl apply -f k8s-manifests/vibecode-app-deployment.yaml

# 4. Wait for deployment
kubectl rollout status deployment/vibecode-app -n vibecode --timeout=5m

# 5. Create ingress
kubectl apply -f - << 'EOF'
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: vibecode-ingress
  namespace: vibecode
spec:
  ingressClassName: nginx
  rules:
  - host: localhost
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

# 6. Access application
# Update /etc/hosts: 127.0.0.1 vibecode.local
echo "127.0.0.1 vibecode.local" | sudo tee -a /etc/hosts

# WebGUI: http://vibecode.local
# Or port-forward: kubectl port-forward svc/vibecode-app-service 3000:3000 -n vibecode
# Then: http://localhost:3000
```

### Verify Kubernetes Deployment

```bash
# 1. Check all resources
kubectl get all -n vibecode

# 2. Check pods
kubectl get pods -n vibecode -o wide

# 3. Check logs
kubectl logs -f deployment/vibecode-app -n vibecode
kubectl logs -f statefulset/postgres -n vibecode
kubectl logs -f deployment/valkey -n vibecode

# 4. Access database
kubectl run -it --rm db-shell --image=postgres:16 \
  --restart=Never -- \
  psql -h postgres-service.vibecode.svc.cluster.local \
  -U vibecode -d vibecode

# 5. Port forward for local access
kubectl port-forward svc/vibecode-app-service 3000:3000 -n vibecode &
kubectl port-forward svc/postgres-service 5432:5432 -n vibecode &
kubectl port-forward svc/valkey-service 6379:6379 -n vibecode &

# Test API
curl http://localhost:3000/api/health
```

### Cleanup KIND Cluster

```bash
# 1. Delete deployment
kubectl delete namespace vibecode

# 2. Delete cluster
kind delete cluster --name vibecode

# 3. Remove from /etc/hosts
sudo sed -i '' '/vibecode.local/d' /etc/hosts
```

---

## Kubernetes Cloud (EKS/AKS/GKE)

### EKS (AWS): 20 Minutes

```bash
# 1. Install tools
brew install awscli eksctl kubectl helm

# 2. Configure AWS credentials
aws configure

# 3. Create EKS cluster
eksctl create cluster \
  --name vibecode-prod \
  --version 1.28 \
  --region us-east-1 \
  --nodegroup-name workers \
  --node-type t3.xlarge \
  --nodes 3 \
  --enable-ssm

# 4. Update kubeconfig
aws eks update-kubeconfig \
  --region us-east-1 \
  --name vibecode-prod

# 5. Verify cluster
kubectl cluster-info
kubectl get nodes

# 6. Install EBS CSI driver (for persistent volumes)
eksctl create addon \
  --name aws-ebs-csi-driver \
  --cluster vibecode-prod

# 7. Deploy VibeCode (same as KIND above)
kubectl create namespace vibecode
kubectl apply -f k8s-manifests/

# 8. Get load balancer address
kubectl get svc -n vibecode

# 9. Access via load balancer
ELB=$(kubectl get svc vibecode-app-service -n vibecode -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
curl http://$ELB:3000/api/health
```

### AKS (Azure): 20 Minutes

```bash
# 1. Install tools
brew install azure-cli kubectl helm

# 2. Login to Azure
az login

# 3. Create resource group
az group create \
  --name vibecode \
  --location eastus

# 4. Create AKS cluster
az aks create \
  --resource-group vibecode \
  --name vibecode-prod \
  --node-count 3 \
  --vm-set-type VirtualMachineScaleSets \
  --enable-managed-identity

# 5. Get credentials
az aks get-credentials \
  --resource-group vibecode \
  --name vibecode-prod

# 6. Verify cluster
kubectl cluster-info
kubectl get nodes

# 7. Deploy VibeCode
kubectl create namespace vibecode
kubectl apply -f k8s-manifests/

# 8. Access application
LB_IP=$(kubectl get svc -n vibecode -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}')
curl http://$LB_IP:3000/api/health
```

### GKE (Google Cloud): 20 Minutes

```bash
# 1. Install tools
brew install google-cloud-sdk kubectl helm

# 2. Initialize gcloud
gcloud init
gcloud auth login

# 3. Set project
PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# 4. Enable APIs
gcloud services enable container.googleapis.com compute.googleapis.com

# 5. Create GKE cluster
gcloud container clusters create vibecode-prod \
  --region us-central1 \
  --num-nodes 3 \
  --machine-type e2-standard-4 \
  --enable-autoscaling \
  --min-nodes 2 \
  --max-nodes 10

# 6. Get credentials
gcloud container clusters get-credentials vibecode-prod --region us-central1

# 7. Verify cluster
kubectl cluster-info
kubectl get nodes

# 8. Deploy VibeCode
kubectl create namespace vibecode
kubectl apply -f k8s-manifests/

# 9. Access application
LB_IP=$(kubectl get svc -n vibecode -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}')
curl http://$LB_IP:3000/api/health
```

---

## Helm Quick Deploy

### Install Helm

```bash
brew install helm
helm version
```

### Deploy with Helm

```bash
# 1. Create values file
cat > values.yaml << 'EOF'
environment: production
vibecodeApp:
  replicaCount: 3
  image:
    repository: ghcr.io/vibecode/webgui
    tag: latest
postgres:
  enabled: true
valkey:
  enabled: true
EOF

# 2. Deploy (add to your helm repo first)
helm repo add vibecode https://charts.vibecode.io
helm repo update
helm install vibecode vibecode/unified-services \
  -f values.yaml \
  -n vibecode \
  --create-namespace

# 3. Monitor deployment
helm status vibecode -n vibecode
kubectl rollout status deployment/vibecode-app -n vibecode

# 4. Upgrade
helm upgrade vibecode vibecode/unified-services \
  -f values.yaml \
  -n vibecode

# 5. Rollback
helm rollback vibecode -n vibecode
```

---

## Common Commands Cheat Sheet

```bash
# Kubernetes Status
kubectl cluster-info
kubectl get nodes
kubectl get ns
kubectl get all -n vibecode

# Deployments
kubectl apply -f manifest.yaml
kubectl delete -f manifest.yaml
kubectl get deployments -n vibecode
kubectl scale deployment/vibecode-app --replicas=5 -n vibecode
kubectl rollout restart deployment/vibecode-app -n vibecode
kubectl rollout status deployment/vibecode-app -n vibecode

# Pods
kubectl get pods -n vibecode
kubectl describe pod <pod-name> -n vibecode
kubectl logs <pod-name> -n vibecode
kubectl logs -f <pod-name> -n vibecode
kubectl exec -it <pod-name> -- /bin/bash

# Services
kubectl get svc -n vibecode
kubectl port-forward svc/<service> 3000:3000 -n vibecode
kubectl expose deployment/vibecode-app --type=LoadBalancer

# Monitoring
kubectl top nodes
kubectl top pods -n vibecode
kubectl get hpa -n vibecode
kubectl get events -n vibecode

# Debugging
kubectl describe node <node-name>
kubectl logs <pod> -n vibecode --previous
kubectl exec <pod> -n vibecode -- /bin/sh

# Helm
helm list -n vibecode
helm status <release> -n vibecode
helm upgrade <release> <chart> -n vibecode
helm rollback <release> -n vibecode
helm uninstall <release> -n vibecode
```

---

## Troubleshooting

### Pod Won't Start

```bash
# 1. Check pod status
kubectl describe pod <pod-name> -n vibecode

# 2. Check logs
kubectl logs <pod-name> -n vibecode --previous

# 3. Check resource availability
kubectl describe nodes
kubectl top nodes

# 4. Common fixes
# - Check image availability
# - Check image pull secrets
# - Check resources (CPU/Memory)
# - Check persistent volumes
```

### Can't Connect to Services

```bash
# 1. Check service exists
kubectl get svc -n vibecode

# 2. Port forward
kubectl port-forward svc/vibecode-app-service 3000:3000 -n vibecode

# 3. Test from pod
kubectl run -it --rm debug --image=busybox --restart=Never -- \
  wget -O- http://vibecode-app-service:3000/api/health

# 4. Check DNS
kubectl run -it --rm debug --image=busybox --restart=Never -- \
  nslookup vibecode-app-service.vibecode.svc.cluster.local
```

### Database Connection Issues

```bash
# 1. Check postgres pod
kubectl get pod -l app=postgres -n vibecode
kubectl logs -l app=postgres -n vibecode

# 2. Port forward and test
kubectl port-forward svc/postgres-service 5432:5432 -n vibecode &
psql -h localhost -U vibecode -d vibecode -c "SELECT 1;"

# 3. Check PVC
kubectl get pvc -n vibecode
kubectl describe pvc <pvc-name> -n vibecode
```

### Disk Space Issues

```bash
# Check disk usage
df -h

# Check K8s resources
kubectl get pv,pvc -n vibecode

# Check node disk
kubectl describe node <node-name> | grep -A5 "Allocatable\|Allocated"

# Cleanup
docker system prune -a  # For Docker
kind delete cluster --name vibecode  # For KIND
```

---

## Performance Tuning

### For Docker Compose

```yaml
# Increase limits in docker-compose.yml
services:
  vibecode-app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### For Kubernetes

```bash
# Update resource requests/limits
kubectl set resources deployment/vibecode-app \
  -n vibecode \
  --limits=cpu=2000m,memory=2Gi \
  --requests=cpu=500m,memory=512Mi

# Enable HPA
kubectl autoscale deployment vibecode-app \
  -n vibecode \
  --min=2 --max=10 \
  --cpu-percent=70
```

---

## Health Checks

```bash
# Docker Compose
docker exec vibecode-app curl http://localhost:3000/api/health
docker exec vibecode-postgres pg_isready -U vibecode
docker exec vibecode-valkey valkey-cli ping

# Kubernetes
kubectl exec -it pod/vibecode-app-xxx -n vibecode -- \
  curl http://localhost:3000/api/health
kubectl exec -it pod/postgres-0 -n vibecode -- \
  pg_isready -U vibecode
kubectl exec -it pod/valkey-xxx -n vibecode -- \
  valkey-cli ping
```

---

## Next Steps

After successful deployment:

1. **Configure DNS**: Set up proper domain names
2. **Enable TLS**: Install cert-manager for HTTPS
3. **Set up monitoring**: Deploy Prometheus/Grafana
4. **Configure backups**: Set up Velero for automated backups
5. **Enable logging**: Deploy ELK or Loki for centralized logging
6. **Implement GitOps**: Set up ArgoCD for declarative deployments

---

## Getting Help

```bash
# Kubernetes troubleshooting
kubectl explain pod
kubectl explain deployment
kubectl api-resources

# Check logs
kubectl logs <pod> -n vibecode
kubectl logs <pod> -n vibecode --previous
kubectl logs <pod> -n vibecode --all-containers=true

# Describe resources
kubectl describe pod <pod-name> -n vibecode
kubectl describe deployment <deployment-name> -n vibecode
kubectl describe node <node-name>

# Get events
kubectl get events -n vibecode --sort-by='.lastTimestamp'
```

---

**Happy containerizing! 🚀**
