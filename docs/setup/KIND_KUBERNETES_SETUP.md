# KIND (Kubernetes in Docker) Setup Guide

Complete guide for running VibeCode on a local Kubernetes cluster using KIND.

## Quick Start

```bash
# Create cluster
kind create cluster --config platforms/kubernetes/k8s/kind-config.yaml

# Deploy VibeCode
kubectl apply -f platforms/kubernetes/k8s/vibecode-local.yaml

# Port-forward to access
kubectl port-forward -n vibecode svc/vibecode 3000:80

# Access at http://localhost:3000
```

---

## Prerequisites

### 🍎 macOS

#### Install Docker Desktop
```bash
# Using Homebrew
brew install --cask docker

# Or download from: https://www.docker.com/products/docker-desktop
```

#### Install kubectl
```bash
# Using Homebrew
brew install kubectl

# Verify installation
kubectl version --client
```

#### Install KIND
```bash
# Using Homebrew
brew install kind

# Verify installation
kind version
```

#### Apple Silicon (M1/M2/M3)
```bash
# KIND works natively on ARM64
# Ensure Docker Desktop is configured for Apple Silicon
# Settings → Features in Development → Use Rosetta for x86/amd64 emulation (optional)
```

---

### 🐧 Linux

#### Install Docker
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y docker.io

# Fedora/RHEL
sudo dnf install -y docker

# Arch
sudo pacman -S docker

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

#### Install kubectl
```bash
# Download latest release
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"

# Make executable
chmod +x kubectl

# Move to PATH
sudo mv kubectl /usr/local/bin/

# Verify
kubectl version --client
```

#### Install KIND
```bash
# Download KIND
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64

# Make executable
chmod +x ./kind

# Move to PATH
sudo mv ./kind /usr/local/bin/kind

# Verify installation
kind version
```

---

### 🪟 Windows

#### Install Docker Desktop
1. Download Docker Desktop: https://www.docker.com/products/docker-desktop
2. Install WSL2: `wsl --install`
3. Enable Hyper-V in BIOS
4. Restart computer

#### Install kubectl (PowerShell as Administrator)
```powershell
# Using Chocolatey
choco install kubernetes-cli

# Or download manually
curl.exe -LO "https://dl.k8s.io/release/v1.28.0/bin/windows/amd64/kubectl.exe"

# Add to PATH
$env:Path += ";C:\kubectl"

# Verify
kubectl version --client
```

#### Install KIND (PowerShell as Administrator)
```powershell
# Download KIND
curl.exe -Lo kind-windows-amd64.exe https://kind.sigs.k8s.io/dl/v0.20.0/kind-windows-amd64

# Rename and move
Move-Item .\kind-windows-amd64.exe C:\Windows\System32\kind.exe

# Verify
kind version
```

---

## Cluster Creation

### Using Custom Configuration

The `platforms/kubernetes/k8s/kind-config.yaml` provides a production-like cluster with:
- 1 control-plane node
- 2 worker nodes
- Port mappings for HTTP/HTTPS (80, 443, 30080, 30443)
- Ingress-ready configuration
- IPVS proxy mode

```bash
# Create cluster with custom config
kind create cluster --config platforms/kubernetes/k8s/kind-config.yaml

# Expected output:
# Creating cluster "vibecode-local" ...
#  ✓ Ensuring node image (kindest/node:v1.27.3)
#  ✓ Preparing nodes 📦 📦 📦
#  ✓ Writing configuration 📜
#  ✓ Starting control-plane 🕹️
#  ✓ Installing CNI 🔌
#  ✓ Installing StorageClass 💾
#  ✓ Joining worker nodes 🚜
# Set kubectl context to "kind-vibecode-local"
```

### Verify Cluster

```bash
# Check cluster info
kubectl cluster-info --context kind-vibecode-local

# View nodes
kubectl get nodes

# Expected output:
# NAME                           STATUS   ROLES           AGE   VERSION
# vibecode-local-control-plane   Ready    control-plane   2m    v1.27.3
# vibecode-local-worker          Ready    <none>          2m    v1.27.3
# vibecode-local-worker2         Ready    <none>          2m    v1.27.3
```

### Quick Cluster (Single Node)

For development or testing with minimal resources:

```bash
# Create single-node cluster
kind create cluster --name vibecode-dev

# Verify
kubectl cluster-info --context kind-vibecode-dev
```

---

## Deploy VibeCode

### Option 1: Using Helm Chart (Recommended)

```bash
# Add VibeCode Helm repository
helm repo add vibecode https://charts.vibecode.dev
helm repo update

# Create namespace
kubectl create namespace vibecode

# Install with default values
helm install vibecode vibecode/vibecode-platform \
  --namespace vibecode \
  --set global.environment=local \
  --set mongodb.enabled=true \
  --set codeServer.persistence.size=5Gi

# Check deployment status
kubectl get pods -n vibecode

# Wait for pods to be ready
kubectl wait --for=condition=ready pod -l app=vibecode -n vibecode --timeout=300s
```

### Option 2: Using kubectl Apply

Create a manifest file `vibecode-kind.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: vibecode

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: vibecode-config
  namespace: vibecode
data:
  NEXTAUTH_URL: "http://localhost:3000"
  DD_SITE: "datadoghq.com"
  NODE_ENV: "development"

---
apiVersion: v1
kind: Secret
metadata:
  name: vibecode-secrets
  namespace: vibecode
type: Opaque
stringData:
  DATABASE_URL: "mongodb://vibecode:vibecode-password@mongodb:27017/vibecode-db"
  NEXTAUTH_SECRET: "dev-secret-change-in-production"
  DD_API_KEY: "your-datadog-api-key"

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vibecode
  namespace: vibecode
  labels:
    app: vibecode
spec:
  replicas: 2
  selector:
    matchLabels:
      app: vibecode
  template:
    metadata:
      labels:
        app: vibecode
    spec:
      containers:
      - name: vibecode
        image: vibecode/webgui:latest
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 3000
          name: http
        envFrom:
        - configMapRef:
            name: vibecode-config
        - secretRef:
            name: vibecode-secrets
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3

---
apiVersion: v1
kind: Service
metadata:
  name: vibecode
  namespace: vibecode
spec:
  type: NodePort
  selector:
    app: vibecode
  ports:
  - port: 80
    targetPort: 3000
    nodePort: 30080
    protocol: TCP
    name: http

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mongodb
  namespace: vibecode
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mongodb
  template:
    metadata:
      labels:
        app: mongodb
    spec:
      containers:
      - name: mongodb
        image: mongo:7.0
        ports:
        - containerPort: 27017
        env:
        - name: MONGO_INITDB_ROOT_USERNAME
          value: "vibecode"
        - name: MONGO_INITDB_ROOT_PASSWORD
          value: "vibecode-password"
        - name: MONGO_INITDB_DATABASE
          value: "vibecode-db"
        volumeMounts:
        - name: mongodb-data
          mountPath: /data/db
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
      volumes:
      - name: mongodb-data
        emptyDir: {}

---
apiVersion: v1
kind: Service
metadata:
  name: mongodb
  namespace: vibecode
spec:
  selector:
    app: mongodb
  ports:
  - port: 27017
    targetPort: 27017
```

Deploy the manifest:

```bash
# Apply the configuration
kubectl apply -f vibecode-kind.yaml

# Watch deployment progress
kubectl get pods -n vibecode -w

# Check pod status
kubectl get pods -n vibecode

# View logs
kubectl logs -n vibecode -l app=vibecode --tail=50 -f
```

---

## Access VibeCode

### Port Forwarding (Recommended for Local Development)

```bash
# Forward service port to localhost
kubectl port-forward -n vibecode svc/vibecode 3000:80

# Access at http://localhost:3000
```

**Keep this terminal open while using VibeCode.**

### NodePort Access

Since KIND maps ports to the host:

```bash
# Access via NodePort (configured in kind-config.yaml)
# http://localhost:30080
```

### Using Ingress (Advanced)

#### Install NGINX Ingress Controller

```bash
# Deploy ingress controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# Wait for ingress to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s
```

#### Create Ingress Resource

```yaml
# vibecode-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: vibecode
  namespace: vibecode
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
  - host: vibecode.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: vibecode
            port:
              number: 80
```

```bash
# Apply ingress
kubectl apply -f vibecode-ingress.yaml

# Add to /etc/hosts
echo "127.0.0.1 vibecode.local" | sudo tee -a /etc/hosts

# Access at http://vibecode.local
```

---

## Managing the Cluster

### View Resources

```bash
# List all resources in vibecode namespace
kubectl get all -n vibecode

# Describe pod
kubectl describe pod -n vibecode -l app=vibecode

# View pod logs
kubectl logs -n vibecode -l app=vibecode

# Follow logs in real-time
kubectl logs -n vibecode -l app=vibecode -f

# View events
kubectl get events -n vibecode --sort-by='.lastTimestamp'
```

### Scale Deployment

```bash
# Scale to 3 replicas
kubectl scale deployment/vibecode -n vibecode --replicas=3

# Verify scaling
kubectl get pods -n vibecode
```

### Update Deployment

```bash
# Update image
kubectl set image deployment/vibecode vibecode=vibecode/webgui:v2.0 -n vibecode

# Check rollout status
kubectl rollout status deployment/vibecode -n vibecode

# View rollout history
kubectl rollout history deployment/vibecode -n vibecode

# Rollback if needed
kubectl rollout undo deployment/vibecode -n vibecode
```

### Execute Commands in Pod

```bash
# Get shell access
kubectl exec -it -n vibecode deployment/vibecode -- /bin/bash

# Run a single command
kubectl exec -n vibecode deployment/vibecode -- env

# Check MongoDB connection
kubectl exec -n vibecode deployment/mongodb -- mongosh --eval "db.adminCommand('ping')"
```

---

## Monitoring and Debugging

### Check Resource Usage

```bash
# Install metrics-server for KIND
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Patch metrics-server for KIND
kubectl patch -n kube-system deployment metrics-server --type=json \
  -p '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

# View resource usage
kubectl top nodes
kubectl top pods -n vibecode
```

### Debug Failed Pods

```bash
# Describe pod to see events
kubectl describe pod -n vibecode <pod-name>

# View logs from crashed container
kubectl logs -n vibecode <pod-name> --previous

# Get pod YAML
kubectl get pod -n vibecode <pod-name> -o yaml
```

### Network Debugging

```bash
# Deploy debug pod
kubectl run debug --image=nicolaka/netshoot -it --rm -n vibecode -- /bin/bash

# Inside debug pod, test connectivity:
# curl http://vibecode.vibecode.svc.cluster.local
# nslookup vibecode.vibecode.svc.cluster.local
# ping mongodb
```

---

## Cleanup

### Delete Deployment

```bash
# Delete VibeCode resources
kubectl delete namespace vibecode

# Or if using manifest file
kubectl delete -f vibecode-kind.yaml
```

### Delete Cluster

```bash
# Delete KIND cluster
kind delete cluster --name vibecode-local

# Verify deletion
kind get clusters
```

### Delete All KIND Clusters

```bash
# List all clusters
kind get clusters

# Delete all
kind delete clusters --all
```

---

## Troubleshooting

### Cluster Creation Fails

```bash
# Check Docker is running
docker ps

# Check KIND logs
kind create cluster --name test --retain -v 1

# Clean up and retry
kind delete cluster --name vibecode-local
docker system prune -a
kind create cluster --config platforms/kubernetes/k8s/kind-config.yaml
```

### Pods Stuck in Pending

```bash
# Check pod status
kubectl describe pod -n vibecode <pod-name>

# Common causes:
# 1. Insufficient resources
kubectl top nodes

# 2. Image pull issues
kubectl get events -n vibecode | grep -i pull

# 3. Storage issues
kubectl get pvc -n vibecode
```

### Pods Stuck in CrashLoopBackOff

```bash
# View logs
kubectl logs -n vibecode <pod-name> --previous

# Check events
kubectl describe pod -n vibecode <pod-name>

# Common fixes:
# 1. Fix environment variables
kubectl edit configmap vibecode-config -n vibecode

# 2. Fix secrets
kubectl edit secret vibecode-secrets -n vibecode

# 3. Restart deployment
kubectl rollout restart deployment/vibecode -n vibecode
```

### Cannot Access Application

```bash
# Check service
kubectl get svc -n vibecode
kubectl describe svc vibecode -n vibecode

# Check endpoints
kubectl get endpoints -n vibecode

# Test from within cluster
kubectl run curl --image=curlimages/curl -it --rm -- curl http://vibecode.vibecode.svc.cluster.local

# Check port-forward
kubectl port-forward -n vibecode svc/vibecode 3000:80
```

### MongoDB Connection Issues

```bash
# Check MongoDB pod
kubectl get pods -n vibecode -l app=mongodb

# View MongoDB logs
kubectl logs -n vibecode -l app=mongodb

# Test connection
kubectl exec -n vibecode deployment/mongodb -- mongosh --eval "db.runCommand({ping: 1})"

# Verify connection string in secret
kubectl get secret vibecode-secrets -n vibecode -o jsonpath='{.data.DATABASE_URL}' | base64 -d
```

### Image Pull Errors

```bash
# Check image exists
docker pull vibecode/webgui:latest

# Load local image into KIND
kind load docker-image vibecode/webgui:latest --name vibecode-local

# Verify image in cluster
docker exec -it vibecode-local-control-plane crictl images | grep vibecode
```

### DNS Resolution Issues

```bash
# Check CoreDNS
kubectl get pods -n kube-system -l k8s-app=kube-dns

# Test DNS
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup vibecode.vibecode.svc.cluster.local

# Check CoreDNS logs
kubectl logs -n kube-system -l k8s-app=kube-dns
```

---

## Advanced Configuration

### Multiple Clusters

```bash
# Create dev cluster
kind create cluster --name vibecode-dev

# Create staging cluster
kind create cluster --name vibecode-staging

# List clusters
kind get clusters

# Switch context
kubectl config use-context kind-vibecode-dev
kubectl config use-context kind-vibecode-staging

# View current context
kubectl config current-context
```

### Custom Registry

```bash
# Create cluster with registry
cat <<EOF | kind create cluster --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: vibecode-registry
containerdConfigPatches:
- |-
  [plugins."io.containerd.grpc.v1.cri".registry.mirrors."localhost:5001"]
    endpoint = ["http://kind-registry:5000"]
EOF

# Deploy local registry
docker run -d --restart=always -p "5001:5000" --name kind-registry registry:2

# Connect registry to cluster network
docker network connect "kind" kind-registry

# Tag and push image
docker tag vibecode/webgui:latest localhost:5001/vibecode/webgui:latest
docker push localhost:5001/vibecode/webgui:latest
```

### Persistent Storage

```bash
# Create local-path-provisioner (included in KIND by default)
kubectl get storageclass

# Create PVC
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: vibecode-data
  namespace: vibecode
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: standard
EOF

# Use in deployment
# Add to volumes:
#   - name: data
#     persistentVolumeClaim:
#       claimName: vibecode-data
# Add to volumeMounts:
#   - name: data
#     mountPath: /data
```

---

## Performance Optimization

### Resource Limits

```bash
# Check resource usage
kubectl top pods -n vibecode

# Adjust resources
kubectl set resources deployment/vibecode -n vibecode \
  --requests=cpu=1000m,memory=2Gi \
  --limits=cpu=2000m,memory=4Gi
```

### Horizontal Pod Autoscaling

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: vibecode-hpa
  namespace: vibecode
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: vibecode
  minReplicas: 2
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

```bash
# Apply HPA
kubectl apply -f hpa.yaml

# Check HPA status
kubectl get hpa -n vibecode
```

---

## Next Steps

- [Production Kubernetes Deployment](../platforms/kubernetes/README.md)
- [Docker Compose Setup](./DOCKER_COMPOSE_SETUP.md)
- [Getting Started Guide](./GETTING_STARTED.md)
- [Monitoring with Datadog](../docs/postgres-datadog-monitoring.md)
- [Backup & Recovery](../docs/BACKUP_GUIDE.md)
