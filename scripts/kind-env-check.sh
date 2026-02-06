#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# KIND Environment Check - Verify all prerequisites

# Initialize log aggregation
init_log_aggregation

set -e

echo "🔍 VibeCode KIND Environment Check"
echo "=================================="

ERRORS=0

# Check Docker with timeout
echo "🔍 Checking Docker daemon..."
if timeout 10s docker info > /dev/null 2>&1; then
    echo "✅ Docker is running"
    DOCKER_VERSION=$(docker --version 2>/dev/null || echo "Unknown")
    echo "   Version: $DOCKER_VERSION"
    
    # Check Docker resource allocation with timeout
    DOCKER_MEM=$(timeout 5s docker info --format '{{.MemTotal}}' 2>/dev/null || echo "0")
    if [ "$DOCKER_MEM" != "0" ] && [ "$DOCKER_MEM" -gt 4000000000 ]; then
        echo "✅ Docker memory: $(($DOCKER_MEM / 1024 / 1024 / 1024))GB"
    elif [ "$DOCKER_MEM" != "0" ]; then
        echo "⚠️  Docker memory: $(($DOCKER_MEM / 1024 / 1024 / 1024))GB (recommend 4GB+)"
    else
        echo "⚠️  Docker memory: Unable to determine (may still be initializing)"
    fi
else
    echo "❌ Docker is NOT running or not responding"
    echo "   Common solutions:"
    echo "   • Start Docker Desktop application"
    echo "   • Wait for Docker to fully initialize (can take 30-60 seconds)"
    echo "   • Check Docker Desktop status in system tray"
    echo "   • Restart Docker Desktop if needed"
    ERRORS=$((ERRORS + 1))
fi

# Check KIND
if command -v kind > /dev/null 2>&1; then
    echo "✅ KIND is installed"
    KIND_VERSION=$(kind version 2>/dev/null | grep "kind" | cut -d' ' -f3 || echo 'Unknown')
    echo "   Version: $KIND_VERSION"
else
    echo "❌ KIND is NOT installed"
    echo "   Solution: Install KIND - https://kind.sigs.k8s.io/docs/user/quick-start/"
    echo "   macOS: brew install kind"
    echo "   Linux: curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64 && chmod +x ./kind && sudo mv ./kind /usr/local/bin/kind"
    ERRORS=$((ERRORS + 1))
fi

# Check kubectl
if command -v kubectl > /dev/null 2>&1; then
    echo "✅ kubectl is installed"
    KUBECTL_VERSION=$(kubectl version --client --short 2>/dev/null | grep "Client Version" | cut -d' ' -f3 || echo 'Unknown')
    echo "   Version: $KUBECTL_VERSION"
else
    echo "❌ kubectl is NOT installed"
    echo "   Solution: Install kubectl - https://kubernetes.io/docs/tasks/tools/"
    echo "   macOS: brew install kubectl"
    ERRORS=$((ERRORS + 1))
fi

# Check Helm (optional but recommended)
if command -v helm > /dev/null 2>&1; then
    echo "✅ Helm is installed"
    HELM_VERSION=$(helm version --short 2>/dev/null | cut -d'+' -f1 | cut -d':' -f2 || echo 'Unknown')
    echo "   Version: $HELM_VERSION"
else
    echo "⚠️  Helm is not installed (optional)"
    echo "   Install: brew install helm"
fi

# Check Node.js
if command -v node > /dev/null 2>&1 && command -v npm > /dev/null 2>&1; then
    echo "✅ Node.js is installed"
    echo "   Node: $(node --version)"
    echo "   NPM: $(npm --version)"
else
    echo "❌ Node.js is NOT installed"
    echo "   Solution: Install Node.js 18+ - https://nodejs.org/"
    ERRORS=$((ERRORS + 1))
fi

# Check port availability
echo ""
echo "🔍 Checking port availability..."
for port in 8090 8443 8081 9091; do
    if command -v lsof > /dev/null 2>&1 && lsof -ti:$port > /dev/null 2>&1; then
        PROCESS=$(lsof -ti:$port | head -1 | xargs ps -p 2>/dev/null | tail -1 || echo "Unknown process")
        echo "⚠️  Port $port is in use by: $PROCESS"
        echo "   Solution: Kill process or change port in vibecode-kind-config.yaml"
    else
        echo "✅ Port $port is available"
    fi
done

# Check disk space
echo ""
echo "🔍 Checking disk space..."
if command -v df > /dev/null 2>&1; then
    DISK_AVAIL_RAW=$(df -h . | tail -1 | awk '{print $4}')
    DISK_AVAIL_NUM=$(echo "$DISK_AVAIL_RAW" | sed 's/[^0-9.]//g')
    DISK_UNIT=$(echo "$DISK_AVAIL_RAW" | sed 's/[0-9.]//g')
    
    if [ -n "$DISK_AVAIL_NUM" ]; then
        # Convert to GB for comparison
        case "$DISK_UNIT" in
            *G*) DISK_GB=$DISK_AVAIL_NUM ;;
            *T*) DISK_GB=$(echo "$DISK_AVAIL_NUM * 1024" | bc -l 2>/dev/null || echo "1000") ;;
            *M*) DISK_GB=$(echo "$DISK_AVAIL_NUM / 1024" | bc -l 2>/dev/null || echo "0") ;;
            *) DISK_GB=0 ;;
        esac
        
        if [ "${DISK_GB%.*}" -gt 5 ] 2>/dev/null; then
            echo "✅ Disk space: $DISK_AVAIL_RAW available"
        else
            echo "⚠️  Disk space: $DISK_AVAIL_RAW available (recommend 5GB+)"
        fi
    else
        echo "⚠️  Disk space: Unable to determine available space"
    fi
fi

# Check config file
if [ -f "k8s/vibecode-kind-config.yaml" ]; then
    echo "✅ KIND config file exists: k8s/vibecode-kind-config.yaml"
else
    echo "❌ KIND config file missing: k8s/vibecode-kind-config.yaml"
    ERRORS=$((ERRORS + 1))
fi

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "🎯 Environment Status: READY ✅"
    echo "All prerequisites are satisfied!"
    exit 0
else
    echo "🚨 Environment Status: NOT READY ❌"
    echo "Found $ERRORS issues that need to be resolved."
    exit 1
fi