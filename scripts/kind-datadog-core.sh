#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Core KIND Cluster with Essential Datadog Monitoring
# Simplified, robust setup focused on getting monitoring working

# Initialize log aggregation
init_log_aggregation


set -e

echo "🚀 VibeCode KIND + Datadog Core Setup"
echo "====================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

CLUSTER_NAME="vibecode-monitoring"

# Clean up any existing cluster
kind delete cluster --name $CLUSTER_NAME 2>/dev/null || true

# Create simple but effective cluster
print_status "Creating KIND cluster..."
cat > /tmp/kind-config.yaml << EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: $CLUSTER_NAME
nodes:
- role: control-plane
  extraPortMappings:
  - containerPort: 80
    hostPort: 8090
  - containerPort: 443
    hostPort: 8443
  - containerPort: 30000
    hostPort: 30000
- role: worker
EOF

kind create cluster --config /tmp/kind-config.yaml --name $CLUSTER_NAME

# Verify cluster is working
print_status "Verifying cluster..."
kubectl cluster-info --context kind-$CLUSTER_NAME
kubectl get nodes

# Install Nginx Ingress (lightweight)
print_status "Installing Nginx Ingress..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# Wait for ingress to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s

# Create namespaces
print_status "Creating namespaces..."
kubectl create namespace vibecode
kubectl create namespace datadog-system

# Install Datadog (lightweight configuration)
print_status "Installing Datadog monitoring..."

# Add Datadog repo
helm repo add datadog https://helm.datadoghq.com
helm repo update

# Create minimal but effective Datadog config
cat > /tmp/datadog-simple.yaml << EOF
datadog:
  apiKey: "${DD_API_KEY:-demo-key}"
  site: "datadoghq.com"
  clusterName: "vibecode-kind"
  
  logs:
    enabled: true
    containerCollectAll: true
    
  apm:
    enabled: true
    
  processAgent:
    enabled: true
    
  kubeStateMetricsEnabled: true
  
  tags:
    - "project:vibecode"
    - "env:development"

clusterAgent:
  enabled: true
  replicas: 1

agents:
  resources:
    requests:
      cpu: "50m"
      memory: "128Mi"
    limits:
      cpu: "100m"
      memory: "256Mi"

tolerations:
  - operator: Exists
EOF

# Install Datadog with timeout
helm install datadog-agent datadog/datadog \
  --namespace datadog-system \
  --values /tmp/datadog-simple.yaml \
  --timeout=300s \
  --wait

# Deploy sample monitored application
print_status "Deploying sample application with monitoring..."

cat > /tmp/sample-app.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sample-app
  namespace: vibecode
  labels:
    app: sample-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: sample-app
  template:
    metadata:
      labels:
        app: sample-app
      annotations:
        datadog.ad.logs: '[{"source":"nginx","service":"sample-app"}]'
    spec:
      containers:
      - name: nginx
        image: nginx:alpine
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: "10m"
            memory: "32Mi"
---
apiVersion: v1
kind: Service
metadata:
  name: sample-app
  namespace: vibecode
spec:
  selector:
    app: sample-app
  ports:
  - port: 80
    targetPort: 80
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: sample-app
  namespace: vibecode
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
  - host: app.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: sample-app
            port:
              number: 80
EOF

kubectl apply -f /tmp/sample-app.yaml

# Wait for everything to be ready
print_status "Waiting for all services to be ready..."
kubectl wait --for=condition=ready pod -l app=datadog-agent -n datadog-system --timeout=120s || true
kubectl wait --for=condition=ready pod -l app=sample-app -n vibecode --timeout=60s

# Show cluster status
print_status "Cluster Status:"
echo "==============="
kubectl get nodes -o wide
echo ""
kubectl get pods --all-namespaces
echo ""

print_success "🎉 KIND cluster with Datadog monitoring is ready!"
echo ""
echo "📊 Access your application:"
echo "  • Sample App: http://app.local:8090 (add 'app.local' to /etc/hosts pointing to 127.0.0.1)"
echo ""
echo "📈 Monitoring:"
echo "  • Datadog Dashboard: https://app.datadoghq.com (if real API key provided)"
echo "  • Check Datadog agent: kubectl logs -l app=datadog-agent -n datadog-system"
echo ""
echo "🔧 Cluster Management:"
echo "  • View all pods: kubectl get pods --all-namespaces"
echo "  • Delete cluster: kind delete cluster --name $CLUSTER_NAME"

# Test connectivity
print_status "Testing cluster connectivity..."
if kubectl get pods -n datadog-system | grep -q Running; then
  print_success "Datadog agent is running"
else
  print_warning "Datadog agent may still be starting"
fi

if kubectl get pods -n vibecode | grep -q Running; then
  print_success "Sample application is running"
else
  print_warning "Sample application may still be starting"
fi