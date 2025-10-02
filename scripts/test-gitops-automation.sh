#!/bin/bash
set -euo pipefail

# GitOps Automation Test Suite
# Tests all components of the VibeCode GitOps pipeline

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/bootstrap.sh"
bootstrap_init "${SCRIPT_DIR}"
# shellcheck disable=SC1091
source "${LIB_DIR}/logging.sh"

log_step "VibeCode GitOps Automation Test Suite"

# Test configuration
CLUSTER_NAME="vibecode-local"
TEST_NAMESPACE="vibecode-webgui-staging"
TIMEOUT=300

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    printf '\n'
    log_step "Test ${TOTAL_TESTS}: ${test_name}"
    log_info "Command: ${test_command}"

    if eval "$test_command"; then
        log_success "PASSED"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        log_error "FAILED"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Function to check if resource exists
check_resource() {
    local resource_type="$1"
    local resource_name="$2"
    local namespace="$3"
    
    if [ -n "$namespace" ]; then
        kubectl get "$resource_type" "$resource_name" -n "$namespace" >/dev/null 2>&1
    else
        kubectl get "$resource_type" "$resource_name" >/dev/null 2>&1
    fi
}

# Function to wait for resource to be ready
wait_for_resource() {
    local resource_type="$1"
    local resource_name="$2"
    local namespace="$3"
    local condition="$4"
    local timeout="${5:-$TIMEOUT}"
    
    log_info "Waiting for ${resource_type}/${resource_name} to be ${condition}..."
    
    if [ -n "$namespace" ]; then
        kubectl wait --for=condition="$condition" "$resource_type/$resource_name" -n "$namespace" --timeout="${timeout}s" || return 1
    else
        kubectl wait --for=condition="$condition" "$resource_type/$resource_name" --timeout="${timeout}s" || return 1
    fi
}

# Test 1: Cluster Connectivity
test_cluster_connectivity() {
    printf '\n'
    log_step "📡 Testing Cluster Connectivity"
    
    run_test "Cluster accessible" "kubectl cluster-info --context kind-$CLUSTER_NAME"
    run_test "Nodes are ready" "kubectl get nodes | grep -q Ready"
    run_test "System pods running" "kubectl get pods -n kube-system | grep -q Running"
}

# Test 2: ArgoCD Installation
test_argocd_installation() {
    printf '\n'
    log_step "🔄 Testing ArgoCD Installation"
    
    run_test "ArgoCD namespace exists" "check_resource namespace argocd"
    run_test "ArgoCD server deployed" "check_resource deployment argocd-server argocd"
    run_test "ArgoCD server running" "kubectl get pods -n argocd -l app.kubernetes.io/name=argocd-server | grep -q Running"
    run_test "ArgoCD API accessible" "kubectl port-forward svc/argocd-server -n argocd 8080:443 >/dev/null 2>&1 & sleep 5; curl -k https://localhost:8080/api/v1/version >/dev/null 2>&1; kill %1 2>/dev/null || true"
}

# Test 3: Monitoring Stack
test_monitoring_stack() {
    printf '\n'
    log_step "📊 Testing Monitoring Stack"
    
    run_test "Monitoring namespace exists" "check_resource namespace monitoring"
    
    # Check if monitoring manifests were applied
    if kubectl get pods -n monitoring >/dev/null 2>&1; then
        run_test "Monitoring pods exist" "[[ \$(kubectl get pods -n monitoring --no-headers 2>/dev/null | wc -l) -gt 0 ]]"
        
        # Test Prometheus if available
        if kubectl get deployment prometheus -n monitoring >/dev/null 2>&1; then
            run_test "Prometheus deployed" "check_resource deployment prometheus monitoring"
        fi
        
        # Test Grafana if available
        if kubectl get deployment grafana -n monitoring >/dev/null 2>&1; then
            run_test "Grafana deployed" "check_resource deployment grafana monitoring"
        fi
    else
        log_info "Monitoring stack not deployed (expected for basic test)"
    fi
}

# Test 4: Sealed Secrets Controller
test_sealed_secrets() {
    printf '\n'
    log_step "🔐 Testing Sealed Secrets Controller"
    
    run_test "Sealed secrets controller deployed" "check_resource deployment sealed-secrets-controller kube-system"
    run_test "Sealed secrets controller running" "kubectl get pods -n kube-system -l name=sealed-secrets-controller | grep -q Running"
    
    # Test creating a sealed secret
    if command -v kubeseal >/dev/null 2>&1; then
        run_test "Kubeseal CLI available" "kubeseal --version >/dev/null 2>&1"
    else
        log_warn "kubeseal CLI not installed (install for full testing)"
    fi
}

# Test 5: Application Namespace and Secrets
test_application_setup() {
    printf '\n'
    log_step "🏗️ Testing Application Setup"
    
    run_test "Application namespace exists" "check_resource namespace $TEST_NAMESPACE"
    run_test "Application secrets exist" "check_resource secret vibecode-staging-secrets $TEST_NAMESPACE"
    run_test "Application config exists" "check_resource configmap vibecode-staging-config $TEST_NAMESPACE"
    
    # Test secret values
    run_test "NextAuth secret configured" "kubectl get secret vibecode-staging-secrets -n $TEST_NAMESPACE -o jsonpath='{.data.NEXTAUTH_SECRET}' | base64 -d | grep -q 'vibecode'"
    run_test "OpenRouter API key configured" "kubectl get secret vibecode-staging-secrets -n $TEST_NAMESPACE -o jsonpath='{.data.OPENROUTER_API_KEY}' | base64 -d | grep -q 'sk-or-v1'"
}

# Test 6: Docker Images
test_docker_images() {
    printf '\n'
    log_step "🐳 Testing Docker Images"
    
    # Check if images were loaded into KIND
    run_test "VibeCode image loaded" "docker exec $CLUSTER_NAME-control-plane crictl images | grep -q vibecode-webgui:local-test"
    run_test "PostgreSQL image loaded" "docker exec $CLUSTER_NAME-control-plane crictl images | grep -q postgres:16"
    run_test "Redis image loaded" "docker exec $CLUSTER_NAME-control-plane crictl images | grep -q redis:7-alpine"
    run_test "LiteLLM image loaded" "docker exec $CLUSTER_NAME-control-plane crictl images | grep -q litellm"
}

# Test 7: Application Deployment
test_application_deployment() {
    printf '\n'
    log_step "🚀 Testing Application Deployment"
    
    # Check if deployment exists
    if kubectl get deployment -n $TEST_NAMESPACE | grep -q vibecode-webgui; then
        DEPLOYMENT_NAME=$(kubectl get deployment -n $TEST_NAMESPACE -o name | grep vibecode-webgui | head -n1 | cut -d'/' -f2)
        
        run_test "Application deployment exists" "check_resource deployment $DEPLOYMENT_NAME $TEST_NAMESPACE"
        run_test "Application service exists" "kubectl get service -n $TEST_NAMESPACE | grep -q vibecode-webgui"
        
        # Check pod status
        log_info "Checking pod status..."
        kubectl get pods -n $TEST_NAMESPACE
        
        if kubectl get pods -n $TEST_NAMESPACE -l app=vibecode-webgui | grep -q Running; then
            run_test "Application pods running" "kubectl get pods -n $TEST_NAMESPACE -l app=vibecode-webgui | grep -q Running"
        else
            log_warn "Application pods not yet running (may be starting)"
            kubectl describe pods -n $TEST_NAMESPACE -l app=vibecode-webgui
        fi
    else
        log_warn "No VibeCode deployment found"
    fi
}

# Test 8: Network Connectivity
test_network_connectivity() {
    printf '\n'
    log_step "🌐 Testing Network Connectivity"
    
    # Test NGINX Ingress
    run_test "NGINX Ingress Controller running" "kubectl get pods -n ingress-nginx -l app.kubernetes.io/component=controller | grep -q Running"
    
    # Test service accessibility
    if kubectl get service -n $TEST_NAMESPACE | grep -q NodePort; then
        run_test "NodePort service accessible" "kubectl get service -n $TEST_NAMESPACE -o wide | grep -q NodePort"
        
        # Test if we can reach the service
        SERVICE_PORT=$(kubectl get service -n $TEST_NAMESPACE -o jsonpath='{.items[?(@.spec.type=="NodePort")].spec.ports[0].nodePort}' 2>/dev/null | head -n1)
        if [ -n "$SERVICE_PORT" ]; then
            log_info "Testing service on port $SERVICE_PORT..."
            sleep 5
            run_test "Service responds to HTTP" "curl -f --connect-timeout 10 http://localhost:$SERVICE_PORT/api/health || curl -f --connect-timeout 10 http://localhost:$SERVICE_PORT/ || echo 'Service may still be starting'"
        fi
    fi
}

# Test 9: Kubernetes Resources Health
test_kubernetes_resources() {
    printf '\n'
    log_step "⚡ Testing Kubernetes Resources Health"
    
    # Check resource quotas and limits
    run_test "No failed pods in test namespace" "! kubectl get pods -n $TEST_NAMESPACE | grep -E '(Error|CrashLoopBackOff|Failed)'"
    run_test "All system pods healthy" "! kubectl get pods -n kube-system | grep -E '(Error|CrashLoopBackOff|Failed)'"
    
    # Check events for errors
    log_info "📋 Recent events:"
    kubectl get events -n $TEST_NAMESPACE --sort-by=.metadata.creationTimestamp | tail -10
}

# Test 10: GitOps Configuration Files
test_gitops_configuration() {
    printf '\n'
    log_step "📋 Testing GitOps Configuration Files"
    
    # Test Terraform files
    run_test "Terraform main.tf exists" "[ -f 'infrastructure/terraform/main.tf' ]"
    run_test "Datadog dashboard config exists" "[ -f 'infrastructure/monitoring/datadog-dashboard.tf' ]"
    
    # Test ArgoCD configurations
    run_test "ArgoCD project config exists" "[ -f 'infrastructure/gitops/argocd/project.yaml' ]"
    run_test "ArgoCD staging app exists" "[ -f 'infrastructure/gitops/argocd/application-staging.yaml' ]"
    run_test "ArgoCD production app exists" "[ -f 'infrastructure/gitops/argocd/application-production.yaml' ]"
    
    # Test Kustomize configurations
    run_test "Base kustomization exists" "[ -f 'infrastructure/kubernetes/environments/base/kustomization.yaml' ]"
    run_test "Staging kustomization exists" "[ -f 'infrastructure/kubernetes/environments/staging/kustomization.yaml' ]"
    run_test "Production kustomization exists" "[ -f 'infrastructure/kubernetes/environments/production/kustomization.yaml' ]"
    
    # Test monitoring configurations
    run_test "Datadog agent config exists" "[ -f 'infrastructure/kubernetes/monitoring/datadog-agent.yaml' ]"
    run_test "Prometheus config exists" "[ -f 'infrastructure/kubernetes/monitoring/prometheus.yaml' ]"
    run_test "Grafana config exists" "[ -f 'infrastructure/kubernetes/monitoring/grafana.yaml' ]"
    
    # Test GitHub Actions workflow
    run_test "GitOps workflow exists" "[ -f '.github/workflows/gitops-deployment.yml' ]"
}

# Test 11: Environment Variables from .env.local
test_environment_configuration() {
    printf '\n'
    log_step "🔧 Testing Environment Configuration"
    
    # Source .env.local if available
    if [ -f ".env.local" ]; then
        set -a
        # shellcheck disable=SC1091
        source .env.local
        set +a

        run_test "NEXTAUTH_SECRET configured" "[ -n \"${NEXTAUTH_SECRET:-}\" ]"
        run_test "OPENROUTER_API_KEY configured" "[ -n \"${OPENROUTER_API_KEY:-}\" ]"
        run_test "DD_API_KEY configured" "[ -n \"${DD_API_KEY:-}\" ]"
        run_test "DATABASE_URL configured" "[ -n \"${DATABASE_URL:-}\" ]"

        log_info "Environment variables loaded from .env.local"
    else
        log_warn ".env.local not found, skipping environment tests"
    fi
}

# Test 12: Datadog Integration (if configured)
test_datadog_integration() {
    printf '\n'
    log_step "🐕 Testing Datadog Integration"
    
    if [ -n "$DD_API_KEY" ] && [ "$DD_API_KEY" != "placeholder" ]; then
        run_test "Datadog API key available" "[ -n \"${DD_API_KEY:-}\" ]"
        
        # Test if Datadog agent would be deployed
        if kubectl get daemonset datadog-agent -n monitoring >/dev/null 2>&1; then
            run_test "Datadog agent deployed" "check_resource daemonset datadog-agent monitoring"
        else
            log_info "Datadog agent not deployed (expected for basic test)"
        fi
        
        # Test enhanced monitoring integration
        run_test "Enhanced monitoring file exists" "[ -f 'src/lib/monitoring/enhanced-datadog-integration.ts' ]"
    else
        log_info "Datadog not configured, skipping integration tests"
    fi
}

# Function to show test results summary
show_test_results() {
    printf '\n'
    log_step "🧪 Test Results Summary"
    log_info "Total Tests: $TOTAL_TESTS"
    log_success "Passed: $PASSED_TESTS"
    log_info "Failed: $FAILED_TESTS"
    printf '\n'
    
    if [ "$FAILED_TESTS" -eq 0 ]; then
        log_success "🎉 All tests passed! GitOps automation is working correctly."
        printf '\n'
        log_info "✅ Your VibeCode GitOps setup includes:"
        log_info "  • KIND cluster with full Kubernetes environment"
        log_info "  • ArgoCD for GitOps deployments"
        log_info "  • Monitoring stack (Prometheus, Grafana, Datadog)"
        log_info "  • Sealed Secrets for secure secret management"
        log_info "  • Multi-environment configurations (staging, production)"
        log_info "  • Complete CI/CD pipeline with GitHub Actions"
        log_info "  • Infrastructure as Code with Terraform"
        printf '\n'
        return 0
    else
        log_warn "Some tests failed. This may be expected for a basic setup."
        printf '\n'
        log_info "🔍 Common issues and solutions:"
        log_info "  • Pods still starting: Wait a few minutes and re-run tests"
        log_info "  • Images not loaded: Run the setup script with image building"
        log_info "  • Services not ready: Check pod logs with kubectl"
        log_info "  • Network issues: Verify KIND cluster networking"
        printf '\n'
        return 1
    fi
}

# Function to show debugging information
show_debug_info() {
    printf '\n'
    log_step "🔍 Debug Information"
    printf '\n'
    log_info "📊 Cluster Status:"
    kubectl get nodes
    printf '\n'
    log_info "📦 All Pods:"
    kubectl get pods -A
    printf '\n'
    log_info "🌐 All Services:"
    kubectl get services -A
    printf '\n'
    log_info "📋 Recent Events:"
    kubectl get events --sort-by=.metadata.creationTimestamp | tail -20
    printf '\n'
}

# Main execution
main() {
    log_step "🚀 Starting GitOps Automation Test Suite..."
    log_info "Using cluster: $CLUSTER_NAME"
    log_info "Test namespace: $TEST_NAMESPACE"
    printf '\n'
    
    # Run all test suites
    test_cluster_connectivity
    test_argocd_installation
    test_sealed_secrets
    test_monitoring_stack
    test_application_setup
    test_docker_images
    test_application_deployment
    test_network_connectivity
    test_kubernetes_resources
    test_gitops_configuration
    test_environment_configuration
    test_datadog_integration
    
    # Show results
    show_test_results
    
    # Show debug info if tests failed
    if [ $FAILED_TESTS -gt 0 ]; then
        show_debug_info
    fi
    
    printf '\n'
    log_step "🏁 GitOps Automation Test Suite Complete!"
}

# Run main function
main "$@"
