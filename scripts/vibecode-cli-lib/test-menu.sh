#!/bin/bash
# VibeCode CLI - Testing & Validation Menu
# Provides access to all testing and validation operations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SCRIPTS_DIR="$PROJECT_ROOT/scripts"

# Helper functions
print_header() {
    echo -e "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${GREEN}$1${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"
}

print_section() {
    echo -e "\n${BLUE}▸ $1${NC}"
    echo -e "${BLUE}─────────────────────────────────────────────${NC}"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Menu display functions
show_test_menu() {
    clear
    print_header "VibeCode Testing & Validation Menu"

    echo -e "${CYAN}1.${NC} Unit & Component Tests"
    echo -e "${CYAN}2.${NC} Integration Tests"
    echo -e "${CYAN}3.${NC} E2E & Accessibility Tests"
    echo -e "${CYAN}4.${NC} Validation & Verification"
    echo -e "${CYAN}5.${NC} Comprehensive Test Suites"
    echo -e "${CYAN}6.${NC} Back to Main Menu"
    echo ""
    echo -n "Select an option [1-6]: "
}

show_unit_tests_menu() {
    clear
    print_header "Unit & Component Tests"

    print_section "All Tests"
    echo -e "  ${CYAN}1.${NC} Run All Tests"
    echo -e "  ${CYAN}2.${NC} Run Tests (Standard)"
    echo -e "  ${CYAN}3.${NC} Test All Components"

    print_section "Component-Specific Tests"
    echo -e "  ${CYAN}4.${NC} Test CNM Integration"
    echo -e "  ${CYAN}5.${NC} Test LiteLLM Integration"
    echo -e "  ${CYAN}6.${NC} Test Code Server Editors"
    echo -e "  ${CYAN}7.${NC} Test AgentAPI"

    print_section "Database Tests"
    echo -e "  ${CYAN}8.${NC} Test DBM Setup"
    echo -e "  ${CYAN}9.${NC} Test Database Scaling"
    echo -e "  ${CYAN}10.${NC} Test Vector DB Migration"
    echo -e "  ${CYAN}11.${NC} Test Vector Migration (Dev)"
    echo -e "  ${CYAN}12.${NC} Test Vector Migration Edge Cases"
    echo -e "  ${CYAN}13.${NC} Test Vector Migration Large Dataset"
    echo -e "  ${CYAN}14.${NC} Test Vector Migration Rollback"
    echo -e "  ${CYAN}15.${NC} Test Vector Error Handling"
    echo -e "  ${CYAN}16.${NC} Test Vector Migration Utility"

    print_section "Monitoring & Observability"
    echo -e "  ${CYAN}17.${NC} Test Monitoring"
    echo -e "  ${CYAN}18.${NC} Test Health Endpoints"
    echo -e "  ${CYAN}19.${NC} Test Datadog MUSL Build"
    echo -e "  ${CYAN}20.${NC} Run DBM Scenarios"

    echo ""
    echo -e "${CYAN}0.${NC} Back to Testing Menu"
    echo ""
    echo -n "Select an option: "
}

show_integration_tests_menu() {
    clear
    print_header "Integration Tests"

    print_section "Kubernetes Integration"
    echo -e "  ${CYAN}1.${NC} Test K8s Complete"
    echo -e "  ${CYAN}2.${NC} Test K8s Core Functionality"
    echo -e "  ${CYAN}3.${NC} Test K8s Health Probes"
    echo -e "  ${CYAN}4.${NC} Test KIND Deployment"
    echo -e "  ${CYAN}5.${NC} Test Code Server KIND"

    print_section "Deployment Integration"
    echo -e "  ${CYAN}6.${NC} Test Complete Deployment"
    echo -e "  ${CYAN}7.${NC} Test Without Docker"
    echo -e "  ${CYAN}8.${NC} Test Docs Deployment"
    echo -e "  ${CYAN}9.${NC} Test Docs"

    print_section "Automation Integration"
    echo -e "  ${CYAN}10.${NC} Test Full Automation"
    echo -e "  ${CYAN}11.${NC} Test GitOps Automation"
    echo -e "  ${CYAN}12.${NC} Test Authelia Automation"

    print_section "Optimization Tests"
    echo -e "  ${CYAN}13.${NC} Test Optimizations (Simple)"
    echo -e "  ${CYAN}14.${NC} Test Experiments Validation"

    echo ""
    echo -e "${CYAN}0.${NC} Back to Testing Menu"
    echo ""
    echo -n "Select an option: "
}

show_e2e_tests_menu() {
    clear
    print_header "E2E & Accessibility Tests"

    print_section "Accessibility"
    echo -e "  ${CYAN}1.${NC} Run Accessibility Tests"

    print_section "Performance"
    echo -e "  ${CYAN}2.${NC} Run Performance Tests"

    echo ""
    echo -e "${CYAN}0.${NC} Back to Testing Menu"
    echo ""
    echo -n "Select an option: "
}

show_validation_menu() {
    clear
    print_header "Validation & Verification"

    print_section "Setup & Configuration Validation"
    echo -e "  ${CYAN}1.${NC} Validate Complete Setup"
    echo -e "  ${CYAN}2.${NC} Validate Helm"
    echo -e "  ${CYAN}3.${NC} Validate GitOps Setup"
    echo -e "  ${CYAN}4.${NC} Validate Environment Config"
    echo -e "  ${CYAN}5.${NC} Validate Database Config"

    print_section "Deployment Validation"
    echo -e "  ${CYAN}6.${NC} Validate Deployment Readiness"
    echo -e "  ${CYAN}7.${NC} Validate Deployment Workflows"
    echo -e "  ${CYAN}8.${NC} Validate Web Testing Workflows"

    print_section "Container & Docker Validation"
    echo -e "  ${CYAN}9.${NC} Validate ARM64 Dockerfile"
    echo -e "  ${CYAN}10.${NC} Validate Container Optimizations"
    echo -e "  ${CYAN}11.${NC} Validate Dockerfile Optimization"

    print_section "Monitoring & Health Validation"
    echo -e "  ${CYAN}12.${NC} Validate Healthchecks"
    echo -e "  ${CYAN}13.${NC} Validate Postgres Monitoring"
    echo -e "  ${CYAN}14.${NC} Validate DBM APM Connection"

    print_section "System Verification"
    echo -e "  ${CYAN}15.${NC} Verify Setup"
    echo -e "  ${CYAN}16.${NC} Verify Onboarding"
    echo -e "  ${CYAN}17.${NC} Verify Environment Consolidation"
    echo -e "  ${CYAN}18.${NC} Verify Datadog DBM"
    echo -e "  ${CYAN}19.${NC} Verify DNS & SSL"
    echo -e "  ${CYAN}20.${NC} Verify Docker Go Fix"
    echo -e "  ${CYAN}21.${NC} Verify Goose"
    echo -e "  ${CYAN}22.${NC} Verify LLM Observability"

    echo ""
    echo -e "${CYAN}0.${NC} Back to Testing Menu"
    echo ""
    echo -n "Select an option: "
}

show_comprehensive_menu() {
    clear
    print_header "Comprehensive Test Suites"

    print_section "Full Test Suites"
    echo -e "  ${CYAN}1.${NC} Comprehensive K8s Tests"
    echo -e "  ${CYAN}2.${NC} Comprehensive KIND Testing"
    echo -e "  ${CYAN}3.${NC} Comprehensive Validation"

    echo ""
    echo -e "${CYAN}0.${NC} Back to Testing Menu"
    echo ""
    echo -n "Select an option: "
}

# Unit tests handler
handle_unit_tests_menu() {
    local choice

    while true; do
        show_unit_tests_menu
        read -r choice

        case $choice in
            1)
                print_info "Running all tests..."
                "$SCRIPTS_DIR/run-all-tests.sh"
                ;;
            2)
                print_info "Running standard tests..."
                "$SCRIPTS_DIR/run-tests.sh"
                ;;
            3)
                print_info "Testing all components..."
                "$SCRIPTS_DIR/test-all-components.sh"
                ;;
            4)
                print_info "Testing CNM integration..."
                "$SCRIPTS_DIR/test-cnm-integration.sh"
                ;;
            5)
                print_info "Testing LiteLLM integration..."
                "$SCRIPTS_DIR/test-litellm-integration.sh"
                ;;
            6)
                print_info "Testing code server editors..."
                "$SCRIPTS_DIR/test-code-server-editors.sh"
                ;;
            7)
                print_info "Testing AgentAPI..."
                "$SCRIPTS_DIR/run-agentapi-tests.sh"
                ;;
            8)
                print_info "Testing DBM setup..."
                "$SCRIPTS_DIR/test-dbm-setup.sh"
                ;;
            9)
                print_info "Testing database scaling..."
                "$SCRIPTS_DIR/test-database-scaling.sh"
                ;;
            10)
                print_info "Testing vector DB migration..."
                "$SCRIPTS_DIR/test-vector-db-migration.sh"
                ;;
            11)
                print_info "Testing vector migration (dev)..."
                "$SCRIPTS_DIR/test-vector-migration-dev.sh"
                ;;
            12)
                print_info "Testing vector migration edge cases..."
                "$SCRIPTS_DIR/test-vector-migration-edge-cases.sh"
                ;;
            13)
                print_info "Testing vector migration large dataset..."
                "$SCRIPTS_DIR/test-vector-migration-large-dataset.sh"
                ;;
            14)
                print_info "Testing vector migration rollback..."
                "$SCRIPTS_DIR/test-vector-migration-rollback.sh"
                ;;
            15)
                print_info "Testing vector error handling..."
                "$SCRIPTS_DIR/test-vector-error-handling.sh"
                ;;
            16)
                print_info "Testing vector migration utility..."
                "$SCRIPTS_DIR/test-vector-migration-utility.sh"
                ;;
            17)
                print_info "Testing monitoring..."
                "$SCRIPTS_DIR/test-monitoring.sh"
                ;;
            18)
                print_info "Testing health endpoints..."
                "$SCRIPTS_DIR/test-health-endpoints.sh"
                ;;
            19)
                print_info "Testing Datadog MUSL build..."
                "$SCRIPTS_DIR/test-datadog-musl-build.sh"
                ;;
            20)
                print_info "Running DBM scenarios..."
                "$SCRIPTS_DIR/run-dbm-scenarios.sh"
                ;;
            0)
                return
                ;;
            *)
                print_error "Invalid option. Please try again."
                ;;
        esac

        if [ "$choice" != "0" ]; then
            echo ""
            read -p "Press Enter to continue..."
        fi
    done
}

# Integration tests handler
handle_integration_tests_menu() {
    local choice

    while true; do
        show_integration_tests_menu
        read -r choice

        case $choice in
            1)
                print_info "Testing K8s complete..."
                "$SCRIPTS_DIR/test-k8s-complete.sh"
                ;;
            2)
                print_info "Testing K8s core functionality..."
                "$SCRIPTS_DIR/test-k8s-core-functionality.sh"
                ;;
            3)
                print_info "Testing K8s health probes..."
                "$SCRIPTS_DIR/test-k8s-health-probes.sh"
                ;;
            4)
                print_info "Testing KIND deployment..."
                "$SCRIPTS_DIR/test-kind-deployment.sh"
                ;;
            5)
                print_info "Testing code server KIND..."
                "$SCRIPTS_DIR/test-code-server-kind.sh"
                ;;
            6)
                print_info "Testing complete deployment..."
                "$SCRIPTS_DIR/test-complete-deployment.sh"
                ;;
            7)
                print_info "Testing without Docker..."
                "$SCRIPTS_DIR/test-without-docker.sh"
                ;;
            8)
                print_info "Testing docs deployment..."
                "$SCRIPTS_DIR/test-docs-deployment.sh"
                ;;
            9)
                print_info "Testing docs..."
                "$SCRIPTS_DIR/test-docs.sh"
                ;;
            10)
                print_info "Testing full automation..."
                "$SCRIPTS_DIR/test-full-automation.sh"
                ;;
            11)
                print_info "Testing GitOps automation..."
                "$SCRIPTS_DIR/test-gitops-automation.sh"
                ;;
            12)
                print_info "Testing Authelia automation..."
                "$SCRIPTS_DIR/test-authelia-automation.sh"
                ;;
            13)
                print_info "Testing optimizations (simple)..."
                "$SCRIPTS_DIR/test-optimizations-simple.sh"
                ;;
            14)
                print_info "Testing experiments validation..."
                "$SCRIPTS_DIR/test-experiments-validation.sh"
                ;;
            0)
                return
                ;;
            *)
                print_error "Invalid option. Please try again."
                ;;
        esac

        if [ "$choice" != "0" ]; then
            echo ""
            read -p "Press Enter to continue..."
        fi
    done
}

# E2E tests handler
handle_e2e_tests_menu() {
    local choice

    while true; do
        show_e2e_tests_menu
        read -r choice

        case $choice in
            1)
                print_info "Running accessibility tests..."
                "$SCRIPTS_DIR/run-accessibility-tests.sh"
                ;;
            2)
                print_info "Running performance tests..."
                "$SCRIPTS_DIR/run_perf_tests.sh"
                ;;
            0)
                return
                ;;
            *)
                print_error "Invalid option. Please try again."
                ;;
        esac

        if [ "$choice" != "0" ]; then
            echo ""
            read -p "Press Enter to continue..."
        fi
    done
}

# Validation handler
handle_validation_menu() {
    local choice

    while true; do
        show_validation_menu
        read -r choice

        case $choice in
            1)
                print_info "Validating complete setup..."
                "$SCRIPTS_DIR/validate-complete-setup.sh"
                ;;
            2)
                print_info "Validating Helm..."
                "$SCRIPTS_DIR/validate-helm.sh"
                ;;
            3)
                print_info "Validating GitOps setup..."
                "$SCRIPTS_DIR/validate-gitops-setup.sh"
                ;;
            4)
                print_info "Validating environment config..."
                "$SCRIPTS_DIR/validate-env-config.sh"
                ;;
            5)
                print_info "Validating database config..."
                "$SCRIPTS_DIR/validate-database-config.sh"
                ;;
            6)
                print_info "Validating deployment readiness..."
                "$SCRIPTS_DIR/validate-deployment-readiness.sh"
                ;;
            7)
                print_info "Validating deployment workflows..."
                "$SCRIPTS_DIR/validate-deployment-workflows.sh"
                ;;
            8)
                print_info "Validating web testing workflows..."
                "$SCRIPTS_DIR/validate-web-testing-workflows.sh"
                ;;
            9)
                print_info "Validating ARM64 Dockerfile..."
                "$SCRIPTS_DIR/validate-arm64-dockerfile.sh"
                ;;
            10)
                print_info "Validating container optimizations..."
                "$SCRIPTS_DIR/validate-container-optimizations.sh"
                ;;
            11)
                print_info "Validating Dockerfile optimization..."
                "$SCRIPTS_DIR/validate-dockerfile-optimization.sh"
                ;;
            12)
                print_info "Validating healthchecks..."
                "$SCRIPTS_DIR/validate-healthchecks.sh"
                ;;
            13)
                print_info "Validating Postgres monitoring..."
                "$SCRIPTS_DIR/validate-postgres-monitoring.sh"
                ;;
            14)
                print_info "Validating DBM APM connection..."
                "$SCRIPTS_DIR/validate-dbm-apm-connection.sh"
                ;;
            15)
                print_info "Verifying setup..."
                "$SCRIPTS_DIR/verify-setup.sh"
                ;;
            16)
                print_info "Verifying onboarding..."
                "$SCRIPTS_DIR/verify-onboarding.sh"
                ;;
            17)
                print_info "Verifying environment consolidation..."
                "$SCRIPTS_DIR/verify-env-consolidation.sh"
                ;;
            18)
                print_info "Verifying Datadog DBM..."
                "$SCRIPTS_DIR/verify-datadog-dbm.sh"
                ;;
            19)
                print_info "Verifying DNS & SSL..."
                "$SCRIPTS_DIR/verify-dns-ssl.sh"
                ;;
            20)
                print_info "Verifying Docker Go fix..."
                "$SCRIPTS_DIR/verify-docker-go-fix.sh"
                ;;
            21)
                print_info "Verifying Goose..."
                "$SCRIPTS_DIR/verify-goose.sh"
                ;;
            22)
                print_info "Verifying LLM observability..."
                "$SCRIPTS_DIR/verify-llm-observability.sh"
                ;;
            0)
                return
                ;;
            *)
                print_error "Invalid option. Please try again."
                ;;
        esac

        if [ "$choice" != "0" ]; then
            echo ""
            read -p "Press Enter to continue..."
        fi
    done
}

# Comprehensive tests handler
handle_comprehensive_menu() {
    local choice

    while true; do
        show_comprehensive_menu
        read -r choice

        case $choice in
            1)
                print_info "Running comprehensive K8s tests..."
                "$SCRIPTS_DIR/comprehensive-k8s-tests.sh"
                ;;
            2)
                print_info "Running comprehensive KIND testing..."
                "$SCRIPTS_DIR/comprehensive-kind-testing.sh"
                ;;
            3)
                print_info "Running comprehensive validation..."
                "$SCRIPTS_DIR/comprehensive-validation.sh"
                ;;
            0)
                return
                ;;
            *)
                print_error "Invalid option. Please try again."
                ;;
        esac

        if [ "$choice" != "0" ]; then
            echo ""
            read -p "Press Enter to continue..."
        fi
    done
}

# Main menu handler
main() {
    local choice

    while true; do
        show_test_menu
        read -r choice

        case $choice in
            1)
                handle_unit_tests_menu
                ;;
            2)
                handle_integration_tests_menu
                ;;
            3)
                handle_e2e_tests_menu
                ;;
            4)
                handle_validation_menu
                ;;
            5)
                handle_comprehensive_menu
                ;;
            6)
                print_info "Returning to main menu..."
                exit 0
                ;;
            *)
                print_error "Invalid option. Please try again."
                read -p "Press Enter to continue..."
                ;;
        esac
    done
}

# Run main menu if script is executed directly
if [ "${BASH_SOURCE[0]}" -eq "$0" ]; then
    main
fi
