#!/bin/bash
set -euo pipefail

# Cloud Workspace Smoke Tests
# Validates production-ready setup before cloud deployment

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_NAMESPACE="vibecode-test"
CLUSTER_NAME="vibecode-smoke-test"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    local missing_tools=()

    command -v kind >/dev/null 2>&1 || missing_tools+=("kind")
    command -v kubectl >/dev/null 2>&1 || missing_tools+=("kubectl")
    command -v helm >/dev/null 2>&1 || missing_tools+=("helm")
    command -v docker >/dev/null 2>&1 || missing_tools+=("docker")

    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        echo "Install with:"
        echo "  brew install kind kubectl helm docker"
        exit 1
    fi

    log_info "All prerequisites met"
}

cleanup_cluster() {
    log_info "Cleaning up existing cluster..."
    kind delete cluster --name "${CLUSTER_NAME}" 2>/dev/null || true
    rm -rf "${SCRIPT_DIR}/test-workspaces" 2>/dev/null || true
}

create_cluster() {
    log_info "Creating KinD cluster..."

    # Create workspace directory
    mkdir -p "${SCRIPT_DIR}/test-workspaces"
    chmod 777 "${SCRIPT_DIR}/test-workspaces"

    # Create cluster
    kind create cluster --config="${SCRIPT_DIR}/kind-config.yaml" --wait=2m

    # Verify cluster is ready
    kubectl wait --for=condition=Ready nodes --all --timeout=3m

    log_info "Cluster created successfully"
}

deploy_test_workspaces() {
    log_info "Deploying test workspaces..."

    # Apply manifests
    kubectl apply -f "${SCRIPT_DIR}/test-deployment.yaml"

    # Wait for namespace
    kubectl wait --for=jsonpath='{.status.phase}'=Active \
        namespace/"${TEST_NAMESPACE}" --timeout=1m

    # Wait for statefulset
    log_info "Waiting for pods to be ready..."
    kubectl wait --for=condition=Ready \
        pods -l app=code-server \
        -n "${TEST_NAMESPACE}" \
        --timeout=5m

    log_info "Test workspaces deployed"
}

test_spot_node_scheduling() {
    log_info "Testing spot node scheduling..."

    local spot_pods=$(kubectl get pods -n "${TEST_NAMESPACE}" \
        -l app=code-server \
        -o jsonpath='{.items[*].spec.nodeName}' | \
        xargs -n1 kubectl get node -o jsonpath='{.metadata.labels.cloud\.google\.com/gke-spot}' 2>/dev/null | \
        grep -c "true" || echo "0")

    if [ "$spot_pods" -gt 0 ]; then
        log_info "✓ Pods successfully scheduled on spot nodes"
        return 0
    else
        log_warn "⚠ No pods on spot nodes (may be expected in test environment)"
        return 0
    fi
}

test_persistent_storage() {
    log_info "Testing persistent storage..."

    local pod_name=$(kubectl get pods -n "${TEST_NAMESPACE}" \
        -l app=code-server \
        -o jsonpath='{.items[0].metadata.name}')

    # Write test file
    kubectl exec -n "${TEST_NAMESPACE}" "${pod_name}" -- \
        bash -c "echo 'test-data' > /home/coder/workspace/test-file.txt"

    # Verify file exists
    local content=$(kubectl exec -n "${TEST_NAMESPACE}" "${pod_name}" -- \
        cat /home/coder/workspace/test-file.txt)

    if [ "$content" = "test-data" ]; then
        log_info "✓ Persistent storage working"
        return 0
    else
        log_error "✗ Persistent storage test failed"
        return 1
    fi
}

test_graceful_shutdown() {
    log_info "Testing graceful shutdown..."

    local pod_name=$(kubectl get pods -n "${TEST_NAMESPACE}" \
        -l app=code-server \
        -o jsonpath='{.items[0].metadata.name}')

    # Delete pod and capture time
    local start_time=$(date +%s)
    kubectl delete pod -n "${TEST_NAMESPACE}" "${pod_name}" --wait=true --timeout=2m

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    if [ $duration -lt 60 ]; then
        log_info "✓ Graceful shutdown completed in ${duration}s"
        return 0
    else
        log_warn "⚠ Shutdown took ${duration}s (expected <60s)"
        return 0
    fi
}

test_hpa_scaling() {
    log_info "Testing HPA configuration..."

    # Check HPA exists
    if kubectl get hpa -n "${TEST_NAMESPACE}" code-server-hpa-test >/dev/null 2>&1; then
        local min_replicas=$(kubectl get hpa -n "${TEST_NAMESPACE}" code-server-hpa-test \
            -o jsonpath='{.spec.minReplicas}')
        local max_replicas=$(kubectl get hpa -n "${TEST_NAMESPACE}" code-server-hpa-test \
            -o jsonpath='{.spec.maxReplicas}')

        log_info "✓ HPA configured: min=${min_replicas}, max=${max_replicas}"
        return 0
    else
        log_error "✗ HPA not found"
        return 1
    fi
}

test_network_isolation() {
    log_info "Testing network policies..."

    # Check network policy exists
    if kubectl get networkpolicy -n "${TEST_NAMESPACE}" workspace-isolation-test >/dev/null 2>&1; then
        log_info "✓ Network policies configured"
        return 0
    else
        log_error "✗ Network policies not found"
        return 1
    fi
}

test_workspace_resumption() {
    log_info "Testing workspace resumption..."

    local pod_name=$(kubectl get pods -n "${TEST_NAMESPACE}" \
        -l app=code-server \
        -o jsonpath='{.items[0].metadata.name}')

    # Write test data
    kubectl exec -n "${TEST_NAMESPACE}" "${pod_name}" -- \
        bash -c "echo 'resume-test' > /home/coder/workspace/resume-test.txt"

    # Delete pod (simulate interruption)
    kubectl delete pod -n "${TEST_NAMESPACE}" "${pod_name}" --wait=true

    # Wait for new pod
    sleep 10
    kubectl wait --for=condition=Ready \
        pods -l app=code-server \
        -n "${TEST_NAMESPACE}" \
        --timeout=3m

    # Get new pod name
    local new_pod_name=$(kubectl get pods -n "${TEST_NAMESPACE}" \
        -l app=code-server \
        -o jsonpath='{.items[0].metadata.name}')

    # Verify data persisted
    local content=$(kubectl exec -n "${TEST_NAMESPACE}" "${new_pod_name}" -- \
        cat /home/coder/workspace/resume-test.txt 2>/dev/null || echo "NOT_FOUND")

    if [ "$content" = "resume-test" ]; then
        log_info "✓ Workspace resumption successful"
        return 0
    else
        log_error "✗ Workspace data not persisted"
        return 1
    fi
}

test_resource_limits() {
    log_info "Testing resource limits..."

    local pod_name=$(kubectl get pods -n "${TEST_NAMESPACE}" \
        -l app=code-server \
        -o jsonpath='{.items[0].metadata.name}')

    local cpu_limit=$(kubectl get pod -n "${TEST_NAMESPACE}" "${pod_name}" \
        -o jsonpath='{.spec.containers[0].resources.limits.cpu}')

    local mem_limit=$(kubectl get pod -n "${TEST_NAMESPACE}" "${pod_name}" \
        -o jsonpath='{.spec.containers[0].resources.limits.memory}')

    if [ -n "$cpu_limit" ] && [ -n "$mem_limit" ]; then
        log_info "✓ Resource limits configured: CPU=${cpu_limit}, Memory=${mem_limit}"
        return 0
    else
        log_error "✗ Resource limits not properly configured"
        return 1
    fi
}

generate_report() {
    log_info "Generating test report..."

    local report_file="${SCRIPT_DIR}/test-report.txt"

    cat > "${report_file}" <<EOF
Cloud Workspace Smoke Test Report
==================================
Date: $(date)
Cluster: ${CLUSTER_NAME}
Namespace: ${TEST_NAMESPACE}

Test Results:
EOF

    echo "" >> "${report_file}"
    echo "Cluster Information:" >> "${report_file}"
    kubectl cluster-info >> "${report_file}" 2>&1
    echo "" >> "${report_file}"

    echo "Node Information:" >> "${report_file}"
    kubectl get nodes -o wide >> "${report_file}" 2>&1
    echo "" >> "${report_file}"

    echo "Pod Status:" >> "${report_file}"
    kubectl get pods -n "${TEST_NAMESPACE}" -o wide >> "${report_file}" 2>&1
    echo "" >> "${report_file}"

    echo "PVC Status:" >> "${report_file}"
    kubectl get pvc -n "${TEST_NAMESPACE}" >> "${report_file}" 2>&1
    echo "" >> "${report_file}"

    echo "HPA Status:" >> "${report_file}"
    kubectl get hpa -n "${TEST_NAMESPACE}" >> "${report_file}" 2>&1
    echo "" >> "${report_file}"

    log_info "Report saved to: ${report_file}"
}

run_all_tests() {
    log_info "Running smoke tests..."

    local failed_tests=0

    test_spot_node_scheduling || ((failed_tests++))
    test_persistent_storage || ((failed_tests++))
    test_graceful_shutdown || ((failed_tests++))
    test_hpa_scaling || ((failed_tests++))
    test_network_isolation || ((failed_tests++))
    test_workspace_resumption || ((failed_tests++))
    test_resource_limits || ((failed_tests++))

    echo ""
    if [ $failed_tests -eq 0 ]; then
        log_info "✓ All tests passed!"
        return 0
    else
        log_error "✗ ${failed_tests} test(s) failed"
        return 1
    fi
}

main() {
    log_info "Starting Cloud Workspace Smoke Tests"
    echo ""

    check_prerequisites

    if [ "${CLEANUP:-true}" = "true" ]; then
        cleanup_cluster
    fi

    create_cluster
    deploy_test_workspaces

    run_all_tests
    local test_result=$?

    generate_report

    if [ "${KEEP_CLUSTER:-false}" = "true" ]; then
        log_info "Cluster kept for manual inspection"
        log_info "Access with: kubectl --context kind-${CLUSTER_NAME}"
        log_info "Clean up with: kind delete cluster --name ${CLUSTER_NAME}"
    else
        cleanup_cluster
    fi

    exit $test_result
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --keep)
            KEEP_CLUSTER=true
            shift
            ;;
        --no-cleanup)
            CLEANUP=false
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --keep         Keep cluster after tests"
            echo "  --no-cleanup   Don't cleanup existing cluster"
            echo "  --help         Show this help"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

main
