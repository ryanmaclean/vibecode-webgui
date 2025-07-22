#!/bin/bash
set -e

# VibeCode Docs Deployment Test Script
# Tests the complete docs deployment in KIND cluster

echo "🚀 Testing VibeCode Docs Deployment in KIND"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
NAMESPACE="vibecode"
SERVICE_NAME="vibecode-docs-service"
DEPLOYMENT_NAME="vibecode-docs"
TEST_PORT="8092"
MAX_WAIT_TIME=120

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

check_command() {
    if command -v $1 &> /dev/null; then
        log_success "$1 is installed"
    else
        log_error "$1 is not installed. Please install it first."
        exit 1
    fi
}

wait_for_deployment() {
    log_info "Waiting for deployment to be ready..."
    
    local count=0
    while [ $count -lt $MAX_WAIT_TIME ]; do
        if kubectl rollout status deployment/$DEPLOYMENT_NAME -n $NAMESPACE --timeout=5s &>/dev/null; then
            log_success "Deployment is ready"
            return 0
        fi
        ((count+=5))
        echo -n "."
        sleep 5
    done
    
    log_error "Deployment failed to become ready within $MAX_WAIT_TIME seconds"
    return 1
}

# Test 1: Prerequisites
echo -e "\n${BLUE}1. Checking Prerequisites${NC}"
echo "----------------------------"
check_command "kubectl"
check_command "curl"
check_command "kind"

# Check if KIND cluster exists
if kind get clusters | grep -q "vibecode-test"; then
    log_success "KIND cluster 'vibecode-test' exists"
else
    log_error "KIND cluster 'vibecode-test' not found"
    exit 1
fi

# Test 2: Kubernetes Resources
echo -e "\n${BLUE}2. Checking Kubernetes Resources${NC}"
echo "-----------------------------------"

# Check namespace
if kubectl get namespace $NAMESPACE &>/dev/null; then
    log_success "Namespace '$NAMESPACE' exists"
else
    log_error "Namespace '$NAMESPACE' not found"
    exit 1
fi

# Check deployment
if kubectl get deployment $DEPLOYMENT_NAME -n $NAMESPACE &>/dev/null; then
    log_success "Deployment '$DEPLOYMENT_NAME' exists"
    
    # Check deployment status
    READY_REPLICAS=$(kubectl get deployment $DEPLOYMENT_NAME -n $NAMESPACE -o jsonpath='{.status.readyReplicas}')
    DESIRED_REPLICAS=$(kubectl get deployment $DEPLOYMENT_NAME -n $NAMESPACE -o jsonpath='{.spec.replicas}')
    
    if [ "$READY_REPLICAS" = "$DESIRED_REPLICAS" ]; then
        log_success "Deployment has $READY_REPLICAS/$DESIRED_REPLICAS replicas ready"
    else
        log_warning "Deployment has $READY_REPLICAS/$DESIRED_REPLICAS replicas ready"
        wait_for_deployment
    fi
else
    log_error "Deployment '$DEPLOYMENT_NAME' not found"
    exit 1
fi

# Check service
if kubectl get service $SERVICE_NAME -n $NAMESPACE &>/dev/null; then
    log_success "Service '$SERVICE_NAME' exists"
else
    log_error "Service '$SERVICE_NAME' not found"
    exit 1
fi

# Test 3: Pod Health
echo -e "\n${BLUE}3. Checking Pod Health${NC}"
echo "------------------------"

PODS=$(kubectl get pods -n $NAMESPACE -l app=vibecode-docs -o jsonpath='{.items[*].metadata.name}')
POD_COUNT=$(echo $PODS | wc -w)

log_info "Found $POD_COUNT pods"

for pod in $PODS; do
    # Check pod status
    POD_STATUS=$(kubectl get pod $pod -n $NAMESPACE -o jsonpath='{.status.phase}')
    if [ "$POD_STATUS" = "Running" ]; then
        log_success "Pod $pod is Running"
    else
        log_error "Pod $pod is $POD_STATUS"
    fi
    
    # Check readiness
    READY=$(kubectl get pod $pod -n $NAMESPACE -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
    if [ "$READY" = "True" ]; then
        log_success "Pod $pod is Ready"
    else
        log_error "Pod $pod is not Ready"
    fi
done

# Test 4: Service Connectivity
echo -e "\n${BLUE}4. Testing Service Connectivity${NC}"
echo "--------------------------------"

# Start port forwarding in background
log_info "Starting port forward on port $TEST_PORT..."
kubectl port-forward -n $NAMESPACE svc/$SERVICE_NAME $TEST_PORT:80 &
PORT_FORWARD_PID=$!

# Give port forward time to establish
sleep 5

# Function to cleanup port forward
cleanup() {
    if [ ! -z "$PORT_FORWARD_PID" ]; then
        kill $PORT_FORWARD_PID &>/dev/null || true
    fi
}
trap cleanup EXIT

# Test HTTP connectivity
log_info "Testing HTTP connectivity..."
if curl -s -f http://localhost:$TEST_PORT/ &>/dev/null; then
    log_success "HTTP request successful"
    
    # Test response code
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$TEST_PORT/)
    if [ "$HTTP_CODE" = "200" ]; then
        log_success "HTTP response code: $HTTP_CODE"
    else
        log_error "HTTP response code: $HTTP_CODE (expected 200)"
    fi
    
    # Test content
    CONTENT=$(curl -s http://localhost:$TEST_PORT/)
    if echo "$CONTENT" | grep -qi "vibecode"; then
        log_success "Response contains VibeCode content"
    else
        log_warning "Response does not contain expected VibeCode content"
    fi
    
    if echo "$CONTENT" | grep -qi "astro"; then
        log_success "Response contains Astro content"
    else
        log_warning "Response does not contain Astro content"
    fi
else
    log_error "HTTP request failed"
fi

# Test health endpoint
log_info "Testing health endpoint..."
if curl -s -f http://localhost:$TEST_PORT/health &>/dev/null; then
    log_success "Health endpoint is accessible"
    
    HEALTH_CONTENT=$(curl -s http://localhost:$TEST_PORT/health)
    if echo "$HEALTH_CONTENT" | grep -qi "healthy"; then
        log_success "Health endpoint returns healthy status"
    else
        log_warning "Health endpoint response: $HEALTH_CONTENT"
    fi
else
    log_error "Health endpoint is not accessible"
fi

# Test 5: Performance
echo -e "\n${BLUE}5. Performance Tests${NC}"
echo "----------------------"

# Response time test
log_info "Testing response time..."
START_TIME=$(date +%s%N)
curl -s http://localhost:$TEST_PORT/ &>/dev/null
END_TIME=$(date +%s%N)
RESPONSE_TIME=$((($END_TIME - $START_TIME) / 1000000)) # Convert to milliseconds

if [ $RESPONSE_TIME -lt 2000 ]; then
    log_success "Response time: ${RESPONSE_TIME}ms (< 2000ms)"
else
    log_warning "Response time: ${RESPONSE_TIME}ms (>= 2000ms)"
fi

# Concurrent requests test
log_info "Testing concurrent requests..."
CONCURRENT_REQUESTS=5
FAILED_REQUESTS=0

for i in $(seq 1 $CONCURRENT_REQUESTS); do
    if ! curl -s -f http://localhost:$TEST_PORT/ &>/dev/null; then
        ((FAILED_REQUESTS++))
    fi &
done
wait

if [ $FAILED_REQUESTS -eq 0 ]; then
    log_success "All $CONCURRENT_REQUESTS concurrent requests succeeded"
else
    log_error "$FAILED_REQUESTS/$CONCURRENT_REQUESTS concurrent requests failed"
fi

# Test 6: Security
echo -e "\n${BLUE}6. Security Checks${NC}"
echo "-------------------"

# Check security context
for pod in $PODS; do
    RUN_AS_USER=$(kubectl get pod $pod -n $NAMESPACE -o jsonpath='{.spec.containers[0].securityContext.runAsUser}')
    if [ "$RUN_AS_USER" = "1001" ]; then
        log_success "Pod $pod runs as non-root user (1001)"
    else
        log_error "Pod $pod runs as user $RUN_AS_USER (should be 1001)"
    fi
    
    READ_ONLY_FS=$(kubectl get pod $pod -n $NAMESPACE -o jsonpath='{.spec.containers[0].securityContext.readOnlyRootFilesystem}')
    if [ "$READ_ONLY_FS" = "true" ]; then
        log_success "Pod $pod has read-only root filesystem"
    else
        log_error "Pod $pod does not have read-only root filesystem"
    fi
done

# Test 7: Resource Usage
echo -e "\n${BLUE}7. Resource Usage${NC}"
echo "-------------------"

# Check resource requests and limits
MEMORY_REQUESTS=$(kubectl get deployment $DEPLOYMENT_NAME -n $NAMESPACE -o jsonpath='{.spec.template.spec.containers[0].resources.requests.memory}')
MEMORY_LIMITS=$(kubectl get deployment $DEPLOYMENT_NAME -n $NAMESPACE -o jsonpath='{.spec.template.spec.containers[0].resources.limits.memory}')
CPU_REQUESTS=$(kubectl get deployment $DEPLOYMENT_NAME -n $NAMESPACE -o jsonpath='{.spec.template.spec.containers[0].resources.requests.cpu}')
CPU_LIMITS=$(kubectl get deployment $DEPLOYMENT_NAME -n $NAMESPACE -o jsonpath='{.spec.template.spec.containers[0].resources.limits.cpu}')

log_info "Resource configuration:"
echo "  Memory: Requests=$MEMORY_REQUESTS, Limits=$MEMORY_LIMITS"
echo "  CPU: Requests=$CPU_REQUESTS, Limits=$CPU_LIMITS"

if [ ! -z "$MEMORY_REQUESTS" ] && [ ! -z "$MEMORY_LIMITS" ]; then
    log_success "Memory resources are configured"
else
    log_warning "Memory resources are not fully configured"
fi

if [ ! -z "$CPU_REQUESTS" ] && [ ! -z "$CPU_LIMITS" ]; then
    log_success "CPU resources are configured"
else
    log_warning "CPU resources are not fully configured"
fi

# Summary
echo -e "\n${BLUE}8. Test Summary${NC}"
echo "----------------"

# Count passed/failed tests by analyzing output
TOTAL_TESTS=$(grep -E "\[(PASS|FAIL)\]" <<< "$output" | wc -l 2>/dev/null || echo "0")
PASSED_TESTS=$(grep "\[PASS\]" <<< "$output" | wc -l 2>/dev/null || echo "0")
FAILED_TESTS=$(grep "\[FAIL\]" <<< "$output" | wc -l 2>/dev/null || echo "0")

echo "✅ VibeCode Docs deployment test completed"
echo "📊 Results summary available above"
echo "🔗 Service accessible at: http://localhost:$TEST_PORT (while port-forward is active)"

# Final status
if [ "$FAILED_TESTS" -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All critical tests passed! Deployment is ready for production.${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  Some tests failed. Please review the output above.${NC}"
    exit 1
fi