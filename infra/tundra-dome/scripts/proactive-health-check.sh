#!/bin/bash
#
# Tundra Dome Proactive Health Check
# ===================================
# Monitor cluster health and service status
#
# Usage:
#   ./proactive-health-check.sh              # Run all health checks
#   ./proactive-health-check.sh --quick      # Quick pod status only
#   ./proactive-health-check.sh --kafka      # Kafka-specific checks
#   ./proactive-health-check.sh --watch      # Continuous monitoring
#

set -e

CLUSTER_NAME="${TUNDRA_CLUSTER_NAME:-tundra-dome}"
NAMESPACE="${TUNDRA_NAMESPACE:-tundra-dome}"
WATCH_INTERVAL="${WATCH_INTERVAL:-10}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

ok() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }
info() { echo -e "${BLUE}ℹ${NC} $1"; }

check_cluster_connectivity() {
    info "Checking cluster connectivity..."

    if kubectl cluster-info --context "kind-${CLUSTER_NAME}" &>/dev/null; then
        ok "Cluster is accessible"
        kubectl config use-context "kind-${CLUSTER_NAME}" &>/dev/null
        return 0
    else
        fail "Cannot connect to cluster: $CLUSTER_NAME"
        return 1
    fi
}

check_pod_health() {
    info "Checking pod health in namespace: $NAMESPACE"

    if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
        fail "Namespace '$NAMESPACE' does not exist"
        return 1
    fi

    local total_pods
    total_pods=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l | tr -d ' ')

    if [ "$total_pods" -eq 0 ]; then
        warn "No pods found in namespace $NAMESPACE"
        return 1
    fi

    local ready_pods
    ready_pods=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | grep -c "Running" || echo "0")

    local pending_pods
    pending_pods=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | grep -c "Pending\|ContainerCreating" || echo "0")

    local failed_pods
    failed_pods=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | grep -c "Error\|CrashLoopBackOff\|ImagePullBackOff" || echo "0")

    echo ""
    echo "  Total pods:   $total_pods"
    echo "  Running:      $ready_pods"

    if [ "$pending_pods" -gt 0 ]; then
        warn "Pending:      $pending_pods"
    fi

    if [ "$failed_pods" -gt 0 ]; then
        fail "Failed:       $failed_pods"
        echo ""
        kubectl get pods -n "$NAMESPACE" | grep -E "Error|CrashLoopBackOff|ImagePullBackOff" || true
    else
        ok "No failed pods"
    fi

    echo ""
    return 0
}

check_core_services() {
    info "Checking core services..."

    local services=("kafka" "airflow-scheduler" "airflow-api-service" "postgresql")
    local all_ok=0

    for svc in "${services[@]}"; do
        if kubectl get deployment "$svc" -n "$NAMESPACE" &>/dev/null; then
            local ready
            ready=$(kubectl get deployment "$svc" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
            local desired
            desired=$(kubectl get deployment "$svc" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")

            if [ "$ready" -eq "$desired" ] && [ "$ready" -gt 0 ]; then
                ok "$svc: $ready/$desired ready"
            else
                warn "$svc: $ready/$desired ready"
                all_ok=1
            fi
        elif kubectl get statefulset "$svc" -n "$NAMESPACE" &>/dev/null; then
            local ready
            ready=$(kubectl get statefulset "$svc" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
            local desired
            desired=$(kubectl get statefulset "$svc" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")

            if [ "$ready" -eq "$desired" ] && [ "$ready" -gt 0 ]; then
                ok "$svc: $ready/$desired ready"
            else
                warn "$svc: $ready/$desired ready"
                all_ok=1
            fi
        else
            warn "$svc: not found"
            all_ok=1
        fi
    done

    echo ""
    return $all_ok
}

check_kafka_health() {
    info "Checking Kafka health..."

    local kafka_pod
    kafka_pod=$(kubectl get pod -l app=kafka -n "$NAMESPACE" -o name 2>/dev/null | head -n 1)

    if [ -z "$kafka_pod" ]; then
        fail "Kafka pod not found"
        return 1
    fi

    # Check if Kafka is responding
    if kubectl exec "$kafka_pod" -n "$NAMESPACE" -c kafka -- \
        /opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092 &>/dev/null; then
        ok "Kafka broker is responsive"
    else
        fail "Kafka broker not responding"
        return 1
    fi

    # List topics
    local topics
    topics=$(kubectl exec "$kafka_pod" -n "$NAMESPACE" -c kafka -- \
        /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list 2>/dev/null | wc -l | tr -d ' ')

    ok "Kafka topics: $topics"

    echo ""
    return 0
}

check_custom_resources() {
    info "Checking custom resources..."

    local resource_types=("beads" "polecats" "lanes" "playbooks" "stations")

    for res in "${resource_types[@]}"; do
        local count
        count=$(kubectl get "$res" -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l | tr -d ' ')
        if [ "$count" -gt 0 ]; then
            ok "$res: $count found"
        else
            info "$res: 0 found"
        fi
    done

    echo ""
    return 0
}

run_quick_check() {
    check_cluster_connectivity || exit 1
    check_pod_health
}

run_full_check() {
    check_cluster_connectivity || exit 1
    check_pod_health
    check_core_services
    check_custom_resources
}

run_watch_mode() {
    info "Starting health monitoring (interval: ${WATCH_INTERVAL}s, Ctrl+C to stop)"
    echo ""

    while true; do
        clear
        echo "=== Tundra Dome Health Check - $(date) ==="
        echo ""
        run_full_check
        echo "Next check in ${WATCH_INTERVAL}s..."
        sleep "$WATCH_INTERVAL"
    done
}

case "${1:-}" in
    --quick)
        run_quick_check
        ;;
    --kafka)
        check_cluster_connectivity || exit 1
        check_kafka_health
        ;;
    --watch)
        run_watch_mode
        ;;
    *)
        run_full_check
        ;;
esac
