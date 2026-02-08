#!/bin/bash
# Tundra Dome Proactive Health Check
# Combines K8s state with Datadog Bits AI SRE insights
# Run this regularly to catch issues before they escalate

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DD_SKILL_DIR="${DD_SKILL_DIR:-$HOME/.claude/skills/datadog-operations/scripts}"
NAMESPACE="${NAMESPACE:-tundra-dome}"

RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "=== Tundra Dome Proactive Health Check ==="
echo "Timestamp: $(date)"
echo ""

issues_found=0

# 1. Check K8s pod health
echo "Checking K8s pods..."
if command -v kubectl &>/dev/null; then
    failing_pods=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase!=Running,status.phase!=Succeeded -o name 2>/dev/null | wc -l | tr -d ' ')
    crash_loops=$(kubectl get pods -n "$NAMESPACE" -o json 2>/dev/null | jq '[.items[] | select(.status.containerStatuses[]?.state.waiting.reason == "CrashLoopBackOff")] | length' 2>/dev/null || echo 0)

    if [[ "$failing_pods" -gt 0 ]]; then
        echo -e "${RED}  [CRITICAL] $failing_pods pods not running${NC}"
        kubectl get pods -n "$NAMESPACE" --field-selector=status.phase!=Running,status.phase!=Succeeded 2>/dev/null | head -10
        ((issues_found++))
    fi

    if [[ "$crash_loops" -gt 0 ]]; then
        echo -e "${RED}  [CRITICAL] $crash_loops pods in CrashLoopBackOff${NC}"
        kubectl get pods -n "$NAMESPACE" -o json 2>/dev/null | jq -r '.items[] | select(.status.containerStatuses[]?.state.waiting.reason == "CrashLoopBackOff") | .metadata.name' | head -5
        ((issues_found++))
    fi

    if [[ "$failing_pods" -eq 0 && "$crash_loops" -eq 0 ]]; then
        echo -e "${GREEN}  All pods healthy${NC}"
    fi
else
    echo -e "${YELLOW}  kubectl not available, skipping K8s checks${NC}"
fi
echo ""

# 2. Check recent pod logs for errors
echo "Checking recent pod logs for errors..."
if command -v kubectl &>/dev/null; then
    error_patterns="Cannot find module|CrashLoopBackOff|Error:|FATAL|panic:|undefined|failed to"

    for pod in $(kubectl get pods -n "$NAMESPACE" -o name 2>/dev/null | head -5); do
        pod_name=$(basename "$pod")
        errors=$(kubectl logs "$pod" -n "$NAMESPACE" --since=10m 2>/dev/null | grep -iE "$error_patterns" | head -3 || true)
        if [[ -n "$errors" ]]; then
            echo -e "${YELLOW}  [WARN] Errors in $pod_name:${NC}"
            echo "$errors" | sed 's/^/    /'
            ((issues_found++))
        fi
    done

    if [[ "$issues_found" -eq 0 ]]; then
        echo -e "${GREEN}  No recent errors in pod logs${NC}"
    fi
else
    echo -e "${YELLOW}  kubectl not available, skipping log checks${NC}"
fi
echo ""

# 3. Check Airflow health
echo "Checking Airflow scheduler..."
if command -v kubectl &>/dev/null; then
    # Try different label selectors for Airflow
    scheduler_pod=$(kubectl get pods -n "$NAMESPACE" -o name 2>/dev/null | grep -i scheduler | head -1 || echo "")
    if [[ -n "$scheduler_pod" ]]; then
        scheduler_ready=$(kubectl get "$scheduler_pod" -n "$NAMESPACE" -o jsonpath='{.status.containerStatuses[0].ready}' 2>/dev/null || echo "false")
        if [[ "$scheduler_ready" == "true" ]]; then
            echo -e "${GREEN}  Airflow scheduler ready${NC}"
        else
            echo -e "${RED}  [CRITICAL] Airflow scheduler not ready${NC}"
            ((issues_found++))
        fi
    else
        echo -e "${YELLOW}  No Airflow scheduler found${NC}"
    fi
fi
echo ""

# 4. Check Kafka connectivity
echo "Checking Kafka..."
if command -v kubectl &>/dev/null; then
    kafka_ready=$(kubectl get pods -n "$NAMESPACE" -l app=kafka -o jsonpath='{.items[0].status.containerStatuses[0].ready}' 2>/dev/null || echo "false")
    if [[ "$kafka_ready" == "true" ]]; then
        echo -e "${GREEN}  Kafka broker ready${NC}"
    else
        echo -e "${YELLOW}  Kafka broker status unknown${NC}"
    fi
fi
echo ""

# 5. Query Datadog Bits AI SRE
echo "Checking Datadog Bits AI SRE..."
if [[ -x "$DD_SKILL_DIR/query-bits-sre.sh" ]]; then
    bits_output=$("$DD_SKILL_DIR/query-bits-sre.sh" --duration 1h --json 2>/dev/null || echo '{}')
    total_issues=$(echo "$bits_output" | jq '.summary.total_issues // 0' 2>/dev/null || echo 0)

    if [[ "$total_issues" -gt 0 ]]; then
        echo -e "${YELLOW}  [WARN] Datadog detected $total_issues issues in last hour${NC}"
        echo "$bits_output" | jq -r '.recommendations[]? | "    - [\(.priority | ascii_upcase)] \(.message)"' 2>/dev/null || true
        ((issues_found+=total_issues))
    else
        echo -e "${GREEN}  No issues detected by Datadog${NC}"
    fi
else
    echo -e "${YELLOW}  Datadog skill not available, skipping${NC}"
fi
echo ""

# 6. Check polecat deployments
echo "Checking Polecat workers..."
if command -v kubectl &>/dev/null; then
    # Check actual polecat pods by label
    polecat_pods=$(kubectl get pods -n "$NAMESPACE" -l 'app' -o name 2>/dev/null | grep polecat | wc -l | tr -d ' ')
    polecat_ready=$(kubectl get pods -n "$NAMESPACE" -o json 2>/dev/null | jq '[.items[] | select(.metadata.name | startswith("polecat-")) | select(.status.phase == "Running")] | length' 2>/dev/null || echo 0)

    if [[ "$polecat_ready" -gt 0 ]]; then
        echo -e "${GREEN}  $polecat_ready polecat workers running${NC}"
    else
        echo -e "${YELLOW}  [WARN] No polecat workers running${NC}"
        ((issues_found++))
    fi
fi
echo ""

# Summary
echo "=== Summary ==="
if [[ "$issues_found" -eq 0 ]]; then
    echo -e "${GREEN}System healthy - no issues detected${NC}"
    exit 0
else
    echo -e "${RED}Found $issues_found issue(s) requiring attention${NC}"
    echo ""
    echo "Recommended Actions:"
    echo "  1. Review failing pods: kubectl get pods -n $NAMESPACE"
    echo "  2. Check pod logs: kubectl logs -n $NAMESPACE <pod-name>"
    echo "  3. Review Datadog: https://app.datadoghq.com/apm/home?env=tundra-dome"
    echo "  4. Check Bits AI SRE: https://app.datadoghq.com/slo"
    exit 1
fi
