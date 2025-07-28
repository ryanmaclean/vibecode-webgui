#!/bin/bash
# Test Authelia Automation Integration
# Verifies that Authelia is properly integrated into both K8s and Docker automation

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "🔒 AUTHELIA AUTOMATION TEST"
echo "============================"

# Test 1: Check Kubernetes integration
test_kubernetes_integration() {
    log_info "Test 1: Checking Kubernetes integration..."
    
    # Check if authelia files exist
    if [ ! -f "k8s/authelia/authelia-config.yaml" ]; then
        log_error "Authelia K8s config not found"
        return 1
    fi
    
    if [ ! -f "k8s/authelia/authelia-deployment.yaml" ]; then
        log_error "Authelia K8s deployment not found"
        return 1
    fi
    
    # Check if deployment script includes Authelia
    if ! grep -q "vibecode-auth" scripts/kind-deploy-services.sh; then
        log_error "Authelia not integrated into K8s deployment script"
        return 1
    fi
    
    log_success "Kubernetes integration verified"
    return 0
}

# Test 2: Check Docker Compose integration
test_docker_integration() {
    log_info "Test 2: Checking Docker Compose integration..."
    
    # Check if Authelia service exists in docker-compose
    if ! grep -q "authelia:" docker-compose.yml; then
        log_error "Authelia service not found in docker-compose.yml"
        return 1
    fi
    
    # Check if Authelia config files exist
    if [ ! -f "docker/authelia/configuration.yml" ]; then
        log_error "Authelia Docker config not found"
        return 1
    fi
    
    if [ ! -f "docker/authelia/users_database.yml" ]; then
        log_error "Authelia Docker users database not found"
        return 1
    fi
    
    # Check if authelia_data volume exists
    if ! grep -q "authelia_data:" docker-compose.yml; then
        log_error "Authelia data volume not found in docker-compose.yml"
        return 1
    fi
    
    log_success "Docker Compose integration verified"
    return 0
}

# Test 3: Check bootstrap script updates
test_bootstrap_integration() {
    log_info "Test 3: Checking bootstrap script integration..."
    
    # Check if bootstrap script mentions Authelia
    if ! grep -q "Authelia authentication" scripts/bootstrap-from-zero.sh; then
        log_error "Bootstrap script not updated with Authelia information"
        return 1
    fi
    
    log_success "Bootstrap script integration verified"
    return 0
}

# Test 4: Validate configuration files
test_configuration_validity() {
    log_info "Test 4: Validating configuration files..."
    
    # Check K8s config structure
    if ! grep -q "authelia/authelia:" k8s/authelia/authelia-deployment.yaml; then
        log_error "Invalid Authelia K8s deployment image"
        return 1
    fi
    
    # Check Docker config structure
    if ! grep -q "totp:" docker/authelia/configuration.yml; then
        log_error "Invalid Authelia Docker configuration (missing TOTP)"
        return 1
    fi
    
    if ! grep -q "webauthn:" docker/authelia/configuration.yml; then
        log_error "Invalid Authelia Docker configuration (missing WebAuthn)"
        return 1
    fi
    
    # Check users database
    if ! grep -q "admin:" docker/authelia/users_database.yml; then
        log_error "Invalid users database (missing admin user)"
        return 1
    fi
    
    log_success "Configuration files validated"
    return 0
}

# Test 5: Check documentation updates
test_documentation_updates() {
    log_info "Test 5: Checking documentation updates..."
    
    # Check if README mentions Authelia
    if ! grep -q "Authelia" README.md; then
        log_error "README not updated with Authelia information"
        return 1
    fi
    
    log_success "Documentation updates verified"
    return 0
}

# Run all tests
echo ""
TOTAL_TESTS=5
PASSED_TESTS=0

test_kubernetes_integration && ((PASSED_TESTS++))
test_docker_integration && ((PASSED_TESTS++))
test_bootstrap_integration && ((PASSED_TESTS++))
test_configuration_validity && ((PASSED_TESTS++))
test_documentation_updates && ((PASSED_TESTS++))

echo ""
echo "📊 Test Results: $PASSED_TESTS/$TOTAL_TESTS tests passed"

if [ "$PASSED_TESTS" -eq "$TOTAL_TESTS" ]; then
    log_success "🎉 All Authelia automation tests passed!"
    echo ""
    echo "✅ Authelia is now integrated into:"
    echo "   - Kubernetes cluster automation (kind-deploy-services.sh)"
    echo "   - Docker Compose automation (docker-compose.yml)"
    echo "   - Bootstrap scripts (bootstrap-from-zero.sh)"
    echo "   - Configuration management (K8s + Docker configs)"
    echo "   - Documentation (README.md)"
    echo ""
    echo "🚀 Ready for deployment:"
    echo "   Docker: docker-compose up -d"
    echo "   K8s: ./scripts/bootstrap-from-zero.sh"
    exit 0
else
    log_error "❌ Some Authelia automation tests failed!"
    exit 1
fi