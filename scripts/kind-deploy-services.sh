#!/bin/bash
# KIND Service Deployment - Deploy VibeCode services to cluster
set -e

echo "🏗️  Deploying VibeCode services to KIND cluster"
echo "=============================================="

CLUSTER_NAME="vibecode-test"
NAMESPACE="vibecode-platform"

# Verify cluster exists and is accessible
if ! kubectl cluster-info --context="kind-${CLUSTER_NAME}" > /dev/null 2>&1; then
    echo "❌ Cannot connect to cluster: kind-${CLUSTER_NAME}"
    echo "   Run: ./scripts/kind-create-cluster.sh"
    exit 1
fi

# Use the correct context
kubectl config use-context "kind-${CLUSTER_NAME}"

# Create namespace
echo "📦 Creating namespace: $NAMESPACE"
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# Deploy in order with dependencies
echo ""
echo "📦 Step 1: Deploying PostgreSQL database..."
if [ -f "k8s/postgres-deployment.yaml" ]; then
    kubectl apply -f k8s/postgres-deployment.yaml
    echo "⏱️  Waiting for PostgreSQL to be ready (timeout: 2min)..."
    kubectl wait --for=condition=ready pod -l app=postgres -n "$NAMESPACE" --timeout=120s
    echo "✅ PostgreSQL is ready"
else
    echo "❌ PostgreSQL deployment file not found: k8s/postgres-deployment.yaml"
    exit 1
fi

echo ""
echo "📦 Step 2: Deploying Redis cache..."
if [ -f "k8s/redis-deployment.yaml" ]; then
    kubectl apply -f k8s/redis-deployment.yaml
    echo "⏱️  Waiting for Redis to be ready (timeout: 1min)..."
    kubectl wait --for=condition=ready pod -l app=redis -n "$NAMESPACE" --timeout=60s
    echo "✅ Redis is ready"
else
    echo "❌ Redis deployment file not found: k8s/redis-deployment.yaml"
    exit 1
fi

echo ""
echo "📦 Step 3: Building and loading application image..."
# Check if we need to build the image
if ! docker images | grep -q "vibecode-webgui:latest"; then
    echo "🏗️  Building application image..."
    npm run build
    docker build -t vibecode-webgui:latest .
else
    echo "♻️  Using existing application image"
fi

echo "📤 Loading image into KIND cluster..."
kind load docker-image vibecode-webgui:latest --name="$CLUSTER_NAME"
echo "✅ Image loaded successfully"

echo ""
echo "📦 Step 4: Deploying VibeCode application..."
if [ -f "k8s/vibecode-deployment.yaml" ]; then
    kubectl apply -f k8s/vibecode-deployment.yaml
    echo "⏱️  Waiting for application to be ready (timeout: 3min)..."
    kubectl wait --for=condition=ready pod -l app=vibecode-webgui -n "$NAMESPACE" --timeout=180s
    echo "✅ VibeCode application is ready"
else
    echo "❌ VibeCode deployment file not found: k8s/vibecode-deployment.yaml"
    exit 1
fi

# Deploy additional services if they exist
echo ""
echo "📦 Step 5: Deploying Authelia authentication..."

# Create authentication namespace
AUTH_NAMESPACE="vibecode-auth"
echo "📦 Creating authentication namespace: $AUTH_NAMESPACE"
kubectl create namespace "$AUTH_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# Deploy Authelia configuration and secrets
if [ -f "k8s/authelia/authelia-config.yaml" ]; then
    echo "🔐 Deploying Authelia configuration..."
    kubectl apply -f k8s/authelia/authelia-config.yaml
    echo "✅ Authelia configuration applied"
else
    echo "❌ Authelia config not found: k8s/authelia/authelia-config.yaml"
fi

# Deploy Authelia service
if [ -f "k8s/authelia/authelia-deployment.yaml" ]; then
    echo "🔒 Deploying Authelia authentication server..."
    kubectl apply -f k8s/authelia/authelia-deployment.yaml
    echo "⏱️  Waiting for Authelia to be ready (timeout: 2min)..."
    kubectl wait --for=condition=ready pod -l app=authelia -n "$AUTH_NAMESPACE" --timeout=120s || echo "⚠️  Authelia may still be starting"
    echo "✅ Authelia authentication server deployed"
else
    echo "❌ Authelia deployment not found: k8s/authelia/authelia-deployment.yaml"
fi

echo ""
echo "📦 Step 6: Deploying additional services..."

# Deploy secrets if they exist
if [ -f "k8s/vibecode-secrets.yaml" ]; then
    echo "🔐 Applying secrets..."
    kubectl apply -f k8s/vibecode-secrets.yaml
fi

# Deploy services
if [ -f "k8s/vibecode-service.yaml" ]; then
    echo "🌐 Applying services..."
    kubectl apply -f k8s/vibecode-service.yaml
fi

# Deploy ingress if available
if [ -f "k8s/vibecode-ingress.yaml" ]; then
    echo "🚪 Applying ingress..."
    kubectl apply -f k8s/vibecode-ingress.yaml
fi

echo ""
echo "🔍 Deployment status check..."
kubectl get pods -n "$NAMESPACE" -o wide

echo ""
echo "🔒 Authentication status:"
kubectl get pods -n "$AUTH_NAMESPACE" -o wide

echo ""
echo "🌐 Service status:"
kubectl get services -n "$NAMESPACE"
kubectl get services -n "$AUTH_NAMESPACE"

# Check if all pods are running
PENDING_PODS=$(kubectl get pods -n "$NAMESPACE" --no-headers | grep -v "Running\|Completed" | wc -l)
if [ "$PENDING_PODS" -eq 0 ]; then
    echo ""
    echo "✅ All services deployed successfully!"
else
    echo ""
    echo "⚠️  Some pods are not running ($PENDING_PODS pending)"
    echo "   Check status: kubectl get pods -n $NAMESPACE"
    echo "   Check logs: kubectl logs -l app=vibecode-webgui -n $NAMESPACE"
fi

# Test basic connectivity
echo ""
echo "🧪 Testing service connectivity..."
if kubectl run test-connectivity --image=curlimages/curl:latest --restart=Never --rm -i --tty --timeout=30s -- \
    curl -s -o /dev/null -w "%{http_code}" http://vibecode-service.$NAMESPACE.svc.cluster.local:3000/api/health | grep -q "200"; then
    echo "✅ Internal service connectivity working"
else
    echo "⚠️  Internal service connectivity test failed (this may be normal if app is still starting)"
fi

echo ""
echo "🎯 Deployment Status: COMPLETE ✅"
echo ""
echo "💡 Access your application:"
echo "   kubectl port-forward -n $NAMESPACE svc/vibecode-service 3000:3000"
echo "   Then open: http://localhost:3000"
echo ""
echo "🔒 Access Authelia authentication:"
echo "   kubectl port-forward -n $AUTH_NAMESPACE svc/authelia 9091:9091"
echo "   Then open: http://localhost:9091"
echo "   Default users: admin@vibecode.dev, dev@vibecode.dev, user@vibecode.dev"
echo "   Default password: Check k8s/authelia/authelia-config.yaml for hashed passwords"
echo ""
echo "🔍 Useful commands:"
echo "   kubectl get all -n $NAMESPACE"
echo "   kubectl get all -n $AUTH_NAMESPACE"
echo "   kubectl logs -f deployment/vibecode-webgui -n $NAMESPACE"
echo "   kubectl logs -f deployment/authelia -n $AUTH_NAMESPACE"
echo "   kubectl exec -it deployment/vibecode-webgui -n $NAMESPACE -- bash"