#!/bin/bash
# SkyWalking Deployment Verification Script
# Comprehensive testing of all components and integrations

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
NAMESPACE_SKYWALKING="skywalking"
NAMESPACE_VIBECODE="vibecode-platform"

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
log_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++))
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

# Test 1: Component Health Checks
test_component_health() {
    log_test "Testing component health..."

    # OAP health
    if kubectl get pods -n "$NAMESPACE_SKYWALKING" -l app.kubernetes.io/name=oap | grep -q Running; then
        OAP_POD=$(kubectl get pod -l app.kubernetes.io/name=oap -n "$NAMESPACE_SKYWALKING" -o jsonpath='{.items[0].metadata.name}')
        if kubectl exec "$OAP_POD" -n "$NAMESPACE_SKYWALKING" -- curl -sf http://localhost:12800/internal/l7check &> /dev/null; then
            log_pass "OAP is healthy"
        else
            log_fail "OAP health check failed"
        fi
    else
        log_fail "OAP pods not running"
    fi

    # BanyanDB health
    if kubectl get pods -n "$NAMESPACE_SKYWALKING" -l app.kubernetes.io/name=banyandb | grep -q Running; then
        log_pass "BanyanDB is running"
    else
        log_fail "BanyanDB pods not running"
    fi

    # UI health
    if kubectl get pods -n "$NAMESPACE_SKYWALKING" -l app.kubernetes.io/name=ui | grep -q Running; then
        log_pass "UI is running"
    else
        log_fail "UI pods not running"
    fi

    # Rover agents
    ROVER_COUNT=$(kubectl get pods -l app.kubernetes.io/name=rover -n "$NAMESPACE_SKYWALKING" --field-selector=status.phase=Running -o json | jq '.items | length')
    NODE_COUNT=$(kubectl get nodes -o json | jq '.items | length')
    if [ "$ROVER_COUNT" -eq "$NODE_COUNT" ]; then
        log_pass "Rover agents running on all $NODE_COUNT nodes"
    else
        log_warn "Rover agents: $ROVER_COUNT/$NODE_COUNT nodes"
    fi
}

# Test 2: Storage Connectivity
test_storage_connectivity() {
    log_test "Testing storage connectivity..."

    OAP_POD=$(kubectl get pod -l app.kubernetes.io/name=oap -n "$NAMESPACE_SKYWALKING" -o jsonpath='{.items[0].metadata.name}')

    if kubectl exec "$OAP_POD" -n "$NAMESPACE_SKYWALKING" -- nc -zv banyandb 17912 &> /dev/null; then
        log_pass "OAP can connect to BanyanDB"
    else
        log_fail "OAP cannot connect to BanyanDB"
    fi
}

# Test 3: Agent Instrumentation
test_agent_instrumentation() {
    log_test "Testing agent instrumentation..."

    # Check Node.js agent config
    if kubectl get configmap skywalking-nodejs-agent-config -n "$NAMESPACE_VIBECODE" &> /dev/null; then
        log_pass "Node.js agent configuration exists"
    else
        log_fail "Node.js agent configuration missing"
    fi

    # Check Python agent config
    if kubectl get configmap skywalking-python-agent-config -n "$NAMESPACE_VIBECODE" &> /dev/null; then
        log_pass "Python agent configuration exists"
    else
        log_fail "Python agent configuration missing"
    fi
}

# Test 4: Trace Collection
test_trace_collection() {
    log_test "Testing trace collection..."

    OAP_POD=$(kubectl get pod -l app.kubernetes.io/name=oap -n "$NAMESPACE_SKYWALKING" -o jsonpath='{.items[0].metadata.name}')

    # Query for traces
    TRACE_QUERY='{"query":"query {getTraces(condition:{},paging:{pageNum:1,pageSize:1}){total}}"}'
    TRACE_COUNT=$(kubectl exec "$OAP_POD" -n "$NAMESPACE_SKYWALKING" -- \
        curl -sf -X POST http://localhost:12800/graphql \
        -H "Content-Type: application/json" \
        -d "$TRACE_QUERY" 2>/dev/null | jq -r '.data.getTraces.total // 0')

    if [ "$TRACE_COUNT" -gt 0 ]; then
        log_pass "Traces are being collected ($TRACE_COUNT traces found)"
    else
        log_warn "No traces found yet (may take a few minutes after deployment)"
    fi
}

# Test 5: AI Anomaly Detection
test_anomaly_detection() {
    log_test "Testing AI anomaly detection..."

    # Check if AI config exists
    if kubectl get configmap skywalking-ai-config -n "$NAMESPACE_SKYWALKING" &> /dev/null; then
        log_pass "AI anomaly detection configuration exists"
    else
        log_fail "AI anomaly detection configuration missing"
    fi

    # Check baseline training job
    if kubectl get job skywalking-initial-training -n "$NAMESPACE_SKYWALKING" &> /dev/null; then
        JOB_STATUS=$(kubectl get job skywalking-initial-training -n "$NAMESPACE_SKYWALKING" -o jsonpath='{.status.conditions[0].type}')
        if [ "$JOB_STATUS" = "Complete" ]; then
            log_pass "Initial model training completed"
        elif [ "$JOB_STATUS" = "Failed" ]; then
            log_fail "Initial model training failed"
        else
            log_warn "Initial model training still in progress"
        fi
    else
        log_warn "Initial training job not found"
    fi

    # Check CronJob for baseline updates
    if kubectl get cronjob skywalking-baseline-training -n "$NAMESPACE_SKYWALKING" &> /dev/null; then
        log_pass "Baseline training CronJob configured"
    else
        log_fail "Baseline training CronJob missing"
    fi
}

# Test 6: Datadog Integration
test_datadog_integration() {
    log_test "Testing Datadog integration..."

    # Check OTLP collector
    if kubectl get deployment skywalking-otel-collector -n "$NAMESPACE_SKYWALKING" &> /dev/null; then
        COLLECTOR_READY=$(kubectl get deployment skywalking-otel-collector -n "$NAMESPACE_SKYWALKING" -o jsonpath='{.status.readyReplicas}')
        if [ "${COLLECTOR_READY:-0}" -gt 0 ]; then
            log_pass "OTLP collector is running"
        else
            log_fail "OTLP collector not ready"
        fi
    else
        log_fail "OTLP collector not deployed"
    fi

    # Check Datadog secret
    if kubectl get secret datadog-secret -n "$NAMESPACE_SKYWALKING" &> /dev/null; then
        log_pass "Datadog secret exists"
    else
        log_warn "Datadog secret not found (integration disabled)"
    fi

    # Check integration config
    if kubectl get configmap skywalking-datadog-integration -n "$NAMESPACE_SKYWALKING" &> /dev/null; then
        log_pass "Datadog integration configuration exists"
    else
        log_fail "Datadog integration configuration missing"
    fi
}

# Test 7: Alert Routing
test_alert_routing() {
    log_test "Testing alert routing..."

    # Check integration secrets
    if kubectl get secret skywalking-integration-secrets -n "$NAMESPACE_SKYWALKING" &> /dev/null; then
        log_pass "Alert routing secrets exist"
    else
        log_warn "Alert routing secrets not found (limited alerting)"
    fi

    # Check alert rules
    if kubectl get configmap skywalking-ai-config -n "$NAMESPACE_SKYWALKING" -o yaml | grep -q "alerting-rules.yaml"; then
        log_pass "Alert rules configured"
    else
        log_warn "Alert rules may not be configured"
    fi
}

# Test 8: Metrics Export
test_metrics_export() {
    log_test "Testing metrics export..."

    OAP_POD=$(kubectl get pod -l app.kubernetes.io/name=oap -n "$NAMESPACE_SKYWALKING" -o jsonpath='{.items[0].metadata.name}')

    # Check Prometheus metrics endpoint
    if kubectl exec "$OAP_POD" -n "$NAMESPACE_SKYWALKING" -- curl -sf http://localhost:1234/metrics | grep -q "skywalking"; then
        log_pass "Prometheus metrics are being exported"
    else
        log_fail "Prometheus metrics not available"
    fi

    # Check ServiceMonitor
    if kubectl get servicemonitor skywalking-otel-collector -n "$NAMESPACE_SKYWALKING" &> /dev/null; then
        log_pass "ServiceMonitor configured for Prometheus scraping"
    else
        log_warn "ServiceMonitor not found (manual Prometheus config needed)"
    fi
}

# Test 9: eBPF Functionality
test_ebpf_functionality() {
    log_test "Testing eBPF functionality..."

    # Check if Rover pods are running
    if kubectl get pods -l app.kubernetes.io/name=rover -n "$NAMESPACE_SKYWALKING" | grep -q Running; then
        # Check if eBPF is actually working
        ROVER_POD=$(kubectl get pod -l app.kubernetes.io/name=rover -n "$NAMESPACE_SKYWALKING" -o jsonpath='{.items[0].metadata.name}')
        if kubectl logs "$ROVER_POD" -n "$NAMESPACE_SKYWALKING" --tail=50 | grep -q "eBPF.*enabled"; then
            log_pass "eBPF profiling is active"
        else
            log_warn "eBPF may not be fully functional (check kernel version)"
        fi
    else
        log_fail "Rover eBPF agents not running"
    fi
}

# Test 10: Resource Usage
test_resource_usage() {
    log_test "Testing resource usage..."

    # Check if metrics-server is available
    if kubectl top pods -n "$NAMESPACE_SKYWALKING" &> /dev/null; then
        CPU_USAGE=$(kubectl top pods -n "$NAMESPACE_SKYWALKING" --no-headers 2>/dev/null | awk '{sum+=$2} END {print sum}' | sed 's/m//')
        MEM_USAGE=$(kubectl top pods -n "$NAMESPACE_SKYWALKING" --no-headers 2>/dev/null | awk '{sum+=$3} END {print sum}' | sed 's/Mi//')

        if [ -n "$CPU_USAGE" ] && [ "$CPU_USAGE" -lt 5000 ]; then
            log_pass "CPU usage is within expected range (${CPU_USAGE}m)"
        else
            log_warn "CPU usage may be high (${CPU_USAGE:-N/A}m)"
        fi

        if [ -n "$MEM_USAGE" ] && [ "$MEM_USAGE" -lt 10000 ]; then
            log_pass "Memory usage is within expected range (${MEM_USAGE}Mi)"
        else
            log_warn "Memory usage may be high (${MEM_USAGE:-N/A}Mi)"
        fi
    else
        log_warn "metrics-server not available, skipping resource usage check"
    fi
}

# Test 11: UI Accessibility
test_ui_accessibility() {
    log_test "Testing UI accessibility..."

    UI_POD=$(kubectl get pod -l app.kubernetes.io/name=ui -n "$NAMESPACE_SKYWALKING" -o jsonpath='{.items[0].metadata.name}')

    if kubectl exec "$UI_POD" -n "$NAMESPACE_SKYWALKING" -- curl -sf http://localhost:8080 &> /dev/null; then
        log_pass "UI is accessible"
    else
        log_fail "UI is not accessible"
    fi

    # Check ingress
    if kubectl get ingress skywalking-ui -n "$NAMESPACE_SKYWALKING" &> /dev/null; then
        log_pass "Ingress configured for external access"
    else
        log_warn "Ingress not found (UI only accessible via port-forward)"
    fi
}

# Test 12: Network Policies
test_network_policies() {
    log_test "Testing network policies..."

    if kubectl get networkpolicy -n "$NAMESPACE_SKYWALKING" &> /dev/null; then
        POLICY_COUNT=$(kubectl get networkpolicy -n "$NAMESPACE_SKYWALKING" -o json | jq '.items | length')
        if [ "$POLICY_COUNT" -gt 0 ]; then
            log_pass "Network policies configured ($POLICY_COUNT policies)"
        else
            log_warn "No network policies found"
        fi
    else
        log_warn "Network policies not configured"
    fi
}

# Summary Report
print_summary() {
    echo ""
    echo "======================================"
    echo "Verification Summary"
    echo "======================================"
    echo ""
    echo -e "${GREEN}Passed:${NC}   $PASSED"
    echo -e "${RED}Failed:${NC}   $FAILED"
    echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
    echo ""

    if [ "$FAILED" -eq 0 ]; then
        echo -e "${GREEN}All critical tests passed!${NC}"
        echo ""
        echo "SkyWalking deployment is healthy and ready for use."
        echo ""
        echo "Next steps:"
        echo "1. Access UI: kubectl port-forward -n $NAMESPACE_SKYWALKING svc/ui 8080:8080"
        echo "2. View traces and service topology"
        echo "3. Check AI anomaly detection dashboard"
        echo "4. Configure alert routing if not already done"
        return 0
    else
        echo -e "${RED}Some tests failed. Please review the output above.${NC}"
        echo ""
        echo "Common fixes:"
        echo "1. Wait a few more minutes for components to stabilize"
        echo "2. Check pod logs: kubectl logs -n $NAMESPACE_SKYWALKING <pod-name>"
        echo "3. Verify secrets are configured correctly"
        echo "4. Ensure Datadog agent is running (if integration enabled)"
        return 1
    fi
}

# Main execution
main() {
    echo "======================================"
    echo "SkyWalking Deployment Verification"
    echo "======================================"
    echo ""

    test_component_health
    test_storage_connectivity
    test_agent_instrumentation
    test_trace_collection
    test_anomaly_detection
    test_datadog_integration
    test_alert_routing
    test_metrics_export
    test_ebpf_functionality
    test_resource_usage
    test_ui_accessibility
    test_network_policies

    print_summary
}

# Run verification
main "$@"
