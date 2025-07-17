#!/bin/bash

# Deploy Authelia Authentication Server to VibeCode Platform
# Enterprise-grade 2FA/SSO authentication with hardware key support

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$SCRIPT_DIR/../k8s"
CLUSTER_NAME="vibecode-cluster"
AUTH_NAMESPACE="vibecode-auth"
STORAGE_NAMESPACE="vibecode-storage"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi

    # Check if KIND cluster exists
    if ! kubectl cluster-info --context "kind-$CLUSTER_NAME" &> /dev/null; then
        log_error "KIND cluster '$CLUSTER_NAME' is not running"
        log_error "Please start the cluster first"
        exit 1
    fi

    # Set kubectl context
    kubectl config use-context "kind-$CLUSTER_NAME" &> /dev/null

    log_info "Prerequisites check passed"
}

# Deploy required databases
deploy_databases() {
    log_info "Deploying PostgreSQL and Redis for Authelia..."

    # Create storage namespace
    kubectl create namespace "$STORAGE_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

    # Deploy PostgreSQL
    kubectl apply -f - << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: $STORAGE_NAMESPACE
  labels:
    app: postgres
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
      securityContext:
        runAsNonRoot: true
        runAsUser: 999
        runAsGroup: 999
        fsGroup: 999
      containers:
      - name: postgres
        image: postgres:15-alpine
        env:
        - name: POSTGRES_DB
          value: authelia
        - name: POSTGRES_USER
          value: authelia
        - name: POSTGRES_PASSWORD
          value: authelia-db-password
        - name: POSTGRES_HOST_AUTH_METHOD
          value: md5
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        ports:
        - containerPort: 5432
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-data
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: $STORAGE_NAMESPACE
  labels:
    app: postgres
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
    name: postgres
EOF

    # Deploy Redis
    kubectl apply -f - << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: $STORAGE_NAMESPACE
  labels:
    app: redis
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
      securityContext:
        runAsNonRoot: true
        runAsUser: 999
        runAsGroup: 999
        fsGroup: 999
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 200m
            memory: 256Mi
        volumeMounts:
        - name: redis-data
          mountPath: /data
      volumes:
      - name: redis-data
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: $STORAGE_NAMESPACE
  labels:
    app: redis
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
    name: redis
EOF

    log_info "Waiting for databases to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/postgres -n "$STORAGE_NAMESPACE"
    kubectl wait --for=condition=available --timeout=300s deployment/redis -n "$STORAGE_NAMESPACE"

    log_info "Databases deployed successfully"
}

# Deploy Authelia
deploy_authelia() {
    log_info "Deploying Authelia authentication server..."

    # Create auth namespace
    kubectl create namespace "$AUTH_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

    # Deploy Authelia configuration and deployment
    kubectl apply -f "$K8S_DIR/authelia/authelia-config.yaml"
    kubectl apply -f "$K8S_DIR/authelia/authelia-deployment.yaml"

    log_info "Waiting for Authelia to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/authelia -n "$AUTH_NAMESPACE"

    log_info "Authelia deployed successfully"
}

# Show deployment status
show_status() {
    log_info "Deployment Status:"
    echo ""

    echo "Storage Namespace ($STORAGE_NAMESPACE):"
    kubectl get pods -n "$STORAGE_NAMESPACE" -o wide
    echo ""

    echo "Authentication Namespace ($AUTH_NAMESPACE):"
    kubectl get pods -n "$AUTH_NAMESPACE" -o wide
    echo ""

    echo "Services:"
    kubectl get svc -n "$STORAGE_NAMESPACE"
    kubectl get svc -n "$AUTH_NAMESPACE"
    echo ""

    echo "Ingress:"
    kubectl get ingress -n "$AUTH_NAMESPACE"
    echo ""
}

# Show connection information
show_connection_info() {
    log_info "Authelia Connection Information:"
    echo ""
    echo "  Authentication URL: http://auth.localhost:8090"
    echo "  Default Users:"
    echo "    - admin@vibecode.dev (password: password123)"
    echo "    - dev@vibecode.dev (password: password123)"
    echo "    - user@vibecode.dev (password: password123)"
    echo ""
    echo "  Access via port-forward:"
    echo "    kubectl port-forward -n $AUTH_NAMESPACE svc/authelia 9091:9091"
    echo "    Then visit: http://localhost:9091"
    echo ""
    echo "  2FA Setup:"
    echo "    1. Login with username/password"
    echo "    2. Scan QR code with authenticator app"
    echo "    3. Enter TOTP code to complete setup"
    echo ""
    echo "  Logs:"
    echo "    kubectl logs -n $AUTH_NAMESPACE -l app=authelia -f"
    echo ""
}

# Main function
main() {
    log_info "Starting Authelia deployment for VibeCode..."

    # Check prerequisites
    check_prerequisites

    # Deploy databases
    deploy_databases

    # Deploy Authelia
    deploy_authelia

    # Show deployment status
    show_status

    # Show connection information
    show_connection_info

    log_info "Authelia deployment completed successfully!"
    log_info "The authentication server is now ready to protect your workspaces."
}

# Execute main function
main "$@"
