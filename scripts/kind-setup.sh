#!/bin/bash

# VibeCode WebGUI KIND Cluster Setup Script
# This script sets up a complete development environment using KIND

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CLUSTER_NAME="vibecode-dev"
NAMESPACE="vibecode-webgui"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi

    # Check if KIND is installed
    if ! command -v kind &> /dev/null; then
        log_error "KIND is not installed. Please install KIND first."
        echo "macOS: brew install kind"
        echo "Linux: curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64"
        exit 1
    fi

    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed. Please install kubectl first."
        exit 1
    fi

    log_success "All prerequisites are met"
}

# Create KIND cluster
create_cluster() {
    log_info "Creating KIND cluster: $CLUSTER_NAME"

    # Delete existing cluster if it exists
    if kind get clusters | grep -q "^$CLUSTER_NAME$"; then
        log_warning "Cluster $CLUSTER_NAME already exists. Deleting..."
        kind delete cluster --name "$CLUSTER_NAME"
    fi

    # Create new cluster
    kind create cluster --name "$CLUSTER_NAME" --config="$PROJECT_ROOT/infrastructure/kind/cluster-config.yaml"

    # Wait for cluster to be ready
    log_info "Waiting for cluster to be ready..."
    kubectl wait --for=condition=Ready nodes --all --timeout=300s

    log_success "KIND cluster created successfully"
}

# Install NGINX Ingress Controller
install_ingress() {
    log_info "Installing NGINX Ingress Controller..."

    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

    # Wait for ingress controller to be ready
    log_info "Waiting for ingress controller to be ready..."
    kubectl wait --namespace ingress-nginx \
        --for=condition=ready pod \
        --selector=app.kubernetes.io/component=controller \
        --timeout=300s

    log_success "NGINX Ingress Controller installed"
}

# Build and load Docker images
build_and_load_images() {
    log_info "Building Docker images..."

    cd "$PROJECT_ROOT"

    # Build main application image
    log_info "Building main application image..."
    docker build -t vibecode/webgui:latest .

    # Build code-server image
    log_info "Building code-server image..."
    docker build -t vibecode/code-server:latest ./docker/code-server

    # Build WebSocket server image
    log_info "Building WebSocket server image..."
    docker build -t vibecode/websocket:latest -f ./docker/development/Dockerfile.websocket .

    # Load images into KIND cluster
    log_info "Loading images into KIND cluster..."
    kind load docker-image vibecode/webgui:latest --name "$CLUSTER_NAME"
    kind load docker-image vibecode/code-server:latest --name "$CLUSTER_NAME"
    kind load docker-image vibecode/websocket:latest --name "$CLUSTER_NAME"

    log_success "Docker images built and loaded"
}

# Deploy application to Kubernetes
deploy_application() {
    log_info "Deploying application to Kubernetes..."

    cd "$PROJECT_ROOT"

    # Create namespace
    kubectl apply -f infrastructure/kubernetes/namespace.yaml

    # Create storage
    kubectl apply -f infrastructure/kubernetes/storage.yaml

    # Create secrets (with development values)
    log_info "Creating secrets with development values..."
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: code-server-secrets
  namespace: $NAMESPACE
type: Opaque
stringData:
  password: "vibecode123"
---
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secrets
  namespace: $NAMESPACE
type: Opaque
stringData:
  POSTGRES_USER: "vibecode"
  POSTGRES_PASSWORD: "vibecode123"
  POSTGRES_DB: "vibecode_dev"
---
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: $NAMESPACE
type: Opaque
stringData:
  NEXTAUTH_SECRET: "REPLACE_WITH_SECURE_NEXTAUTH_SECRET"
  DATABASE_URL: "postgresql://vibecode:vibecode123@postgres-service:5432/vibecode_dev"
  REDIS_URL: "redis://redis-service:6379"
  CLAUDE_API_KEY: "placeholder-key"
  GITHUB_ID: "placeholder-id"
  GITHUB_SECRET: "placeholder-secret"
EOF

    # Deploy PostgreSQL
    log_info "Deploying PostgreSQL..."
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: $NAMESPACE
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
        image: postgres:16-alpine
        env:
        - name: POSTGRES_DB
          valueFrom:
            secretKeyRef:
              name: postgres-secrets
              key: POSTGRES_DB
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgres-secrets
              key: POSTGRES_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secrets
              key: POSTGRES_PASSWORD
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
        - name: init-script
          mountPath: /docker-entrypoint-initdb.d
      volumes:
      - name: postgres-data
        persistentVolumeClaim:
          claimName: postgres-pvc
      - name: init-script
        configMap:
          name: postgres-init
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: $NAMESPACE
spec:
  ports:
  - port: 5432
    targetPort: 5432
    nodePort: 30432
  selector:
    app: postgres
  type: NodePort
EOF

    # Deploy Redis
    log_info "Deploying Redis..."
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: $NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        volumeMounts:
        - name: redis-data
          mountPath: /data
      volumes:
      - name: redis-data
        persistentVolumeClaim:
          claimName: redis-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: $NAMESPACE
spec:
  ports:
  - port: 6379
    targetPort: 6379
    nodePort: 30379
  selector:
    app: redis
  type: NodePort
EOF

    # Create ConfigMap for PostgreSQL init script
    kubectl create configmap postgres-init \
        --from-file="$PROJECT_ROOT/infrastructure/postgres/init.sql" \
        --namespace="$NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -

    # Deploy code-server
    kubectl apply -f infrastructure/kubernetes/code-server-deployment.yaml

    log_success "Application deployed to Kubernetes"
}

# Wait for deployments to be ready
wait_for_deployments() {
    log_info "Waiting for deployments to be ready..."

    kubectl wait --for=condition=available deployment/postgres -n "$NAMESPACE" --timeout=300s
    kubectl wait --for=condition=available deployment/redis -n "$NAMESPACE" --timeout=300s
    kubectl wait --for=condition=available deployment/code-server -n "$NAMESPACE" --timeout=300s

    log_success "All deployments are ready"
}

# Set up port forwarding
setup_port_forwarding() {
    log_info "Setting up port forwarding..."

    # Kill any existing port-forward processes
    pkill -f "kubectl.*port-forward" || true

    # Start port forwarding in background
    nohup kubectl port-forward -n "$NAMESPACE" service/code-server-service 8080:8080 > /tmp/code-server-port-forward.log 2>&1 &
    nohup kubectl port-forward -n "$NAMESPACE" service/postgres-service 5432:5432 > /tmp/postgres-port-forward.log 2>&1 &
    nohup kubectl port-forward -n "$NAMESPACE" service/redis-service 6379:6379 > /tmp/redis-port-forward.log 2>&1 &

    sleep 3

    log_success "Port forwarding set up"
}

# Display access information
display_access_info() {
    echo ""
    log_success "VibeCode WebGUI KIND cluster is ready!"
    echo ""
    echo "🌐 Access URLs:"
    echo "  - Code-Server IDE: http://localhost:8080 (password: vibecode123)"
    echo "  - PostgreSQL: localhost:5432 (user: vibecode, password: vibecode123)"
    echo "  - Redis: localhost:6379"
    echo ""
    echo "🔧 Useful commands:"
    echo "  - View pods: kubectl get pods -n $NAMESPACE"
    echo "  - View services: kubectl get services -n $NAMESPACE"
    echo "  - View logs: kubectl logs -f deployment/code-server -n $NAMESPACE"
    echo "  - Delete cluster: kind delete cluster --name $CLUSTER_NAME"
    echo ""
    echo "📝 Note: Port forwarding is running in the background."
    echo "   To stop it, run: pkill -f 'kubectl.*port-forward'"
    echo ""
}

# Cleanup function
cleanup() {
    log_info "Cleaning up KIND cluster..."
    kind delete cluster --name "$CLUSTER_NAME"
    log_success "KIND cluster deleted"
}

# Main execution
main() {
    case "${1:-setup}" in
        setup)
            check_prerequisites
            create_cluster
            install_ingress
            build_and_load_images
            deploy_application
            wait_for_deployments
            setup_port_forwarding
            display_access_info
            ;;
        cleanup)
            cleanup
            ;;
        *)
            echo "Usage: $0 {setup|cleanup}"
            echo "  setup   - Create and configure KIND cluster"
            echo "  cleanup - Delete KIND cluster"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
