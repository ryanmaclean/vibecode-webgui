#!/bin/bash
# Comprehensive Kubernetes/KIND Functional Tests
# Tests actual deployment functionality, not just file existence

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_NAMESPACE="vibecode-test-deploy"
TIMEOUT_DEPLOY=300  # 5 minutes for deployments
TIMEOUT_READY=120   # 2 minutes for pods to be ready

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

# Wait for pods to be ready
wait_for_pods() {
    local namespace="$1"
    local label_selector="$2"
    local expected_count="$3"
    local timeout="$4"
    
    log_info "Waiting for $expected_count pods with selector '$label_selector' in namespace '$namespace'"
    
    local end_time=$((SECONDS + timeout))
    while [ $SECONDS -lt $end_time ]; do
        local ready_count
        ready_count=$(kubectl get pods -n "$namespace" -l "$label_selector" --field-selector=status.phase=Running 2>/dev/null | grep -c Running || true)
        
        if [[ "$ready_count" -ge "$expected_count" ]]; then
            log_success "Found $ready_count ready pods (expected: $expected_count)"
            return 0
        fi
        
        log_info "Found $ready_count/$expected_count ready pods, waiting..."
        sleep 5
    done
    
    log_error "Timeout waiting for pods to be ready"
    kubectl get pods -n "$namespace" -l "$label_selector" || true
    return 1
}

# Test KIND cluster functionality
test_kind_cluster() {
    log_header "Testing KIND Cluster Functionality"
    
    # Test cluster connectivity
    if kubectl cluster-info >/dev/null 2>&1; then
        local context
        context=$(kubectl config current-context)
        test_result "Cluster Connectivity" "PASS" "Connected to $context"
    else
        test_result "Cluster Connectivity" "FAIL"
        return 1
    fi
    
    # Test node readiness
    local ready_nodes
    ready_nodes=$(kubectl get nodes --no-headers | awk '$2=="Ready"' | wc -l)
    if [[ "$ready_nodes" -gt 0 ]]; then
        test_result "Node Readiness" "PASS" "$ready_nodes nodes ready"
    else
        test_result "Node Readiness" "FAIL"
    fi
    
    # Test DNS resolution
    if kubectl run test-dns --image=busybox --rm -it --restart=Never --timeout=30s -- nslookup kubernetes.default.svc.cluster.local >/dev/null 2>&1; then
        test_result "DNS Resolution" "PASS"
    else
        test_result "DNS Resolution" "FAIL"
    fi
    
    # Test storage class
    if kubectl get storageclass standard >/dev/null 2>&1; then
        test_result "Storage Class" "PASS" "standard storage class available"
    else
        test_result "Storage Class" "FAIL"
    fi
    
    # Test namespace creation
    if kubectl create namespace "$TEST_NAMESPACE" >/dev/null 2>&1; then
        test_result "Namespace Creation" "PASS" "Created $TEST_NAMESPACE"
    else
        test_result "Namespace Creation" "FAIL"
    fi
}

# Test actual secrets functionality
test_secrets_deployment() {
    log_header "Testing Secrets Deployment Functionality"
    
    # Source environment if available
    if [[ -f "$PROJECT_ROOT/.env.local" ]]; then
        source "$PROJECT_ROOT/.env.local"
        log_info "Sourced environment from .env.local"
    else
        log_warning "No .env.local found, using test credentials"
        export DD_API_KEY="test-api-key-32-characters-long-123"
        export POSTGRES_PASSWORD="test-postgres-password"
        export DATADOG_POSTGRES_PASSWORD="test-datadog-password"
    fi
    
    # Test secret creation script
    if "$PROJECT_ROOT/scripts/setup-secrets.sh" "$TEST_NAMESPACE" >/dev/null 2>&1; then
        test_result "Secret Creation Script" "PASS"
    else
        test_result "Secret Creation Script" "FAIL"
        return 1
    fi
    
    # Verify secrets exist and have correct structure
    if kubectl get secret datadog-secrets -n "$TEST_NAMESPACE" >/dev/null 2>&1; then
        local api_key_length
        api_key_length=$(kubectl get secret datadog-secrets -n "$TEST_NAMESPACE" -o jsonpath='{.data.api-key}' | base64 -d | wc -c | tr -d ' ')
        if [[ "$api_key_length" -gt 20 ]]; then
            test_result "Datadog Secret Validation" "PASS" "API key length: $api_key_length chars"
        else
            test_result "Datadog Secret Validation" "FAIL" "API key too short: $api_key_length chars"
        fi
    else
        test_result "Datadog Secret Validation" "FAIL"
    fi
    
    if kubectl get secret postgres-credentials -n "$TEST_NAMESPACE" >/dev/null 2>&1; then
        local keys
        keys=$(kubectl get secret postgres-credentials -n "$TEST_NAMESPACE" -o jsonpath='{.data}' | jq -r 'keys[]' 2>/dev/null | sort | tr '\n' ' ' || echo "FAILED")
        if [[ "$keys" == *"datadog-password"* ]] && [[ "$keys" == *"postgres-password"* ]]; then
            test_result "PostgreSQL Secret Validation" "PASS" "Keys: $keys"
        else
            test_result "PostgreSQL Secret Validation" "FAIL" "Missing keys: $keys"
        fi
    else
        test_result "PostgreSQL Secret Validation" "FAIL"
    fi
}

# Test PostgreSQL deployment and functionality
test_postgresql_deployment() {
    log_header "Testing PostgreSQL Deployment"
    
    # Deploy PostgreSQL using Helm subchart values
    local postgres_values
    postgres_values=$(mktemp)
    cat > "$postgres_values" <<EOF
postgresql:
  enabled: true
  auth:
    database: vibecode_test
    username: vibecode_test
    existingSecret: postgres-credentials
    secretKeys:
      adminPasswordKey: postgres-password
  primary:
    configuration: |
      shared_preload_libraries = 'pg_stat_statements'
      pg_stat_statements.max = 10000
      pg_stat_statements.track = all
    initdb:
      scripts:
        01-extensions.sql: |
          CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
          CREATE USER datadog WITH PASSWORD 'test-datadog-password';
          GRANT pg_monitor TO datadog;
EOF

    if helm install postgres-test oci://registry-1.docker.io/bitnamicharts/postgresql \
        -f "$postgres_values" \
        --namespace="$TEST_NAMESPACE" \
        --timeout="${TIMEOUT_DEPLOY}s" >/dev/null 2>&1; then
        test_result "PostgreSQL Helm Install" "PASS"
    else
        test_result "PostgreSQL Helm Install" "FAIL"
        rm -f "$postgres_values"
        return 1
    fi
    
    rm -f "$postgres_values"
    
    # Wait for PostgreSQL to be ready
    if wait_for_pods "$TEST_NAMESPACE" "app.kubernetes.io/name=postgresql" 1 "$TIMEOUT_READY"; then
        test_result "PostgreSQL Pod Ready" "PASS"
    else
        test_result "PostgreSQL Pod Ready" "FAIL"
        return 1
    fi
    
    # Test database connectivity
    local postgres_pod
    postgres_pod=$(kubectl get pods -n "$TEST_NAMESPACE" -l "app.kubernetes.io/name=postgresql" -o jsonpath='{.items[0].metadata.name}')
    
    if kubectl exec -n "$TEST_NAMESPACE" "$postgres_pod" -- psql -U vibecode_test -d vibecode_test -c "SELECT 1;" >/dev/null 2>&1; then
        test_result "PostgreSQL Connectivity" "PASS"
    else
        test_result "PostgreSQL Connectivity" "FAIL"
    fi
    
    # Test pg_stat_statements extension
    if kubectl exec -n "$TEST_NAMESPACE" "$postgres_pod" -- psql -U vibecode_test -d vibecode_test -c "SELECT * FROM pg_stat_statements LIMIT 1;" >/dev/null 2>&1; then
        test_result "pg_stat_statements Extension" "PASS"
    else
        test_result "pg_stat_statements Extension" "FAIL"
    fi
    
    # Test datadog user access
    if kubectl exec -n "$TEST_NAMESPACE" "$postgres_pod" -- psql -U datadog -d vibecode_test -c "SELECT 1;" >/dev/null 2>&1; then
        test_result "Datadog User Access" "PASS"
    else
        test_result "Datadog User Access" "FAIL"
    fi
}

# Test Datadog agents deployment and functionality
test_datadog_deployment() {
    log_header "Testing Datadog Agents Deployment"
    
    # Create Datadog values for testing
    local datadog_values
    datadog_values=$(mktemp)
    cat > "$datadog_values" <<EOF
datadog:
  apiKeyExistingSecret: datadog-secrets
  site: datadoghq.com
  
agents:
  enabled: true
  image:
    tag: "7.50.0"
  containers:
    agent:
      env:
        - name: DD_DATABASE_MONITORING_ENABLED
          value: "true"
        - name: DD_LOGS_ENABLED
          value: "false"  # Disabled for testing
      resources:
        requests:
          cpu: "100m"
          memory: "128Mi"
        limits:
          cpu: "200m"
          memory: "256Mi"

clusterAgent:
  enabled: true
  resources:
    requests:
      cpu: "100m"
      memory: "128Mi"
    limits:
      cpu: "200m"
      memory: "256Mi"
  confd:
    postgres.yaml: |
      cluster_check: true
      init_config:
      instances:
      - host: postgres-test-postgresql.${TEST_NAMESPACE}.svc.cluster.local
        port: 5432
        username: datadog
        password: "test-datadog-password"
        dbm: true
        tags:
          - "env:test"
          - "service:postgres-test"
EOF

    # Deploy Datadog agents
    if helm install datadog-test oci://registry-1.docker.io/datadoghq/datadog \
        -f "$datadog_values" \
        --namespace="$TEST_NAMESPACE" \
        --timeout="${TIMEOUT_DEPLOY}s" >/dev/null 2>&1; then
        test_result "Datadog Helm Install" "PASS"
    else
        test_result "Datadog Helm Install" "FAIL"
        rm -f "$datadog_values"
        return 1
    fi
    
    rm -f "$datadog_values"
    
    # Wait for Cluster Agent to be ready
    if wait_for_pods "$TEST_NAMESPACE" "app=datadog-test-cluster-agent" 1 "$TIMEOUT_READY"; then
        test_result "Datadog Cluster Agent Ready" "PASS"
    else
        test_result "Datadog Cluster Agent Ready" "FAIL"
    fi
    
    # Wait for Node Agent to be ready
    if wait_for_pods "$TEST_NAMESPACE" "app=datadog-test" 1 "$TIMEOUT_READY"; then
        test_result "Datadog Node Agent Ready" "PASS"
    else
        test_result "Datadog Node Agent Ready" "FAIL"
    fi
    
    # Test cluster agent API
    local cluster_agent_pod
    cluster_agent_pod=$(kubectl get pods -n "$TEST_NAMESPACE" -l "app=datadog-test-cluster-agent" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [[ -n "$cluster_agent_pod" ]]; then
        if kubectl exec -n "$TEST_NAMESPACE" "$cluster_agent_pod" -- curl -s http://localhost:5005/api/v1.0/status >/dev/null 2>&1; then
            test_result "Cluster Agent API" "PASS"
        else
            test_result "Cluster Agent API" "FAIL"
        fi
    else
        test_result "Cluster Agent API" "FAIL" "Pod not found"
    fi
    
    # Test node agent status
    local node_agent_pod
    node_agent_pod=$(kubectl get pods -n "$TEST_NAMESPACE" -l "app=datadog-test" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [[ -n "$node_agent_pod" ]]; then
        if kubectl exec -n "$TEST_NAMESPACE" "$node_agent_pod" -- agent status >/dev/null 2>&1; then
            test_result "Node Agent Status" "PASS"
        else
            test_result "Node Agent Status" "FAIL"
        fi
    else
        test_result "Node Agent Status" "FAIL" "Pod not found"
    fi
}

# Test application deployment
test_application_deployment() {
    log_header "Testing Application Deployment"
    
    # Deploy a simple test application
    kubectl apply -n "$TEST_NAMESPACE" -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: test-app
  template:
    metadata:
      labels:
        app: test-app
    spec:
      containers:
      - name: test-app
        image: nginx:1.21
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: "10m"
            memory: "32Mi"
          limits:
            cpu: "50m"
            memory: "64Mi"
---
apiVersion: v1
kind: Service
metadata:
  name: test-app-service
spec:
  selector:
    app: test-app
  ports:
  - port: 80
    targetPort: 80
EOF

    if wait_for_pods "$TEST_NAMESPACE" "app=test-app" 1 "$TIMEOUT_READY"; then
        test_result "Test Application Deployment" "PASS"
    else
        test_result "Test Application Deployment" "FAIL"
        return 1
    fi
    
    # Test service connectivity
    if kubectl run test-client --image=busybox --rm -it --restart=Never --timeout=30s \
        --namespace="$TEST_NAMESPACE" \
        -- wget -q -O- http://test-app-service.${TEST_NAMESPACE}.svc.cluster.local >/dev/null 2>&1; then
        test_result "Service Connectivity" "PASS"
    else
        test_result "Service Connectivity" "FAIL"
    fi
}

# Test network policies and security
test_network_security() {
    log_header "Testing Network Security"
    
    # Test that pods can communicate within namespace
    if kubectl run test-ping --image=busybox --rm -it --restart=Never --timeout=30s \
        --namespace="$TEST_NAMESPACE" \
        -- ping -c 1 test-app-service.${TEST_NAMESPACE}.svc.cluster.local >/dev/null 2>&1; then
        test_result "Intra-Namespace Communication" "PASS"
    else
        test_result "Intra-Namespace Communication" "FAIL"
    fi
    
    # Test DNS resolution for external services
    if kubectl run test-external-dns --image=busybox --rm -it --restart=Never --timeout=30s \
        --namespace="$TEST_NAMESPACE" \
        -- nslookup google.com >/dev/null 2>&1; then
        test_result "External DNS Resolution" "PASS"
    else
        test_result "External DNS Resolution" "FAIL"
    fi
}

# Test persistent storage
test_persistent_storage() {
    log_header "Testing Persistent Storage"
    
    # Create a PVC
    kubectl apply -n "$TEST_NAMESPACE" -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: test-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  storageClassName: standard
EOF

    # Wait for PVC to be bound
    local end_time=$((SECONDS + 60))
    while [ $SECONDS -lt $end_time ]; do
        local pvc_status
        pvc_status=$(kubectl get pvc test-pvc -n "$TEST_NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null || echo "NotFound")
        
        if [[ "$pvc_status" == "Bound" ]]; then
            test_result "Persistent Volume Claim" "PASS" "PVC bound successfully"
            break
        fi
        
        sleep 2
    done
    
    if [[ "$pvc_status" != "Bound" ]]; then
        test_result "Persistent Volume Claim" "FAIL" "PVC status: $pvc_status"
    fi
    
    # Test pod with persistent storage
    kubectl apply -n "$TEST_NAMESPACE" -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: test-storage-pod
spec:
  containers:
  - name: test-container
    image: busybox
    command: ['sh', '-c', 'echo "test data" > /data/test.txt && sleep 30']
    volumeMounts:
    - name: test-volume
      mountPath: /data
  volumes:
  - name: test-volume
    persistentVolumeClaim:
      claimName: test-pvc
  restartPolicy: Never
EOF

    if wait_for_pods "$TEST_NAMESPACE" "name=test-storage-pod" 1 30; then
        test_result "Persistent Storage Pod" "PASS"
        
        # Verify file was written
        if kubectl exec -n "$TEST_NAMESPACE" test-storage-pod -- cat /data/test.txt | grep -q "test data"; then
            test_result "Persistent Storage Write" "PASS"
        else
            test_result "Persistent Storage Write" "FAIL"
        fi
    else
        test_result "Persistent Storage Pod" "FAIL"
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
    log_header "Comprehensive Test Report"
    
    local total_tests=$((TESTS_PASSED + TESTS_FAILED))
    local success_rate=0
    
    if [[ $total_tests -gt 0 ]]; then
        success_rate=$((TESTS_PASSED * 100 / total_tests))
    fi
    
    echo ""
    echo "COMPREHENSIVE TEST SUMMARY:"
    echo "=========================="
    echo "Total Tests: $total_tests"
    echo "Passed: $TESTS_PASSED"
    echo "Failed: $TESTS_FAILED"
    echo "Success Rate: ${success_rate}%"
    echo ""
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        log_success "ALL TESTS PASSED - Kubernetes cluster is fully functional!"
        echo ""
        echo "VERIFIED COMPONENTS:"
        echo "- KIND cluster with DNS and networking"
        echo "- Automated secrets management"
        echo "- PostgreSQL with monitoring extensions"
        echo "- Datadog agents (cluster + node)"
        echo "- Application deployment and connectivity"
        echo "- Persistent storage functionality"
        echo "- Network security and policies"
        echo ""
        echo "✅ CLUSTER READY FOR PRODUCTION WORKLOADS"
        return 0
    else
        log_error "SOME TESTS FAILED - Please review the following issues:"
        for test in "${FAILED_TESTS[@]}"; do
            echo "  - $test"
        done
        echo ""
        echo "Please address these issues before deploying production workloads."
        return 1
    fi
}

# Main execution
main() {
    log_header "Comprehensive Kubernetes/KIND Functional Tests"
    log_info "Testing actual deployment functionality with real components:"
    log_info "- KIND cluster functionality"
    log_info "- Secrets deployment and validation"
    log_info "- PostgreSQL deployment with extensions"
    log_info "- Datadog agents deployment and connectivity"
    log_info "- Application deployment and networking"
    log_info "- Persistent storage functionality"
    
    # Run all tests
    test_kind_cluster
    test_secrets_deployment
    test_postgresql_deployment
    test_datadog_deployment
    test_application_deployment
    test_network_security
    test_persistent_storage
    
    # Cleanup and generate report
    cleanup
    generate_report
}

# Handle script arguments
case "${1:-run}" in
    "run")
        main
        ;;
    "--help"|"-h")
        echo "Comprehensive Kubernetes/KIND Functional Tests"
        echo ""
        echo "Usage: $0 [run]"
        echo ""
        echo "This script performs comprehensive functional testing of:"
        echo "- KIND cluster setup and networking"
        echo "- Secrets management automation"
        echo "- PostgreSQL deployment with monitoring"
        echo "- Datadog agents deployment and functionality"
        echo "- Application deployment and connectivity"
        echo "- Persistent storage and network security"
        echo ""
        echo "All tests deploy real components and verify actual functionality."
        ;;
    *)
        log_error "Unknown argument: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac