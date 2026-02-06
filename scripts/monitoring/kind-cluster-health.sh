#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# KIND Cluster Health Check and Cleanup Script
# For Tundra Dome project - 3 KIND clusters on shared 24GB disk
# Usage: ./kind-cluster-health.sh [--cleanup] [--verbose]

# Initialize log aggregation
init_log_aggregation


set -euo pipefail

# Configuration
DISK_WARNING_THRESHOLD=85
DISK_CRITICAL_THRESHOLD=90
NODES=(
    "tundra-dome-control-plane"
    "tundra-dome-worker"
    "gastown-control-plane"
    "gastown-worker"
    "gastown-worker2"
    "vibecode-local-control-plane"
    "vibecode-local-worker"
)
CONTEXTS=(
    "kind-tundra-dome"
    "kind-gastown"
    "kind-vibecode-local"
)

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
CLEANUP=false
VERBOSE=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --cleanup) CLEANUP=true; shift ;;
        --verbose) VERBOSE=true; shift ;;
        -h|--help)
            echo "Usage: $0 [--cleanup] [--verbose]"
            echo "  --cleanup  Run image cleanup on all nodes"
            echo "  --verbose  Show detailed output"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   KIND Cluster Health Check${NC}"
echo -e "${BLUE}   $(date)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to check disk usage
check_disk() {
    local node=$1
    local usage
    usage=$(docker exec "$node" df -h / 2>/dev/null | tail -1 | awk '{print $5}' | tr -d '%')

    if [[ -z "$usage" ]]; then
        echo -e "${RED}[ERROR]${NC} Cannot reach node: $node"
        return 1
    fi

    if [[ $usage -ge $DISK_CRITICAL_THRESHOLD ]]; then
        echo -e "${RED}[CRITICAL]${NC} $node: ${usage}% disk used"
        return 2
    elif [[ $usage -ge $DISK_WARNING_THRESHOLD ]]; then
        echo -e "${YELLOW}[WARNING]${NC} $node: ${usage}% disk used"
        return 1
    else
        echo -e "${GREEN}[OK]${NC} $node: ${usage}% disk used"
        return 0
    fi
}

# Function to check pods
check_pods() {
    local context=$1
    echo -e "\n${BLUE}Cluster: $context${NC}"

    if ! kubectl --context "$context" cluster-info &>/dev/null; then
        echo -e "${RED}[ERROR]${NC} Cannot connect to cluster"
        return 1
    fi

    # Count pods by status
    local total running pending failed crashloop
    total=$(kubectl --context "$context" get pods -A --no-headers 2>/dev/null | wc -l)
    running=$(kubectl --context "$context" get pods -A --no-headers 2>/dev/null | grep -c "Running" || true)
    pending=$(kubectl --context "$context" get pods -A --no-headers 2>/dev/null | grep -c "Pending" || true)
    failed=$(kubectl --context "$context" get pods -A --no-headers 2>/dev/null | grep -c "Failed\|Error" || true)
    crashloop=$(kubectl --context "$context" get pods -A --no-headers 2>/dev/null | grep -c "CrashLoopBackOff\|OOMKilled" || true)

    echo "  Total: $total | Running: $running | Pending: $pending | Failed: $failed | CrashLoop/OOM: $crashloop"

    # Show problematic pods
    if [[ $VERBOSE == true ]] || [[ $pending -gt 0 ]] || [[ $failed -gt 0 ]] || [[ $crashloop -gt 0 ]]; then
        local problems
        problems=$(kubectl --context "$context" get pods -A --no-headers 2>/dev/null | grep -E "Pending|Failed|Error|CrashLoopBackOff|OOMKilled" || true)
        if [[ -n "$problems" ]]; then
            echo -e "${YELLOW}  Problematic pods:${NC}"
            echo "$problems" | while read -r line; do
                echo "    $line"
            done
        fi
    fi
}

# Function to cleanup unused images
cleanup_images() {
    local node=$1
    echo -e "${BLUE}Cleaning: $node${NC}"

    local before after
    before=$(docker exec "$node" df / 2>/dev/null | tail -1 | awk '{print $3}')

    docker exec "$node" crictl rmi --prune 2>/dev/null || true

    after=$(docker exec "$node" df / 2>/dev/null | tail -1 | awk '{print $3}')

    if [[ -n "$before" ]] && [[ -n "$after" ]]; then
        local freed=$((before - after))
        if [[ $freed -gt 0 ]]; then
            echo -e "${GREEN}  Freed: ${freed}KB${NC}"
        else
            echo "  No space recovered"
        fi
    fi
}

# Main execution
echo -e "${BLUE}=== Disk Usage Check ===${NC}"
DISK_ISSUES=0
for node in "${NODES[@]}"; do
    check_disk "$node" || DISK_ISSUES=$((DISK_ISSUES + 1))
done

if [[ $CLEANUP == true ]]; then
    echo ""
    echo -e "${BLUE}=== Running Cleanup ===${NC}"
    for node in "${NODES[@]}"; do
        cleanup_images "$node"
    done
    echo ""
    echo -e "${BLUE}=== Post-Cleanup Disk Usage ===${NC}"
    for node in "${NODES[@]}"; do
        check_disk "$node" || true
    done
fi

echo ""
echo -e "${BLUE}=== Pod Health Check ===${NC}"
for context in "${CONTEXTS[@]}"; do
    check_pods "$context"
done

# Docker host stats
echo ""
echo -e "${BLUE}=== Docker Host Stats ===${NC}"
docker system df

# Summary
echo ""
echo -e "${BLUE}=== Summary ===${NC}"
if [[ $DISK_ISSUES -gt 0 ]]; then
    echo -e "${YELLOW}Disk issues found on $DISK_ISSUES nodes${NC}"
    echo "Run with --cleanup to prune unused images"
else
    echo -e "${GREEN}All nodes healthy${NC}"
fi

# Exit with appropriate code
if [[ $DISK_ISSUES -gt 0 ]]; then
    exit 1
fi
exit 0
