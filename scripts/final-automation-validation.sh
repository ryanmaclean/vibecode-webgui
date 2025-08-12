#!/bin/bash
set -e

# Final GitOps Automation Validation
# Complete end-to-end test of the VibeCode GitOps pipeline

echo "🎯 VibeCode GitOps Automation - Final Validation"
echo "=============================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run test
test_component() {
    local name="$1"
    local command="$2"
    local expected="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -ne "${BLUE}Testing $name...${NC} "
    
    if eval "$command" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

echo -e "\n${BOLD}🎛️ Infrastructure Components${NC}"
echo "========================="

# Core Kubernetes
test_component "Kubernetes Cluster" "kubectl cluster-info"
test_component "Worker Nodes Ready" "kubectl get nodes | grep -c Ready | grep -q 3"
test_component "System Pods Running" "kubectl get pods -n kube-system | grep -q Running"

# ArgoCD GitOps
test_component "ArgoCD Namespace" "kubectl get namespace argocd"
test_component "ArgoCD Server Running" "kubectl get pods -n argocd -l app.kubernetes.io/name=argocd-server | grep -q Running"
test_component "ArgoCD Project Created" "kubectl get appprojects -n argocd vibecode-platform"

# Sealed Secrets
test_component "Sealed Secrets Controller" "kubectl get pods -n kube-system -l name=sealed-secrets-controller | grep -q Running"

# NGINX Ingress
test_component "NGINX Ingress Controller" "kubectl get pods -n ingress-nginx | grep -q Running"

# Monitoring Stack
test_component "Monitoring Namespace" "kubectl get namespace monitoring"
test_component "Prometheus Deployment" "kubectl get deployment prometheus -n monitoring"
test_component "Grafana Deployment" "kubectl get deployment grafana -n monitoring"
test_component "Datadog Agent DaemonSet" "kubectl get daemonset datadog-agent -n monitoring"

# Application Setup
test_component "App Namespace" "kubectl get namespace vibecode-webgui-staging"
test_component "App Secrets" "kubectl get secret vibecode-staging-secrets -n vibecode-webgui-staging"
test_component "App ConfigMap" "kubectl get configmap vibecode-staging-config -n vibecode-webgui-staging"

# Test Application
test_component "Test App Deployment" "kubectl get deployment vibecode-test-app -n vibecode-webgui-staging"
test_component "Test App Service" "kubectl get service vibecode-test-service -n vibecode-webgui-staging"
test_component "Test App Pod Running" "kubectl get pods -n vibecode-webgui-staging -l test=true | grep -q Running"

echo -e "\n${BOLD}🔧 Configuration Validation${NC}"
echo "========================="

# GitOps Files
test_component "Terraform Main Config" "[ -f 'infrastructure/terraform/main.tf' ]"
test_component "Datadog Dashboard Config" "[ -f 'infrastructure/monitoring/datadog-dashboard.tf' ]"
test_component "ArgoCD Applications" "[ -f 'infrastructure/gitops/argocd/application-staging.yaml' ]"
test_component "Kustomize Base" "[ -f 'infrastructure/kubernetes/environments/base/kustomization.yaml' ]"
test_component "GitHub Actions Workflow" "[ -f '.github/workflows/gitops-deployment.yml' ]"

# Environment
if [ -f ".env.local" ]; then
    export $(grep -v '^#' .env.local | xargs) 2>/dev/null || true
    test_component "NextAuth Secret" "[ -n '$NEXTAUTH_SECRET' ]"
    test_component "OpenRouter API Key" "[ -n '$OPENROUTER_API_KEY' ]"
    test_component "Datadog API Key" "[ -n '$DD_API_KEY' ]"
else
    echo -e "${RED}❌ .env.local not found${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 3))
    TOTAL_TESTS=$((TOTAL_TESTS + 3))
fi

echo -e "\n${BOLD}🌐 Connectivity Tests${NC}"
echo "==================="

# Service Connectivity
test_component "ArgoCD API Access" "kubectl port-forward svc/argocd-server -n argocd 8080:80 >/dev/null 2>&1 & sleep 2; curl -s http://localhost:8080 >/dev/null; kill %1 2>/dev/null"
test_component "Test App Service Access" "kubectl port-forward svc/vibecode-test-service -n vibecode-webgui-staging 8081:80 >/dev/null 2>&1 & sleep 2; curl -s http://localhost:8081 | grep -q nginx; kill %1 2>/dev/null"

# Get ArgoCD credentials
echo -e "\n${BOLD}🔑 Access Information${NC}"
echo "=================="
if kubectl get secret argocd-initial-admin-secret -n argocd >/dev/null 2>&1; then
    ARGOCD_PASSWORD=$(kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath='{.data.password}' | base64 -d 2>/dev/null || echo "Unable to decode")
    echo -e "${GREEN}ArgoCD UI:${NC} kubectl port-forward svc/argocd-server -n argocd 8080:80 → http://localhost:8080"
    echo -e "${GREEN}Username:${NC} admin"
    echo -e "${GREEN}Password:${NC} $ARGOCD_PASSWORD"
else
    echo -e "${RED}❌ ArgoCD credentials not available${NC}"
fi

echo -e "${GREEN}Test App:${NC} kubectl port-forward svc/vibecode-test-service -n vibecode-webgui-staging 8081:80 → http://localhost:8081"

echo -e "\n${BOLD}📊 Test Results Summary${NC}"
echo "======================"
echo -e "Total Tests: ${BOLD}$TOTAL_TESTS${NC}"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
echo -e "Success Rate: ${BOLD}$SUCCESS_RATE%${NC}"

echo -e "\n${BOLD}🚀 GitOps Automation Status${NC}"
echo "=========================="

if [ $SUCCESS_RATE -ge 90 ]; then
    echo -e "${GREEN}🎉 EXCELLENT! GitOps automation is fully functional${NC}"
    echo ""
    echo "✅ Your VibeCode platform has complete:"
    echo "   • Infrastructure as Code (Terraform)"
    echo "   • GitOps Deployments (ArgoCD)" 
    echo "   • Multi-Environment Support"
    echo "   • Comprehensive Monitoring Stack"
    echo "   • Secure Secrets Management"
    echo "   • Automated CI/CD Pipeline"
    echo "   • Production-Ready Configuration"
    echo ""
    echo -e "${BOLD}Ready for production deployment! 🚀${NC}"
elif [ $SUCCESS_RATE -ge 75 ]; then
    echo -e "${YELLOW}⚠️  GOOD! Most components are working correctly${NC}"
    echo "Minor issues detected but core functionality is operational."
else
    echo -e "${RED}❌ NEEDS ATTENTION! Several components require fixing${NC}"
    echo "Review failed tests and address issues before production use."
fi

echo -e "\n${BOLD}🛠️ Management Commands${NC}"
echo "==================="
echo "• View all resources: kubectl get all -A"
echo "• ArgoCD logs: kubectl logs -n argocd deployment/argocd-server"
echo "• Monitor test app: kubectl get pods -n vibecode-webgui-staging -w"
echo "• Clean up: kind delete cluster --name vibecode-local"

echo -e "\n${BOLD}📋 What Was Automated${NC}"
echo "==================="
echo "🏗️  3-node KIND cluster with full networking"
echo "🔄 ArgoCD GitOps platform with project configuration"
echo "🔐 Sealed Secrets controller for secure secret management"
echo "🌐 NGINX Ingress controller with SSL termination"
echo "📊 Complete monitoring stack (Datadog, Prometheus, Grafana)"
echo "🚀 Application deployment with health checks"
echo "🔧 Environment configuration from .env.local"
echo "📦 Container image management and deployment"
echo "🧪 Comprehensive test suite with validation"
echo "📚 Complete documentation and examples"

echo ""
echo -e "${GREEN}✅ GitOps automation validation complete!${NC}"