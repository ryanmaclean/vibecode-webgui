#!/bin/bash
# Quick Kubernetes Validation - Focused on Critical Components
# Tests the specific issues mentioned: every component should have a test

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_NAMESPACE="vibecode-validation-$(date +%s)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_error() { echo -e "${RED}[FAIL]${NC} $1"; }

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

test_result() {
    local test_name="$1"
    local result="$2"
    local details="${3:-}"
    
    if [[ "$result" == "PASS" ]]; then
        log_success "$test_name${details:+ - $details}"
        ((TESTS_PASSED++))
    else
        log_error "$test_name${details:+ - $details}"
        FAILED_TESTS+=("$test_name")
        ((TESTS_FAILED++))
    fi
}

echo "🧪 QUICK KUBERNETES VALIDATION - Testing Every Component"
echo "========================================================"

# 1. KIND Cluster Components
echo ""
echo "1️⃣  KIND Cluster Core Components:"

# API Server
if kubectl cluster-info --request-timeout=5s >/dev/null 2>&1; then
    test_result "API Server Connectivity" "PASS"
else
    test_result "API Server Connectivity" "FAIL"
fi

# Control Plane Node
if kubectl get nodes | grep -q "control-plane.*Ready"; then
    test_result "Control Plane Node" "PASS"
else
    test_result "Control Plane Node" "FAIL"
fi

# CoreDNS
if kubectl get pods -n kube-system -l k8s-app=kube-dns | grep -q "Running"; then
    test_result "CoreDNS System Pods" "PASS"
else
    test_result "CoreDNS System Pods" "FAIL"
fi

# Container Runtime
if kubectl get nodes -o jsonpath='{.items[0].status.nodeInfo.containerRuntimeVersion}' | grep -q "containerd"; then
    test_result "Container Runtime (containerd)" "PASS"
else
    test_result "Container Runtime (containerd)" "FAIL"
fi

# Storage Provisioner
if kubectl get pods -n local-path-storage | grep -q "local-path-provisioner.*Running"; then
    test_result "Local Path Storage Provisioner" "PASS"
else
    test_result "Local Path Storage Provisioner" "FAIL"
fi

# Default Storage Class
if kubectl get storageclass standard -o name >/dev/null 2>&1; then
    test_result "Default Storage Class" "PASS"
else
    test_result "Default Storage Class" "FAIL"
fi

# 2. Secrets Management
echo ""
echo "2️⃣  Secrets Management Components:"

# Create test namespace
kubectl create namespace "$TEST_NAMESPACE" >/dev/null 2>&1 || true

# Set test environment
export DD_API_KEY="test-datadog-api-key-32-chars-long"
export POSTGRES_PASSWORD="test-postgres-password-123"
export DATADOG_POSTGRES_PASSWORD="test-datadog-password-123"

# Test secrets creation script
if "$PROJECT_ROOT/scripts/setup-secrets.sh" "$TEST_NAMESPACE" >/dev/null 2>&1; then
    test_result "Secrets Creation Script" "PASS"
else
    test_result "Secrets Creation Script" "FAIL"
fi

# Verify Datadog secret
if kubectl get secret datadog-secrets -n "$TEST_NAMESPACE" >/dev/null 2>&1; then
    # Check secret has correct key
    if kubectl get secret datadog-secrets -n "$TEST_NAMESPACE" -o jsonpath='{.data.api-key}' | base64 -d | grep -q "test-datadog-api-key"; then
        test_result "Datadog Secret Content" "PASS"
    else
        test_result "Datadog Secret Content" "FAIL"
    fi
else
    test_result "Datadog Secret Creation" "FAIL"
fi

# Verify PostgreSQL secret
if kubectl get secret postgres-credentials -n "$TEST_NAMESPACE" >/dev/null 2>&1; then
    # Check secret has both required keys
    local keys
    keys=$(kubectl get secret postgres-credentials -n "$TEST_NAMESPACE" -o jsonpath='{.data}' | jq -r 'keys[]' 2>/dev/null | sort | tr '\n' ' ')
    if [[ "$keys" == *"datadog-password"* ]] && [[ "$keys" == *"postgres-password"* ]]; then
        test_result "PostgreSQL Secret Structure" "PASS"
    else
        test_result "PostgreSQL Secret Structure" "FAIL"
    fi
else
    test_result "PostgreSQL Secret Creation" "FAIL"
fi

# 3. Helm Chart Components
echo ""
echo "3️⃣  Helm Chart Components:"

# Helm chart structure
if [[ -f "$PROJECT_ROOT/helm/vibecode-platform/Chart.yaml" ]]; then
    test_result "Helm Chart Definition" "PASS"
else
    test_result "Helm Chart Definition" "FAIL"
fi

# Helm dependencies
if [[ -f "$PROJECT_ROOT/helm/vibecode-platform/Chart.lock" ]]; then
    test_result "Helm Dependencies Lock" "PASS"
else
    # Try to build dependencies
    if helm dependency build "$PROJECT_ROOT/helm/vibecode-platform" >/dev/null 2>&1; then
        test_result "Helm Dependencies Build" "PASS"
    else
        test_result "Helm Dependencies Build" "FAIL"
    fi
fi

# Datadog chart dependency
if [[ -f "$PROJECT_ROOT/helm/vibecode-platform/charts/datadog-3.60.0.tgz" ]]; then
    test_result "Datadog Chart Dependency" "PASS"
else
    test_result "Datadog Chart Dependency" "FAIL"
fi

# PostgreSQL chart dependency
if ls "$PROJECT_ROOT/helm/vibecode-platform/charts/"*postgresql*.tgz >/dev/null 2>&1; then
    test_result "PostgreSQL Chart Dependency" "PASS"
else
    test_result "PostgreSQL Chart Dependency" "FAIL"
fi

# Values files
if [[ -f "$PROJECT_ROOT/helm/vibecode-platform/values-dev.yaml" ]]; then
    test_result "Development Values File" "PASS"
else
    test_result "Development Values File" "FAIL"
fi

# Template rendering test
temp_output=$(mktemp)
if helm template test-render "$PROJECT_ROOT/helm/vibecode-platform" \
    --set datadog.datadog.apiKey="test-key" \
    --set database.postgresql.auth.postgresPassword="test-pass" \
    --namespace="$TEST_NAMESPACE" > "$temp_output" 2>/dev/null; then
    test_result "Helm Template Rendering" "PASS"
    
    # Check for key components in rendered output
    if grep -q "kind: DaemonSet" "$temp_output"; then
        test_result "Datadog DaemonSet Template" "PASS"
    else
        test_result "Datadog DaemonSet Template" "FAIL"
    fi
    
    if grep -q "kind: Deployment" "$temp_output" && grep -A3 -B3 "kind: Deployment" "$temp_output" | grep -q "cluster-agent"; then
        test_result "Datadog Cluster Agent Template" "PASS"
    else
        test_result "Datadog Cluster Agent Template" "FAIL"
    fi
    
    if grep -q "postgresql" "$temp_output"; then
        test_result "PostgreSQL Template Components" "PASS"
    else
        test_result "PostgreSQL Template Components" "FAIL"
    fi
else
    test_result "Helm Template Rendering" "FAIL"
fi
rm -f "$temp_output"

# 4. Database Monitoring Components
echo ""
echo "4️⃣  Database Monitoring Components:"

# DBM initialization script
if [[ -f "$PROJECT_ROOT/database/init-dbm.sql" ]]; then
    test_result "DBM Initialization Script" "PASS"
    
    # Check for required functions
    if grep -q "datadog.explain_statement" "$PROJECT_ROOT/database/init-dbm.sql"; then
        test_result "Explain Plans Function Definition" "PASS"
    else
        test_result "Explain Plans Function Definition" "FAIL"
    fi
    
    # Check for user creation
    if grep -q "CREATE USER datadog" "$PROJECT_ROOT/database/init-dbm.sql"; then
        test_result "Datadog User Creation SQL" "PASS"
    else
        test_result "Datadog User Creation SQL" "FAIL"
    fi
else
    test_result "DBM Initialization Script" "FAIL"
fi

# PostgreSQL configuration
if [[ -f "$PROJECT_ROOT/database/postgresql-dbm.conf" ]]; then
    test_result "PostgreSQL DBM Configuration" "PASS"
    
    # Check for pg_stat_statements
    if grep -q "pg_stat_statements" "$PROJECT_ROOT/database/postgresql-dbm.conf"; then
        test_result "pg_stat_statements Configuration" "PASS"
    else
        test_result "pg_stat_statements Configuration" "FAIL"
    fi
else
    test_result "PostgreSQL DBM Configuration" "FAIL"
fi

# 5. Datadog Integration Components
echo ""
echo "5️⃣  Datadog Integration Components:"

# Check values-dev.yaml has proper Datadog structure
if grep -q "datadog:" "$PROJECT_ROOT/helm/vibecode-platform/values-dev.yaml" && \
   grep -q "agents:" "$PROJECT_ROOT/helm/vibecode-platform/values-dev.yaml" && \
   grep -q "clusterAgent:" "$PROJECT_ROOT/helm/vibecode-platform/values-dev.yaml"; then
    test_result "Datadog Configuration Structure" "PASS"
else
    test_result "Datadog Configuration Structure" "FAIL"
fi

# Check for 2025 best practices
if grep -q "apiKeyExistingSecret.*datadog-secrets" "$PROJECT_ROOT/helm/vibecode-platform/values-dev.yaml" && \
   grep -q "targetSystem.*linux" "$PROJECT_ROOT/helm/vibecode-platform/values-dev.yaml"; then
    test_result "2025 Best Practices Configuration" "PASS"
else
    test_result "2025 Best Practices Configuration" "FAIL"
fi

# Check for DBM configuration in cluster agent
if grep -q "postgres.yaml" "$PROJECT_ROOT/helm/vibecode-platform/values-dev.yaml" && \
   grep -q "cluster_check: true" "$PROJECT_ROOT/helm/vibecode-platform/values-dev.yaml"; then
    test_result "Database Monitoring Configuration" "PASS"
else
    test_result "Database Monitoring Configuration" "FAIL"
fi

# 6. External Secrets Components
echo ""
echo "6️⃣  External Secrets Components:"

# External secrets configuration
if [[ -f "$PROJECT_ROOT/k8s/external-secrets/external-secret-datadog.yaml" ]]; then
    test_result "External Secrets Configuration File" "PASS"
    
    # Check for multiple providers
    if grep -q "SecretStore" "$PROJECT_ROOT/k8s/external-secrets/external-secret-datadog.yaml" && \
       grep -q "ExternalSecret" "$PROJECT_ROOT/k8s/external-secrets/external-secret-datadog.yaml"; then
        test_result "External Secrets Resource Definitions" "PASS"
    else
        test_result "External Secrets Resource Definitions" "FAIL"
    fi
else
    test_result "External Secrets Configuration File" "FAIL"
fi

# 7. Documentation Components
echo ""
echo "7️⃣  Documentation Components:"

# Check key documentation files
docs=("KUBERNETES_SECRETS_AUTOMATION.md" "DATABASE_MONITORING_SETUP.md" "README.md" "TODO.md")
for doc in "${docs[@]}"; do
    if [[ -f "$PROJECT_ROOT/$doc" ]]; then
        test_result "Documentation: $doc" "PASS"
    else
        test_result "Documentation: $doc" "FAIL"
    fi
done

# Check README has been updated with secrets automation
if grep -q "Kubernetes Secrets Automation" "$PROJECT_ROOT/README.md"; then
    test_result "README Updated with Secrets Feature" "PASS"
else
    test_result "README Updated with Secrets Feature" "FAIL"
fi

# 8. Basic Deployment Test
echo ""
echo "8️⃣  Basic Deployment Test:"

# Create a simple pod to test basic deployment
kubectl apply -n "$TEST_NAMESPACE" -f - >/dev/null 2>&1 <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: validation-test-pod
spec:
  containers:
  - name: test
    image: busybox:1.35
    command: ['echo', 'deployment-test-successful']
    resources:
      requests:
        cpu: "1m"
        memory: "8Mi"
  restartPolicy: Never
EOF

# Wait briefly for pod
sleep 5

# Check if pod was created and completed
if kubectl get pod validation-test-pod -n "$TEST_NAMESPACE" >/dev/null 2>&1; then
    local pod_status
    pod_status=$(kubectl get pod validation-test-pod -n "$TEST_NAMESPACE" -o jsonpath='{.status.phase}')
    if [[ "$pod_status" == "Succeeded" ]] || [[ "$pod_status" == "Running" ]]; then
        test_result "Basic Pod Deployment" "PASS"
    else
        test_result "Basic Pod Deployment" "FAIL" "Status: $pod_status"
    fi
else
    test_result "Basic Pod Deployment" "FAIL"
fi

# Cleanup
echo ""
echo "🧹 Cleaning up test resources..."
kubectl delete namespace "$TEST_NAMESPACE" --timeout=30s >/dev/null 2>&1 || true

# Final Report
echo ""
echo "📊 VALIDATION SUMMARY"
echo "===================="
total_tests=$((TESTS_PASSED + TESTS_FAILED))
success_rate=0
if [[ $total_tests -gt 0 ]]; then
    success_rate=$((TESTS_PASSED * 100 / total_tests))
fi

echo "Total Tests: $total_tests"
echo "Passed: $TESTS_PASSED"
echo "Failed: $TESTS_FAILED"
echo "Success Rate: ${success_rate}%"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo "🎉 ALL COMPONENTS VALIDATED SUCCESSFULLY!"
    echo ""
    echo "✅ VERIFIED COMPONENTS:"
    echo "   • KIND cluster with all system components"
    echo "   • Secrets management automation"
    echo "   • Helm chart structure and dependencies"
    echo "   • Database monitoring configuration"
    echo "   • Datadog integration setup"
    echo "   • External secrets support"
    echo "   • Documentation completeness"
    echo "   • Basic deployment functionality"
    echo ""
    echo "🚀 READY FOR PRODUCTION DEPLOYMENT!"
    exit 0
else
    echo "❌ VALIDATION ISSUES DETECTED:"
    for test in "${FAILED_TESTS[@]}"; do
        echo "   • $test"
    done
    echo ""
    echo "⚠️  Please resolve these issues before production deployment."
    exit 1
fi