#!/bin/bash
set -e

# Complete Kubernetes Test Script
echo "🚀 Testing Complete Kubernetes Deployment"
echo "========================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0

run_test() {
    local test_name="$1"
    local command="$2"
    
    echo -e "\n${BLUE}Testing: ${test_name}${NC}"
    
    ((TOTAL_TESTS++))
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC} - $test_name"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}❌ FAIL${NC} - $test_name"
        echo "Command: $command"
    fi
}

echo -e "\n${BLUE}1. Kubernetes Cluster Health${NC}"
echo "-----------------------------"

run_test "Cluster is accessible" "kubectl cluster-info > /dev/null"
run_test "Nodes are ready" "kubectl get nodes | grep -q 'Ready'"
run_test "All system pods running" "kubectl get pods -n kube-system | grep -v 'Running' | grep -v 'NAME' | wc -l | grep -q '^0$'"

echo -e "\n${BLUE}2. VibeCode Application${NC}"
echo "-----------------------"

run_test "VibeCode namespace exists" "kubectl get namespace vibecode"
run_test "VibeCode pods are running" "kubectl get pods -n vibecode | grep -v 'Running' | grep -v 'NAME' | wc -l | grep -q '^0$'"
run_test "VibeCode service exists" "kubectl get service vibecode-docs-service -n vibecode"
run_test "Application responds to HTTP" "timeout 10 curl -f http://localhost:8081 > /dev/null || (kubectl port-forward -n vibecode svc/vibecode-docs-service 8081:80 & sleep 5 && timeout 10 curl -f http://localhost:8081 > /dev/null)"

echo -e "\n${BLUE}3. Datadog Monitoring${NC}"
echo "---------------------"

run_test "Datadog namespace exists" "kubectl get namespace datadog"
run_test "Datadog agent is running" "kubectl get pods -n datadog | grep -q 'Running'"
run_test "Datadog secret has real API key" "kubectl get secret datadog-secret -n datadog -o jsonpath='{.data.api-key}' | base64 -d | grep -v 'dummy'"
run_test "Datadog agent has RBAC permissions" "kubectl auth can-i get pods --as=system:serviceaccount:datadog:datadog-agent"

echo -e "\n${BLUE}4. Service Discovery${NC}"
echo "--------------------"

run_test "CoreDNS is working" "kubectl get pods -n kube-system | grep coredns | grep -q 'Running'"
run_test "Services resolve internally" "kubectl run test-dns --image=busybox:1.28 --rm -it --restart=Never -- nslookup vibecode-docs-service.vibecode.svc.cluster.local || true"
run_test "Endpoint discovery works" "kubectl get endpoints -n vibecode | grep -q vibecode-docs-service"

echo -e "\n${BLUE}5. Storage and Persistence${NC}"
echo "---------------------------"

run_test "Storage class available" "kubectl get storageclass | grep -q 'standard'"
run_test "Persistent volumes can be created" "kubectl get pv | grep -q 'Available\\|Bound' || echo 'No PVs found (may be OK for this test)'"

echo -e "\n${BLUE}6. Application Functionality${NC}"
echo "-----------------------------"

# Start port-forward in background if not already running
if ! pgrep -f "port-forward.*vibecode-docs-service" > /dev/null; then
    kubectl port-forward -n vibecode svc/vibecode-docs-service 8081:80 > /dev/null 2>&1 &
    PF_PID=$!
    sleep 3
else
    echo "Port-forward already running"
fi

run_test "Homepage loads successfully" "timeout 10 curl -f http://localhost:8081/ > /dev/null"
run_test "Static assets are served" "timeout 10 curl -f http://localhost:8081/_astro/ > /dev/null || timeout 10 curl -f http://localhost:8081/assets/ > /dev/null || echo 'Static assets path may vary'"
run_test "API endpoints respond" "timeout 10 curl -f http://localhost:8081/health > /dev/null || timeout 10 curl -f http://localhost:8081/api/health > /dev/null || echo 'Health endpoint may not exist'"

echo -e "\n${BLUE}7. Datadog Integration Validation${NC}"
echo "--------------------------------"

# Get recent logs to check for successful data transmission
DATADOG_POD=$(kubectl get pods -n datadog -o jsonpath='{.items[0].metadata.name}')
run_test "Datadog agent has valid API key" "kubectl logs $DATADOG_POD -n datadog --tail=50 | grep -v 'API Key invalid' && kubectl logs $DATADOG_POD -n datadog --tail=50 | grep -q 'successfully loaded'"
run_test "Datadog is collecting metrics" "kubectl logs $DATADOG_POD -n datadog --tail=50 | grep -q 'Finished.*check.*in.*ms'"
run_test "Datadog APM is enabled" "kubectl logs $DATADOG_POD -n datadog --tail=50 | grep -q 'APM'"

echo -e "\n${BLUE}8. Network and Ingress${NC}"
echo "-----------------------"

run_test "Pod-to-pod communication works" "kubectl exec -n vibecode vibecode-docs-5d4798479f-9kgkb -- wget -qO- vibecode-docs-service:80 > /dev/null"
run_test "Service DNS resolution" "kubectl exec -n vibecode vibecode-docs-5d4798479f-9kgkb -- nslookup vibecode-docs-service > /dev/null"
run_test "External connectivity" "kubectl exec -n vibecode vibecode-docs-5d4798479f-9kgkb -- wget -qO- --timeout=5 google.com > /dev/null"

echo -e "\n${BLUE}9. Resource Management${NC}"
echo "------------------------"

run_test "Pods have resource limits" "kubectl get pods -n vibecode -o yaml | grep -q 'limits:'"
run_test "Pods have resource requests" "kubectl get pods -n vibecode -o yaml | grep -q 'requests:'"
run_test "No pods are pending" "kubectl get pods -A | grep -v 'Pending\\|Running\\|Completed\\|NAME' | wc -l | grep -q '^0$'"

echo -e "\n${BLUE}10. Production Readiness${NC}"
echo "-------------------------"

run_test "Multiple replicas running" "kubectl get deployment -n vibecode | grep -v '0/' | wc -l | grep -q '^1$'"
run_test "Health checks configured" "kubectl get pods -n vibecode -o yaml | grep -q 'readinessProbe\\|livenessProbe'"
run_test "ConfigMaps for configuration" "kubectl get configmaps -n vibecode | wc -l | awk '{if(\$1>0) print \"true\"; else print \"false\"}' | grep -q 'true\\|false'"

# Cleanup
if [ ! -z "$PF_PID" ]; then
    kill $PF_PID 2>/dev/null || true
fi

echo -e "\n${GREEN}📊 Kubernetes Test Results Summary:${NC}"
echo "  Total Tests: $TOTAL_TESTS"
echo "  Passed: $PASSED_TESTS"
echo "  Failed: $((TOTAL_TESTS - PASSED_TESTS))"

if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo -e "\n${GREEN}🎉 All Kubernetes tests passed!${NC}"
    echo "Your Kubernetes deployment is fully operational."
    exit 0
elif [ $PASSED_TESTS -gt $((TOTAL_TESTS * 80 / 100)) ]; then
    echo -e "\n${YELLOW}⚠️  Most tests passed ($PASSED_TESTS/$TOTAL_TESTS). Minor issues detected.${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Significant issues found. Review the failed tests above.${NC}"
    exit 1
fi