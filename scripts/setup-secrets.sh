#!/bin/bash
# Kubernetes Secrets Automation Script - 2025 Best Practices
# Automates creation of Kubernetes secrets from environment variables
# Designed for CI/CD integration and local development

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_NAMESPACE="vibecode-dev"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Flags (can be toggled by CLI options)
WRITE_ENV=false

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Generate a secure random password (32 chars alnum + symbols)
generate_password() {
    local pass
    if command -v openssl >/dev/null 2>&1; then
        pass=$(openssl rand -base64 48 | tr -d '\n' | tr -dc 'A-Za-z0-9!@#%^*_+=' | head -c 32)
    else
        # Fallback using /dev/urandom
        pass=$(LC_CTYPE=C tr -dc 'A-Za-z0-9!@#%^*_+=' </dev/urandom | head -c 32)
    fi
    echo "$pass"
}

# Optionally persist generated creds to .env.local
write_env_if_requested() {
    local key="$1"; local value="$2"
    if [[ "$WRITE_ENV" == "true" ]]; then
        local env_file="$PROJECT_ROOT/.env.local"
        if [[ ! -f "$env_file" ]]; then
            touch "$env_file"
        fi
        # Append; last one wins if duplicates exist
        printf "\n# Added by setup-secrets.sh on $(date -u +'%Y-%m-%dT%H:%M:%SZ')\n%s=%s\n" "$key" "$value" >> "$env_file"
    fi
}

# Ensure Datadog DBM username/password exist in env (generate if missing)
ensure_dbm_creds() {
    # Username: default to 'datadog' if unset
    if [[ -z "${DD_POSTGRES_USER:-}" ]]; then
        export DD_POSTGRES_USER="datadog"
        write_env_if_requested "DD_POSTGRES_USER" "$DD_POSTGRES_USER"
    fi
    # Maintain legacy alias in the environment for compatibility (not persisted unless requested)
    if [[ -z "${DATADOG_POSTGRES_USER:-}" ]]; then
        export DATADOG_POSTGRES_USER="$DD_POSTGRES_USER"
    fi

    # Password: prefer DD_POSTGRES_PASSWORD, fallback from legacy, otherwise generate
    if [[ -z "${DD_POSTGRES_PASSWORD:-}" && -n "${DATADOG_POSTGRES_PASSWORD:-}" ]]; then
        export DD_POSTGRES_PASSWORD="$DATADOG_POSTGRES_PASSWORD"
        log_warning "DD_POSTGRES_PASSWORD missing; using legacy DATADOG_POSTGRES_PASSWORD"
    fi

    if [[ -z "${DD_POSTGRES_PASSWORD:-}" ]]; then
        local gen
        gen=$(generate_password)
        export DD_POSTGRES_PASSWORD="$gen"
        # Also set legacy var for downstream compatibility
        export DATADOG_POSTGRES_PASSWORD="$gen"
        write_env_if_requested "DD_POSTGRES_PASSWORD" "$DD_POSTGRES_PASSWORD"
        # Optionally persist legacy for compatibility
        if [[ "$WRITE_ENV" == "true" ]]; then
            write_env_if_requested "DATADOG_POSTGRES_PASSWORD" "$DD_POSTGRES_PASSWORD"
        fi
        log_success "Generated Datadog DBM password"
    fi
}

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."
    
    local missing_deps=()
    
    if ! command -v kubectl &> /dev/null; then
        missing_deps+=("kubectl")
    fi
    
    if ! command -v helm &> /dev/null; then
        missing_deps+=("helm")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_info "Please install the missing dependencies and try again"
        exit 1
    fi
    
    log_success "All dependencies found"
}

# Source environment variables
source_environment() {
    log_info "Sourcing environment variables..."
    
    local env_files=(
        "$PROJECT_ROOT/.env"
        "$PROJECT_ROOT/.env.local"
        "$HOME/.vibecode/.env"
    )
    
    local sourced=false
    for env_file in "${env_files[@]}"; do
        if [[ -f "$env_file" ]]; then
            log_info "Sourcing $env_file"
            # shellcheck source=/dev/null
            source "$env_file"
            sourced=true
            break
        fi
    done
    
    if [[ "$sourced" == "false" ]]; then
        log_warning "No environment file found. Checking environment variables..."
    fi
}

# Validate required environment variables
validate_environment() {
    log_info "Validating environment variables..."
    
    # Prefer DD_*; allow legacy DATADOG_* fallback with warning
    if [[ -z "${DD_API_KEY:-}" && -n "${DATADOG_API_KEY:-}" ]]; then
        export DD_API_KEY="$DATADOG_API_KEY"
        log_warning "DD_API_KEY missing; using legacy DATADOG_API_KEY"
    fi
    # If both are set and differ, warn and prefer DD_API_KEY
    if [[ -n "${DD_API_KEY:-}" && -n "${DATADOG_API_KEY:-}" && "$DD_API_KEY" != "$DATADOG_API_KEY" ]]; then
        log_warning "Both DD_API_KEY and DATADOG_API_KEY are set and differ; using DD_API_KEY"
    fi
    
    local required_vars=(
        "DD_API_KEY:Datadog API Key"
        "POSTGRES_PASSWORD:PostgreSQL Password"
    )
    
    local missing_vars=()
    
    for var_info in "${required_vars[@]}"; do
        local var_name="${var_info%%:*}"
        local var_desc="${var_info##*:}"
        
        if [[ -z "${!var_name:-}" ]]; then
            missing_vars+=("$var_name ($var_desc)")
        else
            log_success "$var_desc: ✓"
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        log_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            log_error "  - $var"
        done
        log_info ""
        log_info "Please set these variables in one of:"
        log_info "  - $PROJECT_ROOT/.env (preferred) or $PROJECT_ROOT/.env.local"
        log_info "  - Environment variables"
        log_info "  - CI/CD pipeline secrets"
        exit 1
    fi
    
    log_success "All required environment variables are set"
}

# Check Kubernetes connection
check_kubernetes_connection() {
    log_info "Checking Kubernetes connection..."
    
    if ! kubectl cluster-info >/dev/null 2>&1; then
        log_error "Cannot connect to Kubernetes cluster"
        log_info "Please ensure kubectl is configured and cluster is accessible"
        exit 1
    fi
    
    local context
    context=$(kubectl config current-context)
    log_success "Connected to Kubernetes cluster: $context"
}

# Create namespace if it doesn't exist
ensure_namespace() {
    local namespace="${1:-$DEFAULT_NAMESPACE}"
    
    log_info "Ensuring namespace '$namespace' exists..."
    
    if ! kubectl get namespace "$namespace" >/dev/null 2>&1; then
        log_info "Creating namespace '$namespace'..."
        kubectl create namespace "$namespace"
        kubectl label namespace "$namespace" \
            app.kubernetes.io/managed-by=vibecode-platform \
            environment="${namespace#vibecode-}" 2>/dev/null || true
        log_success "Namespace '$namespace' created"
    else
        log_success "Namespace '$namespace' already exists"
    fi
}

# Create or update secret
create_or_update_secret() {
    local namespace="$1"
    local secret_name="$2"
    local secret_data="$3"
    
    log_info "Managing secret '$secret_name' in namespace '$namespace'..."
    
    # Check if secret exists
    if kubectl get secret "$secret_name" -n "$namespace" >/dev/null 2>&1; then
        log_info "Secret '$secret_name' exists, updating..."
        
        # Update secret
        echo "$secret_data" | kubectl apply -f -
        
        # Add labels to track management
        kubectl label secret "$secret_name" \
            app.kubernetes.io/managed-by=vibecode-platform \
            app.kubernetes.io/created-by=setup-secrets-script \
            --namespace="$namespace" \
            --overwrite >/dev/null 2>&1 || true
            
        log_success "Secret '$secret_name' updated successfully"
    else
        log_info "Creating new secret '$secret_name'..."
        
        # Create secret
        echo "$secret_data" | kubectl apply -f -
        
        # Add labels to track management
        kubectl label secret "$secret_name" \
            app.kubernetes.io/managed-by=vibecode-platform \
            app.kubernetes.io/created-by=setup-secrets-script \
            --namespace="$namespace" >/dev/null 2>&1 || true
            
        log_success "Secret '$secret_name' created successfully"
    fi
}

# Setup Datadog secrets
setup_datadog_secrets() {
    local namespace="${1:-$DEFAULT_NAMESPACE}"
    
    log_info "Setting up Datadog secrets..."
    
    # Datadog API secret
    local datadog_secret_yaml
    datadog_secret_yaml=$(cat <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: datadog-secret
  namespace: $namespace
  labels:
    app.kubernetes.io/name: datadog-secret
    app.kubernetes.io/component: monitoring
    app.kubernetes.io/part-of: vibecode-platform
type: Opaque
data:
  api-key: $(echo -n "$DD_API_KEY" | base64 | tr -d '\n')
EOF
)
    
    # Create/Update canonical secret
    create_or_update_secret "$namespace" "datadog-secret" "$datadog_secret_yaml"

    # Maintain legacy alias for backward compatibility
    local datadog_legacy_secret_yaml
    datadog_legacy_secret_yaml=$(cat <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: datadog-secrets
  namespace: $namespace
  labels:
    app.kubernetes.io/name: datadog-secrets
    app.kubernetes.io/component: monitoring
    app.kubernetes.io/part-of: vibecode-platform
type: Opaque
data:
  api-key: $(echo -n "$DD_API_KEY" | base64 | tr -d '\n')
EOF
)
    create_or_update_secret "$namespace" "datadog-secrets" "$datadog_legacy_secret_yaml"
}

# Setup PostgreSQL secrets
setup_postgres_secrets() {
    local namespace="${1:-$DEFAULT_NAMESPACE}"
    
    log_info "Setting up PostgreSQL secrets..."
    
    # Resolve effective Datadog DBM creds (DD_* preferred, legacy fallback)
    local EFFECTIVE_DD_DBM_USER="${DD_POSTGRES_USER:-${DATADOG_POSTGRES_USER:-datadog}}"
    local EFFECTIVE_DD_DBM_PASS="${DD_POSTGRES_PASSWORD:-${DATADOG_POSTGRES_PASSWORD:-}}"
    if [[ -z "$EFFECTIVE_DD_DBM_PASS" ]]; then
        log_error "Internal error: DD_POSTGRES_PASSWORD should have been generated; empty at secret creation"
        exit 1
    fi

    # PostgreSQL credentials secret
    local postgres_secret_yaml
    postgres_secret_yaml=$(cat <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: postgres-credentials
  namespace: $namespace
  labels:
    app.kubernetes.io/name: postgres-credentials
    app.kubernetes.io/component: database
    app.kubernetes.io/part-of: vibecode-platform
type: Opaque
data:
  postgres-password: $(echo -n "$POSTGRES_PASSWORD" | base64 | tr -d '\n')
  datadog-username: $(echo -n "$EFFECTIVE_DD_DBM_USER" | base64 | tr -d '\n')
  datadog-password: $(echo -n "$EFFECTIVE_DD_DBM_PASS" | base64 | tr -d '\n')
EOF
)
    
    create_or_update_secret "$namespace" "postgres-credentials" "$postgres_secret_yaml"
}

# Verify secrets
verify_secrets() {
    local namespace="${1:-$DEFAULT_NAMESPACE}"
    
    log_info "Verifying secrets in namespace '$namespace'..."
    
    local secrets=("datadog-secret" "datadog-secrets" "postgres-credentials")
    local all_good=true
    
    for secret in "${secrets[@]}"; do
        if kubectl get secret "$secret" -n "$namespace" >/dev/null 2>&1; then
            log_success "Secret '$secret': ✓"
            
            # Verify secret has required keys
            case "$secret" in
                "datadog-secret"|"datadog-secrets")
                    if kubectl get secret "$secret" -n "$namespace" -o jsonpath='{.data.api-key}' | base64 -d >/dev/null 2>&1; then
                        log_success "  - api-key: ✓"
                    else
                        log_error "  - api-key: Missing or invalid"
                        all_good=false
                    fi
                    ;;
                "postgres-credentials")
                    local keys=("postgres-password" "datadog-username" "datadog-password")
                    for key in "${keys[@]}"; do
                        if kubectl get secret "$secret" -n "$namespace" -o jsonpath="{.data.$key}" | base64 -d >/dev/null 2>&1; then
                            log_success "  - $key: ✓"
                        else
                            log_error "  - $key: Missing or invalid"
                            all_good=false
                        fi
                    done
                    ;;
            esac
        else
            log_error "Secret '$secret': Missing"
            all_good=false
        fi
    done
    
    if [[ "$all_good" == "true" ]]; then
        log_success "All secrets verified successfully!"
        return 0
    else
        log_error "Some secrets are missing or invalid"
        return 1
    fi
}

# Print usage
usage() {
    cat <<EOF
Kubernetes Secrets Automation Script - 2025 Best Practices

USAGE:
    $0 [OPTIONS] [NAMESPACE]

OPTIONS:
    -h, --help          Show this help message
    -v, --verify-only   Only verify existing secrets, don't create/update
    -d, --dry-run       Show what would be done without making changes
    --write-env         Persist generated DBM creds to $PROJECT_ROOT/.env.local
    
ARGUMENTS:
    NAMESPACE           Target namespace (default: $DEFAULT_NAMESPACE)

EXAMPLES:
    $0                                    # Setup secrets in default namespace
    $0 vibecode-prod                      # Setup secrets in production namespace
    $0 --verify-only                      # Only verify existing secrets
    $0 --dry-run vibecode-staging         # Dry run for staging namespace

ENVIRONMENT VARIABLES:
    Required:
        DD_API_KEY                        # Datadog API Key
        POSTGRES_PASSWORD                 # PostgreSQL admin password
        
    Optional:
        DD_POSTGRES_USER                  # Datadog DBM username (default: datadog)
        DD_POSTGRES_PASSWORD              # Datadog DBM password (auto-generated if missing)
        DATADOG_POSTGRES_PASSWORD         # Legacy fallback to set DD_POSTGRES_PASSWORD
        DATADOG_API_KEY                   # Legacy fallback to set DD_API_KEY
        KUBECONFIG                        # Kubernetes config file path
        KUBECTL_CONTEXT                   # Kubernetes context to use

ENVIRONMENT FILES:
    The script will automatically source environment variables from:
        1. $PROJECT_ROOT/.env (preferred)
        2. $PROJECT_ROOT/.env.local
        3. $HOME/.vibecode/.env

EOF
}

# Main function
main() {
    local namespace="$DEFAULT_NAMESPACE"
    local verify_only=false
    local dry_run=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                exit 0
                ;;
            -v|--verify-only)
                verify_only=true
                shift
                ;;
            -d|--dry-run)
                dry_run=true
                shift
                ;;
            --write-env)
                WRITE_ENV=true
                shift
                ;;
            -*)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
            *)
                namespace="$1"
                shift
                ;;
        esac
    done
    
    log_info "🔐 Kubernetes Secrets Automation - 2025 Best Practices"
    log_info "Target namespace: $namespace"
    
    if [[ "$dry_run" == "true" ]]; then
        log_warning "DRY RUN MODE - No changes will be made"
    fi
    
    # Run checks
    check_dependencies
    source_environment
    ensure_dbm_creds
    validate_environment
    check_kubernetes_connection
    
    if [[ "$verify_only" == "true" ]]; then
        log_info "Running in verify-only mode..."
        verify_secrets "$namespace"
        exit $?
    fi
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "Would create/update secrets in namespace: $namespace"
        log_info "  - datadog-secret (api-key)"
        log_info "  - datadog-secrets (api-key) [legacy alias]"
        log_info "  - postgres-credentials (postgres-password, datadog-username, datadog-password)"
        exit 0
    fi
    
    # Setup secrets
    ensure_namespace "$namespace"
    setup_datadog_secrets "$namespace"
    setup_postgres_secrets "$namespace"
    
    # Verify everything worked
    if verify_secrets "$namespace"; then
        log_success "🎉 Secrets automation completed successfully!"
        log_info ""
        log_info "Next steps:"
        log_info "  1. Deploy with Helm:"
        log_info "     helm install vibecode-dev ./helm/vibecode-platform \\"
        log_info "       -f ./helm/vibecode-platform/values-dev.yaml \\"
        log_info "       --namespace=$namespace"
        log_info ""
        log_info "  2. Verify Datadog monitoring:"
        log_info "     kubectl get pods -n $namespace | grep datadog"
        exit 0
    else
        log_error "❌ Secrets automation failed!"
        exit 1
    fi
}

# Run main function with all arguments
main "$@"