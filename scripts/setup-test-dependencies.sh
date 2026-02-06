#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

set -e


# Initialize log aggregation
init_log_aggregation

echo "🔧 Setting up test dependencies..."

# Check if running in CI
if [[ "${CI}" == "true" && "${ENABLE_INFRASTRUCTURE_TESTS}" != "true" ]]; then
    echo "⏭️  Skipping infrastructure setup in CI (set ENABLE_INFRASTRUCTURE_TESTS=true to enable)"
    exit 0
fi

# Check for required tools
check_tool() {
    if ! command -v "$1" &> /dev/null; then
        echo "❌ $1 is not available"
        return 1
    else
        echo "✅ $1 is available"
        return 0
    fi
}

echo "📋 Checking required tools..."
TOOLS_MISSING=false

if ! check_tool kubectl; then TOOLS_MISSING=true; fi
if ! check_tool helm; then TOOLS_MISSING=true; fi
if ! check_tool docker; then TOOLS_MISSING=true; fi

if [ "$TOOLS_MISSING" = true ]; then
    echo "⚠️  Missing required tools. Infrastructure tests will be skipped."
    exit 0
fi

# Check if Kubernetes cluster is available
echo "🔍 Checking Kubernetes cluster..."
if ! kubectl cluster-info --request-timeout=5s &> /dev/null; then
    echo "⚠️  No Kubernetes cluster available. Infrastructure tests will be skipped."
    exit 0
fi

echo "✅ Kubernetes cluster is available"

# Setup Helm dependencies if charts directory exists
if [ -d "charts/vibecode-platform" ]; then
    echo "📦 Setting up Helm dependencies..."
    
    cd charts/vibecode-platform
    
    # Add required Helm repositories
    echo "🔄 Adding Helm repositories..."
    helm repo add bitnami https://charts.bitnami.com/bitnami || true
    helm repo add mongodb https://mongodb.github.io/helm-charts || true
    helm repo update
    
    # Build dependencies
    echo "🏗️  Building Helm dependencies..."
    if helm dependency build; then
        echo "✅ Helm dependencies built successfully"
    else
        echo "⚠️  Helm dependency build failed, but continuing..."
    fi
    
    cd ../..
else
    echo "⚠️  Charts directory not found, skipping Helm setup"
fi

# Check if Chaos Engineering CRDs are available
echo "🎯 Checking Chaos Engineering CRDs..."
if kubectl get crd disruptions.chaos.datadoghq.com &> /dev/null; then
    echo "✅ Chaos Engineering CRDs are available"
else
    echo "⚠️  Chaos Engineering CRDs not found"
    echo "   Chaos tests will be skipped unless CRDs are installed"
fi

# Create test namespaces if they don't exist
echo "🏗️  Ensuring test namespaces exist..."
kubectl create namespace vibecode --dry-run=client -o yaml | kubectl apply -f - || true
kubectl create namespace chaos-engineering --dry-run=client -o yaml | kubectl apply -f - || true

echo "✅ Test dependencies setup complete!"
echo ""
echo "💡 To run full infrastructure tests:"
echo "   npm test -- tests/integration tests/k8s"
echo ""
echo "💡 To skip infrastructure tests:"
echo "   npm test -- --testPathIgnorePatterns=integration,k8s"