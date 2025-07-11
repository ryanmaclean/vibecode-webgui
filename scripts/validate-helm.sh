#!/bin/bash
# Helm Chart Validation Script
# Validates the VibeCode platform Helm chart

set -euo pipefail

# Configuration
CHART_PATH="${CHART_PATH:-helm/vibecode-platform}"
NAMESPACE="${NAMESPACE:-vibecode-platform}"

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

# Validate prerequisites
validate_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command_exists helm; then
        log_error "Helm is not installed or not in PATH"
        exit 1
    fi
    
    if ! command_exists kubectl; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Validate chart structure
validate_chart_structure() {
    log_info "Validating chart structure..."
    
    # Check required files
    local required_files=(
        "Chart.yaml"
        "values.yaml"
        "README.md"
        "templates/_helpers.tpl"
        "templates/serviceaccount.yaml"
        "templates/configmap.yaml"
        "templates/secret.yaml"
        "templates/rbac.yaml"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$CHART_PATH/$file" ]; then
            log_error "Required file missing: $file"
            exit 1
        fi
    done
    
    log_success "Chart structure validation passed"
}

# Lint Helm chart
lint_chart() {
    log_info "Linting Helm chart..."
    
    cd "$CHART_PATH"
    helm lint .
    cd - >/dev/null
    
    log_success "Helm chart linting passed"
}

# Template chart
template_chart() {
    log_info "Templating Helm chart..."
    
    local temp_output=$(mktemp)
    
    if ! helm template vibecode-platform "$CHART_PATH" \
        --namespace "$NAMESPACE" \
        --values "$CHART_PATH/values.yaml" > "$temp_output"; then
        log_error "Helm template generation failed"
        rm -f "$temp_output"
        exit 1
    fi
    
    # Check that we generated some output
    if [ ! -s "$temp_output" ]; then
        log_error "Helm template generated empty output"
        rm -f "$temp_output"
        exit 1
    fi
    
    # Basic validation - check for YAML documents
    if ! grep -q "^apiVersion:" "$temp_output"; then
        log_error "Generated templates don't contain valid Kubernetes resources"
        rm -f "$temp_output"
        exit 1
    fi
    
    rm -f "$temp_output"
    log_success "Chart templating passed"
}

# Validate values schema
validate_values() {
    log_info "Validating values.yaml..."
    
    # Check that values.yaml exists and is not empty
    if [ ! -f "$CHART_PATH/values.yaml" ] || [ ! -s "$CHART_PATH/values.yaml" ]; then
        log_error "values.yaml is missing or empty"
        exit 1
    fi
    
    # Template with different value combinations
    local test_values=$(mktemp)
    
    # Test with monitoring disabled
    cat > "$test_values" <<EOF
monitoring:
  enabled: false
security:
  networkPolicies:
    enabled: false
examples:
  createSampleUser: true
EOF
    
    helm template vibecode-platform "$CHART_PATH" \
        --namespace "$NAMESPACE" \
        --values "$CHART_PATH/values.yaml" \
        --values "$test_values" >/dev/null
    
    # Test with development environment
    cat > "$test_values" <<EOF
environments:
  development:
    codeServer:
      resources:
        requests:
          cpu: "250m"
          memory: "512Mi"
EOF
    
    helm template vibecode-platform "$CHART_PATH" \
        --namespace "$NAMESPACE" \
        --values "$CHART_PATH/values.yaml" \
        --values "$test_values" >/dev/null
    
    rm -f "$test_values"
    log_success "Values validation passed"
}

# Check for security best practices
validate_security() {
    log_info "Validating security configurations..."
    
    local temp_output=$(mktemp)
    
    helm template vibecode-platform "$CHART_PATH" \
        --namespace "$NAMESPACE" \
        --values "$CHART_PATH/values.yaml" > "$temp_output"
    
    # Check for security contexts
    if ! grep -q "runAsNonRoot.*true" "$temp_output"; then
        log_error "No runAsNonRoot security context found"
        rm -f "$temp_output"
        exit 1
    fi
    
    # Check for network policies
    if ! grep -q "kind: NetworkPolicy" "$temp_output"; then
        log_warning "No NetworkPolicy found (may be disabled in values)"
    fi
    
    # Check for resource quotas
    if ! grep -q "kind: ResourceQuota" "$temp_output"; then
        log_error "No ResourceQuota found"
        rm -f "$temp_output"
        exit 1
    fi
    
    # Check for RBAC
    if ! grep -q "kind: Role\|kind: ClusterRole" "$temp_output"; then
        log_error "No RBAC roles found"
        rm -f "$temp_output"
        exit 1
    fi
    
    rm -f "$temp_output"
    log_success "Security validation passed"
}

# Validate user provisioning template
validate_user_templates() {
    log_info "Validating user provisioning templates..."
    
    # Check that user templates can be generated
    local temp_output=$(mktemp)
    
    helm template vibecode-platform "$CHART_PATH" \
        --namespace "$NAMESPACE" \
        --values "$CHART_PATH/values.yaml" \
        --set "examples.createSampleUser=true" > "$temp_output"
    
    # Check for sample user resources
    if ! grep -q "name: code-server-sample-user" "$temp_output"; then
        log_error "Sample user deployment not generated"
        rm -f "$temp_output"
        exit 1
    fi
    
    if ! grep -q "name: workspace-sample-user" "$temp_output"; then
        log_error "Sample user PVC not generated"
        rm -f "$temp_output"
        exit 1
    fi
    
    rm -f "$temp_output"
    log_success "User template validation passed"
}

# Main execution
main() {
    log_info "Starting Helm chart validation..."
    
    validate_prerequisites
    validate_chart_structure
    lint_chart
    template_chart
    validate_values
    validate_security
    validate_user_templates
    
    log_success "All Helm chart validations passed!"
    echo ""
    echo "Chart is ready for deployment:"
    echo "  helm install vibecode-platform $CHART_PATH --namespace $NAMESPACE --create-namespace"
    echo ""
}

# Show usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --chart-path <path>     Path to Helm chart (default: helm/vibecode-platform)"
    echo "  --namespace <ns>        Target namespace (default: vibecode-platform)"
    echo "  --help                  Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0"
    echo "  $0 --chart-path ./my-chart --namespace my-namespace"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --chart-path)
            CHART_PATH="$2"
            shift 2
            ;;
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Run main function
main "$@"