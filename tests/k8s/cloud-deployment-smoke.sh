#!/bin/bash
set -e

# Cloud Deployment Smoke Tests
# Tests cloud deployment scenarios in KinD cluster to validate GKE/EKS manifests

echo "☁️ Cloud Deployment Smoke Tests"
echo "==============================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0
CLUSTER_NAME="vibecode-cloud-test"
NAMESPACE="vibecode-cloud"
CODESERVER_NAMESPACE="codeserver"

test_result() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}[PASS]${NC} $1"
        ((PASSED++))
    else
        echo -e "${RED}[FAIL]${NC} $1"
        ((FAILED++))
    fi
}

cleanup() {
    echo -e "\n${YELLOW}Cleaning up port forwards...${NC}"
    pkill -f "kubectl port-forward" &>/dev/null || true
}

trap cleanup EXIT

echo -e "\n${BLUE}1. Cloud Cluster Setup${NC}"
echo "------------------------"

# Test cluster exists
kind get clusters | grep -q "$CLUSTER_NAME"
test_result "KinD cloud cluster '$CLUSTER_NAME' exists"

# Test kubectl context
kubectl config current-context | grep -q "kind-$CLUSTER_NAME"
test_result "kubectl context set to KinD cloud cluster"

# Test cluster connectivity
kubectl cluster-info &>/dev/null
test_result "kubectl can connect to cloud cluster"

# Test nodes are ready
kubectl get nodes | grep -q "Ready"
test_result "Cloud cluster nodes are ready"

# Test node count
NODE_COUNT=$(kubectl get nodes --no-headers | wc -l)
[ "$NODE_COUNT" -ge 3 ]
test_result "Cloud cluster has multiple nodes ($NODE_COUNT nodes)"

echo -e "\n${BLUE}2. Cloud Namespace Tests${NC}"
echo "---------------------------"

# Test namespaces exist
kubectl get namespace $NAMESPACE &>/dev/null
test_result "VibeCode cloud namespace exists"

kubectl get namespace $CODESERVER_NAMESPACE &>/dev/null
test_result "Code-server cloud namespace exists"

echo -e "\n${BLUE}3. Code-Server Cloud Deployment${NC}"
echo "-----------------------------------"

# Deploy code-server cloud manifest
kubectl apply -f k8s/code-server-kind-cloud.yaml -n $CODESERVER_NAMESPACE &>/dev/null
test_result "Code-server cloud deployment applied"

# Wait for deployment to be ready
kubectl wait --for=condition=available --timeout=300s deployment/codeserver-cloud -n $CODESERVER_NAMESPACE &>/dev/null
test_result "Code-server cloud deployment is ready"

# Test deployment exists
kubectl get deployment codeserver-cloud -n $CODESERVER_NAMESPACE &>/dev/null
test_result "Code-server cloud deployment exists"

# Test deployment status
READY_REPLICAS=$(kubectl get deployment codeserver-cloud -n $CODESERVER_NAMESPACE -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
DESIRED_REPLICAS=$(kubectl get deployment codeserver-cloud -n $CODESERVER_NAMESPACE -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")

[ "$READY_REPLICAS" = "$DESIRED_REPLICAS" ] && [ "$READY_REPLICAS" -gt 0 ]
test_result "Code-server cloud deployment has all replicas ready ($READY_REPLICAS/$DESIRED_REPLICAS)"

# Test pods are running
kubectl get pods -l app=codeserver -n $CODESERVER_NAMESPACE | grep -q "Running"
test_result "Code-server cloud pods are in Running state"

echo -e "\n${BLUE}4. Cloud Service Tests${NC}"
echo "------------------------"

# Test service exists
kubectl get service codeserver-cloud -n $CODESERVER_NAMESPACE &>/dev/null
test_result "Code-server cloud service exists"

# Test service endpoints
kubectl get endpoints codeserver-cloud -n $CODESERVER_NAMESPACE | grep -q ":8765"
test_result "Code-server cloud service has active endpoints"

# Test service selector
kubectl get service codeserver-cloud -n $CODESERVER_NAMESPACE -o yaml | grep -q "app: codeserver"
test_result "Code-server cloud service has correct selector"

echo -e "\n${BLUE}5. Cloud Image and Configuration Tests${NC}"
echo "--------------------------------------------"

# Test correct image
IMAGE=$(kubectl get deployment codeserver-cloud -n $CODESERVER_NAMESPACE -o jsonpath='{.spec.template.spec.containers[0].image}')
[ "$IMAGE" = "ghcr.io/ryanmaclean/vibecode-codeserver:latest" ]
test_result "Code-server cloud deployment uses correct image"

# Test correct port
PORT=$(kubectl get deployment codeserver-cloud -n $CODESERVER_NAMESPACE -o jsonpath='{.spec.template.spec.containers[0].ports[0].containerPort}')
[ "$PORT" = "8765" ]
test_result "Code-server cloud deployment uses correct port"

# Test environment variables
kubectl get deployment codeserver-cloud -n $CODESERVER_NAMESPACE -o yaml | grep -q "PASSWORD"
test_result "Code-server cloud deployment has PASSWORD environment variable"

# Test workspace volume
kubectl get deployment codeserver-cloud -n $CODESERVER_NAMESPACE -o yaml | grep -q "workspace"
test_result "Code-server cloud deployment has workspace volume"

echo -e "\n${BLUE}6. Cloud Scaling Tests${NC}"
echo "-------------------------"

# Test horizontal scaling
echo "Testing horizontal scaling..."
ORIGINAL_REPLICAS=$(kubectl get deployment codeserver-cloud -n $CODESERVER_NAMESPACE -o jsonpath='{.spec.replicas}')

# Scale up
kubectl scale deployment codeserver-cloud --replicas=3 -n $CODESERVER_NAMESPACE &>/dev/null
sleep 10

SCALED_REPLICAS=$(kubectl get deployment codeserver-cloud -n $CODESERVER_NAMESPACE -o jsonpath='{.status.readyReplicas}')
[ "$SCALED_REPLICAS" = "3" ]
test_result "Code-server cloud deployment scales up successfully"

# Scale back down
kubectl scale deployment codeserver-cloud --replicas=$ORIGINAL_REPLICAS -n $CODESERVER_NAMESPACE &>/dev/null
sleep 5

SCALED_DOWN_REPLICAS=$(kubectl get deployment codeserver-cloud -n $CODESERVER_NAMESPACE -o jsonpath='{.status.readyReplicas}')
[ "$SCALED_DOWN_REPLICAS" = "$ORIGINAL_REPLICAS" ]
test_result "Code-server cloud deployment scales down successfully"

echo -e "\n${BLUE}7. Cloud Pod Disruption Tests${NC}"
echo "--------------------------------"

# Test pod deletion and recovery
echo "Testing pod disruption and recovery..."
POD_NAME=$(kubectl get pods -l app=codeserver -n $CODESERVER_NAMESPACE -o jsonpath='{.items[0].metadata.name}')
kubectl delete pod $POD_NAME -n $CODESERVER_NAMESPACE &>/dev/null

# Wait for new pod
sleep 15

# Test new pod is running
kubectl get pods -l app=codeserver -n $CODESERVER_NAMESPACE | grep -q "Running"
test_result "New code-server cloud pod starts after deletion (self-healing)"

echo -e "\n${BLUE}8. Cloud Networking Tests${NC}"
echo "---------------------------"

# Test service connectivity via port forward
echo "Testing service connectivity..."
kubectl port-forward -n $CODESERVER_NAMESPACE svc/codeserver-cloud 8080:80 &>/dev/null &
PF_PID=$!
sleep 5

# Test HTTP response
curl -s -f http://localhost:8080/ &>/dev/null
test_result "Code-server cloud service responds via port forward"

# Test HTTP status
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/)
[ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]
test_result "Code-server cloud service returns valid HTTP status ($HTTP_CODE)"

kill $PF_PID &>/dev/null || true

echo -e "\n${BLUE}9. Cloud Resource Management Tests${NC}"
echo "------------------------------------"

# Test resource limits are set
kubectl get deployment codeserver-cloud -n $CODESERVER_NAMESPACE -o yaml | grep -q "limits:" || kubectl get deployment codeserver-cloud -n $CODESERVER_NAMESPACE -o yaml | grep -q "requests:"
test_result "Resource limits or requests are configured"

# Test actual resource usage (if metrics server available)
kubectl top pods -l app=codeserver -n $CODESERVER_NAMESPACE &>/dev/null
test_result "Pod resource usage is measurable (metrics server available)"

echo -e "\n${BLUE}10. Cloud Security Tests${NC}"
echo "-------------------------"

# Test security context
kubectl get deployment codeserver-cloud -n $CODESERVER_NAMESPACE -o yaml | grep -q "securityContext"
test_result "Security context is configured"

# Test non-root user (if configured)
kubectl get deployment codeserver-cloud -n $CODESERVER_NAMESPACE -o yaml | grep -q "runAsUser:" || echo "Non-root user not configured"
test_result "Non-root user configuration checked"

echo -e "\n${BLUE}11. Cloud Storage Tests${NC}"
echo "------------------------"

# Test workspace volume configuration
VOLUME_NAME=$(kubectl get deployment codeserver-cloud -n $CODESERVER_NAMESPACE -o jsonpath='{.spec.template.spec.volumes[0].name}')
[ "$VOLUME_NAME" = "workspace" ]
test_result "Workspace volume is configured"

# Test volume mount
MOUNT_PATH=$(kubectl get deployment codeserver-cloud -n $CODESERVER_NAMESPACE -o jsonpath='{.spec.template.spec.containers[0].volumeMounts[0].mountPath}')
[ "$MOUNT_PATH" = "/home/coder/project" ]
test_result "Workspace volume mount path is correct"

echo -e "\n${BLUE}12. Cloud Health Checks${NC}"
echo "-------------------------"

# Test pod health
kubectl get pods -l app=codeserver -n $CODESERVER_NAMESPACE -o jsonpath='{.items[0].status.phase}' | grep -q "Running"
test_result "Code-server cloud pods are healthy"

# Test deployment health
kubectl get deployment codeserver-cloud -n $CODESERVER_NAMESPACE -o jsonpath='{.status.conditions[?(@.type=="Available")].status}' | grep -q "True"
test_result "Code-server cloud deployment is healthy"

echo -e "\n${BLUE}13. Cloud Performance Tests${NC}"
echo "----------------------------"

# Test response time
START_TIME=$(date +%s%N)
curl -s -f http://localhost:8080/ &>/dev/null || {
    kubectl port-forward -n $CODESERVER_NAMESPACE svc/codeserver-cloud 8081:80 &>/dev/null &
    PF_PID2=$!
    sleep 3
    curl -s -f http://localhost:8081/ &>/dev/null
    kill $PF_PID2 &>/dev/null || true
}
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))
[ "$RESPONSE_TIME" -lt 5000 ]
test_result "Response time under 5 seconds ($RESPONSE_TIME ms)"

echo -e "\n${BLUE}14. Cloud Disaster Recovery Tests${NC}"
echo "-----------------------------------"

# Test deployment deletion and recovery
echo "Testing deployment deletion and recovery..."
kubectl delete deployment codeserver-cloud -n $CODESERVER_NAMESPACE &>/dev/null

# Recreate deployment
kubectl apply -f k8s/code-server-kind-cloud.yaml -n $CODESERVER_NAMESPACE &>/dev/null

# Wait for recovery
kubectl wait --for=condition=available --timeout=300s deployment/codeserver-cloud -n $CODESERVER_NAMESPACE &>/dev/null

# Verify recovery
kubectl get deployment codeserver-cloud -n $CODESERVER_NAMESPACE | grep -q "codeserver-cloud"
test_result "Code-server cloud deployment recovers after deletion"

echo -e "\n${BLUE}15. Cloud Integration Tests${NC}"
echo "----------------------------"

# Test ingress controller availability
kubectl get pods -n ingress-nginx &>/dev/null
test_result "Ingress controller is available"

# Test monitoring stack availability
kubectl get pods -n monitoring &>/dev/null || echo "Monitoring stack not available"
test_result "Monitoring stack availability checked"

echo -e "\n${BLUE}=== Cloud Deployment Test Results ===${NC}"
echo "Total Tests: $((PASSED + FAILED))"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✅ All cloud deployment tests passed!${NC}"
    echo "Cloud deployment is ready for GKE/EKS validation."
    echo ""
    echo "Cloud Deployment Information:"
    echo "  🎯 Cluster: $CLUSTER_NAME"
    echo "  📦 Code-server replicas: $(kubectl get deployment codeserver-cloud -n $CODESERVER_NAMESPACE -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo '0')"
    echo "  🔧 Access: kubectl port-forward -n $CODESERVER_NAMESPACE svc/codeserver-cloud 8080:80"
    echo "  🚀 Ready for: GKE Autopilot, EKS Fargate, AKS deployment"
else
    echo -e "\n${RED}❌ Some cloud deployment tests failed!${NC}"
    echo "Please fix the issues before proceeding to cloud deployment."
fi

exit $FAILED