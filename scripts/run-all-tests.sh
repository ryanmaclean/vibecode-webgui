#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

set -e

# Master Test Runner
# Orchestrates all component tests across all environments

# Initialize log aggregation
init_log_aggregation


# Source Datadog logging library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/datadog-logging.sh"

dd_info "🧪 VibeCode Master Test Suite" "script:run-all-tests"
echo "============================="
echo "Running comprehensive tests for all components across all deployment methods"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Test suite tracking
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0

BASE_DIR="/Users/ryan.maclean/vibecode-webgui"
TEST_DIR="$BASE_DIR/tests"
SCRIPTS_DIR="$BASE_DIR/scripts"

# Helper functions
run_test_suite() {
    local suite_name="$1"
    local script_path="$2"
    local description="$3"

    echo -e "\n${CYAN}📋 Test Suite: $suite_name${NC}"
    echo -e "${BLUE}Description: $description${NC}"
    echo "Script: $script_path"
    echo "────────────────────────────────────────────────────"

    ((TOTAL_SUITES++))
    dd_info "Starting test suite: $suite_name" "script:run-all-tests,suite:$suite_name"

    if [ -x "$script_path" ]; then
        if "$script_path"; then
            echo -e "${GREEN}✅ $suite_name: PASSED${NC}"
            dd_info "Test suite passed: $suite_name" "script:run-all-tests,suite:$suite_name,status:pass"
            ((PASSED_SUITES++))
        else
            echo -e "${RED}❌ $suite_name: FAILED${NC}"
            dd_error "Test suite failed: $suite_name" "script:run-all-tests,suite:$suite_name,status:fail"
            ((FAILED_SUITES++))
        fi
    else
        echo -e "${RED}❌ $suite_name: SCRIPT NOT EXECUTABLE${NC}"
        dd_error "Test suite script not executable: $suite_name" "script:run-all-tests,suite:$suite_name,status:not_executable"
        ((FAILED_SUITES++))
    fi
}

# Display test matrix
echo -e "\n${PURPLE}🎯 Test Matrix Overview${NC}"
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

echo -e "\n${PURPLE}════════════════════════════════════════${NC}"
echo -e "${PURPLE}         MASTER TEST RESULTS              ${NC}"
echo -e "${PURPLE}════════════════════════════════════════${NC}"

echo -e "\n${BLUE}Test Suite Summary:${NC}"
echo "┌─────────────────────────┬──────────┬────────┐"
echo "│ Test Suite              │ Status   │ Result │"
echo "├─────────────────────────┼──────────┼────────┤"

# Create result matrix
declare -a suite_names=("Local Development" "Docker Compose" "KIND Cluster" "K8s Manifests" "Integration Tests" "Complete Pipeline" "All Components")
declare -a suite_results=()

# This would be populated by actual test results
for suite in "${suite_names[@]}"; do
    echo "│ $(printf '%-23s' "$suite") │ Executed │ Status │"
done

echo "└─────────────────────────┴──────────┴────────┘"

echo -e "\n${BLUE}Overall Statistics:${NC}"
echo "┌────────────────────────┬─────────┐"
printf "│ %-22s │ %7s │\n" "Total Test Suites" "$TOTAL_SUITES"
printf "│ %-22s │ %7s │\n" "Passed Suites" "$PASSED_SUITES"
printf "│ %-22s │ %7s │\n" "Failed Suites" "$FAILED_SUITES"
printf "│ %-22s │ %6.1f%% │\n" "Success Rate" "$(echo "scale=1; $PASSED_SUITES * 100 / $TOTAL_SUITES" | bc -l)"
echo "└────────────────────────┴─────────┘"

# Component Status Matrix
echo -e "\n${PURPLE}🎯 Component Readiness Matrix:${NC}"
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
echo -e "\n${PURPLE}🎯 FINAL VERDICT:${NC}"

# Send metrics to Datadog
dd_metric "test.suites.total" "$TOTAL_SUITES" "count" "script:run-all-tests"
dd_metric "test.suites.passed" "$PASSED_SUITES" "count" "script:run-all-tests"
dd_metric "test.suites.failed" "$FAILED_SUITES" "count" "script:run-all-tests"

if [ $FAILED_SUITES -eq 0 ]; then
    dd_metric "test.suites.success_rate" "100" "gauge" "script:run-all-tests"
    dd_info "ALL TEST SUITES PASSED - Production ready" "script:run-all-tests,status:success"
    echo -e "${GREEN}✅ ALL TEST SUITES PASSED!${NC}"
    echo -e "${GREEN}🚀 VibeCode is ready for production deployment!${NC}"
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
    success_rate=$(echo "scale=1; $PASSED_SUITES * 100 / $TOTAL_SUITES" | bc -l)
    dd_metric "test.suites.success_rate" "$success_rate" "gauge" "script:run-all-tests"
    dd_error "SOME TEST SUITES FAILED - Not production ready" "script:run-all-tests,status:failure,failed_count:$FAILED_SUITES"
    echo -e "${RED}❌ SOME TEST SUITES FAILED!${NC}"
    echo -e "${YELLOW}⚠️  Please fix the failing tests before production deployment.${NC}"
    echo ""
    echo "🔧 Next Steps:"
    echo "  1. Review failed test output above"
    echo "  2. Fix the identified issues"
    echo "  3. Re-run the failed test suites"
    echo "  4. Ensure all tests pass before deployment"
fi

echo -e "\n${BLUE}📋 Test Artifacts:${NC}"
echo "  📂 Test Scripts: $TEST_DIR/"
echo "  🔧 Deployment Scripts: $SCRIPTS_DIR/"
echo "  📊 Logs: Check individual test outputs above"
echo "  🌐 KIND Cluster: kubectl config use-context kind-vibecode-test"

exit $FAILED_SUITES