#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Deploy to Existing Cluster Script
# Works with your current KIND cluster and PostgreSQL setup

# Initialize log aggregation
init_log_aggregation


set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo ""
    echo -e "${CYAN}================================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}================================================${NC}"
    echo ""
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NAMESPACE="vibecode-platform"

print_header "DEPLOYING TO EXISTING CLUSTER"

# Check cluster connectivity
print_status "Checking cluster connectivity..."
if ! kubectl cluster-info --context kind-vibecode-kind-local &> /dev/null; then
    print_error "Cannot connect to KIND cluster. Is it running?"
    exit 1
fi

# Set context to the existing cluster
kubectl config use-context kind-vibecode-kind-local
print_success "Connected to KIND cluster: vibecode-kind-local"

# Create namespace if it doesn't exist
print_status "Creating namespace: $NAMESPACE"
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# Deploy the application
print_status "Building and deploying application..."
cd "$PROJECT_ROOT"

# Install dependencies
print_status "Installing dependencies..."
npm ci

# Build the application
print_status "Building application..."
npm run build

# Create a simple deployment for the application
print_status "Creating application deployment..."
cat << EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vibecode-webgui
  namespace: $NAMESPACE
  labels:
    app: vibecode-webgui
spec:
  replicas: 1
  selector:
    matchLabels:
      app: vibecode-webgui
  template:
    metadata:
      labels:
        app: vibecode-webgui
    spec:
      containers:
      - name: vibecode-webgui
        image: node:18-alpine
        command: ["sh", "-c"]
        args:
          - |
            apk add --no-cache git
            git clone https://github.com/ryanmaclean/vibecode-webgui.git /app
            cd /app
            npm ci
            npm run build
            npm start
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "development"
        - name: DATABASE_URL
          value: "postgresql://vibecode:vibecode_password@host.docker.internal:5432/vibecode"
        - name: NEXTAUTH_URL
          value: "http://localhost:3000"
        - name: NEXTAUTH_SECRET
          value: "development-secret-key"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: vibecode-webgui
  namespace: $NAMESPACE
spec:
  selector:
    app: vibecode-webgui
  ports:
  - port: 3000
    targetPort: 3000
    nodePort: 30000
  type: NodePort
EOF

# Wait for deployment to be ready
print_status "Waiting for deployment to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/vibecode-webgui -n "$NAMESPACE" || {
    print_warning "Deployment may still be starting. Check with: kubectl get pods -n $NAMESPACE"
}

# Check pod status
print_status "Checking pod status..."
kubectl get pods -n "$NAMESPACE"

# Display access information
print_header "DEPLOYMENT COMPLETE"

cat << EOF
🎉 Application deployed to existing cluster!

Access Information:
- Application: http://localhost:30000
- Cluster: vibecode-kind-local
- Namespace: $NAMESPACE

Useful Commands:
# Check application status
kubectl get pods -n $NAMESPACE

# View application logs
kubectl logs -n $NAMESPACE -l app=vibecode-webgui

# Port forward (alternative access)
kubectl port-forward -n $NAMESPACE service/vibecode-webgui 3000:3000

# Scale application
kubectl scale deployment vibecode-webgui -n $NAMESPACE --replicas=2

# Delete deployment
kubectl delete namespace $NAMESPACE

Your existing PostgreSQL container is still running on localhost:5432
EOF

print_success "Deployment completed! 🚀"
print_status "Try accessing: http://localhost:30000"
