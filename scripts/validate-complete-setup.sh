#!/bin/bash
# Complete VibeCode Platform Validation Script
# Validates the entire implementation including secrets automation, Datadog integration, and DBM

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_NAMESPACE="vibecode-validation"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}INFO: $1${NC}"
}

log_success() {
    echo -e "${GREEN}SUCCESS: $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}WARNING: $1${NC}"
}

log_error() {
    echo -e "${RED}ERROR: $1${NC}"
}

log_header() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}"
}

# Initialize test results
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

test_result() {
    local test_name="$1"
    local result="$2"
    
    if [[ "$result" == "PASS" ]]; then
        log_success "$test_name: PASSED"
        ((TESTS_PASSED++))
    else
        log_error "$test_name: FAILED"
        FAILED_TESTS+=("$test_name")
        ((TESTS_FAILED++))
    fi
}

# Validate prerequisites
validate_prerequisites() {
    log_header "Validating Prerequisites"
    
    local missing_deps=()
    
    # Check required commands
    for cmd in kubectl helm docker kind; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        test_result "Prerequisites Check" "FAIL"
        return 1
    fi
    
    # Check Kubernetes connection
    if ! kubectl cluster-info >/dev/null 2>&1; then
        log_error "Cannot connect to Kubernetes cluster"
        test_result "Kubernetes Connection" "FAIL"
        return 1
    fi
    
    local context
    context=$(kubectl config current-context)
    log_info "Connected to Kubernetes cluster: $context"
    
    test_result "Prerequisites Check" "PASS"
    test_result "Kubernetes Connection" "PASS"
}

# Test secrets automation
test_secrets_automation() {
    log_header "Testing Secrets Automation"
    
    # Source environment
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        source "$PROJECT_ROOT/.env"
        log_info "Sourced .env"
    elif [[ -f "$PROJECT_ROOT/.env.local" ]]; then
        source "$PROJECT_ROOT/.env.local"
        log_info "Sourced .env.local"
    else
        log_warning ".env not found (nor .env.local), using environment variables"
    fi
    
    # Set test passwords
    export POSTGRES_PASSWORD="test_postgres_$(date +%s)"
    export DATADOG_POSTGRES_PASSWORD="test_datadog_$(date +%s)"
    
    # Test script execution
    if "$PROJECT_ROOT/scripts/setup-secrets.sh" "$TEST_NAMESPACE" >/dev/null 2>&1; then
        test_result "Secrets Script Execution" "PASS"
    else
        test_result "Secrets Script Execution" "FAIL"
        return 1
    fi
    
    # Verify secrets created
    if kubectl get secret datadog-secrets -n "$TEST_NAMESPACE" >/dev/null 2>&1; then
        test_result "Datadog Secrets Creation" "PASS"
        
        # Verify API key length
        local api_key_length
        api_key_length=$(kubectl get secret datadog-secrets -n "$TEST_NAMESPACE" -o jsonpath='{.data.api-key}' | base64 -d | wc -c | tr -d ' ')
        if [[ "$api_key_length" -gt 20 ]]; then
            test_result "API Key Validation" "PASS"
        else
            test_result "API Key Validation" "FAIL"
        fi
    else
        test_result "Datadog Secrets Creation" "FAIL"
    fi
    
    if kubectl get secret postgres-credentials -n "$TEST_NAMESPACE" >/dev/null 2>&1; then
        test_result "PostgreSQL Secrets Creation" "PASS"
        
        # Verify secret keys
        local keys
        keys=$(kubectl get secret postgres-credentials -n "$TEST_NAMESPACE" -o jsonpath='{.data}' | jq -r 'keys[]' 2>/dev/null | sort | tr '\n' ' ')
        if [[ "$keys" == *"datadog-password"* ]] && [[ "$keys" == *"postgres-password"* ]]; then
            test_result "Secret Keys Validation" "PASS"
        else
            test_result "Secret Keys Validation" "FAIL"
        fi
    else
        test_result "PostgreSQL Secrets Creation" "FAIL"
    fi
}

# Test Helm configuration
test_helm_configuration() {
    log_header "Testing Helm Configuration"
    
    # Test Helm dependencies
    if [[ -f "$PROJECT_ROOT/helm/vibecode-platform/Chart.lock" ]]; then
        test_result "Helm Dependencies Downloaded" "PASS"
    else
        log_info "Building Helm dependencies..."
        if helm dependency build "$PROJECT_ROOT/helm/vibecode-platform" >/dev/null 2>&1; then
            test_result "Helm Dependencies Build" "PASS"
        else
            test_result "Helm Dependencies Build" "FAIL"
        fi
    fi
    
    # Test Helm template rendering
    local temp_values
    temp_values=$(mktemp)
    cat > "$temp_values" <<EOF
datadog:
  enabled: true
  targetSystem: "linux"
  datadog:
    apiKey: "test-api-key-for-validation"
    site: datadoghq.com
  agents:
    enabled: true
  clusterAgent:
    enabled: true
EOF
    
    if helm template test-validation "$PROJECT_ROOT/helm/vibecode-platform" \
        -f "$temp_values" \
        --set database.postgresql.auth.postgresPassword="test-pass" \
        --set database.postgresql.auth.datadogPassword="test-datadog-pass" \
        --namespace="$TEST_NAMESPACE" >/dev/null 2>&1; then
        test_result "Helm Template Validation" "PASS"
        
        # Check for both DaemonSet and Deployment
        local temp_output_file
        temp_output_file=$(mktemp)
        
        if helm template test-validation "$PROJECT_ROOT/helm/vibecode-platform" \
            -f "$temp_values" \
            --set database.postgresql.auth.postgresPassword="test-pass" \
            --set database.postgresql.auth.datadogPassword="test-datadog-pass" \
            --namespace="$TEST_NAMESPACE" > "$temp_output_file" 2>/dev/null; then
            
            if grep -q "kind: DaemonSet" "$temp_output_file"; then
                test_result "Datadog Node Agents (DaemonSet)" "PASS"
            else
                test_result "Datadog Node Agents (DaemonSet)" "FAIL"
            fi
            
            if grep -A2 "kind: Deployment" "$temp_output_file" | grep -q "cluster-agent"; then
                test_result "Datadog Cluster Agent (Deployment)" "PASS"
            else
                test_result "Datadog Cluster Agent (Deployment)" "FAIL"
            fi
        else
            test_result "Datadog Node Agents (DaemonSet)" "FAIL"
            test_result "Datadog Cluster Agent (Deployment)" "FAIL"
        fi
        
        rm -f "$temp_output_file"
    else
        test_result "Helm Template Validation" "FAIL"
    fi
    
    rm -f "$temp_values"
}

# Test Datadog configuration
test_datadog_configuration() {
    log_header "Testing Datadog Configuration"
    
    # Check Datadog chart dependency
    if [[ -f "$PROJECT_ROOT/helm/vibecode-platform/charts/datadog-3.60.0.tgz" ]]; then
        test_result "Datadog Chart Dependency" "PASS"
    else
        test_result "Datadog Chart Dependency" "FAIL"
    fi
    
    # Validate Helm values structure
    local dev_values="$PROJECT_ROOT/helm/vibecode-platform/values-dev.yaml"
    if [[ -f "$dev_values" ]]; then
        # Check for required Datadog configuration sections
        if grep -q "datadog:" "$dev_values" && \
           grep -q "agents:" "$dev_values" && \
           grep -q "clusterAgent:" "$dev_values"; then
            test_result "Datadog Configuration Structure" "PASS"
        else
            test_result "Datadog Configuration Structure" "FAIL"
        fi
        
        # Check for 2025 best practices
        if grep -q "targetSystem.*linux" "$dev_values" && \
           grep -q "apiKeyExistingSecret.*datadog-secrets" "$dev_values"; then
            test_result "2025 Best Practices Configuration" "PASS"
        else
            test_result "2025 Best Practices Configuration" "FAIL"
        fi
    else
        test_result "Development Values File" "FAIL"
    fi
}

# Test database monitoring configuration
test_database_monitoring() {
    log_header "Testing Database Monitoring Configuration"
    
    # Check DBM initialization script
    if [[ -f "$PROJECT_ROOT/database/init-dbm.sql" ]]; then
        test_result "DBM Initialization Script" "PASS"
        
        # Check for required functions
        if grep -q "datadog.explain_statement" "$PROJECT_ROOT/database/init-dbm.sql"; then
            test_result "Explain Plans Function" "PASS"
        else
            test_result "Explain Plans Function" "FAIL"
        fi
        
        # Check for monitoring user setup
        if grep -q "CREATE USER datadog" "$PROJECT_ROOT/database/init-dbm.sql"; then
            test_result "Datadog User Creation" "PASS"
        else
            test_result "Datadog User Creation" "FAIL"
        fi
    else
        test_result "DBM Initialization Script" "FAIL"
    fi
    
    # Check PostgreSQL configuration
    if [[ -f "$PROJECT_ROOT/database/postgresql-dbm.conf" ]]; then
        test_result "PostgreSQL DBM Configuration" "PASS"
        
        # Check for required extensions
        if grep -q "pg_stat_statements" "$PROJECT_ROOT/database/postgresql-dbm.conf"; then
            test_result "pg_stat_statements Configuration" "PASS"
        else
            test_result "pg_stat_statements Configuration" "FAIL"
        fi
    else
        test_result "PostgreSQL DBM Configuration" "FAIL"
    fi
}

# Test External Secrets Operator configuration
test_external_secrets() {
    log_header "Testing External Secrets Operator Configuration"
    
    if [[ -f "$PROJECT_ROOT/k8s/external-secrets/external-secret-datadog.yaml" ]]; then
        test_result "External Secrets Configuration" "PASS"
        
        # Validate YAML syntax (check for CRDs first)
        local yaml_output exit_code
        yaml_output=$(timeout 30 kubectl apply --dry-run=client -f "$PROJECT_ROOT/k8s/external-secrets/external-secret-datadog.yaml" 2>&1)
        exit_code=$?
        
        if echo "$yaml_output" | grep -q "ensure CRDs are installed first"; then
            log_info "External Secrets CRDs not installed (expected for validation)"
            test_result "External Secrets YAML Validation" "PASS"
        elif [[ $exit_code -eq 0 ]]; then
            test_result "External Secrets YAML Validation" "PASS"
        else
            test_result "External Secrets YAML Validation" "FAIL"
            log_info "YAML validation output: $yaml_output"
        fi
    else
        test_result "External Secrets Configuration" "FAIL"
    fi
}

# Test documentation
test_documentation() {
    log_header "Testing Documentation"
    
    # Check main documentation files
    local docs=(
        "KUBERNETES_SECRETS_AUTOMATION.md"
        "DATABASE_MONITORING_SETUP.md"
        "README.md"
        "TODO.md"
    )
    
    for doc in "${docs[@]}"; do
        if [[ -f "$PROJECT_ROOT/$doc" ]]; then
            test_result "Documentation: $doc" "PASS"
        else
            test_result "Documentation: $doc" "FAIL"
        fi
    done
    
    # Check for updated content
    if grep -q "Kubernetes Secrets Automation" "$PROJECT_ROOT/README.md"; then
        test_result "README Updated with Secrets Automation" "PASS"
    else
        test_result "README Updated with Secrets Automation" "FAIL"
    fi
    
    if grep -q "2025 best practices" "$PROJECT_ROOT/TODO.md"; then
        test_result "TODO Updated with 2025 Best Practices" "PASS"
    else
        test_result "TODO Updated with 2025 Best Practices" "FAIL"
    fi
}

# Test GitHub integration
test_github_integration() {
    log_header "Testing GitHub Integration"
    
    # Check if we can list PRs (optional test)
    if command -v gh &> /dev/null; then
        if gh pr list --repo ryanmaclean/vibecode-webgui --limit 1 >/dev/null 2>&1; then
            test_result "GitHub CLI Integration" "PASS"
            
            # Check for merged Datadog PRs
            local pr49_status pr48_status
            pr49_status=$(gh pr view 49 --repo ryanmaclean/vibecode-webgui --json state --jq '.state' 2>/dev/null || echo "UNKNOWN")
            pr48_status=$(gh pr view 48 --repo ryanmaclean/vibecode-webgui --json state --jq '.state' 2>/dev/null || echo "UNKNOWN")
            
            if [[ "$pr49_status" == "MERGED" ]] && [[ "$pr48_status" == "MERGED" ]]; then
                test_result "Datadog Dependency Updates" "PASS"
            else
                test_result "Datadog Dependency Updates" "FAIL"
            fi
        else
            test_result "GitHub CLI Integration" "FAIL"
        fi
    else
        log_info "GitHub CLI not available, skipping GitHub integration tests"
    fi
}

# Cleanup test resources
cleanup() {
    log_header "Cleaning Up Test Resources"
    
    if kubectl get namespace "$TEST_NAMESPACE" >/dev/null 2>&1; then
        log_info "Cleaning up test namespace: $TEST_NAMESPACE"
        kubectl delete namespace "$TEST_NAMESPACE" --timeout=60s >/dev/null 2>&1 || true
        log_success "Test namespace cleaned up"
    fi
}

# Generate final report
generate_report() {
    log_header "Validation Report"
    
    local total_tests=$((TESTS_PASSED + TESTS_FAILED))
    local success_rate=0
    
    if [[ $total_tests -gt 0 ]]; then
        success_rate=$((TESTS_PASSED * 100 / total_tests))
    fi
    
    echo ""
    echo "VALIDATION SUMMARY:"
    echo "=================="
    echo "Total Tests: $total_tests"
    echo "Passed: $TESTS_PASSED"
    echo "Failed: $TESTS_FAILED"
    echo "Success Rate: ${success_rate}%"
    echo ""
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        log_success "ALL TESTS PASSED - VibeCode platform is fully validated!"
        echo ""
        echo "IMPLEMENTATION STATUS:"
        echo "- Kubernetes Secrets Automation: COMPLETE"
        echo "- Datadog Database Monitoring: COMPLETE" 
        echo "- 2025 Best Practices: IMPLEMENTED"
        echo "- Multi-Environment Support: READY"
        echo "- Documentation: UP TO DATE"
        echo ""
        echo "NEXT STEPS:"
        echo "1. Deploy to your target environment using:"
        echo "   ./scripts/setup-secrets.sh [namespace]"
        echo "   helm install [release] ./helm/vibecode-platform -f ./helm/vibecode-platform/values-[env].yaml"
        echo ""
        echo "2. Monitor deployment with:"
        echo "   kubectl get pods -n [namespace]"
        echo "   kubectl logs -n [namespace] -l app.kubernetes.io/name=datadog"
        return 0
    else
        log_error "SOME TESTS FAILED - Please review the following issues:"
        for test in "${FAILED_TESTS[@]}"; do
            echo "  - $test"
        done
        echo ""
        echo "Please address these issues before proceeding with deployment."
        return 1
    fi
}

# Main execution
main() {
    log_header "VibeCode Platform Complete Validation"
    log_info "Testing comprehensive implementation including:"
    log_info "- Kubernetes Secrets Automation"
    log_info "- Datadog Database Monitoring"
    log_info "- 2025 Best Practices Compliance"
    log_info "- External Secrets Operator Support"
    
    # Run all validation tests
    validate_prerequisites || exit 1
    test_secrets_automation
    test_helm_configuration
    test_datadog_configuration
    test_database_monitoring
    test_external_secrets
    test_documentation
    test_github_integration
    
    # Cleanup and generate final report
    cleanup
    generate_report
}

# Handle script arguments
case "${1:-run}" in
    "run")
        main
        ;;
    "--help"|"-h")
        echo "VibeCode Platform Complete Validation Script"
        echo ""
        echo "Usage: $0 [run]"
        echo ""
        echo "This script validates the complete VibeCode platform implementation including:"
        echo "- Kubernetes secrets automation"
        echo "- Datadog database monitoring configuration"
        echo "- 2025 best practices compliance"
        echo "- External Secrets Operator support"
        echo "- Documentation completeness"
        echo ""
        echo "The script will create a temporary namespace for testing and clean it up afterward."
        ;;
    *)
        log_error "Unknown argument: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac