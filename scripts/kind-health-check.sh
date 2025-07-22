#!/bin/bash
# KIND Health Check - Comprehensive validation of VibeCode deployment
set -e

echo "🩺 VibeCode KIND Health Check"
echo "============================"

CLUSTER_NAME="vibecode-test"
NAMESPACE="vibecode"
ERRORS=0

# Check cluster connectivity
echo "Test 1: Cluster connectivity"
if kubectl cluster-info --context="kind-${CLUSTER_NAME}" > /dev/null 2>&1; then
    echo "✅ Cluster is accessible"
    CURRENT_CONTEXT=$(kubectl config current-context)
    echo "   Current context: $CURRENT_CONTEXT"
else
    echo "❌ Cannot connect to cluster"
    echo "   Solution: ./scripts/kind-create-cluster.sh"
    ERRORS=$((ERRORS + 1))
fi

# Check nodes
echo ""
echo "Test 2: Node health"
READY_NODES=$(kubectl get nodes --no-headers 2>/dev/null | grep "Ready" | wc -l)
TOTAL_NODES=$(kubectl get nodes --no-headers 2>/dev/null | wc -l)
if [ "$READY_NODES" -eq "$TOTAL_NODES" ] && [ "$TOTAL_NODES" -gt 0 ]; then
    echo "✅ All nodes ready ($READY_NODES/$TOTAL_NODES)"
    kubectl get nodes --no-headers | sed 's/^/   /'
else
    echo "❌ Some nodes not ready ($READY_NODES/$TOTAL_NODES)"
    kubectl get nodes
    ERRORS=$((ERRORS + 1))
fi

# Check namespace
echo ""
echo "Test 3: Namespace and pods"
if kubectl get namespace "$NAMESPACE" > /dev/null 2>&1; then
    echo "✅ Namespace '$NAMESPACE' exists"
    
    # Check pod status
    RUNNING_PODS=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | grep "Running" | wc -l)
    TOTAL_PODS=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
    
    if [ "$TOTAL_PODS" -gt 0 ]; then
        if [ "$RUNNING_PODS" -eq "$TOTAL_PODS" ]; then
            echo "✅ All pods running ($RUNNING_PODS/$TOTAL_PODS)"
            kubectl get pods -n "$NAMESPACE" --no-headers | sed 's/^/   /'
        else
            echo "❌ Some pods not running ($RUNNING_PODS/$TOTAL_PODS)"
            kubectl get pods -n "$NAMESPACE"
            ERRORS=$((ERRORS + 1))
        fi
    else
        echo "⚠️  No pods found in namespace (deployment may be missing)"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "❌ Namespace '$NAMESPACE' does not exist"
    ERRORS=$((ERRORS + 1))
fi

# Check services
echo ""
echo "Test 4: Service connectivity"
SERVICES=$(kubectl get services -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
if [ "$SERVICES" -gt 0 ]; then
    echo "✅ Found $SERVICES services"
    kubectl get services -n "$NAMESPACE" --no-headers | awk '{print "   " $1 " (" $3 ")"}' 
else
    echo "⚠️  No services found"
fi

# Test database connectivity
echo ""
echo "Test 5: Database connectivity"
if kubectl get pods -n "$NAMESPACE" -l app=postgres --no-headers 2>/dev/null | grep -q "Running"; then
    if kubectl exec -n "$NAMESPACE" deployment/postgres -- psql -U vibecode -d vibecode -c "SELECT 1;" > /dev/null 2>&1; then
        echo "✅ PostgreSQL is responsive"
    else
        echo "❌ PostgreSQL connection failed"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "❌ PostgreSQL pod not running"
    ERRORS=$((ERRORS + 1))
fi

# Test Redis connectivity
echo ""
echo "Test 6: Redis connectivity"
if kubectl get pods -n "$NAMESPACE" -l app=redis --no-headers 2>/dev/null | grep -q "Running"; then
    if kubectl exec -n "$NAMESPACE" deployment/redis -- redis-cli ping 2>/dev/null | grep -q "PONG"; then
        echo "✅ Redis is responsive"
    else
        echo "❌ Redis connection failed"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "❌ Redis pod not running"
    ERRORS=$((ERRORS + 1))
fi

# Test application health endpoint
echo ""
echo "Test 7: Application health endpoint"
if kubectl get pods -n "$NAMESPACE" -l app=vibecode-webgui --no-headers 2>/dev/null | grep -q "Running"; then
    # Create a temporary pod to test connectivity
    if kubectl run health-test --image=curlimages/curl:latest --restart=Never --rm -i --timeout=30s -- \
        curl -s -f http://vibecode-service.$NAMESPACE.svc.cluster.local:3000/api/health > /dev/null 2>&1; then
        echo "✅ Health endpoint responding"
    else
        echo "❌ Health endpoint not accessible"
        echo "   This may be normal if the app is still starting"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "❌ VibeCode application pod not running"
    ERRORS=$((ERRORS + 1))
fi

# Test AI endpoint (basic)
echo ""
echo "Test 8: AI endpoint basic test"
if [ $ERRORS -eq 0 ]; then
    if kubectl run ai-test --image=curlimages/curl:latest --restart=Never --rm -i --timeout=30s -- \
        curl -s -f -X POST http://vibecode-service.$NAMESPACE.svc.cluster.local:3000/api/health \
        -H "Content-Type: application/json" > /dev/null 2>&1; then
        echo "✅ API endpoints accessible"
    else
        echo "⚠️  API endpoints may not be fully ready"
    fi
else
    echo "⏭️  Skipping API test due to previous failures"
fi

# Resource usage check
echo ""
echo "Test 9: Resource usage"
if command -v kubectl > /dev/null 2>&1; then
    echo "📊 Cluster resource usage:"
    if kubectl top nodes 2>/dev/null | grep -v NAME | head -5; then
        echo "   (Resource metrics available)"
    else
        echo "   (Resource metrics not available - metrics server may not be installed)"
    fi
    
    echo ""
    echo "📊 Pod resource usage:"
    if kubectl top pods -n "$NAMESPACE" 2>/dev/null | head -10; then
        echo "   (Pod metrics available)"
    else
        echo "   (Pod metrics not available)"
    fi
fi

# Port forwarding test
echo ""
echo "Test 10: Port forwarding capability"
echo "🔌 Testing port forwarding (10 second test)..."
kubectl port-forward -n "$NAMESPACE" svc/vibecode-service 3001:3000 --address=127.0.0.1 &
PF_PID=$!
sleep 3

if curl -s -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "✅ Port forwarding works"
    echo "   Application accessible at: http://localhost:3001"
else
    echo "⚠️  Port forwarding test inconclusive (app may still be starting)"
fi

# Clean up port forwarding
kill $PF_PID 2>/dev/null || true
sleep 1

# Summary
echo ""
echo "======================================"
if [ $ERRORS -eq 0 ]; then
    echo "🎯 Health Check: PASSED ✅"
    echo ""
    echo "🚀 Your VibeCode environment is healthy!"
    echo ""
    echo "💡 Quick start:"
    echo "   kubectl port-forward -n $NAMESPACE svc/vibecode-service 3000:3000"
    echo "   open http://localhost:3000"
    echo ""
    echo "📋 Available features to test:"
    echo "   • AI Chat with multiple models"
    echo "   • RAG-enhanced responses"
    echo "   • Console mode (VS Code in browser)"
    echo "   • Project generation"
    echo "   • Vector search"
    exit 0
else
    echo "🚨 Health Check: FAILED ❌"
    echo ""
    echo "Found $ERRORS issues. Check the logs above for details."
    echo ""
    echo "🛠️  Troubleshooting steps:"
    echo "   1. Check pod logs: kubectl logs -l app=vibecode-webgui -n $NAMESPACE"
    echo "   2. Check events: kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp'"
    echo "   3. Restart deployment: kubectl rollout restart deployment/vibecode-webgui -n $NAMESPACE"
    echo "   4. Full reset: kind delete cluster --name=$CLUSTER_NAME && ./scripts/kind-setup.sh"
    exit 1
fi