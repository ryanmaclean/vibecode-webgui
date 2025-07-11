#!/bin/bash

# VibeCode User Workspace Provisioning Script
# Automated user workspace creation with security and resource management

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHARTS_DIR="$SCRIPT_DIR/../charts"
CLUSTER_NAME="vibecode-cluster"
NAMESPACE="vibecode-platform"
DOMAIN=${VIBECODE_DOMAIN:-"vibecode.dev"}

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

# Help function
show_help() {
    cat << 'EOF'
VibeCode Workspace Provisioning Script

Usage: $0 [OPTIONS] <user_id> <user_email>

Arguments:
    user_id        Unique user identifier (lowercase, alphanumeric, hyphens)
    user_email     User's email address

Options:
    -d, --domain DOMAIN      Custom domain (default: vibecode.dev)
    -n, --namespace NS       Kubernetes namespace (default: vibecode-platform)
    -c, --cpu CPU           CPU limit (default: 1000m)
    -m, --memory MEMORY     Memory limit (default: 2Gi)
    -s, --storage STORAGE   Storage size (default: 10Gi)
    -g, --group GROUP       User group (default: users)
    --dry-run              Show what would be done without executing
    -h, --help             Show this help message

Examples:
    $0 john.doe john@example.com
    $0 --domain dev.vibecode.local alice alice@company.com
    $0 --cpu 2000m --memory 4Gi --storage 20Gi poweruser power@example.com

EOF
}

# Validation functions
validate_user_id() {
    local user_id="$1"
    if [[ ! "$user_id" =~ ^[a-z0-9][a-z0-9-]*[a-z0-9]$ ]]; then
        log_error "Invalid user ID: $user_id"
        log_error "User ID must be lowercase, alphanumeric, may contain hyphens, and not start/end with hyphen"
        return 1
    fi
    if [[ ${#user_id} -gt 63 ]]; then
        log_error "User ID too long: $user_id (max 63 characters)"
        return 1
    fi
}

validate_email() {
    local email="$1"
    if [[ ! "$email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
        log_error "Invalid email format: $email"
        return 1
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        return 1
    fi
    
    # Check if helm is available
    if ! command -v helm &> /dev/null; then
        log_error "helm is not installed or not in PATH"
        return 1
    fi
    
    # Check if KIND cluster exists
    if ! kubectl cluster-info --context "kind-$CLUSTER_NAME" &> /dev/null; then
        log_error "KIND cluster '$CLUSTER_NAME' is not running"
        log_error "Please start the cluster with: kind create cluster --name $CLUSTER_NAME"
        return 1
    fi
    
    # Set kubectl context
    kubectl config use-context "kind-$CLUSTER_NAME" &> /dev/null
    
    log_info "Prerequisites check passed"
}

# Create namespace if it doesn't exist
ensure_namespace() {
    log_info "Ensuring namespace '$NAMESPACE' exists..."
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
}

# Deploy workspace using Helm
deploy_workspace() {
    local user_id="$1"
    local user_email="$2"
    local cpu="$3"
    local memory="$4"
    local storage="$5"
    local group="$6"
    local dry_run="$7"
    
    local release_name="code-server-$user_id"
    
    log_info "Deploying workspace for user '$user_id'..."
    
    # Helm command
    local helm_cmd="helm upgrade --install $release_name $CHARTS_DIR/vibecode-platform"
    helm_cmd+=" --namespace $NAMESPACE"
    helm_cmd+=" --set user.id=$user_id"
    helm_cmd+=" --set user.email=$user_email"
    helm_cmd+=" --set user.group=$group"
    helm_cmd+=" --set global.domain=$DOMAIN"
    helm_cmd+=" --set codeServer.resources.limits.cpu=$cpu"
    helm_cmd+=" --set codeServer.resources.limits.memory=$memory"
    helm_cmd+=" --set codeServer.persistence.workspace.size=$storage"
    helm_cmd+=" --wait --timeout 300s"
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "Dry run mode - would execute:"
        echo "$helm_cmd --dry-run"
        helm_cmd+=" --dry-run"
    fi
    
    # Execute helm deployment
    if eval "$helm_cmd"; then
        log_info "Workspace deployed successfully"
        
        if [[ "$dry_run" != "true" ]]; then
            show_connection_info "$user_id"
        fi
    else
        log_error "Failed to deploy workspace"
        return 1
    fi
}

# Show connection information
show_connection_info() {
    local user_id="$1"
    
    log_info "Workspace connection information:"
    echo ""
    echo "  User ID: $user_id"
    echo "  Workspace URL: https://$user_id.$DOMAIN"
    echo "  Namespace: $NAMESPACE"
    echo "  Release: code-server-$user_id"
    echo ""
    echo "To access the workspace:"
    echo "  1. Navigate to https://$user_id.$DOMAIN"
    echo "  2. Complete Authelia authentication"
    echo "  3. Your VS Code workspace will be available"
    echo ""
    echo "To manage the workspace:"
    echo "  kubectl get pods -n $NAMESPACE -l user=$user_id"
    echo "  kubectl logs -n $NAMESPACE -l user=$user_id -f"
    echo "  kubectl port-forward -n $NAMESPACE svc/code-server-$user_id 8080:8080"
    echo ""
}

# Main function
main() {
    local user_id=""
    local user_email=""
    local cpu="1000m"
    local memory="2Gi"
    local storage="10Gi"
    local group="users"
    local dry_run="false"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -d|--domain)
                DOMAIN="$2"
                shift 2
                ;;
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -c|--cpu)
                cpu="$2"
                shift 2
                ;;
            -m|--memory)
                memory="$2"
                shift 2
                ;;
            -s|--storage)
                storage="$2"
                shift 2
                ;;
            -g|--group)
                group="$2"
                shift 2
                ;;
            --dry-run)
                dry_run="true"
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            -*)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
            *)
                if [[ -z "$user_id" ]]; then
                    user_id="$1"
                elif [[ -z "$user_email" ]]; then
                    user_email="$1"
                else
                    log_error "Too many arguments"
                    show_help
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # Validate required arguments
    if [[ -z "$user_id" || -z "$user_email" ]]; then
        log_error "Missing required arguments"
        show_help
        exit 1
    fi
    
    # Validate inputs
    validate_user_id "$user_id"
    validate_email "$user_email"
    
    # Check prerequisites
    check_prerequisites
    
    # Ensure namespace exists
    ensure_namespace
    
    # Deploy workspace
    deploy_workspace "$user_id" "$user_email" "$cpu" "$memory" "$storage" "$group" "$dry_run"
    
    log_info "Workspace provisioning completed!"
}

# Execute main function
main "$@"