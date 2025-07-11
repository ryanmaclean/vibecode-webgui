#!/bin/bash
# VibeCode User Provisioning Script
# Creates a complete workspace for a new user

set -euo pipefail

# Configuration
NAMESPACE="${NAMESPACE:-vibecode-platform}"
HELM_RELEASE="${HELM_RELEASE:-vibecode-platform}"
CHART_PATH="${CHART_PATH:-helm/vibecode-platform}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Validate user ID
validate_user_id() {
    local user_id="$1"
    
    if [ -z "$user_id" ]; then
        log_error "User ID is required"
        return 1
    fi
    
    # Check format: alphanumeric and hyphens only, 3-63 chars
    if ! [[ "$user_id" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$ ]] || [ ${#user_id} -lt 3 ] || [ ${#user_id} -gt 63 ]; then
        log_error "User ID must be 3-63 characters, alphanumeric with hyphens, starting and ending with alphanumeric"
        return 1
    fi
    
    return 0
}

# Check if user workspace already exists
user_exists() {
    local user_id="$1"
    kubectl get deployment "code-server-$user_id" -n "$NAMESPACE" >/dev/null 2>&1
}

# Generate secure password
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Create user workspace using Helm template
create_user_workspace() {
    local user_id="$1"
    local password="$2"
    
    log_info "Creating workspace for user: $user_id"
    
    # Create user-specific secret
    kubectl create secret generic "code-server-$user_id-config" \
        --namespace="$NAMESPACE" \
        --from-literal=password="$password" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Label the secret
    kubectl label secret "code-server-$user_id-config" \
        --namespace="$NAMESPACE" \
        app.kubernetes.io/name=vibecode-platform \
        app.kubernetes.io/instance="$HELM_RELEASE" \
        app.kubernetes.io/component=code-server \
        vibecode.dev/user-id="$user_id" \
        --overwrite
    
    # Create temporary values file for this user
    local temp_values=$(mktemp)
    cat > "$temp_values" <<EOF
examples:
  createSampleUser: true
  
# Override for this specific user
userOverride:
  userId: "$user_id"
  password: "$password"
EOF
    
    # Generate manifests using Helm template
    local temp_manifests=$(mktemp)
    helm template "$HELM_RELEASE" "$CHART_PATH" \
        --values "$CHART_PATH/values.yaml" \
        --values "$temp_values" \
        --set "examples.createSampleUser=true" \
        --namespace "$NAMESPACE" > "$temp_manifests"
    
    # Filter and customize manifests for this user
    local user_manifests=$(mktemp)
    
    # Extract only the user-specific resources and replace sample-user with actual user ID
    sed "s/sample-user/$user_id/g" "$temp_manifests" | \
    grep -A 1000 "name: code-server-$user_id" | \
    grep -B 1000 "^---$" > "$user_manifests" || true
    
    # Apply the manifests
    if [ -s "$user_manifests" ]; then
        kubectl apply -f "$user_manifests"
    else
        log_warning "No user-specific manifests generated, creating manually..."
        create_user_resources_manually "$user_id" "$password"
    fi
    
    # Cleanup temp files
    rm -f "$temp_values" "$temp_manifests" "$user_manifests"
}

# Fallback: Create user resources manually
create_user_resources_manually() {
    local user_id="$1"
    local password="$2"
    
    # Get values from the Helm chart
    local storage_size=$(helm template "$HELM_RELEASE" "$CHART_PATH" --show-only templates/configmap.yaml | grep -o "10Gi" | head -1 || echo "10Gi")
    local storage_class=$(helm template "$HELM_RELEASE" "$CHART_PATH" --show-only templates/configmap.yaml | grep -o "vibecode-local-storage" | head -1 || echo "vibecode-local-storage")
    
    # Create PVC
    kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: workspace-$user_id
  namespace: $NAMESPACE
  labels:
    app.kubernetes.io/name: vibecode-platform
    app.kubernetes.io/instance: $HELM_RELEASE
    app.kubernetes.io/component: code-server
    vibecode.dev/user-id: $user_id
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: $storage_size
  storageClassName: $storage_class
EOF
    
    # Create Deployment
    kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: code-server-$user_id
  namespace: $NAMESPACE
  labels:
    app.kubernetes.io/name: vibecode-platform
    app.kubernetes.io/instance: $HELM_RELEASE
    app.kubernetes.io/component: code-server
    vibecode.dev/user-id: $user_id
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: vibecode-platform
      app.kubernetes.io/instance: $HELM_RELEASE
      app.kubernetes.io/component: code-server
      vibecode.dev/user-id: $user_id
  template:
    metadata:
      labels:
        app.kubernetes.io/name: vibecode-platform
        app.kubernetes.io/instance: $HELM_RELEASE
        app.kubernetes.io/component: code-server
        vibecode.dev/user-id: $user_id
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
      containers:
      - name: code-server
        image: codercom/code-server:4.22.1
        imagePullPolicy: IfNotPresent
        ports:
        - name: http
          containerPort: 8080
          protocol: TCP
        env:
        - name: USER_ID
          value: $user_id
        - name: PASSWORD
          valueFrom:
            secretKeyRef:
              name: code-server-$user_id-config
              key: password
        securityContext:
          runAsNonRoot: true
          runAsUser: 1000
          runAsGroup: 1000
          capabilities:
            drop:
              - ALL
          readOnlyRootFilesystem: false
          allowPrivilegeEscalation: false
        resources:
          requests:
            cpu: "500m"
            memory: "1Gi"
          limits:
            cpu: "2000m"
            memory: "4Gi"
        volumeMounts:
        - name: workspace
          mountPath: /home/coder
      volumes:
      - name: workspace
        persistentVolumeClaim:
          claimName: workspace-$user_id
EOF
    
    # Create Service
    kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: code-server-$user_id
  namespace: $NAMESPACE
  labels:
    app.kubernetes.io/name: vibecode-platform
    app.kubernetes.io/instance: $HELM_RELEASE
    app.kubernetes.io/component: code-server
    vibecode.dev/user-id: $user_id
spec:
  type: ClusterIP
  ports:
  - port: 8080
    targetPort: 8080
    protocol: TCP
    name: http
  selector:
    app.kubernetes.io/name: vibecode-platform
    app.kubernetes.io/instance: $HELM_RELEASE
    app.kubernetes.io/component: code-server
    vibecode.dev/user-id: $user_id
EOF
    
    # Create Ingress
    kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: code-server-$user_id
  namespace: $NAMESPACE
  labels:
    app.kubernetes.io/name: vibecode-platform
    app.kubernetes.io/instance: $HELM_RELEASE
    app.kubernetes.io/component: code-server
    vibecode.dev/user-id: $user_id
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/backend-protocol: "HTTP"
spec:
  ingressClassName: nginx
  rules:
  - host: $user_id.vibecode.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: code-server-$user_id
            port:
              number: 8080
EOF
}

# Wait for workspace to be ready
wait_for_workspace() {
    local user_id="$1"
    local timeout=300  # 5 minutes
    local counter=0
    
    log_info "Waiting for workspace to be ready..."
    
    while [ $counter -lt $timeout ]; do
        if kubectl get deployment "code-server-$user_id" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' | grep -q "1"; then
            log_success "Workspace is ready"
            return 0
        fi
        
        sleep 5
        counter=$((counter + 5))
        echo -n "."
    done
    
    log_error "Workspace failed to become ready within ${timeout} seconds"
    return 1
}

# Display connection info
display_connection_info() {
    local user_id="$1"
    local password="$2"
    
    echo ""
    log_success "User workspace created successfully!"
    echo ""
    echo "User ID: $user_id"
    echo "Access URL: http://$user_id.vibecode.local"
    echo "Password: $password"
    echo ""
    echo "To get the password later:"
    echo "kubectl get secret code-server-$user_id-config -n $NAMESPACE -o jsonpath='{.data.password}' | base64 -d"
    echo ""
}

# Cleanup user workspace
cleanup_user() {
    local user_id="$1"
    local delete_storage="${2:-false}"
    
    log_info "Cleaning up workspace for user: $user_id"
    
    # Delete resources in order
    kubectl delete ingress "code-server-$user_id" -n "$NAMESPACE" --ignore-not-found=true
    kubectl delete service "code-server-$user_id" -n "$NAMESPACE" --ignore-not-found=true
    kubectl delete deployment "code-server-$user_id" -n "$NAMESPACE" --ignore-not-found=true
    kubectl delete secret "code-server-$user_id-config" -n "$NAMESPACE" --ignore-not-found=true
    
    # Optionally delete PVC
    if [ "$delete_storage" = "true" ]; then
        kubectl delete pvc "workspace-$user_id" -n "$NAMESPACE" --ignore-not-found=true
        log_warning "Storage for user $user_id has been deleted!"
    else
        log_info "Storage for user $user_id preserved (use --delete-storage to remove)"
    fi
    
    log_success "Successfully cleaned up workspace for user: $user_id"
}

# List all users
list_users() {
    log_info "Active user workspaces in namespace: $NAMESPACE"
    echo ""
    
    kubectl get deployments -n "$NAMESPACE" -l app.kubernetes.io/component=code-server -o custom-columns="USER ID:.metadata.labels.vibecode\.dev/user-id,STATUS:.status.conditions[?(@.type=='Available')].status,READY:.status.readyReplicas,AGE:.metadata.creationTimestamp" --no-headers | while read line; do
        if [ -n "$line" ]; then
            echo "$line"
        fi
    done
}

# Show usage
usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  create <user-id>        Create a new user workspace"
    echo "  delete <user-id>        Delete a user workspace"
    echo "  list                    List all user workspaces"
    echo "  status <user-id>        Show status of a user workspace"
    echo ""
    echo "Options:"
    echo "  --namespace <ns>        Kubernetes namespace (default: vibecode-platform)"
    echo "  --delete-storage        Delete persistent storage when deleting user"
    echo "  --help                  Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 create alice"
    echo "  $0 delete bob --delete-storage"
    echo "  $0 list"
    echo "  $0 status alice"
}

# Parse command line arguments
COMMAND=""
USER_ID=""
DELETE_STORAGE="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        create|delete|list|status)
            COMMAND="$1"
            shift
            ;;
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --delete-storage)
            DELETE_STORAGE="true"
            shift
            ;;
        --help)
            usage
            exit 0
            ;;
        -*)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
        *)
            if [ -z "$USER_ID" ]; then
                USER_ID="$1"
            else
                log_error "Unexpected argument: $1"
                usage
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate prerequisites
if ! command_exists kubectl; then
    log_error "kubectl is not installed or not in PATH"
    exit 1
fi

if ! command_exists helm; then
    log_error "helm is not installed or not in PATH"
    exit 1
fi

# Execute command
case "$COMMAND" in
    create)
        if [ -z "$USER_ID" ]; then
            log_error "User ID is required for create command"
            usage
            exit 1
        fi
        
        if ! validate_user_id "$USER_ID"; then
            exit 1
        fi
        
        if user_exists "$USER_ID"; then
            log_error "User workspace for '$USER_ID' already exists"
            exit 1
        fi
        
        PASSWORD=$(generate_password)
        create_user_workspace "$USER_ID" "$PASSWORD"
        wait_for_workspace "$USER_ID"
        display_connection_info "$USER_ID" "$PASSWORD"
        ;;
        
    delete)
        if [ -z "$USER_ID" ]; then
            log_error "User ID is required for delete command"
            usage
            exit 1
        fi
        
        if ! user_exists "$USER_ID"; then
            log_error "User workspace for '$USER_ID' does not exist"
            exit 1
        fi
        
        cleanup_user "$USER_ID" "$DELETE_STORAGE"
        ;;
        
    list)
        list_users
        ;;
        
    status)
        if [ -z "$USER_ID" ]; then
            log_error "User ID is required for status command"
            usage
            exit 1
        fi
        
        if ! user_exists "$USER_ID"; then
            log_error "User workspace for '$USER_ID' does not exist"
            exit 1
        fi
        
        echo "Deployment status:"
        kubectl get deployment "code-server-$USER_ID" -n "$NAMESPACE"
        echo ""
        echo "Pod status:"
        kubectl get pods -l vibecode.dev/user-id="$USER_ID" -n "$NAMESPACE"
        echo ""
        echo "Service status:"
        kubectl get service "code-server-$USER_ID" -n "$NAMESPACE"
        echo ""
        echo "Ingress status:"
        kubectl get ingress "code-server-$USER_ID" -n "$NAMESPACE"
        ;;
        
    "")
        log_error "Command is required"
        usage
        exit 1
        ;;
        
    *)
        log_error "Unknown command: $COMMAND"
        usage
        exit 1
        ;;
esac