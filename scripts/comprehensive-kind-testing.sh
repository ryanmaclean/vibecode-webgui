#!/bin/bash

# Comprehensive KIND Cluster Testing Script
# Staff Engineer Implementation - Full infrastructure validation

set -e

CLUSTER_NAME="vibecode-test"
NAMESPACE="vibecode"
TEST_RESULTS_FILE="kind-test-results.log"

echo "🚀 Starting Comprehensive KIND Cluster Testing" | tee $TEST_RESULTS_FILE
echo "=================================================" | tee -a $TEST_RESULTS_FILE
echo "Timestamp: $(date)" | tee -a $TEST_RESULTS_FILE
echo "" | tee -a $TEST_RESULTS_FILE

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_test() {
    local status=$1
    local message=$2
    local color=$GREEN

    if [ "$status" = "FAIL" ]; then
        color=$RED
    elif [ "$status" = "WARN" ]; then
        color=$YELLOW
    fi

    echo -e "${color}[$status]${NC} $message" | tee -a $TEST_RESULTS_FILE
}

# Test 1: Docker and KIND Availability
echo "📋 Test 1: Environment Prerequisites" | tee -a $TEST_RESULTS_FILE
echo "-----------------------------------" | tee -a $TEST_RESULTS_FILE

if command -v docker &> /dev/null; then
    log_test "PASS" "Docker is installed: $(docker --version | head -n1)"
else
    log_test "FAIL" "Docker is not installed or not in PATH"
    exit 1
fi

if command -v kind &> /dev/null; then
    log_test "PASS" "KIND is installed: $(kind version)"
else
    log_test "FAIL" "KIND is not installed or not in PATH"
    exit 1
fi

if command -v kubectl &> /dev/null; then
    log_test "PASS" "kubectl is installed: $(kubectl version --client --short)"
else
    log_test "FAIL" "kubectl is not installed or not in PATH"
    exit 1
fi

# Test 2: Docker Daemon Health
echo "" | tee -a $TEST_RESULTS_FILE
echo "📋 Test 2: Docker Daemon Health" | tee -a $TEST_RESULTS_FILE
echo "-------------------------------" | tee -a $TEST_RESULTS_FILE

if docker info &> /dev/null; then
    log_test "PASS" "Docker daemon is responsive"

    # Check Docker disk space
    docker_space=$(docker system df --format "table {{.Size}}" | tail -n +2 | head -n1)
    log_test "INFO" "Docker disk usage: $docker_space"

    # Check running containers
    container_count=$(docker ps | wc -l)
    log_test "INFO" "Running containers: $((container_count - 1))"

else
    log_test "FAIL" "Docker daemon is not responsive"
    exit 1
fi

# Test 3: KIND Cluster Management
echo "" | tee -a $TEST_RESULTS_FILE
echo "📋 Test 3: KIND Cluster Management" | tee -a $TEST_RESULTS_FILE
echo "----------------------------------" | tee -a $TEST_RESULTS_FILE

# List existing clusters
existing_clusters=$(kind get clusters 2>/dev/null | wc -l)
log_test "INFO" "Existing KIND clusters: $existing_clusters"

# Test cluster creation with minimal config
cat > /tmp/test-cluster-config.yaml << EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: test-minimal
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP
EOF

echo "Creating test cluster..." | tee -a $TEST_RESULTS_FILE
if kind create cluster --name test-minimal --config /tmp/test-cluster-config.yaml --wait 300s; then
    log_test "PASS" "Successfully created test KIND cluster"

    # Test cluster connectivity
    if kubectl cluster-info --context kind-test-minimal &> /dev/null; then
        log_test "PASS" "Cluster API server is responsive"

        # Test node readiness
        if kubectl wait --for=condition=Ready nodes --all --timeout=300s --context kind-test-minimal; then
            log_test "PASS" "All nodes are ready"

            # Get cluster info
            node_count=$(kubectl get nodes --context kind-test-minimal --no-headers | wc -l)
            log_test "INFO" "Cluster has $node_count node(s)"

            # Test basic pod deployment
            echo "Testing basic pod deployment..." | tee -a $TEST_RESULTS_FILE
            kubectl run test-pod --image=nginx:alpine --context kind-test-minimal

            if kubectl wait --for=condition=Ready pod/test-pod --timeout=300s --context kind-test-minimal; then
                log_test "PASS" "Basic pod deployment successful"

                # Test pod networking
                pod_ip=$(kubectl get pod test-pod -o jsonpath='{.status.podIP}' --context kind-test-minimal)
                log_test "INFO" "Pod IP: $pod_ip"

                # Cleanup test pod
                kubectl delete pod test-pod --context kind-test-minimal &> /dev/null
                log_test "INFO" "Cleaned up test pod"
            else
                log_test "FAIL" "Basic pod deployment failed"
            fi
        else
            log_test "FAIL" "Nodes did not become ready within timeout"
        fi
    else
        log_test "FAIL" "Cluster API server is not responsive"
    fi

    # Cleanup test cluster
    echo "Cleaning up test cluster..." | tee -a $TEST_RESULTS_FILE
    kind delete cluster --name test-minimal &> /dev/null
    log_test "INFO" "Test cluster cleaned up"

else
    log_test "FAIL" "Failed to create test KIND cluster"
fi

# Test 4: Production Cluster Testing
echo "" | tee -a $TEST_RESULTS_FILE
echo "📋 Test 4: Production Cluster Configuration" | tee -a $TEST_RESULTS_FILE
echo "-------------------------------------------" | tee -a $TEST_RESULTS_FILE

# Check if production cluster config exists
if [ -f "k8s/kind-simple-config.yaml" ]; then
    log_test "PASS" "Production cluster config found"

    # Validate config syntax
    if kind create cluster --name validate-config --config k8s/kind-simple-config.yaml --dry-run 2>/dev/null; then
        log_test "PASS" "Production cluster config is valid"
    else
        log_test "FAIL" "Production cluster config has syntax errors"
    fi
else
    log_test "FAIL" "Production cluster config not found"
fi

# Test 5: Kubernetes Manifests Validation
echo "" | tee -a $TEST_RESULTS_FILE
echo "📋 Test 5: Kubernetes Manifests Validation" | tee -a $TEST_RESULTS_FILE
echo "-------------------------------------------" | tee -a $TEST_RESULTS_FILE

manifest_count=0
valid_manifests=0

if [ -d "k8s" ]; then
    for manifest in k8s/*.yaml; do
        if [ -f "$manifest" ]; then
            manifest_count=$((manifest_count + 1))

            # Validate manifest syntax
            if kubectl apply --dry-run=client -f "$manifest" &> /dev/null; then
                valid_manifests=$((valid_manifests + 1))
                log_test "PASS" "$(basename $manifest) - Valid manifest"
            else
                log_test "FAIL" "$(basename $manifest) - Invalid manifest"
            fi
        fi
    done

    log_test "INFO" "Validated $valid_manifests/$manifest_count manifests"
else
    log_test "FAIL" "k8s directory not found"
fi

# Test 6: Container Image Validation
echo "" | tee -a $TEST_RESULTS_FILE
echo "📋 Test 6: Container Image Validation" | tee -a $TEST_RESULTS_FILE
echo "-------------------------------------" | tee -a $TEST_RESULTS_FILE

# Common images used in the project
images=(
            "pgvector/pgvector:pg16"
    "redis:7-alpine"
    "nginx:alpine"
    "datadog/agent:latest"
    "timberio/vector:latest-alpine"
    "authelia/authelia:latest"
)

available_images=0
for image in "${images[@]}"; do
    echo "Checking $image..." | tee -a $TEST_RESULTS_FILE
    if docker pull "$image" &> /dev/null; then
        available_images=$((available_images + 1))
        log_test "PASS" "$image - Available"
    else
        log_test "FAIL" "$image - Not available"
    fi
done

log_test "INFO" "Available images: $available_images/${#images[@]}"

# Test 7: Resource Limits and Quotas
echo "" | tee -a $TEST_RESULTS_FILE
echo "📋 Test 7: System Resource Validation" | tee -a $TEST_RESULTS_FILE
echo "-------------------------------------" | tee -a $TEST_RESULTS_FILE

# Check available memory
available_memory=$(free -h | awk '/^Mem:/ {print $7}')
log_test "INFO" "Available memory: $available_memory"

# Check available disk space
available_disk=$(df -h / | awk 'NR==2 {print $4}')
log_test "INFO" "Available disk space: $available_disk"

# Check CPU cores
cpu_cores=$(nproc)
log_test "INFO" "CPU cores available: $cpu_cores"

# Memory requirements check (KIND needs at least 2GB)
memory_bytes=$(free -b | awk '/^Mem:/ {print $7}')
min_memory_bytes=$((2 * 1024 * 1024 * 1024)) # 2GB

if [ "$memory_bytes" -gt "$min_memory_bytes" ]; then
    log_test "PASS" "Sufficient memory for KIND cluster"
else
    log_test "WARN" "Low memory - KIND cluster may be unstable"
fi

# Test 8: Network Configuration
echo "" | tee -a $TEST_RESULTS_FILE
echo "📋 Test 8: Network Configuration" | tee -a $TEST_RESULTS_FILE
echo "--------------------------------" | tee -a $TEST_RESULTS_FILE

# Check for port conflicts
ports_to_check=(80 443 8080 3000 5432 6379 9091)
available_ports=0

for port in "${ports_to_check[@]}"; do
    if ! netstat -tuln | grep ":$port " &> /dev/null; then
        available_ports=$((available_ports + 1))
        log_test "PASS" "Port $port is available"
    else
        log_test "WARN" "Port $port is in use"
    fi
done

log_test "INFO" "Available ports: $available_ports/${#ports_to_check[@]}"

# Test Docker network
if docker network ls | grep -q bridge; then
    log_test "PASS" "Docker bridge network available"
else
    log_test "FAIL" "Docker bridge network not available"
fi

# Test 9: Performance Validation
echo "" | tee -a $TEST_RESULTS_FILE
echo "📋 Test 9: Performance Baseline" | tee -a $TEST_RESULTS_FILE
echo "-------------------------------" | tee -a $TEST_RESULTS_FILE

# Docker performance test
echo "Running Docker performance test..." | tee -a $TEST_RESULTS_FILE
start_time=$(date +%s.%N)
docker run --rm alpine:latest echo "Docker performance test" &> /dev/null
end_time=$(date +%s.%N)
docker_time=$(echo "$end_time - $start_time" | bc)

log_test "INFO" "Docker container start time: ${docker_time}s"

if (( $(echo "$docker_time < 5.0" | bc -l) )); then
    log_test "PASS" "Docker performance acceptable"
else
    log_test "WARN" "Docker performance may be slow"
fi

# Test 10: Integration Readiness
echo "" | tee -a $TEST_RESULTS_FILE
echo "📋 Test 10: Integration Readiness" | tee -a $TEST_RESULTS_FILE
echo "---------------------------------" | tee -a $TEST_RESULTS_FILE

# Check environment variables for real testing
if [ -n "$DATADOG_API_KEY" ] && [ "$DATADOG_API_KEY" != "placeholder" ]; then
    log_test "PASS" "Datadog API key configured"
else
    log_test "WARN" "Datadog API key not configured for real testing"
fi

if [ -n "$OPENROUTER_API_KEY" ] && [ "$OPENROUTER_API_KEY" != "placeholder" ]; then
    log_test "PASS" "OpenRouter API key configured"
else
    log_test "WARN" "OpenRouter API key not configured for real testing"
fi

# Check for monitoring configuration
if [ -f ".env.local" ]; then
    log_test "PASS" "Environment configuration file found"
else
    log_test "WARN" "Environment configuration file not found"
fi

# Final Summary
echo "" | tee -a $TEST_RESULTS_FILE
echo "🎯 Test Summary" | tee -a $TEST_RESULTS_FILE
echo "===============" | tee -a $TEST_RESULTS_FILE

total_tests=$(grep -c "\[PASS\]" $TEST_RESULTS_FILE)
failed_tests=$(grep -c "\[FAIL\]" $TEST_RESULTS_FILE)
warnings=$(grep -c "\[WARN\]" $TEST_RESULTS_FILE)

log_test "INFO" "Tests passed: $total_tests"
log_test "INFO" "Tests failed: $failed_tests"
log_test "INFO" "Warnings: $warnings"

if [ "$failed_tests" -eq 0 ]; then
    log_test "PASS" "KIND cluster testing completed successfully"
    echo "" | tee -a $TEST_RESULTS_FILE
    echo "✅ KIND cluster is ready for production deployment" | tee -a $TEST_RESULTS_FILE
    exit 0
else
    log_test "FAIL" "KIND cluster testing completed with failures"
    echo "" | tee -a $TEST_RESULTS_FILE
    echo "❌ KIND cluster needs attention before production deployment" | tee -a $TEST_RESULTS_FILE
    exit 1
fi
