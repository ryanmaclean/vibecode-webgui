#\!/bin/bash

# VibeCode KIND Cluster Setup Script
# Creates and configures the complete development environment

set -e

CLUSTER_NAME="vibecode-cluster"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$SCRIPT_DIR/../k8s"

echo "🚀 Setting up VibeCode KIND cluster..."

# Check if KIND is installed
if \! command -v kind &> /dev/null; then
  echo "❌ KIND is not installed. Please install it first:"
  echo "   brew install kind"
  exit 1
fi

# Check if kubectl is installed
if \! command -v kubectl &> /dev/null; then
  echo "❌ kubectl is not installed. Please install it first:"
  echo "   brew install kubectl"
  exit 1
fi

# Check if helm is installed
if \! command -v helm &> /dev/null; then
  echo "❌ Helm is not installed. Please install it first:"
  echo "   brew install helm"
  exit 1
fi

# Create local directories for persistent storage
echo "📁 Creating local storage directories..."
mkdir -p /tmp/vibecode-workspaces /tmp/vibecode-data /tmp/vibecode-db

# Delete existing cluster if it exists
if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
  echo "🗑️  Deleting existing cluster..."
  kind delete cluster --name "$CLUSTER_NAME"
fi

# Create new cluster
echo "🏗️  Creating KIND cluster..."
kind create cluster --config "$K8S_DIR/vibecode-kind-config.yaml" --name "$CLUSTER_NAME"

# Wait for cluster to be ready
echo "⏳ Waiting for cluster to be ready..."
kubectl wait --for=condition=Ready nodes --all --timeout=300s

# Create namespaces
echo "🏷️  Creating namespaces..."
kubectl apply -f "$K8S_DIR/namespace.yaml"

# Install NGINX Ingress Controller
echo "🌐 Installing NGINX Ingress Controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# Wait for NGINX Ingress to be ready
echo "⏳ Waiting for NGINX Ingress to be ready..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=300s

# Add Helm repositories
echo "📦 Adding Helm repositories..."
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo add cert-manager https://charts.jetstack.io
helm repo add authelia https://charts.authelia.com
helm repo add datadog https://helm.datadoghq.com
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install cert-manager
echo "🔒 Installing cert-manager..."
helm upgrade --install cert-manager cert-manager/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --version v1.16.1 \
  --set crds.enabled=true \
  --wait

# Wait for cert-manager to be ready
kubectl wait --namespace cert-manager \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/name=cert-manager \
  --timeout=300s

# Install PostgreSQL for Authelia
echo "🗄️  Installing PostgreSQL..."
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: vibecode-storage
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: pgvector/pgvector:pg16
        env:
        - name: POSTGRES_DB
          value: authelia
        - name: POSTGRES_USER
          value: authelia
        - name: POSTGRES_PASSWORD
          value: authelia-password
        - name: POSTGRES_HOST_AUTH_METHOD
          value: md5
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-data
        hostPath:
          path: /tmp/vibecode-db/postgres
          type: DirectoryOrCreate
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: vibecode-storage
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
