#!/usr/bin/env bash
# Master Test Runner
# Orchestrates all component tests across all environments

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/bootstrap.sh"
bootstrap_init "${SCRIPT_DIR}"
# shellcheck disable=SC1091
source "${LIB_DIR}/logging.sh"

REPO_ROOT="$(cd "${SCRIPTS_ROOT}/.." && pwd)"
cd "$REPO_ROOT"

log_step "🧪 VibeCode Master Test Suite"
echo "Running comprehensive tests for all components across all deployment methods"

# Test suite tracking
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0

TEST_DIR="$REPO_ROOT/tests"
SCRIPTS_DIR="$REPO_ROOT/scripts"

# Helper functions
run_test_suite() {
    local suite_name="$1"
    local script_path="$2"
    local description="$3"
    
    log_step "📋 Test Suite: $suite_name"
    log_info "Description: $description"
    echo "Script: $script_path"
    echo "────────────────────────────────────────────────────"
    
    ((TOTAL_SUITES++))
    
    if [ -x "$script_path" ]; then
        if "$script_path"; then
            log_success "✅ $suite_name: PASSED"
            ((PASSED_SUITES++))
        else
            log_error "❌ $suite_name: FAILED"
            ((FAILED_SUITES++))
        fi
    else
        log_error "❌ $suite_name: SCRIPT NOT EXECUTABLE"
        ((FAILED_SUITES++))
    fi
}

# Display test matrix
echo -e "\n${PURPLE}🎯 Test Matrix Overview"
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│                    VIBECODE TEST MATRIX                     │"
echo "├─────────────────────────────────────────────────────────────┤"
echo "│ Test Suite           │ Local │ Docker │ KIND  │ K8s  │ TF  │"
echo "│                      │ Dev   │ Compose│       │      │     │"
echo "├─────────────────────────────────────────────────────────────┤"
echo "│ 1. Local Development │   ✓   │   -    │   -   │  -   │  -  │"
echo "│ 2. Docker Compose    │   -   │   ✓    │   -   │  -   │  -  │"
echo "│ 3. KIND Cluster      │   -   │   -    │   ✓   │  ✓   │  -  │"
echo "│ 4. K8s Manifests     │   -   │   -    │   -   │  ✓   │  ✓  │"
echo "│ 5. Integration       │   ✓   │   ✓    │   ✓   │  ✓   │  ✓  │"
echo "│ 6. Complete Pipeline │   ✓   │   ✓    │   ✓   │  ✓   │  ✓  │"
echo "└─────────────────────────────────────────────────────────────┘"

# Test Suite 1: Local Development Environment
run_test_suite \
    "Local Development" \
    "$TEST_DIR/local-dev-tests.sh" \
    "Tests Node.js, npm, Astro build, and local development server"

# Test Suite 2: Docker Compose Environment
run_test_suite \
    "Docker Compose" \
    "$TEST_DIR/docker-compose-tests.sh" \
    "Tests all services in Docker Compose: docs, PostgreSQL, Redis, monitoring"

# Test Suite 3: KIND Cluster
run_test_suite \
    "KIND Cluster" \
    "$TEST_DIR/kind-cluster-tests.sh" \
    "Tests Kubernetes deployment in KIND: pods, services, scaling, monitoring"

# Test Suite 4: Kubernetes Manifests
run_test_suite \
    "Kubernetes Manifests" \
    "$TEST_DIR/kubernetes-manifests-tests.sh" \
    "Tests YAML manifests, Helm charts, Terraform configurations"

# Test Suite 5: Integration Tests
run_test_suite \
    "Integration Tests" \
    "$TEST_DIR/integration-tests.sh" \
    "Tests cross-component functionality and environment parity"

# Test Suite 6: Complete Deployment Pipeline
run_test_suite \
    "Complete Pipeline" \
    "$SCRIPTS_DIR/test-complete-deployment.sh" \
    "Tests entire deployment pipeline from Docker to Azure readiness"

# Test Suite 7: All Components (Master)
run_test_suite \
    "All Components" \
    "$SCRIPTS_DIR/test-all-components.sh" \
    "Comprehensive test matrix for all components across all environments"

echo -e "\n${PURPLE}════════════════════════════════════════"
echo -e "${PURPLE}         MASTER TEST RESULTS              "
echo -e "${PURPLE}════════════════════════════════════════"

log_step "Test Suite Summary:"
echo "┌─────────────────────────┬──────────┬────────┐"
echo "│ Test Suite              │ Status   │ Result │"
echo "├─────────────────────────┼──────────┼────────┤"

# Create result matrix
declare -a suite_names=("Local Development" "Docker Compose" "KIND Cluster" "K8s Manifests" "Integration Tests" "Complete Pipeline" "All Components")

# This would be populated by actual test results
for suite in "${suite_names[@]}"; do
    echo "│ $(printf '%-23s' "$suite") │ Executed │ Status │"
done

echo "└─────────────────────────┴──────────┴────────┘"

log_step "Overall Statistics:"
echo "┌────────────────────────┬─────────┐"
printf "│ %-22s │ %7s │\n" "Total Test Suites" "$TOTAL_SUITES"
printf "│ %-22s │ %7s │\n" "Passed Suites" "$PASSED_SUITES"
printf "│ %-22s │ %7s │\n" "Failed Suites" "$FAILED_SUITES"
printf "│ %-22s │ %6.1f%% │\n" "Success Rate" "$(echo "scale=1; $PASSED_SUITES * 100 / $TOTAL_SUITES" | bc -l)"
echo "└────────────────────────┴─────────┘"

# Component Status Matrix
echo -e "\n${PURPLE}🎯 Component Readiness Matrix:"
echo "┌─────────────────┬─────────┬─────────────┬──────┬─────┬──────────┐"
echo "│ Component       │ Local   │ Docker      │ KIND │ K8s │ Status   │"
echo "│                 │ Dev     │ Compose     │      │     │          │"
echo "├─────────────────┼─────────┼─────────────┼──────┼─────┼──────────┤"

if [ $FAILED_SUITES -eq 0 ]; then
    echo -e "│ Docs Service    │ ${GREEN}✅${NC}       │ ${GREEN}✅${NC}           │ ${GREEN}✅${NC}    │ ${GREEN}✅${NC}   │ ${GREEN}READY${NC}    │"
    echo -e "│ Monitoring      │ ${YELLOW}N/A${NC}     │ ${GREEN}✅${NC}           │ ${GREEN}✅${NC}    │ ${GREEN}✅${NC}   │ ${GREEN}READY${NC}    │"
    echo -e "│ Database        │ ${GREEN}✅${NC}       │ ${GREEN}✅${NC}           │ ${YELLOW}Ext${NC}  │ ${GREEN}✅${NC}   │ ${GREEN}READY${NC}    │"
    echo -e "│ Security        │ ${GREEN}✅${NC}       │ ${GREEN}✅${NC}           │ ${GREEN}✅${NC}    │ ${GREEN}✅${NC}   │ ${GREEN}READY${NC}    │"
    echo -e "│ Scaling         │ ${YELLOW}N/A${NC}     │ ${YELLOW}Manual${NC}      │ ${GREEN}✅${NC}    │ ${GREEN}✅${NC}   │ ${GREEN}READY${NC}    │"
    echo -e "│ CI/CD           │ ${GREEN}✅${NC}       │ ${GREEN}✅${NC}           │ ${GREEN}✅${NC}    │ ${GREEN}✅${NC}   │ ${GREEN}READY${NC}    │"
else
    echo -e "│ Components      │ ${YELLOW}PARTIAL${NC} │ ${YELLOW}PARTIAL${NC}     │ ${YELLOW}PARTIAL${NC}│ ${YELLOW}PARTIAL${NC}│ ${RED}ISSUES${NC}   │"
fi
echo "└─────────────────┴─────────┴─────────────┴──────┴─────┴──────────┘"

# Final verdict
echo -e "\n${PURPLE}🎯 FINAL VERDICT:"
if [ $FAILED_SUITES -eq 0 ]; then
    log_success "✅ ALL TEST SUITES PASSED!"
    log_success "🚀 VibeCode is ready for production deployment!"
    echo ""
    echo "✨ Achievements:"
    echo "  📚 Documentation system fully tested"
    echo "  🐳 Docker containerization validated"
    echo "  ☸️  Kubernetes deployments verified"
    echo "  📊 Monitoring stack operational"
    echo "  🔒 Security configurations validated"
    echo "  ⚖️  Scaling mechanisms tested"
    echo "  🔄 CI/CD pipeline verified"
    echo "  🌐 Azure deployment ready"
    echo ""
    echo "🎉 Ready for 'terraform apply' to deploy to Azure!"
else
    log_error "❌ SOME TEST SUITES FAILED!"
    log_warn "⚠️  Please fix the failing tests before production deployment."
    echo ""
    echo "🔧 Next Steps:"
    echo "  1. Review failed test output above"
    echo "  2. Fix the identified issues"
    echo "  3. Re-run the failed test suites"
    echo "  4. Ensure all tests pass before deployment"
fi

log_step "📋 Test Artifacts:"
echo "  📂 Test Scripts: $TEST_DIR/"
echo "  🔧 Deployment Scripts: $SCRIPTS_DIR/"
echo "  📊 Logs: Check individual test outputs above"
echo "  🌐 KIND Cluster: kubectl config use-context kind-vibecode-test"

exit $FAILED_SUITES