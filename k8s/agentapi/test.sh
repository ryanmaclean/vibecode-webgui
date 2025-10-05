#!/bin/bash
set -euo pipefail

# VibeCode AgentAPI Deployment Test Suite
# Validates deployment functionality and resource constraints

NAMESPACE="vibecode-platform"
DEPLOYMENT="code-server-workspace"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

pass() { echo -e "${GREEN}✓${NC} $1"; ((PASS_COUNT++)); }
fail() { echo -e "${RED}✗${NC} $1"; ((FAIL_COUNT++)); }
info() { echo -e "${BLUE}ℹ${NC} $1"; }
section() { echo -e "\n${YELLOW}=== $1 ===${NC}"; }

# Test: Namespace and RBAC
test_namespace() {
    section "Testing Namespace and RBAC"

    if kubectl get namespace "$NAMESPACE" &> /dev/null; then
        pass "Namespace exists"
    else
        fail "Namespace not found"
        return 1
    fi

    if kubectl -n "$NAMESPACE" get serviceaccount code-server-sa &> /dev/null; then
        pass "ServiceAccount exists"
    else
        fail "ServiceAccount not found"
    fi

    if kubectl -n "$NAMESPACE" get role code-server-role &> /dev/null; then
        pass "Role exists"
    else
        fail "Role not found"
    fi

    if kubectl -n "$NAMESPACE" get rolebinding code-server-rolebinding &> /dev/null; then
        pass "RoleBinding exists"
    else
        fail "RoleBinding not found"
    fi
}

# Test: ConfigMap and Secrets
test_config() {
    section "Testing Configuration"

    if kubectl -n "$NAMESPACE" get configmap agentapi-config &> /dev/null; then
        pass "ConfigMap exists"

        # Validate ConfigMap keys
        KEYS=$(kubectl -n "$NAMESPACE" get configmap agentapi-config -o jsonpath='{.data}' | jq -r 'keys[]')
        if echo "$KEYS" | grep -q "config.yaml"; then
            pass "ConfigMap contains config.yaml"
        else
            fail "ConfigMap missing config.yaml"
        fi

        if echo "$KEYS" | grep -q "health-check.sh"; then
            pass "ConfigMap contains health-check.sh"
        else
            fail "ConfigMap missing health-check.sh"
        fi
    else
        fail "ConfigMap not found"
    fi

    if kubectl -n "$NAMESPACE" get secret code-server-config &> /dev/null; then
        pass "Secret code-server-config exists"
    else
        fail "Secret code-server-config not found"
    fi

    if kubectl -n "$NAMESPACE" get secret agentapi-secrets &> /dev/null; then
        pass "Secret agentapi-secrets exists"
    else
        fail "Secret agentapi-secrets not found"
    fi
}

# Test: Storage
test_storage() {
    section "Testing Storage"

    if kubectl -n "$NAMESPACE" get pvc code-server-workspace-pvc &> /dev/null; then
        pass "PVC exists"

        PVC_STATUS=$(kubectl -n "$NAMESPACE" get pvc code-server-workspace-pvc -o jsonpath='{.status.phase}')
        if [ "$PVC_STATUS" = "Bound" ]; then
            pass "PVC is bound"
        else
            fail "PVC not bound (status: $PVC_STATUS)"
        fi
    else
        fail "PVC not found"
    fi
}

# Test: Service
test_service() {
    section "Testing Service"

    if kubectl -n "$NAMESPACE" get service code-server-workspace &> /dev/null; then
        pass "Service exists"

        # Check service ports
        PORTS=$(kubectl -n "$NAMESPACE" get service code-server-workspace -o jsonpath='{.spec.ports[*].port}')
        if echo "$PORTS" | grep -q "8765"; then
            pass "Service exposes IDE port 8765"
        else
            fail "Service missing IDE port 8765"
        fi

        if echo "$PORTS" | grep -q "3284"; then
            pass "Service exposes AgentAPI port 3284"
        else
            fail "Service missing AgentAPI port 3284"
        fi

        if echo "$PORTS" | grep -q "9090"; then
            pass "Service exposes metrics port 9090"
        else
            fail "Service missing metrics port 9090"
        fi
    else
        fail "Service not found"
    fi
}

# Test: Deployment
test_deployment() {
    section "Testing Deployment"

    if kubectl -n "$NAMESPACE" get deployment "$DEPLOYMENT" &> /dev/null; then
        pass "Deployment exists"

        # Check deployment status
        READY=$(kubectl -n "$NAMESPACE" get deployment "$DEPLOYMENT" -o jsonpath='{.status.readyReplicas}')
        DESIRED=$(kubectl -n "$NAMESPACE" get deployment "$DEPLOYMENT" -o jsonpath='{.spec.replicas}')

        if [ "${READY:-0}" -eq "${DESIRED:-1}" ]; then
            pass "Deployment ready ($READY/$DESIRED replicas)"
        else
            fail "Deployment not ready ($READY/$DESIRED replicas)"
        fi

        # Check update strategy
        STRATEGY=$(kubectl -n "$NAMESPACE" get deployment "$DEPLOYMENT" -o jsonpath='{.spec.strategy.type}')
        if [ "$STRATEGY" = "RollingUpdate" ]; then
            pass "Using RollingUpdate strategy"
        else
            fail "Not using RollingUpdate strategy (found: $STRATEGY)"
        fi
    else
        fail "Deployment not found"
        return 1
    fi
}

# Test: Pods
test_pods() {
    section "Testing Pods"

    POD_NAME=$(kubectl -n "$NAMESPACE" get pods -l app=code-server -o jsonpath='{.items[0].metadata.name}')
    if [ -n "$POD_NAME" ]; then
        pass "Pod found: $POD_NAME"

        # Check pod status
        POD_STATUS=$(kubectl -n "$NAMESPACE" get pod "$POD_NAME" -o jsonpath='{.status.phase}')
        if [ "$POD_STATUS" = "Running" ]; then
            pass "Pod is running"
        else
            fail "Pod not running (status: $POD_STATUS)"
        fi

        # Check containers
        CONTAINERS=$(kubectl -n "$NAMESPACE" get pod "$POD_NAME" -o jsonpath='{.spec.containers[*].name}')
        if echo "$CONTAINERS" | grep -q "code-server"; then
            pass "code-server container exists"
        else
            fail "code-server container not found"
        fi

        if echo "$CONTAINERS" | grep -q "agentapi"; then
            pass "agentapi container exists"
        else
            fail "agentapi container not found"
        fi

        # Check container readiness
        CODE_SERVER_READY=$(kubectl -n "$NAMESPACE" get pod "$POD_NAME" -o jsonpath='{.status.containerStatuses[?(@.name=="code-server")].ready}')
        if [ "$CODE_SERVER_READY" = "true" ]; then
            pass "code-server container ready"
        else
            fail "code-server container not ready"
        fi

        AGENTAPI_READY=$(kubectl -n "$NAMESPACE" get pod "$POD_NAME" -o jsonpath='{.status.containerStatuses[?(@.name=="agentapi")].ready}')
        if [ "$AGENTAPI_READY" = "true" ]; then
            pass "agentapi container ready"
        else
            fail "agentapi container not ready"
        fi
    else
        fail "No pods found"
        return 1
    fi
}

# Test: Resource Limits
test_resources() {
    section "Testing Resource Limits"

    POD_NAME=$(kubectl -n "$NAMESPACE" get pods -l app=code-server -o jsonpath='{.items[0].metadata.name}')
    if [ -z "$POD_NAME" ]; then
        fail "No pod found for resource testing"
        return 1
    fi

    # code-server resources
    CPU_REQ=$(kubectl -n "$NAMESPACE" get pod "$POD_NAME" -o jsonpath='{.spec.containers[?(@.name=="code-server")].resources.requests.cpu}')
    MEM_REQ=$(kubectl -n "$NAMESPACE" get pod "$POD_NAME" -o jsonpath='{.spec.containers[?(@.name=="code-server")].resources.requests.memory}')

    if [ -n "$CPU_REQ" ]; then
        pass "code-server CPU request: $CPU_REQ"
    else
        fail "code-server missing CPU request"
    fi

    if [ -n "$MEM_REQ" ]; then
        pass "code-server memory request: $MEM_REQ"
    else
        fail "code-server missing memory request"
    fi

    # agentapi resources
    CPU_REQ=$(kubectl -n "$NAMESPACE" get pod "$POD_NAME" -o jsonpath='{.spec.containers[?(@.name=="agentapi")].resources.requests.cpu}')
    MEM_REQ=$(kubectl -n "$NAMESPACE" get pod "$POD_NAME" -o jsonpath='{.spec.containers[?(@.name=="agentapi")].resources.requests.memory}')

    if [ -n "$CPU_REQ" ]; then
        pass "agentapi CPU request: $CPU_REQ"
    else
        fail "agentapi missing CPU request"
    fi

    if [ -n "$MEM_REQ" ]; then
        pass "agentapi memory request: $MEM_REQ"
    else
        fail "agentapi missing memory request"
    fi
}

# Test: Health Checks
test_health() {
    section "Testing Health Checks"

    POD_NAME=$(kubectl -n "$NAMESPACE" get pods -l app=code-server -o jsonpath='{.items[0].metadata.name}')
    if [ -z "$POD_NAME" ]; then
        fail "No pod found for health testing"
        return 1
    fi

    # code-server health
    if kubectl -n "$NAMESPACE" exec "$POD_NAME" -c code-server -- curl -sf http://localhost:8765/healthz &> /dev/null; then
        pass "code-server health endpoint responding"
    else
        fail "code-server health endpoint not responding"
    fi

    # agentapi health
    if kubectl -n "$NAMESPACE" exec "$POD_NAME" -c agentapi -- curl -sf http://127.0.0.1:3284/health &> /dev/null; then
        pass "agentapi health endpoint responding"
    else
        fail "agentapi health endpoint not responding"
    fi

    # agentapi metrics
    if kubectl -n "$NAMESPACE" exec "$POD_NAME" -c agentapi -- curl -sf http://127.0.0.1:9090/metrics &> /dev/null; then
        pass "agentapi metrics endpoint responding"
    else
        fail "agentapi metrics endpoint not responding"
    fi
}

# Test: Security
test_security() {
    section "Testing Security"

    POD_NAME=$(kubectl -n "$NAMESPACE" get pods -l app=code-server -o jsonpath='{.items[0].metadata.name}')
    if [ -z "$POD_NAME" ]; then
        fail "No pod found for security testing"
        return 1
    fi

    # Check security context
    RUN_AS_USER=$(kubectl -n "$NAMESPACE" get pod "$POD_NAME" -o jsonpath='{.spec.securityContext.runAsUser}')
    if [ "$RUN_AS_USER" = "1000" ]; then
        pass "Running as non-root user (UID: $RUN_AS_USER)"
    else
        fail "Not running as expected user (UID: $RUN_AS_USER, expected: 1000)"
    fi

    RUN_AS_NON_ROOT=$(kubectl -n "$NAMESPACE" get pod "$POD_NAME" -o jsonpath='{.spec.securityContext.runAsNonRoot}')
    if [ "$RUN_AS_NON_ROOT" = "true" ]; then
        pass "runAsNonRoot enabled"
    else
        fail "runAsNonRoot not enabled"
    fi

    # Check container capabilities
    CODE_SERVER_CAPS=$(kubectl -n "$NAMESPACE" get pod "$POD_NAME" -o jsonpath='{.spec.containers[?(@.name=="code-server")].securityContext.capabilities.drop[*]}')
    if echo "$CODE_SERVER_CAPS" | grep -q "ALL"; then
        pass "code-server drops all capabilities"
    else
        fail "code-server doesn't drop all capabilities"
    fi

    AGENTAPI_CAPS=$(kubectl -n "$NAMESPACE" get pod "$POD_NAME" -o jsonpath='{.spec.containers[?(@.name=="agentapi")].securityContext.capabilities.drop[*]}')
    if echo "$AGENTAPI_CAPS" | grep -q "ALL"; then
        pass "agentapi drops all capabilities"
    else
        fail "agentapi doesn't drop all capabilities"
    fi
}

# Test: Networking
test_networking() {
    section "Testing Networking"

    # Check NetworkPolicy
    if kubectl -n "$NAMESPACE" get networkpolicy code-server-workspace-netpol &> /dev/null; then
        pass "NetworkPolicy exists"
    else
        fail "NetworkPolicy not found"
    fi

    # Test service connectivity (from within cluster)
    POD_NAME=$(kubectl -n "$NAMESPACE" get pods -l app=code-server -o jsonpath='{.items[0].metadata.name}')
    if [ -n "$POD_NAME" ]; then
        # Test inter-container communication
        if kubectl -n "$NAMESPACE" exec "$POD_NAME" -c code-server -- curl -sf http://127.0.0.1:3284/health &> /dev/null; then
            pass "code-server can reach agentapi (localhost)"
        else
            fail "code-server cannot reach agentapi"
        fi
    fi
}

# Test: Autoscaling
test_autoscaling() {
    section "Testing Autoscaling"

    if kubectl -n "$NAMESPACE" get hpa code-server-workspace-hpa &> /dev/null; then
        pass "HPA exists"

        MIN_REPLICAS=$(kubectl -n "$NAMESPACE" get hpa code-server-workspace-hpa -o jsonpath='{.spec.minReplicas}')
        MAX_REPLICAS=$(kubectl -n "$NAMESPACE" get hpa code-server-workspace-hpa -o jsonpath='{.spec.maxReplicas}')

        if [ "$MIN_REPLICAS" -eq 1 ] && [ "$MAX_REPLICAS" -eq 100 ]; then
            pass "HPA configured for 1-100 replicas"
        else
            fail "HPA replica range incorrect (min: $MIN_REPLICAS, max: $MAX_REPLICAS)"
        fi
    else
        info "HPA not found (may require metrics-server)"
    fi
}

# Test: Policies
test_policies() {
    section "Testing Policies"

    if kubectl -n "$NAMESPACE" get pdb code-server-workspace-pdb &> /dev/null; then
        pass "PodDisruptionBudget exists"
    else
        fail "PodDisruptionBudget not found"
    fi

    if kubectl get priorityclass vibecode-workspace-priority &> /dev/null; then
        pass "PriorityClass exists"
    else
        fail "PriorityClass not found"
    fi
}

# Performance test
test_performance() {
    section "Testing Performance"

    POD_NAME=$(kubectl -n "$NAMESPACE" get pods -l app=code-server -o jsonpath='{.items[0].metadata.name}')
    if [ -z "$POD_NAME" ]; then
        fail "No pod found for performance testing"
        return 1
    fi

    # Check current resource usage
    info "Current resource usage:"
    kubectl top pod -n "$NAMESPACE" "$POD_NAME" --containers 2>/dev/null || info "metrics-server not available"

    # Test response times
    info "Testing endpoint response times..."

    # code-server response time
    START=$(date +%s%N)
    kubectl -n "$NAMESPACE" exec "$POD_NAME" -c code-server -- curl -sf http://localhost:8765/healthz &> /dev/null
    END=$(date +%s%N)
    DURATION=$(( (END - START) / 1000000 ))
    if [ "$DURATION" -lt 100 ]; then
        pass "code-server response time: ${DURATION}ms (< 100ms)"
    else
        fail "code-server response time: ${DURATION}ms (>= 100ms)"
    fi

    # agentapi response time
    START=$(date +%s%N)
    kubectl -n "$NAMESPACE" exec "$POD_NAME" -c agentapi -- curl -sf http://127.0.0.1:3284/health &> /dev/null
    END=$(date +%s%N)
    DURATION=$(( (END - START) / 1000000 ))
    if [ "$DURATION" -lt 100 ]; then
        pass "agentapi response time: ${DURATION}ms (< 100ms)"
    else
        fail "agentapi response time: ${DURATION}ms (>= 100ms)"
    fi
}

# Summary
print_summary() {
    section "Test Summary"

    TOTAL=$((PASS_COUNT + FAIL_COUNT))
    PASS_RATE=0
    if [ "$TOTAL" -gt 0 ]; then
        PASS_RATE=$(( PASS_COUNT * 100 / TOTAL ))
    fi

    echo ""
    echo "Total tests: $TOTAL"
    echo -e "${GREEN}Passed: $PASS_COUNT${NC}"
    echo -e "${RED}Failed: $FAIL_COUNT${NC}"
    echo "Pass rate: ${PASS_RATE}%"
    echo ""

    if [ "$FAIL_COUNT" -eq 0 ]; then
        echo -e "${GREEN}All tests passed! ✓${NC}"
        return 0
    else
        echo -e "${RED}Some tests failed. Review the output above.${NC}"
        return 1
    fi
}

# Main
main() {
    echo "VibeCode AgentAPI Deployment Test Suite"
    echo "========================================"

    test_namespace
    test_config
    test_storage
    test_service
    test_deployment
    test_pods
    test_resources
    test_health
    test_security
    test_networking
    test_autoscaling
    test_policies
    test_performance

    print_summary
}

main "$@"
