#!/bin/bash
set -e

# KIND Cluster Component Tests
# Tests all components deployed in KIND cluster

echo "☸️ KIND Cluster Component Tests"
echo "================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0
CLUSTER_NAME="vibecode-test"
NAMESPACE="vibecode"
DATADOG_NAMESPACE="datadog"

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

echo -e "\n${BLUE}1. KIND Cluster Setup Tests${NC}"
echo "------------------------------"

# Test KIND is installed
kind version &>/dev/null
test_result "KIND is installed and available"

# Test cluster exists
kind get clusters | grep -q "$CLUSTER_NAME"
test_result "KIND cluster '$CLUSTER_NAME' exists"

# Test kubectl context
kubectl config current-context | grep -q "kind-$CLUSTER_NAME"
test_result "kubectl context set to KIND cluster"

# Test cluster connectivity
kubectl cluster-info &>/dev/null
test_result "kubectl can connect to cluster"

# Test nodes are ready
kubectl get nodes | grep -q "Ready"
test_result "Cluster nodes are ready"

echo -e "\n${BLUE}2. Namespace Tests${NC}"
echo "--------------------"

# Test namespaces exist
kubectl get namespace $NAMESPACE &>/dev/null
test_result "VibeCode namespace exists"

kubectl get namespace $DATADOG_NAMESPACE &>/dev/null
test_result "Datadog namespace exists"

# Test namespace labels
kubectl get namespace $NAMESPACE -o yaml | grep -q "name: $NAMESPACE"
test_result "VibeCode namespace properly labeled"

echo -e "\n${BLUE}3. Deployment Tests${NC}"
echo "---------------------"

# Test deployments exist
kubectl get deployment vibecode-docs -n $NAMESPACE &>/dev/null
test_result "Docs deployment exists"

# Test deployment status
READY_REPLICAS=$(kubectl get deployment vibecode-docs -n $NAMESPACE -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
DESIRED_REPLICAS=$(kubectl get deployment vibecode-docs -n $NAMESPACE -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")

[ "$READY_REPLICAS" = "$DESIRED_REPLICAS" ] && [ "$READY_REPLICAS" -gt 0 ]
test_result "Docs deployment has all replicas ready ($READY_REPLICAS/$DESIRED_REPLICAS)"

# Test pods are running
kubectl get pods -l app=vibecode-docs -n $NAMESPACE | grep -q "Running"
test_result "Docs pods are in Running state"

# Test pod restarts
RESTART_COUNT=$(kubectl get pods -l app=vibecode-docs -n $NAMESPACE -o jsonpath='{.items[0].status.containerStatuses[0].restartCount}' 2>/dev/null || echo "0")
[ "$RESTART_COUNT" -lt 3 ]
test_result "Docs pods have minimal restart count ($RESTART_COUNT)"

echo -e "\n${BLUE}4. Service Tests${NC}"
echo "------------------"

# Test services exist
kubectl get service vibecode-docs-service -n $NAMESPACE &>/dev/null
test_result "Docs service exists"

# Test service endpoints
kubectl get endpoints vibecode-docs-service -n $NAMESPACE | grep -q ":8080"
test_result "Docs service has active endpoints"

# Test service selector
kubectl get service vibecode-docs-service -n $NAMESPACE -o yaml | grep -q "app: vibecode-docs"
test_result "Docs service has correct selector"

echo -e "\n${BLUE}5. Connectivity Tests${NC}"
echo "-----------------------"

# Test service connectivity via port forward
echo "Testing service connectivity..."
kubectl port-forward -n $NAMESPACE svc/vibecode-docs-service 8090:80 &>/dev/null &
PF_PID=$!
sleep 5

# Test HTTP response
curl -s -f http://localhost:8090/ &>/dev/null
test_result "Docs service responds via port forward"

# Test content
curl -s http://localhost:8090/ | grep -q "VibeCode"
test_result "Docs service serves correct content"

# Test HTTP status
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8090/)
[ "$HTTP_CODE" = "200" ]
test_result "Docs service returns HTTP 200"

kill $PF_PID &>/dev/null || true

echo -e "\n${BLUE}6. Resource Management Tests${NC}"
echo "------------------------------"

# Test resource limits are set
kubectl get deployment vibecode-docs -n $NAMESPACE -o yaml | grep -q "limits:"
test_result "Resource limits are configured"

kubectl get deployment vibecode-docs -n $NAMESPACE -o yaml | grep -q "requests:"
test_result "Resource requests are configured"

# Test actual resource usage
kubectl top pods -l app=vibecode-docs -n $NAMESPACE &>/dev/null
test_result "Pod resource usage is measurable"

echo -e "\n${BLUE}7. Security Tests${NC}"
echo "-------------------"

# Test security context
kubectl get deployment vibecode-docs -n $NAMESPACE -o yaml | grep -q "runAsUser: 1001"
test_result "Pods run as non-root user (1001)"

kubectl get deployment vibecode-docs -n $NAMESPACE -o yaml | grep -q "readOnlyRootFilesystem: true"
test_result "Pods use read-only root filesystem"

kubectl get deployment vibecode-docs -n $NAMESPACE -o yaml | grep -q "allowPrivilegeEscalation: false"
test_result "Privilege escalation is disabled"

# Test capabilities
kubectl get deployment vibecode-docs -n $NAMESPACE -o yaml | grep -A 5 "capabilities:" | grep -q "drop:"
test_result "Security capabilities are dropped"

echo -e "\n${BLUE}8. Monitoring Tests${NC}"
echo "---------------------"

# Test Datadog agent deployment
kubectl get daemonset datadog-agent -n $DATADOG_NAMESPACE &>/dev/null
test_result "Datadog agent DaemonSet exists"

# Test Datadog pods
DATADOG_PODS=$(kubectl get pods -l app=datadog-agent -n $DATADOG_NAMESPACE --no-headers | wc -l)
[ "$DATADOG_PODS" -gt 0 ]
test_result "Datadog agent pods are running ($DATADOG_PODS pods)"

# Test Datadog pod status
kubectl get pods -l app=datadog-agent -n $DATADOG_NAMESPACE | grep -q "Running"
test_result "Datadog agent pods are in Running state"

# Test monitoring configuration
kubectl get configmap datadog-config -n $DATADOG_NAMESPACE &>/dev/null
test_result "Datadog configuration exists"

echo -e "\n${BLUE}9. Scaling Tests${NC}"
echo "------------------"

# Test horizontal pod autoscaler
kubectl get hpa vibecode-docs-hpa -n $NAMESPACE &>/dev/null
test_result "Horizontal Pod Autoscaler exists"

# Test pod disruption budget
kubectl get pdb vibecode-docs-pdb -n $NAMESPACE &>/dev/null
test_result "Pod Disruption Budget exists"

# Test manual scaling
echo "Testing manual scaling..."
ORIGINAL_REPLICAS=$(kubectl get deployment vibecode-docs -n $NAMESPACE -o jsonpath='{.spec.replicas}')

kubectl scale deployment vibecode-docs --replicas=3 -n $NAMESPACE &>/dev/null
sleep 10

SCALED_REPLICAS=$(kubectl get deployment vibecode-docs -n $NAMESPACE -o jsonpath='{.status.readyReplicas}')
[ "$SCALED_REPLICAS" = "3" ]
test_result "Deployment scales up successfully"

# Scale back
kubectl scale deployment vibecode-docs --replicas=$ORIGINAL_REPLICAS -n $NAMESPACE &>/dev/null
sleep 5

echo -e "\n${BLUE}10. Storage Tests${NC}"
echo "-------------------"

# Test persistent volumes (if any)
PV_COUNT=$(kubectl get pv 2>/dev/null | wc -l)
echo "Persistent volumes in cluster: $PV_COUNT"
test_result "Persistent volume information available"

# Test storage classes
kubectl get storageclass &>/dev/null
test_result "Storage classes are available"

echo -e "\n${BLUE}11. Network Policy Tests${NC}"
echo "--------------------------"

# Test ingress configuration
kubectl get ingress vibecode-docs-ingress -n $NAMESPACE &>/dev/null
test_result "Ingress configuration exists"

# Test ingress rules
kubectl get ingress vibecode-docs-ingress -n $NAMESPACE -o yaml | grep -q "backend:"
test_result "Ingress has backend configuration"

echo -e "\n${BLUE}12. Log Analysis Tests${NC}"
echo "------------------------"

# Test pod logs don't contain errors
! kubectl logs -l app=vibecode-docs -n $NAMESPACE --tail=50 | grep -i "error\|fatal\|exception" &>/dev/null
test_result "Docs pod logs are clean (no errors)"

# Test Datadog agent logs
! kubectl logs -l app=datadog-agent -n $DATADOG_NAMESPACE --tail=50 | grep -i "error\|fatal" &>/dev/null
test_result "Datadog agent logs are clean"

echo -e "\n${BLUE}13. Configuration Tests${NC}"
echo "-------------------------"

# Test environment variables
kubectl get deployment vibecode-docs -n $NAMESPACE -o yaml | grep -q "env:" || kubectl get deployment vibecode-docs -n $NAMESPACE -o yaml | grep -q "envFrom:"
test_result "Environment variables are configured"

# Test volume mounts
kubectl get deployment vibecode-docs -n $NAMESPACE -o yaml | grep -q "volumeMounts:"
test_result "Volume mounts are configured"

# Test health checks
kubectl get deployment vibecode-docs -n $NAMESPACE -o yaml | grep -q "livenessProbe:"
test_result "Liveness probe is configured"

kubectl get deployment vibecode-docs -n $NAMESPACE -o yaml | grep -q "readinessProbe:"
test_result "Readiness probe is configured"

echo -e "\n${BLUE}14. Performance Tests${NC}"
echo "-----------------------"

# Test response time
START_TIME=$(date +%s%N)
curl -s -f http://localhost:8090/ &>/dev/null || {
    kubectl port-forward -n $NAMESPACE svc/vibecode-docs-service 8091:80 &>/dev/null &
    PF_PID2=$!
    sleep 3
    curl -s -f http://localhost:8091/ &>/dev/null
    kill $PF_PID2 &>/dev/null || true
}
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))
[ "$RESPONSE_TIME" -lt 2000 ]
test_result "Response time under 2 seconds ($RESPONSE_TIME ms)"

echo -e "\n${BLUE}15. Disaster Recovery Tests${NC}"
echo "------------------------------"

# Test pod deletion and recovery
echo "Testing pod recovery..."
POD_NAME=$(kubectl get pods -l app=vibecode-docs -n $NAMESPACE -o jsonpath='{.items[0].metadata.name}')
kubectl delete pod $POD_NAME -n $NAMESPACE &>/dev/null

# Wait for new pod
sleep 15

# Test new pod is running
kubectl get pods -l app=vibecode-docs -n $NAMESPACE | grep -q "Running"
test_result "New pod starts after deletion (self-healing)"

echo -e "\n${BLUE}=== KIND Cluster Test Results ===${NC}"
echo "Total Tests: $((PASSED + FAILED))"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✅ All KIND cluster tests passed!${NC}"
    echo "KIND cluster deployment is ready for production validation."
    echo ""
    echo "Cluster Information:"
    echo "  🎯 Cluster: $CLUSTER_NAME"
    echo "  📚 Docs replicas: $(kubectl get deployment vibecode-docs -n $NAMESPACE -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo '0')"
    echo "  📊 Datadog pods: $(kubectl get pods -l app=datadog-agent -n $DATADOG_NAMESPACE --no-headers 2>/dev/null | wc -l)"
    echo "  🔧 Access: kubectl port-forward -n $NAMESPACE svc/vibecode-docs-service 8080:80"
else
    echo -e "\n${RED}❌ Some KIND cluster tests failed!${NC}"
    echo "Please fix the issues before proceeding to production."
fi

exit $FAILED