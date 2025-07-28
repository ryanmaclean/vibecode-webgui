#!/bin/bash
# Core Kubernetes Functionality Tests
# Focused tests for essential KIND/K8s components

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_NAMESPACE="vibecode-func-test"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}INFO: $1${NC}"; }
log_success() { echo -e "${GREEN}SUCCESS: $1${NC}"; }
log_error() { echo -e "${RED}ERROR: $1${NC}"; }
log_header() { echo -e "\n${BLUE}=== $1 ===${NC}"; }

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

test_result() {
    local test_name="$1"
    local result="$2"
    local details="${3:-}"
    
    if [[ "$result" == "PASS" ]]; then
        log_success "$test_name: PASSED${details:+ - $details}"
        ((TESTS_PASSED++))
    else
        log_error "$test_name: FAILED${details:+ - $details}"
        FAILED_TESTS+=("$test_name")
        ((TESTS_FAILED++))
    fi
}

# Test 1: Basic cluster functionality
test_cluster_basics() {
    log_header "Testing Basic Cluster Functionality"
    
    # Cluster connectivity
    if kubectl cluster-info --request-timeout=10s >/dev/null 2>&1; then
        test_result "Cluster API Server" "PASS"
    else
        test_result "Cluster API Server" "FAIL"
    fi
    
    # Node status
    local ready_nodes
    ready_nodes=$(kubectl get nodes --no-headers 2>/dev/null | awk '$2=="Ready"' | wc -l)
    if [[ "$ready_nodes" -gt 0 ]]; then
        test_result "Node Readiness" "PASS" "$ready_nodes nodes ready"
    else
        test_result "Node Readiness" "FAIL"
    fi
    
    # Core DNS
    if kubectl get pods -n kube-system -l k8s-app=kube-dns --field-selector=status.phase=Running | grep -q Running; then
        test_result "CoreDNS Running" "PASS"
    else
        test_result "CoreDNS Running" "FAIL"
    fi
    
    # Storage class
    if kubectl get storageclass standard >/dev/null 2>&1; then
        test_result "Default Storage Class" "PASS"
    else
        test_result "Default Storage Class" "FAIL"
    fi
}

# Test 2: Secrets functionality (the core issue)
test_secrets_functionality() {
    log_header "Testing Secrets Management"
    
    # Create test namespace
    kubectl create namespace "$TEST_NAMESPACE" >/dev/null 2>&1 || true
    
    # Set test environment
    export DD_API_KEY="test-datadog-api-key-32chars-long"
    export POSTGRES_PASSWORD="test-postgres-pass-123"
    export DATADOG_POSTGRES_PASSWORD="test-datadog-pass-123"
    
    # Test secrets script execution
    if "$PROJECT_ROOT/scripts/setup-secrets.sh" "$TEST_NAMESPACE" >/dev/null 2>&1; then
        test_result "Secrets Script Execution" "PASS"
    else
        test_result "Secrets Script Execution" "FAIL"
        return 1
    fi
    
    # Verify secrets were created
    if kubectl get secret datadog-secrets -n "$TEST_NAMESPACE" >/dev/null 2>&1; then
        test_result "Datadog Secret Created" "PASS"
    else
        test_result "Datadog Secret Created" "FAIL"
    fi
    
    if kubectl get secret postgres-credentials -n "$TEST_NAMESPACE" >/dev/null 2>&1; then
        test_result "PostgreSQL Secret Created" "PASS"
    else
        test_result "PostgreSQL Secret Created" "FAIL"
    fi
    
    # Test secret content
    local api_key_content
    api_key_content=$(kubectl get secret datadog-secrets -n "$TEST_NAMESPACE" -o jsonpath='{.data.api-key}' 2>/dev/null | base64 -d || echo "FAILED")
    if [[ "$api_key_content" == "$DD_API_KEY" ]]; then
        test_result "Secret Content Validation" "PASS"
    else
        test_result "Secret Content Validation" "FAIL" "Expected: $DD_API_KEY, Got: $api_key_content"
    fi
}

# Test 3: Helm template rendering (critical for deployment)
test_helm_functionality() {
    log_header "Testing Helm Template Rendering"
    
    # Test Helm dependencies
    if [[ -f "$PROJECT_ROOT/helm/vibecode-platform/Chart.lock" ]]; then
        test_result "Helm Dependencies" "PASS"
    else
        log_info "Building Helm dependencies..."
        if helm dependency build "$PROJECT_ROOT/helm/vibecode-platform" >/dev/null 2>&1; then
            test_result "Helm Dependencies Build" "PASS"
        else
            test_result "Helm Dependencies Build" "FAIL"
            return 1
        fi
    fi
    
    # Test template rendering with real values
    local temp_values
    temp_values=$(mktemp)
    cat > "$temp_values" <<EOF
datadog:
  enabled: true
  targetSystem: "linux"
  datadog:
    apiKeyExistingSecret: datadog-secrets
    site: datadoghq.com
  agents:
    enabled: true
  clusterAgent:
    enabled: true

database:
  postgresql:
    enabled: true
    auth:
      database: vibecode_test
      username: vibecode_test
      existingSecret: postgres-credentials
      secretKeys:
        adminPasswordKey: postgres-password
EOF

    local template_output
    template_output=$(mktemp)
    
    if helm template test-deployment "$PROJECT_ROOT/helm/vibecode-platform" \
        -f "$temp_values" \
        --namespace="$TEST_NAMESPACE" > "$template_output" 2>/dev/null; then
        test_result "Helm Template Rendering" "PASS"
    else
        test_result "Helm Template Rendering" "FAIL"
        rm -f "$temp_values" "$template_output"
        return 1
    fi
    
    # Verify specific components are generated
    if grep -q "kind: DaemonSet" "$template_output"; then
        test_result "Datadog DaemonSet Generated" "PASS"
    else
        test_result "Datadog DaemonSet Generated" "FAIL"
    fi
    
    if grep -q "kind: Deployment" "$template_output" && grep -A5 -B5 "kind: Deployment" "$template_output" | grep -q "cluster-agent"; then
        test_result "Datadog Cluster Agent Generated" "PASS"
    else
        test_result "Datadog Cluster Agent Generated" "FAIL"
    fi
    
    if grep -q "postgresql" "$template_output"; then
        test_result "PostgreSQL Components Generated" "PASS"
    else
        test_result "PostgreSQL Components Generated" "FAIL"
    fi
    
    rm -f "$temp_values" "$template_output"
}

# Test 4: Actual deployment functionality (simplified)
test_deployment_basics() {
    log_header "Testing Basic Deployment Functionality"
    
    # Deploy a simple test pod
    kubectl apply -n "$TEST_NAMESPACE" -f - <<EOF >/dev/null 2>&1
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
spec:
  containers:
  - name: test-container
    image: busybox:1.35
    command: ['sleep', '60']
    resources:
      requests:
        cpu: "10m"
        memory: "16Mi"
      limits:
        cpu: "50m"
        memory: "32Mi"
  restartPolicy: Never
EOF

    # Wait for pod to be ready
    local attempts=0
    local max_attempts=30
    while [[ $attempts -lt $max_attempts ]]; do
        if kubectl get pod test-pod -n "$TEST_NAMESPACE" --field-selector=status.phase=Running >/dev/null 2>&1; then
            test_result "Basic Pod Deployment" "PASS"
            break
        fi
        ((attempts++))
        sleep 2
    done
    
    if [[ $attempts -eq $max_attempts ]]; then
        test_result "Basic Pod Deployment" "FAIL" "Pod not ready after 60s"
    fi
    
    # Test DNS resolution from within cluster
    if kubectl exec -n "$TEST_NAMESPACE" test-pod --timeout=10s -- nslookup kubernetes.default.svc.cluster.local >/dev/null 2>&1; then
        test_result "In-Cluster DNS Resolution" "PASS"
    else
        test_result "In-Cluster DNS Resolution" "FAIL"
    fi
    
    # Test service creation and connectivity
    kubectl apply -n "$TEST_NAMESPACE" -f - <<EOF >/dev/null 2>&1
apiVersion: v1
kind: Service
metadata:
  name: test-service
spec:
  selector:
    app: nonexistent  # Intentionally empty for testing
  ports:
  - port: 80
    targetPort: 80
EOF

    if kubectl get service test-service -n "$TEST_NAMESPACE" >/dev/null 2>&1; then
        test_result "Service Creation" "PASS"
    else
        test_result "Service Creation" "FAIL"
    fi
}

# Test 5: Resource constraints and limits
test_resource_management() {
    log_header "Testing Resource Management"
    
    # Test resource quota creation
    kubectl apply -n "$TEST_NAMESPACE" -f - <<EOF >/dev/null 2>&1
apiVersion: v1
kind: ResourceQuota
metadata:
  name: test-quota
spec:
  hard:
    requests.cpu: "1"
    requests.memory: 1Gi
    limits.cpu: "2"
    limits.memory: 2Gi
    pods: "10"
EOF

    if kubectl get resourcequota test-quota -n "$TEST_NAMESPACE" >/dev/null 2>&1; then
        test_result "Resource Quota Creation" "PASS"
    else
        test_result "Resource Quota Creation" "FAIL"
    fi
    
    # Test that quota is enforced (try to create pod that exceeds quota)
    kubectl apply -n "$TEST_NAMESPACE" -f - <<EOF >/dev/null 2>&1
apiVersion: v1
kind: Pod
metadata:
  name: quota-test-pod
spec:
  containers:
  - name: test-container
    image: busybox:1.35
    command: ['sleep', '10']
    resources:
      requests:
        cpu: "2"  # Exceeds quota
        memory: "3Gi"  # Exceeds quota
  restartPolicy: Never
EOF

    # This should fail due to quota
    if kubectl get pod quota-test-pod -n "$TEST_NAMESPACE" >/dev/null 2>&1; then
        test_result "Resource Quota Enforcement" "FAIL" "Pod creation should have failed"
    else
        test_result "Resource Quota Enforcement" "PASS" "Pod creation properly blocked"
    fi
}

# Cleanup
cleanup() {
    log_header "Cleaning Up Test Resources"
    
    if kubectl get namespace "$TEST_NAMESPACE" >/dev/null 2>&1; then
        kubectl delete namespace "$TEST_NAMESPACE" --timeout=30s >/dev/null 2>&1 || true
        log_info "Test namespace cleaned up"
    fi
}

# Generate report
generate_report() {
    log_header "Core Functionality Test Report"
    
    local total_tests=$((TESTS_PASSED + TESTS_FAILED))
    local success_rate=0
    
    if [[ $total_tests -gt 0 ]]; then
        success_rate=$((TESTS_PASSED * 100 / total_tests))
    fi
    
    echo ""
    echo "CORE FUNCTIONALITY TEST SUMMARY:"
    echo "================================"
    echo "Total Tests: $total_tests"
    echo "Passed: $TESTS_PASSED"
    echo "Failed: $TESTS_FAILED"
    echo "Success Rate: ${success_rate}%"
    echo ""
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        log_success "ALL CORE TESTS PASSED!"
        echo ""
        echo "✅ VERIFIED CORE COMPONENTS:"
        echo "   - KIND cluster basic functionality"
        echo "   - Secrets management automation"  
        echo "   - Helm template rendering"
        echo "   - Basic pod deployment and networking"
        echo "   - Resource management and quotas"
        echo ""
        echo "🚀 CORE KUBERNETES FUNCTIONALITY IS WORKING"
        return 0
    else
        log_error "CORE FUNCTIONALITY ISSUES DETECTED:"
        for test in "${FAILED_TESTS[@]}"; do
            echo "  ❌ $test"
        done
        echo ""
        echo "⚠️  These issues must be resolved before production deployment."
        return 1
    fi
}

# Main execution
main() {
    log_header "Core Kubernetes/KIND Functionality Tests"
    log_info "Testing essential components that must work for production deployment"
    
    # Run core tests
    test_cluster_basics
    test_secrets_functionality  
    test_helm_functionality
    test_deployment_basics
    test_resource_management
    
    # Cleanup and report
    cleanup
    generate_report
}

main "$@"